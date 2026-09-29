"""Exact-byte and provenance gates for private badge object storage."""
import hashlib
import pathlib
import sys
import unittest
from unittest.mock import patch


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

    def test_official_snapshot_reads_exact_approved_r2_png_without_mutable_cdn(self):
        badge = {**self.badge, 'club_id': 520, 'logo_source': 'official_source_snapshot_private'}
        commands = []
        def run(command, *, check):
            commands.append(command)
            pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        stage.upload_badges([badge], lambda *a, **k: self.fail('mutable CDN fetched'), run)
        self.assertEqual(len(commands), 1)
        self.assertIn('get', commands[0])
        self.assertNotIn('put', commands[0])

    def test_private_derivative_fetches_original_and_uploads_exact_reviewed_png(self):
        source = b'\x89PNG\r\n\x1a\noriginal official bytes'
        badge = {**self.badge, 'logo_source': 'official_source_transparency_derivative_private',
                 'original_source_url': 'https://club.example/original.png',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        commands = []
        urls = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        def get(url, **_):
            urls.append(url)
            return Response(source)
        with patch('pilot_badge_transparency.transparent_png', return_value=self.data):
            stage.upload_badges([badge], get, run)
        self.assertEqual(urls, [badge['original_source_url']])
        self.assertEqual(len(commands), 2)
        self.assertIn('put', commands[0])
        self.assertIn('get', commands[1])
        with patch('pilot_badge_transparency.transparent_png', return_value=b'wrong'):
            with self.assertRaisesRegex(ValueError, 'transparency bytes differ'):
                stage.upload_badges([badge], get, run)

    def test_pinned_pitchero_png_with_jpeg_header(self):
        source = b'\x89PNG\r\n\x1a\nexact approved original'
        badge = {**self.badge, 'club_id': 271,
                 'logo_source': 'official_source_transparency_derivative_private',
                 'original_source_url': 'https://images.pitchero.com/original.png',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        class Mislabelled(Response):
            headers = {'Content-Type': 'image/jpeg'}
        response = lambda *a, **k: Mislabelled(source)
        original = {**badge, 'logo_url': badge['original_source_url'],
                    'logo_sha256': badge['original_sha256']}
        with self.assertRaisesRegex(ValueError, 'inconsistent image MIME'):
            stage.fetch_reviewed(original, response)
        with patch('pilot_badge_transparency.transparent_png', return_value=self.data):
            stage.upload_badges([badge], response, lambda command, **k:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
                if 'get' in command else None)
        with self.assertRaisesRegex(ValueError, 'changed since review'):
            stage.fetch_reviewed({**original, 'logo_sha256': '0' * 64}, response,
                                 expected_mislabelled_type='image/jpeg')

    def test_blue_exterior_derivative_uses_pinned_official_bytes(self):
        source = b'\x89PNG\r\n\x1a\noriginal Teviot bytes'
        badge = {**self.badge, 'club_id': 333,
                 'logo_source': 'official_source_transparency_derivative_private',
                 'derivation': 'outer_blue_background_transparency_only',
                 'original_source_url': 'https://club.example/original.png',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        commands = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        with patch('pilot_badge_transparency.transparent_blue_exterior_png', return_value=self.data):
            stage.upload_badges([badge], lambda *a, **k: Response(source), run)
        self.assertEqual(len(commands), 2)
        self.assertIn('put', commands[0])
        with patch('pilot_badge_transparency.transparent_blue_exterior_png', return_value=b'wrong'):
            with self.assertRaisesRegex(ValueError, 'transparency bytes differ'):
                stage.upload_badges([badge], lambda *a, **k: Response(source), run)

    def test_vector_derivative_requires_exact_official_source_and_pinned_png(self):
        source = b'<svg xmlns="http://www.w3.org/2000/svg"/>'
        badge = {**self.badge, 'club_id': 240,
                 'logo_source': 'official_source_vector_raster_private',
                 'original_source_url': 'https://club.example/crest.svg',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        class VectorResponse(Response):
            headers = {'Content-Type': 'image/svg+xml'}
        commands = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        with patch('stage_pilot_badges_r2.Path.read_bytes', return_value=self.data):
            stage.upload_badges([badge], lambda *a, **k: VectorResponse(source), run)
        self.assertEqual(len(commands), 2)
        self.assertIn('put', commands[0])
        with self.assertRaisesRegex(ValueError, 'official vector changed'):
            stage.fetch_reviewed_vector({**badge, 'original_sha256': '0' * 64},
                                        lambda *a, **k: VectorResponse(source))
        with patch('stage_pilot_badges_r2.Path.read_bytes', return_value=self.data + b'wrong'):
            with self.assertRaisesRegex(ValueError, 'raster differs'):
                stage.upload_badges([badge], lambda *a, **k: VectorResponse(source), run)


if __name__ == '__main__':
    unittest.main()
