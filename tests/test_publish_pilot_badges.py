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
        # Exercise this transition starting with one approved badge.
        self.manifest['badges'] = [next(b for b in self.manifest['badges'] if b['club_id'] == 250)]
        initial = copy.deepcopy(self.directory)
        # Exercise admission from an unbadged copy even when the live feed
        # already contains this approved pilot badge.
        cray = next(c for c in self.directory['clubs'] if c['club_id'] == 250)
        for field in module.BADGE_FIELDS:
            cray.pop(field, None)
        self.directory.pop('pilot_badges_revision', None)
        changed, ids = module.update_directory(self.directory, self.manifest)
        self.assertTrue(changed)
        self.assertEqual(ids, [250])
        for field in module.BADGE_FIELDS:
            self.assertEqual(cray[field], self.manifest['badges'][0][field])
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

    def test_current_manifest_applies_only_to_exact_club_ids(self):
        original = copy.deepcopy(self.directory)
        _, ids = module.update_directory(self.directory, self.manifest)
        self.assertEqual(ids, sorted(b['club_id'] for b in self.manifest['badges']))
        for before, after in zip(original['clubs'], self.directory['clubs']):
            if before['club_id'] not in ids:
                expected = copy.deepcopy(before)
                if expected.get('logo_status') == 'pilot_verified':
                    for field in module.BADGE_FIELDS:
                        expected.pop(field, None)
                self.assertEqual(expected, after)
        for badge in self.manifest['badges']:
            club = next(c for c in self.directory['clubs']
                        if c['club_id'] == badge['club_id'])
            for field in module.BADGE_FIELDS:
                self.assertEqual(club[field], badge[field])

    def test_fails_closed_for_mismatched_name_and_unreviewed_status(self):
        for changed in ({'club_name': 'Another Club'}, {'logo_status': 'ready_for_second_review'}):
            with self.subTest(changed=changed):
                candidate = copy.deepcopy(self.manifest)
                candidate['badges'][0].update(changed)
                with self.assertRaises(ValueError):
                    module.update_directory(copy.deepcopy(self.directory), candidate)

    def test_hosted_asset_must_still_match_reviewed_hash(self):
        # This response fixture covers only the first source and digest.
        self.manifest['badges'] = [self.manifest['badges'][0]]
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

    def test_private_source_requires_exact_protected_route_and_no_public_fetch(self):
        private = next(b for b in self.manifest['badges'] if b['club_id'] == 499)
        with patch('requests.get', side_effect=AssertionError('private source fetched')):
            module.verify_hosted_assets({'badges': [private]})
        for changed in ({'logo_url': 'https://example.com/badge.png'},
                        {'logo_sha256': 'a' * 64}):
            candidate = copy.deepcopy(self.manifest)
            next(b for b in candidate['badges'] if b['club_id'] == 499).update(changed)
            with self.assertRaisesRegex(ValueError, 'invalid private-pilot URL'):
                module.validated_approvals(copy.deepcopy(self.directory), candidate)

    def test_derived_private_source_keeps_original_provenance(self):
        candidate = copy.deepcopy(self.manifest)
        badge = next(b for b in candidate['badges'] if b['club_id'] == 250)
        badge.update(logo_source='official_source_transparency_derivative_private',
                     logo_sha256='b' * 64, original_source_url=badge['logo_url'],
                     original_sha256='a' * 64,
                     derivation='outer_background_transparency_only')
        badge['logo_url'] = f"https://test.pitchkind.com/__pilot_badges/250/{'b' * 64}"
        self.assertIn(250, module.validated_approvals(copy.deepcopy(self.directory), candidate))
        with patch('requests.get', side_effect=AssertionError('private derivative fetched')):
            module.verify_hosted_assets({'badges': [badge]})
        for field in ('original_source_url', 'original_sha256', 'derivation'):
            missing = copy.deepcopy(candidate)
            next(b for b in missing['badges'] if b['club_id'] == 250).pop(field)
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'provenance'):
                module.validated_approvals(copy.deepcopy(self.directory), missing)


if __name__ == '__main__':
    unittest.main()
