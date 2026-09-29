#!/usr/bin/env python3
"""Copy reviewed pilot badge bytes into private R2 using immutable hash keys.

This does not approve candidates or change the canonical directory. The
existing pilot manifest is the only admission list. R2 has no public URL.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit

from publish_pilot_badges import MAX_IMAGE_BYTES, validated_approvals


BUCKET = 'pitchkind-pilot-badges'
WRANGLER = ('npx', '--yes', 'wrangler@4.142.0')


def media_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    if len(data) >= 12 and data[4:8] == b'ftyp' and b'avif' in data[8:24]:
        return 'image/avif'
    # SVG needs a separate active-content review and explicit delivery policy.
    raise ValueError('unsupported badge image format')


def fetch_reviewed(badge, get):
    club_id = badge['club_id']
    with get(badge['logo_url'], stream=True, timeout=20,
             headers={'User-Agent': 'PitchKindBadgeQA/1.0', 'Accept': 'image/*'}) as response:
        response.raise_for_status()
        final = urlsplit(response.url)
        if final.scheme != 'https' or not final.hostname or final.username or final.password:
            raise ValueError(f'badge {club_id} source redirected away from HTTPS')
        data = bytearray()
        for chunk in response.iter_content(65536):
            data.extend(chunk)
            if len(data) > MAX_IMAGE_BYTES:
                raise ValueError(f'badge {club_id} exceeds image size limit')
        if not data or hashlib.sha256(data).hexdigest() != badge['logo_sha256'].lower():
            raise ValueError(f'badge {club_id} hosted bytes changed since review')
        kind = media_type(data)
        if response.headers.get('Content-Type', '').split(';')[0].strip().lower() != kind:
            raise ValueError(f'badge {club_id} has inconsistent image MIME type')
        return bytes(data), kind


def approvals(directory, manifest):
    validated_approvals(directory, manifest)
    for badge in manifest['badges']:
        if not badge.get('rights_status') or not badge.get('review_basis'):
            raise ValueError(f"badge {badge['club_id']} lacks review provenance")
    return manifest['badges']


def upload_badges(badges, get, run):
    with tempfile.TemporaryDirectory(prefix='pitchkind-badges-') as directory:
        root = Path(directory)
        for badge in badges:
            key = f"{int(badge['club_id'])}/{badge['logo_sha256'].lower()}"
            readback = root / 'r2-readback'
            if badge.get('logo_source') == 'club_supplied_private':
                # Secretary-supplied artwork has no public source. It was staged
                # privately, and CI admits only its exact reviewed bytes.
                run([*WRANGLER, 'r2', 'object', 'get', f'{BUCKET}/{key}',
                     '--remote', '--file', str(readback)], check=True)
                data = readback.read_bytes()
                if (not data or len(data) > MAX_IMAGE_BYTES or
                        hashlib.sha256(data).hexdigest() != badge['logo_sha256'].lower() or
                        media_type(data) != 'image/png'):
                    raise ValueError(f"badge {badge['club_id']} private R2 bytes differ from reviewed PNG")
                readback.unlink()
                print(f"Checked private R2 badge club_id={badge['club_id']} sha256={badge['logo_sha256']}")
                continue
            if badge.get('logo_source') == 'official_source_transparency_derivative_private':
                # Fetch the exact official original, repeat the reviewed outer
                # background edit on Linux, and require the exact approved PNG.
                from pilot_badge_transparency import transparent_png
                original = {**badge, 'logo_url': badge['original_source_url'],
                            'logo_sha256': badge['original_sha256']}
                source, _ = fetch_reviewed(original, get)
                data = transparent_png(source)
                if hashlib.sha256(data).hexdigest() != badge['logo_sha256'].lower():
                    raise ValueError(f"badge {badge['club_id']} transparency bytes differ from reviewed PNG")
                kind = 'image/png'
            else:
                data, kind = fetch_reviewed(badge, get)
            local = root / 'approved-image'
            local.write_bytes(data)
            run([*WRANGLER, 'r2', 'object', 'put', f'{BUCKET}/{key}',
                 '--remote', '--file', str(local), '--content-type', kind,
                 '--cache-control', 'private, no-store'], check=True)
            run([*WRANGLER, 'r2', 'object', 'get', f'{BUCKET}/{key}',
                 '--remote', '--file', str(readback)], check=True)
            if readback.read_bytes() != data:
                raise ValueError(f"badge {badge['club_id']} R2 readback differs from approved bytes")
            readback.unlink()
            print(f"Stored and checked private R2 badge club_id={badge['club_id']} sha256={badge['logo_sha256']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='validate manifest without network or upload')
    parser.add_argument('--upload', action='store_true', help='fetch, hash, upload, and verify R2 readback')
    args = parser.parse_args()
    if args.check == args.upload:
        parser.error('specify exactly one of --check or --upload')
    directory = json.loads(Path('data/directory.json').read_text(encoding='utf-8'))
    manifest = json.loads(Path('verification/pilot_verified_badges.json').read_text(encoding='utf-8'))
    badges = approvals(directory, manifest)
    if args.upload:
        import requests
        upload_badges(badges, requests.get, subprocess.run)
    else:
        print(f'Validated {len(badges)} reviewed pilot badge record(s); no upload performed')


if __name__ == '__main__':
    main()
