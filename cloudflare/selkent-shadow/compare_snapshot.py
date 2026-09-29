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


def _fixture_age(payloads: dict, age: dict):
    age_id = age["agegroup_id"]
    base_html = payloads[f"fixturespage/{age_id}"]
    discovered_weeks = _parse(parse_fixture_week_ids, base_html, "fixture tabs")
    week_ids = age["fixture_week_ids"]
    if week_ids:
        week_rows = []
        for week_id in week_ids:
            html = payloads[f"fixturespage/{age_id}/{week_id}"]
            rows, _ = _parse(parse_fixtures, html, "fixture")
            week_rows.append(rows)
        fixtures = merge_fixture_rows(*week_rows)
        status = ("verified_multiweek_fixture_rows_v2" if fixtures
                  else "verified_empty_multiweek_v2")
    else:
        fixtures, status = _parse(parse_fixtures, base_html, "fixture")
    return discovered_weeks, fixtures, status


def compare_worker_fixture_preview(snapshot: dict, feed: dict) -> dict:
    """Compare both parsers against the same private pages, regardless of feed age."""
    if snapshot.get("schema") != "pitchkind-selkent-shadow-v1" or (
        feed.get("schema_version") != 2 or feed.get("provider") != "Selkent"
    ):
        raise ValueError("Unrecognized private snapshot or public feed schema")
    preview = snapshot.get("fixture_preview")
    if preview is None:
        return {"event": "selkent-worker-python-fixtures", "status": "pending_new_collection"}
    if not isinstance(preview, dict) or set(preview) != {
        str(age["agegroup_id"]) for age in feed["age_groups"]
    }:
        raise ValueError("Incomplete private Worker fixture preview")

    differences = Counter()
    count = 0
    for age in feed["age_groups"]:
        discovered, fixtures, status = _fixture_age(snapshot["payloads"], age)
        parsed = preview[str(age["agegroup_id"])]
        if not isinstance(parsed, dict) or not isinstance(parsed.get("fixtures"), list):
            raise ValueError("Malformed private Worker fixture preview")
        count += len(fixtures)
        if parsed.get("discovered_week_ids") != discovered:
            differences["week_lists"] += 1
        if parsed["fixtures"] != fixtures:
            differences["fixture_age_groups"] += 1
        if parsed.get("fixture_parse_status") != status:
            differences["statuses"] += 1
    return {
        "event": "selkent-worker-python-fixtures",
        "status": "drift" if differences else "exact",
        "age_groups": len(feed["age_groups"]),
        "fixtures": count,
        "different_age_group_counts": dict(differences),
    }


def compare_worker_results_preview(snapshot: dict, feed: dict) -> dict:
    """Compare only public U12+ results against the same private R2 pages."""
    if snapshot.get("schema") != "pitchkind-selkent-shadow-v1" or (
        feed.get("schema_version") != 2 or feed.get("provider") != "Selkent"
    ):
        raise ValueError("Unrecognized private snapshot or public feed schema")
    preview = snapshot.get("published_results_preview")
    if preview is None:
        return {"event": "selkent-worker-python-results", "status": "pending_new_collection"}
    if not isinstance(preview, dict) or set(preview) != {
        str(age["agegroup_id"]) for age in feed["age_groups"]
        if age.get("standings") is not None
    }:
        raise ValueError("Private Worker results target list is incomplete or unsafe")
    differences = 0
    count = 0
    for age in feed["age_groups"]:
        if age.get("standings") is None:
            continue
        if "".join(age["age_group"].upper().split()) in RESTRICTED:
            raise ValueError("Restricted age group has a results preview")
        parsed = preview[str(age["agegroup_id"])]
        if not isinstance(parsed, list):
            raise ValueError("Malformed private Worker results preview")
        rows = []
        for table in age["standings"]:
            division_id = table["provider_division_id"]
            html = snapshot["payloads"][f"resultsTable/{division_id}"]
            published = _parse(parse_published_results, html, "published results")
            rows.extend({**row, "provider_division_id": division_id,
                         "division_name": table["division_name"]} for row in published)
        count += len(rows)
        differences += parsed != rows
    return {
        "event": "selkent-worker-python-results",
        "status": "drift" if differences else "exact",
        "age_groups": len(preview),
        "published_results": count,
        "different_age_groups": differences,
    }


def compare_worker_standings_preview(snapshot: dict, feed: dict) -> dict:
    """Compare U12+ league tables parsed from the same private R2 pages."""
    if snapshot.get("schema") != "pitchkind-selkent-shadow-v1" or (
        feed.get("schema_version") != 2 or feed.get("provider") != "Selkent"
    ):
        raise ValueError("Unrecognized private snapshot or public feed schema")
    preview = snapshot.get("standings_preview")
    if preview is None:
        return {"event": "selkent-worker-python-standings", "status": "pending_new_collection"}
    if not isinstance(preview, dict) or set(preview) != {
        str(age["agegroup_id"]) for age in feed["age_groups"]
        if age.get("standings") is not None
    }:
        raise ValueError("Private Worker standings target list is incomplete or unsafe")
    differences = 0
    rows = 0
    for age in feed["age_groups"]:
        if age.get("standings") is None:
            continue
        if "".join(age["age_group"].upper().split()) in RESTRICTED:
            raise ValueError("Restricted age group has a standings preview")
        worker_tables = preview[str(age["agegroup_id"])]
        if not isinstance(worker_tables, list):
            raise ValueError("Malformed private Worker standings preview")
        parsed_tables = []
        for table in age["standings"]:
            division_id = table["provider_division_id"]
            html = snapshot["payloads"][f"resultsTable/{division_id}"]
            parsed = _parse(parse_standings_html, html, "standings")
            parsed["provider_division_id"] = division_id
            if not parsed.get("division_name"):
                parsed["division_name"] = table["division_name"]
            parsed_tables.append(parsed)
        rows += sum(len(table["rows"]) for table in parsed_tables)
        differences += worker_tables != parsed_tables
    return {
        "event": "selkent-worker-python-standings",
        "status": "drift" if differences else "exact",
        "age_groups": len(preview),
        "standings_rows": rows,
        "different_age_groups": differences,
    }


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

        discovered_weeks, fixtures, fixture_status = _fixture_age(payloads, age)
        if discovered_weeks != age["fixture_week_ids"]:
            differences["fixture_week_lists"] += 1
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
    parser_parity = compare_worker_fixture_preview(snapshot, feed)
    print(json.dumps(parser_parity, sort_keys=True))
    results_parity = compare_worker_results_preview(snapshot, feed)
    print(json.dumps(results_parity, sort_keys=True))
    standings_parity = compare_worker_standings_preview(snapshot, feed)
    print(json.dumps(standings_parity, sort_keys=True))
    if (parser_parity["status"] == "drift" or results_parity["status"] == "drift"
            or standings_parity["status"] == "drift"):
        raise SystemExit("Worker parser differs from Python on the same private snapshot")
