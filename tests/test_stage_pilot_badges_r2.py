"""Exact-byte and provenance gates for private badge object storage."""
import hashlib
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import stage_pilot_badges_r2 as stage


class Response:
    url = 'https://club.example/badge.png'
    headers = {'Content-Type': 'image/png'}

    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def raise_for_status(self):
        pass

    def iter_content(self, _):
        yield self.data


class StageTest(unittest.TestCase):
    def setUp(self):
        self.data = b'\x89PNG\r\n\x1a\nreviewed badge bytes'
        self.badge = {'club_id': 250, 'club_name': 'Cray Wanderers',
                      'logo_url': Response.url, 'logo_sha256': hashlib.sha256(self.data).hexdigest(),
                      'logo_status': 'pilot_verified', 'logo_source': 'official_site_image',
                      'logo_updated_at': '2026-09-26', 'rights_status': 'legal_basis_not_reviewed',
                      'review_basis': 'Independent identity review'}
        self.directory = {'clubs': [{'club_id': 250, 'club_name': 'Cray Wanderers'}],
                          'team_club_links': []}
        self.manifest = {'schema_version': 1, 'scope': 'private_pilot', 'badges': [self.badge]}

    def test_only_approved_identity_with_provenance_can_stage(self):
        self.assertEqual(stage.approvals(self.directory, self.manifest), [self.badge])
        for update in ({'club_name': 'Wrong club'}, {'logo_status': 'unverified'},
                       {'rights_status': ''}, {'review_basis': ''}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                stage.approvals(self.directory, {**self.manifest,
                    'badges': [{**self.badge, **update}]})

    def test_download_hash_mime_and_readback(self):
        commands = []
        def run(command, *, check):
            self.assertTrue(check)
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        stage.upload_badges([self.badge], lambda *a, **k: Response(self.data), run)
        self.assertEqual(len(commands), 2)
        self.assertIn(f"250/{self.badge['logo_sha256']}", commands[0][6])
        with self.assertRaisesRegex(ValueError, 'changed since review'):
            stage.fetch_reviewed(self.badge, lambda *a, **k: Response(self.data + b'changed'))
        with self.assertRaisesRegex(ValueError, 'unsupported badge image format'):
            stage.fetch_reviewed({**self.badge, 'logo_sha256': hashlib.sha256(b'<svg/>').hexdigest()},
                                 lambda *a, **k: Response(b'<svg/>'))

    def test_private_badge_is_only_read_back_from_r2(self):
        badge = {**self.badge, 'logo_source': 'club_supplied_private'}
        commands = []
        def run(command, *, check):
            commands.append(command)
            pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        stage.upload_badges([badge], lambda *a, **k: self.fail('private fetch'), run)
        self.assertEqual(len(commands), 1)
        self.assertIn('get', commands[0])
        self.assertNotIn('put', commands[0])
        def wrong(command, *, check):
            pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data + b'changed')
        with self.assertRaisesRegex(ValueError, 'differ from reviewed PNG'):
            stage.upload_badges([badge], lambda *a, **k: self.fail('private fetch'), wrong)


if __name__ == '__main__':
    unittest.main()
