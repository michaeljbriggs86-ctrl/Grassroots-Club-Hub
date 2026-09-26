"""Data-only admission and revocation on a copy of the real directory schema."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch


ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('publish_pilot_badges', ROOT / 'scripts/publish_pilot_badges.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BadgePublisherTest(unittest.TestCase):
    def setUp(self):
        self.directory = json.loads((ROOT / 'data/directory.json').read_text())
        self.manifest = json.loads((ROOT / 'verification/pilot_verified_badges.json').read_text())

    def test_add_second_badge_and_revoke_first_without_other_directory_changes(self):
        initial = copy.deepcopy(self.directory)
        changed, ids = module.update_directory(self.directory, self.manifest)
        self.assertTrue(changed)
        self.assertEqual(ids, [250])
        revision = self.directory['pilot_badges_revision']
        unchanged, _ = module.update_directory(self.directory, self.manifest)
        self.assertFalse(unchanged)
        self.assertEqual(revision, self.directory['pilot_badges_revision'])

        next_manifest = copy.deepcopy(self.manifest)
        next_manifest['badges'].append({**next_manifest['badges'][0], 'club_id': 261,
                                        'club_name': 'Dulwich Village',
                                        'logo_url': 'https://www.dulwichvillagefc.co.uk/crest.png',
                                        'logo_sha256': 'a' * 64})
        changed, ids = module.update_directory(self.directory, next_manifest)
        self.assertTrue(changed)
        self.assertEqual(ids, [250, 261])
        self.assertNotEqual(revision, self.directory['pilot_badges_revision'])

        next_manifest['badges'] = next_manifest['badges'][1:]
        changed, ids = module.update_directory(self.directory, next_manifest)
        self.assertTrue(changed)
        self.assertEqual(ids, [261])
        cray = next(c for c in self.directory['clubs'] if c['club_id'] == 250)
        self.assertNotIn('logo_status', cray)
        self.assertEqual(self.directory['leagues'], initial['leagues'])
        self.assertEqual(self.directory['team_club_links'], initial['team_club_links'])

    def test_fails_closed_for_mismatched_name_and_unreviewed_status(self):
        for changed in ({'club_name': 'Another Club'}, {'logo_status': 'ready_for_second_review'}):
            with self.subTest(changed=changed):
                candidate = copy.deepcopy(self.manifest)
                candidate['badges'][0].update(changed)
                with self.assertRaises(ValueError):
                    module.update_directory(copy.deepcopy(self.directory), candidate)

    def test_hosted_asset_must_still_match_reviewed_hash(self):
        class Response:
            headers = {'Content-Type': 'image/png'}
            url = self.manifest['badges'][0]['logo_url']
            def __init__(self, chunks): self.chunks = chunks
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def raise_for_status(self): pass
            def iter_content(self, _): return iter(self.chunks)
        with patch('requests.get', return_value=Response([b'replaced image'])):
            with self.assertRaisesRegex(ValueError, 'hosted bytes changed'):
                module.verify_hosted_assets(self.manifest)

        approved_bytes = b'approved image bytes'
        matching = copy.deepcopy(self.manifest)
        matching['badges'][0]['logo_sha256'] = hashlib.sha256(approved_bytes).hexdigest()
        with patch('requests.get', return_value=Response([approved_bytes])):
            module.verify_hosted_assets(matching)


if __name__ == '__main__':
    unittest.main()
