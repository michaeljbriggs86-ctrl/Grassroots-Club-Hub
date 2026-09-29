#!/usr/bin/env python3
"""Publish reviewed pilot badge metadata into the existing Selkent directory feed.

This does not approve a badge or fetch/copy image bytes. The manifest is the
reviewed authority; the canonical directory is the only club identity source.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit


BADGE_FIELDS = ("logo_url", "logo_status", "logo_source", "logo_updated_at", "logo_sha256")
MAX_IMAGE_BYTES = 12 * 1024 * 1024


def validated_approvals(directory, manifest):
    if manifest.get("schema_version") != 1 or manifest.get("scope") != "private_pilot":
        raise ValueError("unsupported pilot badge manifest")
    badges = manifest.get("badges")
    if not isinstance(badges, list):
        raise ValueError("pilot badges must be a list")
    if not isinstance(directory.get("clubs"), list) or not isinstance(directory.get("team_club_links"), list):
        raise ValueError("unsupported canonical directory")
    clubs = {int(c["club_id"]): c for c in directory["clubs"]}
    if len(clubs) != len(directory["clubs"]):
        raise ValueError("duplicate canonical club ID")
    selected = {}
    for badge in badges:
        club_id = int(badge["club_id"])
        if club_id in selected:
            raise ValueError(f"duplicate pilot badge club ID {club_id}")
        club = clubs.get(club_id)
        if not club or club["club_name"] != badge.get("club_name"):
            raise ValueError(f"pilot badge club ID/name mismatch for {club_id}")
        if badge.get("logo_status") != "pilot_verified":
            raise ValueError(f"badge {club_id} lacks pilot verification")
        url = urlsplit(str(badge.get("logo_url") or ""))
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.fragment:
            raise ValueError(f"badge {club_id} has an unsafe source URL")
        if not re.fullmatch(r"[a-f0-9]{64}", str(badge.get("logo_sha256") or ""), re.I):
            raise ValueError(f"badge {club_id} has no exact-image SHA-256")
        if not all(badge.get(field) for field in BADGE_FIELDS):
            raise ValueError(f"badge {club_id} is missing provenance metadata")
        if badge.get('logo_source') in ('club_supplied_private', 'official_source_transparency_derivative_private'):
            if badge['logo_source'] == 'club_supplied_private' and club_id != 499:
                raise ValueError(f"badge {club_id} is outside the private club-supplied pilot")
            expected = f"https://test.pitchkind.com/__pilot_badges/{club_id}/{badge['logo_sha256'].lower()}"
            if badge['logo_url'] != expected:
                raise ValueError(f"badge {club_id} has an invalid private-pilot URL")
            if badge['logo_source'] == 'official_source_transparency_derivative_private':
                original = urlsplit(str(badge.get('original_source_url') or ''))
                if (original.scheme != 'https' or not original.hostname or original.username or
                        original.password or original.fragment or not re.fullmatch(
                            r'[a-f0-9]{64}', str(badge.get('original_sha256') or ''), re.I) or
                        badge['original_sha256'].lower() == badge['logo_sha256'].lower() or
                        badge.get('derivation') != 'outer_background_transparency_only'):
                    raise ValueError(f"badge {club_id} lacks exact original and derivation provenance")
        selected[club_id] = {field: badge[field] for field in BADGE_FIELDS}
    return selected


def verify_hosted_assets(manifest):
    """Fail publication if an official-hosted image no longer matches its review."""
    import requests
    for badge in manifest['badges']:
        # Club-supplied bytes were reviewed locally and must be read back from
        # private R2 by the staging gate. They have no publicly fetchable source.
        if badge.get('logo_source') in ('club_supplied_private', 'official_source_transparency_derivative_private'):
            continue
        club_id = badge['club_id']
        digest = hashlib.sha256()
        size = 0
        with requests.get(badge['logo_url'], stream=True, timeout=20,
                          headers={'User-Agent': 'PitchKindBadgeQA/1.0', 'Accept': 'image/*'}) as response:
            response.raise_for_status()
            final = urlsplit(response.url)
            if final.scheme != 'https' or not final.hostname or final.username or final.password:
                raise ValueError(f"badge {club_id} source redirected away from HTTPS")
            if not response.headers.get('Content-Type', '').lower().startswith('image/'):
                raise ValueError(f"badge {club_id} source no longer serves an image")
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > MAX_IMAGE_BYTES:
                    raise ValueError(f"badge {club_id} source exceeds image size limit")
                digest.update(chunk)
        if not size or digest.hexdigest().lower() != badge['logo_sha256'].lower():
            raise ValueError(f"badge {club_id} hosted bytes changed since visual review")


def update_directory(directory, manifest):
    approvals = validated_approvals(directory, manifest)
    changed = False
    for club in directory["clubs"]:
        club_id = int(club["club_id"])
        before = {field: club.get(field) for field in BADGE_FIELDS}
        if club.get("logo_status") == "pilot_verified":
            for field in BADGE_FIELDS:
                club.pop(field, None)
        if club_id in approvals:
            club.update(approvals[club_id])
        after = {field: club.get(field) for field in BADGE_FIELDS}
        changed |= before != after
    revision = hashlib.sha256(json.dumps(approvals, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if directory.get("pilot_badges_revision") != revision:
        directory["pilot_badges_revision"] = revision
        changed = True
    if changed:
        directory["last_updated"] = datetime.now(timezone.utc).isoformat()
    return changed, sorted(approvals)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=Path('verification/pilot_verified_badges.json'))
    parser.add_argument('--directory', type=Path, default=Path('data/directory.json'))
    parser.add_argument('--check', action='store_true', help='validate and report without writing')
    parser.add_argument('--verify-assets', action='store_true', help='re-fetch hosted images and compare exact reviewed hashes')
    args = parser.parse_args()
    directory = json.loads(args.directory.read_text(encoding='utf-8'))
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    changed, ids = update_directory(directory, manifest)
    if args.verify_assets:
        verify_hosted_assets(manifest)
    if changed and not args.check:
        fd, temp = tempfile.mkstemp(prefix='.directory-badges-', suffix='.json', dir=args.directory.parent)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as out:
                json.dump(directory, out, ensure_ascii=False, indent=2)
                out.write('\n')
            os.replace(temp, args.directory)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
    print(json.dumps({'changed': changed, 'check_only': args.check, 'pilot_verified_club_ids': ids,
                      'pilot_badges_revision': directory['pilot_badges_revision']}))


if __name__ == '__main__':
    main()
