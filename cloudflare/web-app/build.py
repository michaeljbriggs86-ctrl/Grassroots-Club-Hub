#!/usr/bin/env python3
"""Build the restricted PitchKind browser pilot from reviewed Android assets."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / "app/src/main/assets"
DIST = HERE / "dist"

# Only these public client assets are eligible for upload. Keep source and
# verification files, diagnostics and other future additions out of the site.
ASSETS = (
    "index.html", "manifest.json", "cloud-config.js", "cloud.js",
    "onboarding.js", "onboarding.css", "app.js", "static-feed-overlay.js",
    "styles.css", "cloud.css", "app-design-system.css",
    "pitchkind-wt_logo-primary.svg", "pitchkind-wt_logo-reverse.svg",
    "pitchkind-wt_mark.svg", "pitchkind-wt_mark-reverse.svg",
    "pitchkind-wt_app-icon.svg", "shooters-hill-logo.png",
    "icon-192.png", "icon-512.png", "icon-maskable-512.png",
    "football-login-adult.jpg", "football-login-player.jpg",
    "football-login-club.jpg", "football-pitch-hero.jpg",
)


def check_public_feed(path: Path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    if document.get("schema_version") != 2 or str(document.get("provider", "")).lower() != "selkent":
        raise ValueError("Unsupported public Selkent results feed")
    for age in document.get("age_groups", []):
        age_code = str(age.get("age_group", "")).upper()
        if age_code not in {"U7", "U8", "U9", "U10", "U10X", "U11"}:
            continue
        if (age.get("standings") is not None or age.get("results") is not None
                or age.get("published_results") is not None
                or age.get("published_results_status") != "not_publicly_published"):
            raise ValueError(f"Restricted {age_code} results or table found in public feed")
        for fixture in age.get("fixtures") or []:
            if set(fixture) - {"date", "division_name", "home", "away", "provider_team_ids"}:
                raise ValueError(f"Unexpected {age_code} fixture field: review before publishing")


def build() -> None:
    check_public_feed(ROOT / "data/results.json")
    for name in ASSETS:
        source = SOURCE / name
        if not source.is_file():
            raise FileNotFoundError(source)
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    for name in ASSETS:
        shutil.copyfile(SOURCE / name, DIST / name)
    subprocess.run(
        ["python3", str(ROOT / "verification/verify_pilot_scope.py"),
         "--override", str(SOURCE / "pilot_rights_override.json"),
         "--roster", str(ROOT / "verification/pilot_active_roster.json"),
         "--emit-runtime-js", str(DIST / "pilot-rights-runtime.js")],
        check=True,
    )
    overlay = DIST / "static-feed-overlay.js"
    original = overlay.read_text(encoding="utf-8")
    first = "'https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/directory.json'"
    second = "'https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json'"
    if original.count(first) != 1 or original.count(second) != 1:
        raise ValueError("Selkent feed source has changed; review before deploying")
    overlay.write_text(
        original.replace(first, "new URL('./data/directory.json',location.href).href")
                .replace(second, "new URL('./data/results.json',location.href).href")
                .replace("github-static-", "cloudflare-static-"),
        encoding="utf-8",
    )
    shutil.copyfile(HERE / "service-worker.js", DIST / "service-worker.js")
    (DIST / "data").mkdir()
    for name in ("directory.json", "results.json"):
        shutil.copyfile(ROOT / "data" / name, DIST / "data" / name)
    print("Prepared browser app and public fixtures in", DIST)


if __name__ == "__main__":
    build()
