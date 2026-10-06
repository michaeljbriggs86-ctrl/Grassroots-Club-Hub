"""Exact-byte and provenance gates for private badge object storage."""
import hashlib
import pathlib
import subprocess
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

    def test_repeat_deploy_checks_stored_bytes_without_fetch_or_put(self):
        commands = []
        def run(command, *, check):
            self.assertTrue(check)
            commands.append(command)
            pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        stage.upload_badges([self.badge], lambda *a, **k: self.fail('mutable source fetched'),
                            run, prefer_stored=True)
        self.assertEqual(len(commands), 1)
        self.assertIn('get', commands[0])
        self.assertNotIn('put', commands[0])
        self.assertIn(f"250/{self.badge['logo_sha256']}", commands[0][6])

    def test_generic_jpeg_type_repaired_using_same_approved_bytes(self):
        data = b'\xff\xd8\xffapproved Metrogas JPEG'
        badge = {**self.badge, 'club_id': 416, 'logo_sha256': hashlib.sha256(data).hexdigest()}
        reads = iter([(data, 'application/octet-stream'), (data, 'image/jpeg')])
        commands = []
        def stored_get(key):
            self.assertEqual(key, f"416/{badge['logo_sha256']}")
            return next(reads)
        def run(command, *, check):
            self.assertTrue(check)
            commands.append(command)
            self.assertEqual(pathlib.Path(command[command.index('--file') + 1]).read_bytes(), data)
        stage.upload_badges([badge], lambda *a, **k: self.fail('mutable source fetched'),
                            run, prefer_stored=True, stored_get=stored_get)
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0][5], 'put')
        self.assertEqual(commands[0][commands[0].index('--content-type') + 1], 'image/jpeg')
        self.assertEqual(commands[0][commands[0].index('--cache-control') + 1], 'private, no-store')

    def test_correct_stored_mime_has_no_write_or_public_source_fetch(self):
        stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fetched'),
                            lambda *a, **k: self.fail('unnecessary write'), prefer_stored=True,
                            stored_get=lambda key: (self.data, 'image/png'))

    def test_missing_mime_repaired_for_approved_png(self):
        reads = iter([(self.data, ''), (self.data, 'image/png')])
        commands = []
        stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fetched'),
                            lambda command, **k: commands.append(command), prefer_stored=True,
                            stored_get=lambda key: next(reads))
        self.assertEqual(len(commands), 1)
        self.assertIn('image/png', commands[0])

    def test_corrupt_stored_body_is_not_replaced_even_with_generic_mime(self):
        with self.assertRaisesRegex(ValueError, 'stored R2 bytes differ'):
            stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fallback'),
                                lambda *a, **k: self.fail('corrupt object replaced'),
                                prefer_stored=True,
                                stored_get=lambda key: (self.data + b'changed', 'application/octet-stream'))

    def test_conflicting_image_mime_is_not_silently_repaired(self):
        with self.assertRaisesRegex(ValueError, 'MIME differs'):
            stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fetched'),
                                lambda *a, **k: self.fail('conflicting MIME replaced'),
                                prefer_stored=True, stored_get=lambda key: (self.data, 'image/jpeg'))

    def test_metadata_repair_requires_exact_type_and_body_readback(self):
        for after in (None, (self.data, 'application/octet-stream'),
                      (self.data + b'changed', 'image/png')):
            with self.subTest(after=after), self.assertRaisesRegex(ValueError, 'metadata readback failed'):
                reads = iter([(self.data, 'application/octet-stream'), after])
                stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fetched'),
                                    lambda *a, **k: None, prefer_stored=True,
                                    stored_get=lambda key: next(reads))

    def test_missing_stored_body_keeps_source_gate_and_checks_new_mime(self):
        reads = iter([None, (self.data, 'image/png')])
        commands = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        stage.upload_badges([self.badge], lambda *a, **k: Response(self.data), run,
                            prefer_stored=True, stored_get=lambda key: next(reads))
        self.assertEqual([c[5] for c in commands], ['put', 'get'])

    def test_newly_uploaded_wrong_mime_blocks_success(self):
        reads = iter([None, (self.data, 'application/octet-stream')])
        def run(command, *, check):
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        with self.assertRaisesRegex(ValueError, 'metadata readback failed'):
            stage.upload_badges([self.badge], lambda *a, **k: Response(self.data), run,
                                prefer_stored=True, stored_get=lambda key: next(reads))

    def test_private_r2_reader_uses_literal_key_and_no_redirects(self):
        response = Response(self.data)
        response.status_code = 200
        response.headers = {'Content-Type': ' Image/PNG; charset=binary '}
        calls = []
        def get(url, **kwargs):
            calls.append((url, kwargs))
            return response
        with patch.dict('os.environ', {'CLOUDFLARE_ACCOUNT_ID': 'a' * 32,
                                      'CLOUDFLARE_API_TOKEN': 'test-token'}):
            read = stage.r2_reader(get)
        key = f"250/{self.badge['logo_sha256']}"
        self.assertEqual(read(key), (self.data, 'image/png'))
        self.assertTrue(calls[0][0].endswith('/objects/' + key))
        self.assertNotIn('%2F', calls[0][0])
        self.assertFalse(calls[0][1]['allow_redirects'])
        self.assertEqual(calls[0][1]['headers']['Authorization'], 'Bearer test-token')

    def test_private_r2_reader_only_404_is_missing_and_errors_hide_body(self):
        with patch.dict('os.environ', {'CLOUDFLARE_ACCOUNT_ID': 'a' * 32,
                                      'CLOUDFLARE_API_TOKEN': 'test-token'}):
            for status in (301, 401, 403, 404, 429, 500):
                response = Response(b'error-body-with-sensitive-details')
                response.status_code = status
                read = stage.r2_reader(lambda *a, **k: response)
                with self.subTest(status=status):
                    if status == 404:
                        self.assertIsNone(read(f"250/{self.badge['logo_sha256']}"))
                    else:
                        with self.assertRaisesRegex(ValueError, f'HTTP {status}') as caught:
                            read(f"250/{self.badge['logo_sha256']}")
                        self.assertNotIn('sensitive', str(caught.exception))

    def test_private_r2_reader_rejects_missing_credentials_bad_keys_and_oversize(self):
        with patch.dict('os.environ', {'CLOUDFLARE_ACCOUNT_ID': '', 'CLOUDFLARE_API_TOKEN': ''}):
            with self.assertRaisesRegex(ValueError, 'required'):
                stage.r2_reader(lambda *a, **k: self.fail('network called'))
        response = Response(self.data)
        response.status_code = 200
        with patch.dict('os.environ', {'CLOUDFLARE_ACCOUNT_ID': 'a' * 32,
                                      'CLOUDFLARE_API_TOKEN': 'test-token'}):
            read = stage.r2_reader(lambda *a, **k: response)
        with self.assertRaisesRegex(ValueError, 'invalid approved'):
            read('../unapproved')
        with patch.object(stage, 'MAX_IMAGE_BYTES', 3), self.assertRaisesRegex(ValueError, 'size limit'):
            read(f"250/{self.badge['logo_sha256']}")

    def test_private_read_error_does_not_fall_back_or_replace(self):
        def read(key):
            raise ValueError('private R2 read failed: HTTP 403')
        with self.assertRaisesRegex(ValueError, 'HTTP 403'):
            stage.upload_badges([self.badge], lambda *a, **k: self.fail('public fallback'),
                                lambda *a, **k: self.fail('write after read failure'),
                                prefer_stored=True, stored_get=read)

    def test_cli_prefer_stored_enables_authenticated_metadata_reader(self):
        with patch.object(sys, 'argv', ['stage_pilot_badges_r2.py', '--upload', '--prefer-stored']), \
             patch.dict('os.environ', {'CLOUDFLARE_ACCOUNT_ID': 'a' * 32,
                                       'CLOUDFLARE_API_TOKEN': 'test-token'}), \
             patch.object(stage, 'upload_badges') as upload:
            stage.main()
        self.assertTrue(upload.call_args.kwargs['prefer_stored'])
        self.assertTrue(callable(upload.call_args.kwargs['stored_get']))

    def test_corrupt_stored_object_stops_without_fetch_or_replacement(self):
        commands = []
        def run(command, *, check):
            commands.append(command)
            pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data + b'changed')
        with self.assertRaisesRegex(ValueError, 'stored R2 bytes differ'):
            stage.upload_badges([self.badge], lambda *a, **k: self.fail('source fallback'),
                                run, prefer_stored=True)
        self.assertEqual(len(commands), 1)
        self.assertNotIn('put', commands[0])

    def test_missing_stored_object_uses_original_exact_source_and_readback_gates(self):
        commands = []
        urls = []
        def run(command, *, check):
            commands.append(command)
            if len(commands) == 1:
                raise subprocess.CalledProcessError(1, command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        def get(url, **kwargs):
            urls.append(url)
            return Response(self.data)
        stage.upload_badges([self.badge], get, run, prefer_stored=True)
        self.assertEqual(urls, [self.badge['logo_url']])
        self.assertEqual([c[5] for c in commands], ['get', 'put', 'get'])

    def test_missing_object_still_rejects_changed_public_source(self):
        def run(command, *, check):
            raise subprocess.CalledProcessError(1, command)
        with self.assertRaisesRegex(ValueError, 'changed since review'):
            stage.upload_badges([self.badge], lambda *a, **k: Response(self.data + b'changed'),
                                run, prefer_stored=True)

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

    def test_green_exterior_derivative_uses_pinned_official_bytes(self):
        source = b'\x89PNG\r\n\x1a\noriginal Phoenix bytes'
        badge = {**self.badge, 'club_id': 318,
                 'logo_source': 'official_source_transparency_derivative_private',
                 'derivation': 'outer_green_background_transparency_only',
                 'original_source_url': 'https://club.example/original.png',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        commands = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        with patch('pilot_badge_transparency.transparent_green_exterior_png', return_value=self.data):
            stage.upload_badges([badge], lambda *a, **k: Response(source), run)
        self.assertEqual(len(commands), 2)
        self.assertIn('put', commands[0])
        with patch('pilot_badge_transparency.transparent_green_exterior_png', return_value=b'wrong'):
            with self.assertRaisesRegex(ValueError, 'transparency bytes differ'):
                stage.upload_badges([badge], lambda *a, **k: Response(source), run)

    def test_trim_derivative_uses_pinned_original_and_checks_result(self):
        source = b'\x89PNG\r\n\x1a\noriginal Punjab bytes'
        badge = {**self.badge, 'club_id': 473,
                 'logo_source': 'official_source_trim_derivative_private',
                 'derivation': 'transparent_padding_trim_2pct',
                 'original_source_url': 'https://club.example/original.png',
                 'original_sha256': hashlib.sha256(source).hexdigest()}
        commands = []
        def run(command, *, check):
            commands.append(command)
            if 'get' in command:
                pathlib.Path(command[command.index('--file') + 1]).write_bytes(self.data)
        with patch('pilot_badge_transparency.trim_transparent_padding_png', return_value=self.data):
            stage.upload_badges([badge], lambda *a, **k: Response(source), run)
        self.assertEqual(len(commands), 2)
        self.assertIn('put', commands[0])
        with patch('pilot_badge_transparency.trim_transparent_padding_png', return_value=b'wrong'):
            with self.assertRaisesRegex(ValueError, 'trimmed bytes differ'):
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
