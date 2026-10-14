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
- Populated fixture markup is verified for h2.subHead / .panel-title / .fixtureRow payloads.
- Standings table shape is verified against real Selkent payloads and tested
  with an explicitly synthetic non-zero fixture.
- Published result rows are verified against a real 2026-09-27 Selkent payload:
  Results panel > dated panel > .row with two .resultTeam and one .resultScore.

This script intentionally stops publication for unknown populated fixture or
result shapes.
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

# Temporary club scope agreed by Mike on 2026-10-14: Shooters Hill has no
# U12X team. Remove this entry and verify cupspage/22 before adding one.
# This excludes cup collection only; fixture and league collection stay intact.
DEFERRED_CUP_AGEGROUPS = {
    (22, "U12X"): "Shooters Hill AFC has no U12X team; cup collection deferred",
}


class SelkentFeedError(RuntimeError):
    """Base error for public feed generation."""


class UnverifiedFixtureMarkupError(SelkentFeedError):
    """Raised when a populated fixture payload appears before parser verification."""


class UnverifiedPublishedResultsMarkupError(SelkentFeedError):
    """Raised when a populated result row does not match verified markup."""


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
    Parse the verified Selkent fixture shape.

    Verified real populated shape (2026-09-21):
      h2.subHead                       -> fixture date / week
      .panel-title                     -> division
      .fixtureRow[data-team-ids]       -> home / away fixture
      .fixtureRow.nonFixture           -> status row; ignore

    A verified status-only No Game / On Standby week returns verified_empty.

    Unknown populated shapes still fail closed.
    """
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#fixtureContainer")

    if container is None:
        raise SelkentFeedError("Fixture response has no #fixtureContainer")

    if not container.get_text(" ", strip=True):
        return [], "verified_empty"

    fixtures: list[dict[str, Any]] = []
    non_fixture_rows = []
    verified_non_fixture_rows = []
    current_date = ""
    current_division = ""

    for element in container.select("h2.subHead, .panel-title, .fixtureRow"):
        classes = set(element.get("class", []))

        if element.name == "h2" and "subHead" in classes:
            match = re.search(
                r"(\d{1,2})/(\d{1,2})/(\d{2,4})",
                element.get_text(" ", strip=True),
            )
            if not match:
                raise UnverifiedFixtureMarkupError(
                    "Fixture date heading has an unsupported shape"
                )

            day, month, year = match.groups()
            year_number = int(year)
            if year_number < 100:
                year_number += 2000

            current_date = (
                f"{year_number:04d}-{int(month):02d}-{int(day):02d}"
            )
            continue

        if "panel-title" in classes:
            current_division = _normalise_text(
                element.get_text(" ", strip=True)
            )
            continue

        if "fixtureRow" not in classes:
            continue

        columns = [
            _normalise_text(child.get_text(" ", strip=True))
            for child in element.find_all("div", recursive=False)
            if "col-xs-5" in child.get("class", [])
        ]

        if "nonFixture" in classes:
            non_fixture_rows.append(element)
            # Real provider status-only weeks contain one team and No Game.
            # On Standby is the other previously verified non-match status.
            if (len(columns) == 2 and columns[0] and current_date and current_division
                    and columns[1].casefold() in {"no game", "on standby"}
                    and re.fullmatch(r"[1-9][0-9]*;?", str(element.get("data-team-ids", "")))
                    and re.sub(r"\s", "", element.get_text()) == re.sub(r"\s", "", "".join(columns))):
                verified_non_fixture_rows.append(element)
            continue

        if len(columns) < 2 or not current_date or not current_division:
            raise UnverifiedFixtureMarkupError(
                "Populated fixture row has an unsupported shape"
            )

        provider_team_ids = [
            item
            for item in str(element.get("data-team-ids", "")).split(";")
            if item
        ]

        fixtures.append(
            {
                "date": current_date,
                "division_name": current_division,
                "home": columns[0],
                "away": columns[-1],
                "provider_team_ids": provider_team_ids,
            }
        )

    if not fixtures:
        if non_fixture_rows and len(verified_non_fixture_rows) == len(non_fixture_rows):
            # Do not let one known status row mask unknown populated content.
            for element in container.select("h2.subHead, .panel-title, .fixtureRow"):
                element.extract()
            if not container.get_text(" ", strip=True):
                return [], "verified_empty"
        sample = _normalise_text(container.get_text(" ", strip=True))[:500]
        raise UnverifiedFixtureMarkupError(
            "Fixture container is populated but no verified fixture rows "
            f"were parsed. Text sample: {sample!r}"
        )

    return fixtures, "verified_fixture_rows_v1"



def parse_fixture_week_ids(html: str) -> list[int]:
    """
    Discover every fixture week Selkent currently advertises for an age group.

    Verified real shape (2026-09-21):
      <a data-week-id="2" role="tab" data-toggle="tab">27/09/26</a>
      <a data-week-id="3" role="tab" data-toggle="tab">04/10/26</a>

    The provider's week IDs are authoritative. We do not calculate fixture
    Sundays locally.
    """
    soup = BeautifulSoup(html, "html.parser")
    week_ids: set[int] = set()

    for tab in soup.select("[data-week-id]"):
        raw = str(tab.get("data-week-id", "")).strip()
        if raw.isdigit():
            week_ids.add(int(raw))

    return sorted(week_ids)


def _fixture_identity(row: dict[str, Any]) -> tuple[Any, ...]:
    provider_ids = tuple(
        str(item).strip()
        for item in row.get("provider_team_ids", [])
        if str(item).strip()
    )

    if len(provider_ids) >= 2:
        participants: tuple[Any, ...] = ("provider_ids",) + provider_ids
    else:
        participants = (
            "names",
            _normalise_text(str(row.get("home", ""))).casefold(),
            _normalise_text(str(row.get("away", ""))).casefold(),
        )

    return (
        str(row.get("date", "")),
        _normalise_text(str(row.get("division_name", ""))).casefold(),
        participants,
    )


def merge_fixture_rows(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge independently fetched fixture weeks without publishing duplicates."""
    merged: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()

    for group in groups:
        for row in group:
            identity = _fixture_identity(row)
            if identity in seen:
                continue
            seen.add(identity)
            merged.append(row)

    return sorted(
        merged,
        key=lambda row: (
            str(row.get("date", "")),
            _normalise_text(str(row.get("division_name", ""))).casefold(),
            _normalise_text(str(row.get("home", ""))).casefold(),
            _normalise_text(str(row.get("away", ""))).casefold(),
        ),
    )


def parse_published_results(html: str) -> list[dict[str, Any]]:
    """Parse only scored matches from Selkent's verified Results panel.

    Real 2026-09-27 shape: #results-{division} .panel.panel-static, with a
    dd/mm/yy (Week n) heading and .panel-body > .row containing two
    .resultTeam cells around one .resultScore cell. Empty and '-' scores are
    unplayed matches and must not be published as results.
    """
    soup = BeautifulSoup(html, "html.parser")
    results_panel = soup.select_one('div[id^="results-"]')
    if results_panel is None:
        raise SelkentFeedError("resultsTable response has no Results panel")
    rows: list[dict[str, Any]] = []
    panels = results_panel.select(".panel.panel-static")

    for panel in panels:
        heading = panel.select_one(".panel-heading")
        date_match = re.search(
            r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b",
            heading.get_text(" ", strip=True) if heading else "",
        )
        if not date_match:
            raise UnverifiedPublishedResultsMarkupError(
                "Results panel has an unsupported date heading"
            )
        day, month, year = map(int, date_match.groups())
        if year < 100:
            year += 2000
        try:
            date = datetime(year, month, day).date().isoformat()
        except ValueError as exc:
            raise UnverifiedPublishedResultsMarkupError(
                "Results panel contains an invalid date"
            ) from exc

        body = panel.select_one(".panel-body")
        if body is None:
            raise UnverifiedPublishedResultsMarkupError(
                "Dated Results panel has no body"
            )
        for row in body.select(".row"):
            teams = row.select(".resultTeam")
            scores = row.select(".resultScore")
            if len(teams) != 2 or len(scores) != 1:
                raise UnverifiedPublishedResultsMarkupError(
                    "Results row has unsupported team/score cells"
                )
            score_text = _normalise_text(scores[0].get_text(" ", strip=True))
            # Verified public resultsTable/4273 on 2026-09-27 uses this
            # literal status for an unscored abandoned match. It is not a
            # result; other unfamiliar score/status text still fails closed.
            if score_text in ("", "-", "Abandoned"):
                continue
            score_match = re.fullmatch(r"(\d{1,2})\s*-\s*(\d{1,2})", score_text)
            home = _normalise_text(teams[0].get_text(" ", strip=True))
            away = _normalise_text(teams[1].get_text(" ", strip=True))
            if not score_match or not home or not away:
                raise UnverifiedPublishedResultsMarkupError(
                    f"Results row has unsupported score or team: {score_text!r}"
                )
            rows.append({
                "date": date,
                "home": home,
                "away": away,
                "homeGoals": int(score_match.group(1)),
                "awayGoals": int(score_match.group(2)),
            })

    # Heading and Print button are the only content in an empty Results panel.
    copy = BeautifulSoup(str(results_panel), "html.parser")
    copy_panel = copy.select_one('div[id^="results-"]')
    for element in copy_panel.find_all(["h1", "h2", "h3", "h4", "button"]):
        element.decompose()
    if not panels and _normalise_text(copy_panel.get_text(" ", strip=True)):
        raise UnverifiedPublishedResultsMarkupError(
            "Results panel is populated with an unknown markup shape"
        )
    return rows


def parse_published_cup_results(html: str, agegroup_id: int) -> list[dict[str, Any]]:
    """Verified public cupspage shape, captured 2026-10-11 (U12+ only).

    Each competition pane contains dated rounds, four-cell fixture rows and
    a numeric .vCol score. The observed W - L outcome (2026-10-12) and its
    reverse are recognised non-numeric outcomes, not invented goal scores.
    A date inside .matchRef overrides the round's
    start date; a round date range otherwise uses its published start date.
    """
    soup = BeautifulSoup(html, "html.parser")
    tabs = soup.select("a.tabType")
    competitions = []
    for tab in tabs:
        target = str(tab.get("href", ""))
        name = _normalise_text(tab.get_text(" ", strip=True))
        pane = soup.find(id=target[1:]) if target.startswith("#") else None
        if pane is None or not re.search(r"cup|vase", name, re.I):
            raise UnverifiedPublishedResultsMarkupError("Unknown cup competition tab")
        competitions.append((pane, name, target[1:]))
    if not tabs:
        competitions = [(soup, "Selkent Cup", f"cup-{agegroup_id}")]

    def dates(text: str) -> list[str]:
        values = []
        for day, month, year in re.findall(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b", text):
            year = int(year)
            try:
                values.append(datetime(year + 2000 if year < 100 else year, int(month), int(day)).date().isoformat())
            except ValueError as exc:
                raise UnverifiedPublishedResultsMarkupError("Invalid cup date") from exc
        return values

    results = []
    for pane, competition, provider_cup_id in competitions:
        panels = pane.select(".panel.panel-static")
        if not panels:
            raise UnverifiedPublishedResultsMarkupError("Cup response has no verified round panels")
        for panel in panels:
            heading, body = panel.select_one(".panel-heading"), panel.select_one(".panel-body")
            heading_text = _normalise_text(heading.get_text(" ", strip=True)) if heading else ""
            round_dates = dates(heading_text)
            if body is None or not round_dates or "::" not in heading_text:
                raise UnverifiedPublishedResultsMarkupError("Unknown cup round heading/body")
            round_name = heading_text.split("::", 1)[0].strip()
            match_rows = body.select(".fixtureRow")
            if any("fixtureRow" not in row.get("class", []) for row in body.find_all("div", recursive=False)):
                raise UnverifiedPublishedResultsMarkupError("Unknown cup body row")
            if not match_rows and _normalise_text(body.get_text(" ", strip=True)):
                raise UnverifiedPublishedResultsMarkupError("Unknown populated cup round")
            for row in match_rows:
                cells = row.find_all("div", recursive=False)
                if len(cells) != 4 or "matchRef" not in cells[0].get("class", []) or "vCol" not in cells[2].get("class", []):
                    raise UnverifiedPublishedResultsMarkupError("Unknown cup team/score cells")
                score = _normalise_text(cells[2].get_text(" ", strip=True))
                if score in ("v", "n/g", "", "-"):
                    continue
                home, away = (_normalise_text(cells[i].get_text(" ", strip=True)) for i in (1, 3))
                if re.fullmatch(r"(?:W\s*-\s*L|L\s*-\s*W)", score):
                    if not home or not away:
                        raise UnverifiedPublishedResultsMarkupError("Cup outcome is missing a team")
                    # The public feed publishes goals only. Keep the provider's
                    # win/loss marker out of numeric results and league tables.
                    continue
                scored = re.fullmatch(r"(\d{1,2})\s*-\s*(\d{1,2})", score)
                if not scored or not home or not away:
                    raise UnverifiedPublishedResultsMarkupError(f"Unknown cup score/team: {score!r}")
                ref_text = _normalise_text(cells[0].get_text(" ", strip=True))
                override = dates(ref_text)
                if len(override) > 1:
                    raise UnverifiedPublishedResultsMarkupError("Ambiguous cup match date")
                results.append({
                    "date": override[0] if override else round_dates[0],
                    "home": home, "away": away,
                    "homeGoals": int(scored.group(1)), "awayGoals": int(scored.group(2)),
                    "competition": competition, "round": round_name,
                    "provider_cup_id": provider_cup_id,
                    "provider_match_ref": ref_text.split()[0],
                })
    return results


def collect_cup_results(results_agegroups: dict[int, dict[str, str]]) -> dict[int, list[dict[str, Any]]]:
    """Use advertised cup tabs intersected with public Results eligibility."""
    collected = {}
    for format_type in ("9", "11"):
        soup = BeautifulSoup(fetch_text(f"cups/{format_type}"), "html.parser")
        tabs = soup.select("#cupTabs a[data-agegroup-id]")
        if not tabs:
            raise SelkentFeedError("Public cup page has no age-group tabs")
        for tab in tabs:
            raw_id = str(tab.get("data-agegroup-id", ""))
            if not raw_id.isdigit():
                raise SelkentFeedError("Invalid public cup age-group ID")
            age_id = int(raw_id)
            metadata = results_agegroups.get(age_id)
            if metadata is None:
                continue
            label = metadata["age_group"]
            age = re.fullmatch(r"U(\d+)X?", label, re.I)
            if label.lower() != "senior" and (age is None or int(age.group(1)) < 12):
                continue
            if _normalise_text(tab.get_text(" ", strip=True)) != label or metadata["format_type"] != format_type:
                raise SelkentFeedError("Cup/Results age-group metadata conflict")
            if (age_id, label) in DEFERRED_CUP_AGEGROUPS:
                continue
            collected[age_id] = parse_published_cup_results(fetch_json(f"cupspage/{age_id}"), age_id)
            _sleep_between_requests()
    return collected


def collect_fixtures(
    fixture_agegroups: dict[int, str],
) -> dict[int, dict[str, Any]]:
    """
    Collect every fixture week Selkent advertises for every discovered age group.

    The base endpoint discovers provider week IDs. Each advertised week is then
    fetched explicitly through:
        fixturespage/{agegroup_id}/{week_id}

    If Selkent exposes no week tabs, retain the verified single-page behaviour.
    Any advertised week that cannot be fetched/parsed aborts the complete build,
    preserving the previous known-good public feed.
    """
    collected: dict[int, dict[str, Any]] = {}

    for agegroup_id, label in sorted(
        fixture_agegroups.items(),
        key=lambda item: item[0],
    ):
        base_html = fetch_json(f"fixturespage/{agegroup_id}")
        week_ids = parse_fixture_week_ids(base_html)

        if week_ids:
            groups: list[list[dict[str, Any]]] = []

            for week_id in week_ids:
                week_html = fetch_json(
                    f"fixturespage/{agegroup_id}/{week_id}"
                )
                week_fixtures, _week_status = parse_fixtures(week_html)
                groups.append(week_fixtures)
                _sleep_between_requests()

            fixtures = merge_fixture_rows(*groups)
            parse_status = (
                "verified_multiweek_fixture_rows_v2"
                if fixtures
                else "verified_empty_multiweek_v2"
            )
        else:
            fixtures, parse_status = parse_fixtures(base_html)

        collected[agegroup_id] = {
            "age_group": label,
            "fixtures": fixtures,
            "fixture_parse_status": parse_status,
            "fixture_week_ids": week_ids,
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
        age_results: list[dict[str, Any]] = []

        for division in divisions:
            division_id = division["provider_division_id"]
            table_html = fetch_json(f"resultsTable/{division_id}")

            division_results = parse_published_results(table_html)
            age_results.extend({
                **row,
                "provider_division_id": division_id,
                "division_name": division["division_name"],
            } for row in division_results)

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
            "published_results": age_results,
            "published_results_status": "verified_scored_rows_v1",
        }

        _sleep_between_requests()

    return collected


def temporary_cup_transport_error(exc: requests.RequestException) -> bool:
    """Recover outages only; TLS/auth/contract failures are never treated as empty."""
    if isinstance(exc, requests.exceptions.SSLError):
        return False
    if isinstance(exc, requests.HTTPError):
        return exc.response is not None and exc.response.status_code in {429, 500, 502, 503, 504}
    return isinstance(exc, (requests.Timeout, requests.ConnectionError))


def retained_cup_results(previous: Any, results_agegroups: dict[int, dict[str, str]],
                         now: str) -> tuple[dict[int, list[dict[str, Any]]], str]:
    """Retain only validated public cup rows from the canonical previous snapshot."""
    if not isinstance(previous, dict) or previous.get("schema_version") != SCHEMA_VERSION or previous.get("provider") != "Selkent":
        raise SelkentFeedError("No verified previous cup snapshot")
    coverage = previous.get("coverage", {}).get("published_results", {})
    if coverage.get("cup_parser_status") != "verified_cup_scored_rows_v1" or previous.get("cup_results_status") not in {None, "verified_current", "stale_retained"}:
        raise SelkentFeedError("Previous cup parser provenance is unverified")
    stamp = previous.get("cup_results_last_updated")
    try:
        checked = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if checked.tzinfo is None or checked > datetime.fromisoformat(now):
            raise ValueError("Invalid check date")
    except (AttributeError, TypeError, ValueError) as exc:
        raise SelkentFeedError("Previous cup check date is invalid") from exc
    ages = previous.get("age_groups")
    if not isinstance(ages, list) or any(not isinstance(a, dict) for a in ages):
        raise SelkentFeedError("Previous cup age groups are invalid")
    indexed = {a.get("agegroup_id"): a for a in ages}
    if len(indexed) != len(ages):
        raise SelkentFeedError("Previous cup age-group identity is ambiguous")
    fields = {"date", "home", "away", "homeGoals", "awayGoals", "competition",
              "round", "provider_cup_id", "provider_match_ref"}
    cups = {}
    for age_id, metadata in results_agegroups.items():
        label = metadata["age_group"]
        youth = re.fullmatch(r"U(\d+)X?", label, re.I)
        if label.lower() != "senior" and (not youth or int(youth.group(1)) < 12):
            continue
        if (age_id, label) in DEFERRED_CUP_AGEGROUPS:
            continue
        age = indexed.get(age_id)
        if not age or age.get("age_group") != label or age.get("results_format_type") != metadata["format_type"] or age.get("published_results_status") != "verified_scored_rows_v1" or not isinstance(age.get("published_results"), list):
            raise SelkentFeedError(f"Previous cup identity/provenance mismatch for {label}")
        rows = []
        for row in age["published_results"]:
            if not isinstance(row, dict):
                raise SelkentFeedError("Previous public result row is invalid")
            if "provider_cup_id" not in row:
                continue  # League rows come only from this run, never the baseline.
            if set(row) != fields or not re.fullmatch(rf"cupCombined{age_id}-\d+", str(row.get("provider_cup_id", ""))):
                raise SelkentFeedError("Previous cup fields/identity are unsafe")
            if any(not isinstance(row[k], str) or not row[k].strip() or len(row[k]) > 300 or re.search(r"[\x00-\x1f\x7f]", row[k]) for k in fields - {"homeGoals", "awayGoals"}):
                raise SelkentFeedError("Previous cup text is invalid")
            if not re.search(r"cup|vase", row["competition"], re.I) or any(type(row[k]) is not int or not 0 <= row[k] <= 99 for k in ("homeGoals", "awayGoals")):
                raise SelkentFeedError("Previous cup score/competition is invalid")
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["date"]):
                    raise ValueError("Invalid date format")
                datetime.strptime(row["date"], "%Y-%m-%d")
            except ValueError as exc:
                raise SelkentFeedError("Previous cup match date is invalid") from exc
            rows.append(dict(row))
        cups[age_id] = rows
    return cups, stamp


def build_payload(previous_payload: Any = None) -> dict[str, Any]:
    fixture_agegroups, fixture_discovery_source = discover_fixture_agegroups()
    results_agegroups = discover_public_results_agegroups()

    fixtures_by_age = collect_fixtures(fixture_agegroups)
    standings_by_age = collect_standings(results_agegroups)
    generated_at = datetime.now(timezone.utc).isoformat()
    cup_status, cup_checked_at = "verified_current", generated_at
    try:
        cups_by_age = collect_cup_results(results_agegroups)
    except requests.RequestException as exc:
        if not temporary_cup_transport_error(exc):
            raise
        cups_by_age, cup_checked_at = retained_cup_results(previous_payload, results_agegroups, generated_at)
        cup_status = "stale_retained"

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
            "fixture_week_ids": (
                fixture_data.get("fixture_week_ids", [])
                if fixture_data is not None
                else []
            ),
        }

        if standings_data is not None:
            entry["results_format_type"] = standings_data["format_type"]
            entry["standings"] = standings_data["standings"]
            entry["published_results"] = standings_data["published_results"] + cups_by_age.get(agegroup_id, [])
            entry["published_results_status"] = standings_data[
                "published_results_status"
            ]
        else:
            # Explicitly distinguish "not publicly published by Selkent"
            # from an empty public results list.
            entry["standings"] = None
            entry["published_results"] = None
            entry["published_results_status"] = "not_publicly_published"

        deferred_reason = DEFERRED_CUP_AGEGROUPS.get((agegroup_id, label))
        if deferred_reason is not None:
            entry["cup_results_status"] = "deferred"
            entry["cup_results_deferred_reason"] = deferred_reason

        age_groups.append(entry)

    return {
        "schema_version": SCHEMA_VERSION,
        "provider": "Selkent",
        "last_updated": generated_at,
        "cup_results_last_updated": cup_checked_at,
        "cup_results_last_attempted": generated_at,
        "cup_results_status": cup_status,
        "fixture_agegroup_discovery_source": fixture_discovery_source,
        "coverage": {
            "fixtures": {
                "scope": "all Selkent age groups",
                "parser_status": "verified_empty_fixture_rows_and_multiweek_v2",
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
                "parser_status": "verified_scored_rows_v1",
                "cup_parser_status": "verified_cup_scored_rows_v1",
                "cup_scope": "Advertised public cups excluding explicitly deferred age groups",
                "deferred_cup_age_groups": [
                    {
                        "agegroup_id": entry["agegroup_id"],
                        "age_group": entry["age_group"],
                        "reason": entry["cup_results_deferred_reason"],
                    }
                    for entry in age_groups
                    if entry.get("cup_results_status") == "deferred"
                ],
            },
        },
        "age_groups": age_groups,
        "notes": [
            (
                "last_updated applies to fixtures and league data. "
                "cup_results_last_updated is the last complete verified cup collection; "
                "stale_retained preserves that original date during a transport outage; "
                "deferred cup data has not been checked and is not confirmed empty."
            ),
            (
                "U7-U11/private club-entered results are intentionally excluded "
                "from this public feed."
            ),
            (
                "Unknown fixture/result shapes fail closed rather than "
                "publish guessed data."
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
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = None
    try:
        payload = build_payload(previous)
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
    if payload["cup_results_status"] == "stale_retained":
        print("WARNING: Cup provider temporarily unavailable; retained verified cups checked "
              + payload["cup_results_last_updated"])


if __name__ == "__main__":
    main()
