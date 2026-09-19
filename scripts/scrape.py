"""
Build the public Selkent static feed at data/results.json.

Architecture contract (see ARCHITECTURE.md):
- GitHub static JSON is the intended app-facing source for public Selkent data.
- Fixtures are public for all Selkent age groups.
- Published results/standings are public only where Selkent itself publishes
  them (currently U12+).
- U7-U11 club-entered/private results must NEVER enter this file.
- Selkent standings expose source row order, not an authoritative "position".
- Unknown populated fixture/result markup must fail closed rather than publish
  guessed data.
- Publication is atomic: a failed run leaves the previous known-good
  data/results.json untouched.

Current verification boundary:
- Empty fixtureContainer is verified against real Selkent payloads.
- Populated fixture markup is NOT yet verified.
- Standings table shape is verified against real Selkent payloads and tested
  with an explicitly synthetic non-zero fixture.
- Published result-row markup is NOT yet verified against a real non-empty
  result payload.

This script intentionally stops publication if populated fixture/result markup
appears before its parser has been verified.
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

from selkent_results import StandingsParseError, parse_standings_html


BASE_URL = "https://www.selkent.org.uk/public"
OUTPUT_PATH = Path("data/results.json")
DIRECTORY_PATH = Path("data/directory.json")

REQUEST_TIMEOUT_SECONDS = 20
DELAY_BETWEEN_REQUESTS_SECONDS = 0.35

SCHEMA_VERSION = 2


class SelkentFeedError(RuntimeError):
    """Base error for public feed generation."""


class UnverifiedFixtureMarkupError(SelkentFeedError):
    """Raised when a populated fixture payload appears before parser verification."""


class UnverifiedPublishedResultsMarkupError(SelkentFeedError):
    """Raised when published result rows appear before parser verification."""


def _sleep_between_requests() -> None:
    if DELAY_BETWEEN_REQUESTS_SECONDS > 0:
        time.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)


def _normalise_text(value: str) -> str:
    return " ".join(value.split())


def parse_divisions(html: str) -> list[dict[str, Any]]:
    """
    Parse Selkent division/team membership panels.

    This function is retained here because scripts/scrape_directory.py imports
    it from scrape.py. Removing it would break the weekly directory build.

    Verified real shape:
      .panel-division
        .panel-title
        .panel-body > div     (direct child team rows)
        .panel-footer
    """
    soup = BeautifulSoup(html, "html.parser")
    divisions: list[dict[str, Any]] = []

    for panel in soup.select(".panel-division"):
        title_el = panel.select_one(".panel-title")
        body_el = panel.select_one(".panel-body")
        footer_el = panel.select_one(".panel-footer")

        if title_el is None or body_el is None:
            continue

        teams = [
            _normalise_text(team_div.get_text(" ", strip=True))
            for team_div in body_el.find_all("div", recursive=False)
            if _normalise_text(team_div.get_text(" ", strip=True))
        ]

        divisions.append(
            {
                "division_name": _normalise_text(
                    title_el.get_text(" ", strip=True)
                ),
                "teams": teams,
                "team_count_label": (
                    _normalise_text(footer_el.get_text(" ", strip=True))
                    if footer_el is not None
                    else None
                ),
            }
        )

    return divisions


def fetch_json(path: str) -> str:
    """Fetch a Selkent JSON endpoint and return its `html` field."""
    url = f"{BASE_URL}/{path.lstrip('/')}"
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": "GrassrootsClubHub-PublicFeed/2"},
    )
    response.raise_for_status()

    try:
        data = response.json()
    except ValueError as exc:
        raise SelkentFeedError(f"Non-JSON response from {url}") from exc

    if not data.get("success"):
        raise SelkentFeedError(f"Selkent endpoint reported failure: {url}")

    html = data.get("html")
    if not isinstance(html, str):
        raise SelkentFeedError(f"Selkent endpoint returned no HTML string: {url}")

    return html


def fetch_text(path: str) -> str:
    """Fetch a normal Selkent HTML page."""
    url = f"{BASE_URL}/{path.lstrip('/')}"
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": "GrassrootsClubHub-PublicFeed/2"},
    )
    response.raise_for_status()
    return response.text


def load_directory_agegroups() -> dict[int, str]:
    """
    Load the weekly directory's known age-group IDs as a safe fallback.

    directory.json remains authoritative for the club/division directory;
    here it is only used to avoid hardcoding age-group IDs when live discovery
    has a transient failure.
    """
    try:
        data = json.loads(DIRECTORY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SelkentFeedError(
            f"Cannot load fallback age groups from {DIRECTORY_PATH}"
        ) from exc

    agegroups: dict[int, str] = {}

    for league in data.get("leagues", []):
        raw_id = league.get("agegroup_id")
        label = _normalise_text(str(league.get("age_group", "")))

        if not isinstance(raw_id, int) or not label:
            continue

        agegroups[raw_id] = label

    if not agegroups:
        raise SelkentFeedError(
            f"No age groups found in fallback directory {DIRECTORY_PATH}"
        )

    return agegroups


def discover_fixture_agegroups() -> tuple[dict[int, str], str]:
    """
    Discover all fixture-capable Selkent age groups dynamically.

    Returns:
        ({agegroup_id: label, ...}, discovery_source)

    A plausible live result is preferred. If the page shape breaks or returns
    too few groups, fall back to the already-published weekly directory.
    """
    fallback = load_directory_agegroups()

    try:
        html = fetch_text("divisions/all")
        soup = BeautifulSoup(html, "html.parser")

        discovered: dict[int, str] = {}

        for tab in soup.select("#divisionTabs a[data-agegroup-id]"):
            raw_id = str(tab.get("data-agegroup-id", "")).strip()
            label = _normalise_text(tab.get_text(" ", strip=True))

            if not raw_id.isdigit() or not label:
                continue

            discovered[int(raw_id)] = label

        minimum_plausible = max(1, int(len(fallback) * 0.8))

        if len(discovered) >= minimum_plausible:
            return discovered, "selkent_divisions_all"

    except (requests.RequestException, SelkentFeedError):
        pass

    return fallback, "directory_json_fallback"


def parse_public_results_agegroups(parent_html: str) -> dict[int, dict[str, str]]:
    """
    Parse a Selkent public Results parent page.

    Real Selkent pages expose:
      #agegroupTabs a.tabAgegroup
        data-agegroup-id="6"
        data-format-type="9"

    The presence of an age group on these Results pages is the publication
    boundary: we do not construct a U7-U11 results list ourselves.
    """
    soup = BeautifulSoup(parent_html, "html.parser")
    result: dict[int, dict[str, str]] = {}

    for tab in soup.select(
        "#agegroupTabs a.tabAgegroup[data-agegroup-id][data-format-type]"
    ):
        raw_age_id = str(tab.get("data-agegroup-id", "")).strip()
        format_type = str(tab.get("data-format-type", "")).strip()
        label = _normalise_text(tab.get_text(" ", strip=True))

        if not raw_age_id.isdigit() or not format_type or not label:
            continue

        agegroup_id = int(raw_age_id)

        result[agegroup_id] = {
            "age_group": label,
            "format_type": format_type,
        }

    return result


def discover_public_results_agegroups() -> dict[int, dict[str, str]]:
    """
    Discover all age groups for which Selkent publishes Results/League Tables.

    Selkent separates public Results pages by playing format:
      /public/results/9
      /public/results/11

    We read the page-provided data-format-type rather than deriving publication
    eligibility from an age number.
    """
    combined: dict[int, dict[str, str]] = {}

    for parent_path in ("results/9", "results/11"):
        html = fetch_text(parent_path)
        parsed = parse_public_results_agegroups(html)

        for agegroup_id, metadata in parsed.items():
            existing = combined.get(agegroup_id)

            if existing is not None and existing != metadata:
                raise SelkentFeedError(
                    f"Conflicting Results metadata for agegroup_id={agegroup_id}"
                )

            combined[agegroup_id] = metadata

        _sleep_between_requests()

    if not combined:
        raise SelkentFeedError(
            "Selkent Results pages exposed no public results age groups"
        )

    return combined


def parse_results_divisions(html: str) -> list[dict[str, Any]]:
    """
    Parse one /public/results/{format_type}/{agegroup_id} JSON HTML fragment.

    Verified real shape:
      a.tabDivision[data-division-id]
    """
    soup = BeautifulSoup(html, "html.parser")
    divisions: list[dict[str, Any]] = []
    seen: set[int] = set()

    for tab in soup.select("a.tabDivision[data-division-id]"):
        raw_id = str(tab.get("data-division-id", "")).strip()

        if not raw_id.isdigit():
            continue

        division_id = int(raw_id)

        if division_id in seen:
            continue

        name = _normalise_text(str(tab.get("aria-controls", "")))
        if not name:
            name = _normalise_text(tab.get_text(" ", strip=True))

        if not name:
            raise SelkentFeedError(
                f"Division {division_id} has no readable name"
            )

        seen.add(division_id)
        divisions.append(
            {
                "provider_division_id": division_id,
                "division_name": name,
            }
        )

    return divisions


def parse_fixtures(html: str) -> tuple[list[dict[str, Any]], str]:
    """
    Parse a fixture response only within the currently verified boundary.

    Empty fixtureContainer has been verified from real Selkent payloads.
    Populated markup has not. We therefore fail closed if content appears
    instead of pretending an inferred parser is production-ready.
    """
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#fixtureContainer")

    if container is None:
        raise SelkentFeedError("Fixture response has no #fixtureContainer")

    if not container.get_text(" ", strip=True):
        return [], "verified_empty"

    sample = _normalise_text(container.get_text(" ", strip=True))[:500]

    raise UnverifiedFixtureMarkupError(
        "A populated Selkent fixture response is now live, but populated "
        "fixture markup has not yet been verified. Publication stopped to "
        f"protect the previous feed. Text sample: {sample!r}"
    )


def has_unparsed_published_results(html: str) -> bool:
    """
    Detect whether a resultsTable payload now contains actual match-result
    content in its Results panel.

    The empty Results panel has been observed in real Selkent payloads.
    We intentionally do not guess the result-row structure.
    """
    soup = BeautifulSoup(html, "html.parser")
    results_panel = soup.select_one('div[id^="results-"]')

    if results_panel is None:
        raise SelkentFeedError("resultsTable response has no Results panel")

    # Work on a detached copy so heading/button text does not count as a result.
    copy = BeautifulSoup(str(results_panel), "html.parser")
    copy_panel = copy.select_one('div[id^="results-"]')

    if copy_panel is None:
        raise SelkentFeedError("Unable to inspect Results panel")

    for heading in copy_panel.find_all(["h1", "h2", "h3", "h4", "button"]):
        heading.decompose()

    meaningful_text = _normalise_text(copy_panel.get_text(" ", strip=True))
    meaningful_tags = copy_panel.find_all(
        ["table", "tr", "li"],
        recursive=True,
    )

    return bool(meaningful_text or meaningful_tags)


def collect_fixtures(
    fixture_agegroups: dict[int, str],
) -> dict[int, dict[str, Any]]:
    collected: dict[int, dict[str, Any]] = {}

    for agegroup_id, label in sorted(
        fixture_agegroups.items(),
        key=lambda item: item[0],
    ):
        html = fetch_json(f"fixturespage/{agegroup_id}")
        fixtures, parse_status = parse_fixtures(html)

        collected[agegroup_id] = {
            "age_group": label,
            "fixtures": fixtures,
            "fixture_parse_status": parse_status,
        }

        _sleep_between_requests()

    return collected


def collect_standings(
    results_agegroups: dict[int, dict[str, str]],
) -> dict[int, dict[str, Any]]:
    collected: dict[int, dict[str, Any]] = {}

    for agegroup_id, metadata in sorted(
        results_agegroups.items(),
        key=lambda item: item[0],
    ):
        format_type = metadata["format_type"]
        age_label = metadata["age_group"]

        age_html = fetch_json(f"results/{format_type}/{agegroup_id}")
        divisions = parse_results_divisions(age_html)

        age_standings: list[dict[str, Any]] = []

        for division in divisions:
            division_id = division["provider_division_id"]
            table_html = fetch_json(f"resultsTable/{division_id}")

            if has_unparsed_published_results(table_html):
                raise UnverifiedPublishedResultsMarkupError(
                    "A real published Selkent result row is now present, but "
                    "published-result markup has not yet been verified. "
                    f"Publication stopped at division {division_id} "
                    f"({division['division_name']})."
                )

            try:
                parsed = parse_standings_html(table_html)
            except StandingsParseError as exc:
                raise SelkentFeedError(
                    f"Standings parse failed for division {division_id} "
                    f"({division['division_name']}): {exc}"
                ) from exc

            parsed["provider_division_id"] = division_id

            if not parsed.get("division_name"):
                parsed["division_name"] = division["division_name"]

            age_standings.append(parsed)
            _sleep_between_requests()

        collected[agegroup_id] = {
            "age_group": age_label,
            "format_type": format_type,
            "standings": age_standings,
            "published_results_status": "pending_verified_nonempty_sample",
        }

        _sleep_between_requests()

    return collected


def build_payload() -> dict[str, Any]:
    fixture_agegroups, fixture_discovery_source = discover_fixture_agegroups()
    results_agegroups = discover_public_results_agegroups()

    fixtures_by_age = collect_fixtures(fixture_agegroups)
    standings_by_age = collect_standings(results_agegroups)

    all_age_ids = sorted(set(fixtures_by_age) | set(standings_by_age))
    age_groups: list[dict[str, Any]] = []

    for agegroup_id in all_age_ids:
        fixture_data = fixtures_by_age.get(agegroup_id)
        standings_data = standings_by_age.get(agegroup_id)

        label = (
            (fixture_data or {}).get("age_group")
            or (standings_data or {}).get("age_group")
            or f"agegroup-{agegroup_id}"
        )

        entry: dict[str, Any] = {
            "agegroup_id": agegroup_id,
            "age_group": label,
            "fixtures": (
                fixture_data["fixtures"]
                if fixture_data is not None
                else []
            ),
            "fixture_parse_status": (
                fixture_data["fixture_parse_status"]
                if fixture_data is not None
                else "not_available"
            ),
        }

        if standings_data is not None:
            entry["results_format_type"] = standings_data["format_type"]
            entry["standings"] = standings_data["standings"]
            entry["published_results_status"] = standings_data[
                "published_results_status"
            ]
        else:
            # Explicitly distinguish "not publicly published by Selkent"
            # from an empty public results list.
            entry["standings"] = None
            entry["published_results_status"] = "not_publicly_published"

        age_groups.append(entry)

    return {
        "schema_version": SCHEMA_VERSION,
        "provider": "Selkent",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "fixture_agegroup_discovery_source": fixture_discovery_source,
        "coverage": {
            "fixtures": {
                "scope": "all Selkent age groups",
                "parser_status": "verified_empty_only",
            },
            "standings": {
                "scope": "Selkent-public Results age groups only",
                "parser_status": (
                    "real_zero_shape_verified_and_synthetic_nonzero_tested"
                ),
                "source_order_field": "row_order",
                "official_position_field": None,
            },
            "published_results": {
                "scope": "Selkent-public Results age groups only",
                "parser_status": "awaiting_verified_nonempty_result_sample",
            },
        },
        "age_groups": age_groups,
        "notes": [
            (
                "U7-U11/private club-entered results are intentionally excluded "
                "from this public feed."
            ),
            (
                "A non-empty fixture or published-result payload currently "
                "fails closed until its real markup has been verified."
            ),
            (
                "Standings preserve Selkent display sequence as row_order; "
                "row_order is not an authoritative tied-team position."
            ),
        ],
    }


def write_atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    temp_path = path.with_suffix(path.suffix + ".tmp")

    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(
            payload,
            handle,
            indent=2,
            ensure_ascii=False,
            sort_keys=False,
        )
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())

    os.replace(temp_path, path)


def main() -> None:
    try:
        payload = build_payload()
        write_atomic_json(OUTPUT_PATH, payload)
    except Exception:
        # The previous data/results.json remains untouched because write happens
        # only after the complete feed has been collected and validated.
        raise

    fixture_count = sum(
        len(age.get("fixtures", []))
        for age in payload["age_groups"]
    )
    standings_division_count = sum(
        len(age.get("standings") or [])
        for age in payload["age_groups"]
    )
    standings_row_count = sum(
        len(table.get("rows", []))
        for age in payload["age_groups"]
        for table in (age.get("standings") or [])
    )

    print(
        "PUBLISHED generalized Selkent feed: "
        f"{len(payload['age_groups'])} age groups, "
        f"{fixture_count} parsed fixtures, "
        f"{standings_division_count} standings divisions, "
        f"{standings_row_count} standings rows."
    )


if __name__ == "__main__":
    main()
