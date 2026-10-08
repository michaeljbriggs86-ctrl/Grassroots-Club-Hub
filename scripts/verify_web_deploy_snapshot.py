#!/usr/bin/env python3
"""Reject untrusted deployment events and stale/mismatched public feed bundles.

No credentials, upstream artifacts or private team data are read or recorded.
The receipt is a pre-deploy snapshot, not proof of the revision served to users.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'michaeljbriggs86-ctrl/Grassroots-Club-Hub'
UPSTREAM = {
    'Scrape Selkent Results': '.github/workflows/scrape-selkent.yml',
    'Scrape Selkent Club/League Directory': '.github/workflows/scrape-directory.yml',
    'Publish reviewed private-pilot badges': '.github/workflows/publish-pilot-badges.yml',
}


def validate_event(event_name, event, repository, ref):
    if repository != REPOSITORY or ref != 'refs/heads/main':
        raise ValueError('Deployment requires the canonical repository main branch')
    if event.get('repository', {}).get('full_name') != repository:
        raise ValueError('Event repository differs from the canonical repository')
    if event_name in ('push', 'workflow_dispatch'):
        allowed_refs = {ref, 'main'} if event_name == 'workflow_dispatch' else {ref}
        if event.get('ref') not in allowed_refs:
            raise ValueError('Event ref is not main')
        return {'event': event_name}
    if event_name != 'workflow_run':
        raise ValueError('Unsupported deployment event')
    run = event.get('workflow_run', {})
    if (event.get('action') != 'completed' or run.get('status') != 'completed' or
            run.get('conclusion') != 'success' or run.get('head_branch') != 'main' or
            run.get('head_repository', {}).get('full_name') != repository or
            run.get('name') not in UPSTREAM or
            run.get('event') not in ('push', 'schedule', 'workflow_dispatch') or
            run.get('path', '').split('@')[0] != UPSTREAM.get(run.get('name')) or
            not re.fullmatch(r'[a-f0-9]{40}', str(run.get('head_sha', ''))) or
            type(run.get('id')) is not int or run['id'] <= 0):
        raise ValueError('Upstream is not a successful trusted main publisher')
    return {'event': event_name, 'upstream_run_id': run['id'],
            'upstream_head_sha': run['head_sha'], 'upstream_workflow': run['name']}


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def snapshot(root, event, *, fetch=True):
    if fetch:
        subprocess.run(['git', '-C', str(root), 'fetch', '--quiet', 'origin', 'main'], check=True)
    head = git(root, 'rev-parse', 'HEAD')
    if head != git(root, 'rev-parse', 'refs/remotes/origin/main'):
        raise ValueError('main advanced while checks ran; refuse a stale deployment')
    if event.get('upstream_head_sha'):
        subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor',
                        event['upstream_head_sha'], head], check=True)
    # Badge publication may only update canonical directory metadata in-tree.
    changed = set(git(root, 'diff', '--name-only', 'HEAD').splitlines())
    if changed - {'data/directory.json'}:
        raise ValueError('Unexpected tracked changes after deployment checks')
    feeds = {}
    for name in ('results.json', 'directory.json'):
        source = (root / 'data' / name).read_bytes()
        built = (root / 'cloudflare/web-app/dist/data' / name).read_bytes()
        if source != built:
            raise ValueError(f'Bundled {name} differs from the checked source')
        document = json.loads(source)
        if not isinstance(document.get('last_updated'), str):
            raise ValueError(f'{name} lacks a feed timestamp')
        feeds[name] = {'sha256': hashlib.sha256(source).hexdigest(),
                       'bytes': len(source), 'last_updated': document['last_updated']}
    return {'schema_version': 1, 'status': 'pre_deploy_snapshot',
            'checked_at': datetime.now(timezone.utc).isoformat(),
            'repository': REPOSITORY, 'source_commit': head, **event, 'feeds': feeds,
            'badge_manifest_sha256': hashlib.sha256(
                (root / 'verification/pilot_verified_badges.json').read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument('--event-only', action='store_true')
    choice.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    event = validate_event(os.environ['GITHUB_EVENT_NAME'],
                           json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text()),
                           os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_REF'])
    if args.event_only:
        print('Trusted canonical-main deployment event accepted')
        return
    receipt = snapshot(ROOT, event)
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, sort_keys=True))


if __name__ == '__main__':
    main()
