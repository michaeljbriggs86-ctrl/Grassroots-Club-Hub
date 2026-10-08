"""Exercise deployment trust, real Git drift and bundle mismatch failures."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('deploy_snapshot', ROOT / 'scripts/verify_web_deploy_snapshot.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class EventTest(unittest.TestCase):
    def setUp(self):
        self.event = {'action': 'completed', 'repository': {'full_name': deploy.REPOSITORY},
                      'workflow_run': {'id': 123, 'status': 'completed', 'conclusion': 'success',
                                       'name': 'Scrape Selkent Results', 'event': 'schedule',
                                       'path': '.github/workflows/scrape-selkent.yml',
                                       'head_sha': 'a' * 40, 'head_branch': 'main',
                                       'head_repository': {'full_name': deploy.REPOSITORY}}}

    def check(self, event, name='workflow_run'):
        return deploy.validate_event(name, event, deploy.REPOSITORY, 'refs/heads/main')

    def test_successful_known_publishers_accepted(self):
        for name, path in deploy.UPSTREAM.items():
            event = copy.deepcopy(self.event)
            event['workflow_run'].update(name=name, path=path)
            self.assertEqual(self.check(event)['upstream_run_id'], 123)

    def test_failed_cancelled_fork_branch_pr_and_unknown_workflow_rejected(self):
        changes = [{'conclusion': 'failure'}, {'conclusion': 'cancelled'},
                   {'status': 'in_progress'}, {'head_branch': 'feature'},
                   {'head_repository': {'full_name': 'other/fork'}},
                   {'event': 'pull_request'}, {'name': 'Untrusted build'},
                   {'path': '.github/workflows/untrusted.yml'}, {'head_sha': 'bad'},
                   {'id': 0}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                event = copy.deepcopy(self.event)
                event['workflow_run'].update(change)
                self.check(event)
        for change in [{'action': 'requested'}, {'repository': {'full_name': 'other/fork'}}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.check({**self.event, **change})

    def test_main_push_and_manual_run_remain_supported(self):
        for name, ref in [('push', 'refs/heads/main'), ('workflow_dispatch', 'main'),
                          ('workflow_dispatch', 'refs/heads/main')]:
            event = {'repository': {'full_name': deploy.REPOSITORY}, 'ref': ref}
            self.assertEqual(self.check(event, name), {'event': name})
        for name in ['push', 'workflow_dispatch', 'pull_request']:
            with self.assertRaises(ValueError):
                self.check({'repository': {'full_name': deploy.REPOSITORY}, 'ref': 'feature'}, name)


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        self.remote = Path(self.temp.name) / 'origin.git'
        subprocess.run(['git', 'init', '-q', '--bare', str(self.remote)], check=True)
        subprocess.run(['git', 'init', '-q', '-b', 'main', str(self.root)], check=True)
        deploy.git(self.root, 'config', 'user.email', 'test@example.invalid')
        deploy.git(self.root, 'config', 'user.name', 'Test')
        for folder in ['data', 'verification', 'cloudflare/web-app/dist/data']:
            (self.root / folder).mkdir(parents=True)
        for name in ['results.json', 'directory.json']:
            payload = json.dumps({'last_updated': '2026-10-08T18:00:00Z', 'sample': name})
            (self.root / 'data' / name).write_text(payload)
            (self.root / 'cloudflare/web-app/dist/data' / name).write_text(payload)
        (self.root / 'verification/pilot_verified_badges.json').write_text('{}')
        (self.root / 'app.js').write_text('reviewed source')
        deploy.git(self.root, 'add', '.')
        deploy.git(self.root, 'commit', '-qm', 'Fixture')
        deploy.git(self.root, 'remote', 'add', 'origin', str(self.remote))
        deploy.git(self.root, 'push', '-qu', 'origin', 'main')

    def test_current_main_bundle_matches_and_records_public_hashes(self):
        event = {'event': 'workflow_run', 'upstream_head_sha': deploy.git(self.root, 'rev-parse', 'HEAD')}
        receipt = deploy.snapshot(self.root, event)
        self.assertEqual(receipt['source_commit'], deploy.git(self.root, 'rev-parse', 'HEAD'))
        self.assertEqual(receipt['status'], 'pre_deploy_snapshot')
        self.assertEqual(set(receipt['feeds']), {'results.json', 'directory.json'})
        self.assertEqual(len(receipt['feeds']['results.json']['sha256']), 64)

    def test_newer_origin_main_prevents_older_checkout_deploy(self):
        old = deploy.git(self.root, 'rev-parse', 'HEAD')
        (self.root / 'app.js').write_text('newer source')
        deploy.git(self.root, 'add', 'app.js')
        deploy.git(self.root, 'commit', '-qm', 'Advance')
        deploy.git(self.root, 'push', '-q', 'origin', 'main')
        deploy.git(self.root, 'checkout', '-q', '--detach', old)
        with self.assertRaisesRegex(ValueError, 'main advanced'):
            deploy.snapshot(self.root, {'event': 'push'})

    def test_wrong_bundled_feed_blocks_deployment(self):
        (self.root / 'cloudflare/web-app/dist/data/results.json').write_text('{}')
        # Real dist is ignored; make that match this disposable repository.
        deploy.git(self.root, 'update-index', '--assume-unchanged', 'cloudflare/web-app/dist/data/results.json')
        with self.assertRaisesRegex(ValueError, 'Bundled results.json differs'):
            deploy.snapshot(self.root, {'event': 'push'})

    def test_local_source_mutation_blocks_deployment(self):
        (self.root / 'app.js').write_text('unchecked change')
        with self.assertRaisesRegex(ValueError, 'Unexpected tracked changes'):
            deploy.snapshot(self.root, {'event': 'push'})

    def test_verified_directory_metadata_can_be_bundled_without_commit(self):
        payload = json.dumps({'last_updated': '2026-10-08T19:00:00Z', 'pilot_badges_revision': 'checked'})
        (self.root / 'data/directory.json').write_text(payload)
        (self.root / 'cloudflare/web-app/dist/data/directory.json').write_text(payload)
        deploy.git(self.root, 'update-index', '--assume-unchanged', 'cloudflare/web-app/dist/data/directory.json')
        self.assertEqual(deploy.snapshot(self.root, {'event': 'push'})['feeds']['directory.json']['bytes'],
                         len(payload))

    def test_upstream_sha_outside_main_ancestry_rejected(self):
        with self.assertRaises(subprocess.CalledProcessError):
            deploy.snapshot(self.root, {'event': 'workflow_run', 'upstream_head_sha': 'a' * 40})


class WorkflowTest(unittest.TestCase):
    def test_every_automatic_route_uses_same_gate_and_main_checkout(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/stage-pilot-badges-r2.yml').read_text())
        # PyYAML's YAML 1.1 reader calls the GitHub YAML 1.2 key 'on' True.
        triggers = workflow.get('on', workflow.get(True))
        self.assertEqual(set(triggers['workflow_run']['workflows']), set(deploy.UPSTREAM))
        self.assertEqual(triggers['workflow_run']['types'], ['completed'])
        self.assertEqual(triggers['workflow_run']['branches'], ['main'])
        self.assertNotIn('pull_request', triggers)
        steps = workflow['jobs']['stage']['steps']
        checkout = next(s for s in steps if s.get('uses', '').startswith('actions/checkout@'))
        self.assertEqual(checkout['with'], {'ref': 'main', 'fetch-depth': 0})
        gate = next(i for i,s in enumerate(steps) if '--upload --prefer-stored' in s.get('run', ''))
        publish = next(i for i,s in enumerate(steps) if s.get('name') == 'Publish metadata after verified R2 readback')
        shipping = next(i for i,s in enumerate(steps) if s.get('id') == 'deploy')
        self.assertLess(gate, publish)
        self.assertLess(publish, shipping)
        self.assertIn('verify_web_deploy_snapshot.py --receipt', steps[shipping]['run'])
        self.assertNotIn('continue-on-error', steps[gate])
        self.assertEqual(workflow['concurrency']['cancel-in-progress'], False)


if __name__ == '__main__':
    unittest.main()
