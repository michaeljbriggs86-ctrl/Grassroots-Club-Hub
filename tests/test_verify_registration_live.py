"""Keep live byte checks strict across the actual browser build and hosting additions."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("live_readback", ROOT / "scripts/verify_registration_live.py")
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)


class LiveReadbackExpectations(unittest.TestCase):
    def test_built_overlay_retains_reviewed_guards_with_only_existing_feed_rewrite(self):
        subprocess.run([sys.executable, str(ROOT / "cloudflare/web-app/build.py")], check=True, cwd=ROOT,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        authored = (ROOT / "app/src/main/assets/static-feed-overlay.js").read_bytes()
        built = (ROOT / "cloudflare/web-app/dist/static-feed-overlay.js").read_bytes()
        self.assertNotEqual(authored, built)
        self.assertNotIn(b"raw.githubusercontent.com", built)
        self.assertIn(b"new URL('./data/results.json',location.href).href", built)
        self.assertIn(b"new URL('./data/directory.json',location.href).href", built)
        for guard in (b"matchActionMutationEpoch", b"matchActionIsPending", b"adminUiMode"):
            self.assertIn(guard, built)
        self.assertEqual(live.matches_expected_asset("static-feed-overlay.js", built, built), (True, False))
        self.assertEqual(live.matches_expected_asset("static-feed-overlay.js", built, authored), (False, False))

    def test_observed_beacons_are_allowed_only_on_unchanged_main_page(self):
        page = b"<!doctype html><body>Reviewed app</body>"
        for beacon in live.MAIN_BEACONS:
            served = page.replace(b"</body>", beacon + b"</body>")
            self.assertEqual(live.matches_expected_asset("index.html", page, served), (True, True))
            for name in ("register.html", "registration.js", "static-feed-overlay.js"):
                self.assertEqual(live.matches_expected_asset(name, page, served), (False, False))
            changed = served.replace(b"Reviewed app", b"Unexpected app")
            self.assertEqual(live.matches_expected_asset("index.html", page, changed), (False, False))

    def test_unknown_changed_duplicated_or_relocated_scripts_fail_closed(self):
        page = b"<!doctype html><body>Reviewed app</body>"
        beacon = live.MAIN_BEACONS[-1]
        variants = (
            beacon.replace(b"UKNk8Gbx", b"Changed!"),
            beacon.replace(b"10a09a2b", b"00000000"),
            beacon.replace(b"static.cloudflareinsights.com", b"example.invalid"),
            beacon + beacon,
            b"<script src='https://example.invalid/unknown.js'></script>",
        )
        for script in variants:
            self.assertEqual(live.matches_expected_asset("index.html", page, page.replace(b"</body>", script + b"</body>")),
                             (False, False))
        self.assertEqual(live.matches_expected_asset("index.html", page, beacon + page), (False, False))
        self.assertEqual(live.matches_expected_asset("index.html", page, page + b" "), (False, False))
        self.assertEqual(live.matches_expected_asset("index.html", page, page), (True, False))


if __name__ == "__main__":
    unittest.main()
