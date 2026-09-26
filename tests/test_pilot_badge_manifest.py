"""Publication gates for the separate pilot approval manifest."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('badge_directory', ROOT / 'scripts/scrape_directory.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BadgeManifestTest(unittest.TestCase):
    def setUp(self):
        self.clubs = [{'club_id': 250, 'club_name': 'Cray Wanderers'},
                      {'club_id': 261, 'club_name': 'Dulwich Village'}]
        self.badge = json.loads((ROOT / 'verification/pilot_verified_badges.json').read_text())['badges'][0]

    def attach(self, badges):
        with tempfile.TemporaryDirectory() as folder:
            p = pathlib.Path(folder) / 'manifest.json'
            p.write_text(json.dumps({'schema_version': 1, 'scope': 'private_pilot', 'badges': badges}))
            return module.attach_pilot_badges([dict(c) for c in self.clubs], p)

    def test_only_matching_club_receives_approval(self):
        result = self.attach([self.badge])
        self.assertEqual(result[0]['logo_status'], 'pilot_verified')
        self.assertEqual(result[0]['logo_sha256'], self.badge['logo_sha256'])
        self.assertNotIn('logo_url', result[1])

    def test_rejects_wrong_identity_and_duplicate(self):
        for bad in ([{**self.badge, 'club_name': 'Different Club'}],
                    [self.badge, self.badge]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.attach(bad)

    def test_rejects_unverified_or_unsafe_url_or_bad_hash(self):
        for change in ({'logo_status': 'ready_for_second_review'},
                       {'logo_url': 'http://example.com/crest.png'},
                       {'logo_url': 'https://someone@example.com/crest.png'},
                       {'logo_sha256': 'bad'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.attach([{**self.badge, **change}])


if __name__ == '__main__':
    unittest.main()
