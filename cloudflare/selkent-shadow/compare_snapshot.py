"""Read-only comparison of a private Selkent R2 snapshot with the public feed.

Runs only after verify-snapshot.mjs has checked freshness and target integrity.
Never prints or uploads provider HTML, club names, or individual match details.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from scrape import (  # noqa: E402
    merge_fixture_rows,
    parse_fixture_week_ids,
    parse_fixtures,
    parse_published_results,
)
from selkent_results import parse_standings_html  # noqa: E402

RESTRICTED = {"U7", "U8", "U8X", "U9", "U10", "U10X", "U11"}


def _parse(parser, html: str, category: str):
    try:
        return parser(html)
    except Exception as exc:
        # Some parser exceptions include a provider text sample. Suppress that
        # exception context so private content never appears in CI logs.
        raise ValueError(f"Private {category} markup failed: {type(exc).__name__}") from None


def compare_snapshot(snapshot: dict, feed: dict) -> dict:
    if snapshot.get("schema") != "pitchkind-selkent-shadow-v1":
        raise ValueError("Unrecognized private snapshot schema")
    if feed.get("schema_version") != 2 or feed.get("provider") != "Selkent":
        raise ValueError("Unrecognized public feed schema")
    payloads = snapshot["payloads"]
    differences = Counter()
    counts = Counter()
    same_feed_version = snapshot["canonical_feed_last_updated"] == feed["last_updated"]

    for age in feed["age_groups"]:
        age_id = age["agegroup_id"]
        age_code = "".join(age["age_group"].upper().split())
        restricted = age_code in RESTRICTED
        standings = age.get("standings")
        if restricted and (standings is not None or age.get("published_results") is not None or
                           age.get("published_results_status") != "not_publicly_published"):
            raise ValueError("Restricted public age group contains results or standings")
        if not restricted and standings is None:
            # It may be an age without public results, but cannot own resultsTable targets.
            if age.get("published_results") is not None:
                raise ValueError("Public results exist without standings")

        base_key = f"fixturespage/{age_id}"
        base_html = payloads[base_key]
        discovered_weeks = _parse(parse_fixture_week_ids, base_html, "fixture tabs")
        week_ids = age["fixture_week_ids"]
        if discovered_weeks != week_ids:
            differences["fixture_week_lists"] += 1

        if week_ids:
            week_rows = []
            for week_id in week_ids:
                html = payloads[f"fixturespage/{age_id}/{week_id}"]
                rows, _ = _parse(parse_fixtures, html, "fixture")
                week_rows.append(rows)
            fixtures = merge_fixture_rows(*week_rows)
            fixture_status = ("verified_multiweek_fixture_rows_v2" if fixtures
                              else "verified_empty_multiweek_v2")
        else:
            fixtures, fixture_status = _parse(parse_fixtures, base_html, "fixture")
        counts["fixtures"] += len(fixtures)
        if same_feed_version and fixtures != age["fixtures"]:
            differences["fixture_age_groups"] += 1
        if same_feed_version and fixture_status != age["fixture_parse_status"]:
            differences["fixture_statuses"] += 1

        if standings is None:
            continue
        if restricted or not isinstance(standings, list):
            raise ValueError("Restricted or malformed standings in public feed")

        parsed_standings = []
        parsed_results = []
        for table in standings:
            division_id = table["provider_division_id"]
            html = payloads[f"resultsTable/{division_id}"]
            parsed = _parse(parse_standings_html, html, "standings")
            parsed["provider_division_id"] = division_id
            if not parsed.get("division_name"):
                parsed["division_name"] = table["division_name"]
            parsed_standings.append(parsed)
            rows = _parse(parse_published_results, html, "published results")
            parsed_results.extend({**row, "provider_division_id": division_id,
                                   "division_name": table["division_name"]}
                                  for row in rows)
        counts["standings_rows"] += sum(len(table["rows"]) for table in parsed_standings)
        counts["published_results"] += len(parsed_results)
        if same_feed_version and parsed_standings != standings:
            differences["standings_age_groups"] += 1
        if same_feed_version and parsed_results != age["published_results"]:
            differences["results_age_groups"] += 1
    counts["age_groups"] = len(feed["age_groups"])
    return {
        "event": "selkent-shadow-parity",
        "collected_at": snapshot["collected_at"],
        "canonical_feed_last_updated": snapshot["canonical_feed_last_updated"],
        "status": ("deferred_feed_version_differs" if not same_feed_version else
                   "drift" if any(differences.values()) else "exact"),
        "parsed_counts": dict(counts),
        "different_age_group_counts": dict(differences),
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: compare_snapshot.py SNAPSHOT_PATH PUBLIC_FEED_PATH")
    with open(sys.argv[1], encoding="utf8") as private_file:
        snapshot = json.load(private_file)
    with open(sys.argv[2], encoding="utf8") as public_file:
        feed = json.load(public_file)
    print(json.dumps(compare_snapshot(snapshot, feed), sort_keys=True))
