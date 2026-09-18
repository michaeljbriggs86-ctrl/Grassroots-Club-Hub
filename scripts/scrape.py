"""
Scrapes Selkent divisions/fixtures for a given agegroup_id and writes the
parsed result to data/results.json as a flat snapshot the app can fetch
instantly, instead of hitting Selkent live.

Confirmed against real responses (Sept 2026):

  Divisions: GET /public/divisionsspage/{agegroup_id}
    -> {"success": true, "html": "<div id='divisionContainerN'>...</div>"}
    html contains one <div class="panel-division"> per division:
      .panel-title   -> division name (e.g. "Under 9D Navy")
      .panel-body > div (direct children only) -> one per team name
      .panel-footer  -> "N teams" summary text

  Fixtures: GET /public/fixturespage/{agegroup_id}[/{week_id}]
    -> {"success": true, "html": "<div id='fixtureContainer'></div>"}
    Confirmed empty against agegroup_id=3 (U9) as of Sept 2026 - this is
    EXPECTED, not a bug: fixtures are released irregularly (single matches or
    small batches, roughly a week's notice, no fixed release day), so an
    empty response simply means nothing has been published yet for the
    current window. The workflow polls this once daily to catch a release
    without wasting runs. parse_fixtures() below returns [] on empty, which
    the app should treat as "no fixtures currently published" rather than
    an error state.
    NOTE: parsing logic for a POPULATED response is still unverified - the
    div-per-row structure below is inferred from the divisions endpoint's
    pattern, not confirmed against real fixture HTML. Re-test once a fixture
    batch is actually live and adjust selectors if the real markup differs.
"""

import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

BASE_URL = "https://www.selkent.org.uk/public"

# Your U9 age group. Confirmed: Valiants sit in Under 9D Navy.
AGEGROUP_ID = 3

OUTPUT_PATH = "data/results.json"


def fetch_json(path):
    resp = requests.get(f"{BASE_URL}/{path}", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"Selkent endpoint reported failure for {path}")
    return data["html"]


def parse_divisions(html):
    soup = BeautifulSoup(html, "html.parser")
    divisions = []

    for panel in soup.select(".panel-division"):
        title_el = panel.select_one(".panel-title")
        body_el = panel.select_one(".panel-body")
        footer_el = panel.select_one(".panel-footer")

        if not title_el or not body_el:
            continue

        # Only direct-child divs are team rows; nested divs (if any) are skipped.
        teams = [
            d.get_text(strip=True)
            for d in body_el.find_all("div", recursive=False)
            if d.get_text(strip=True)
        ]

        divisions.append({
            "division_name": title_el.get_text(strip=True),
            "teams": teams,
            "team_count_label": footer_el.get_text(strip=True) if footer_el else None,
        })

    return divisions


def parse_fixtures(html):
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#fixtureContainer")

    if container is None or not container.get_text(strip=True):
        # Confirmed empty as of last test - see module docstring.
        return []

    # NOT YET VERIFIED - placeholder based on the divisions pattern
    # (div-per-row). Replace once a populated fixtures response is captured.
    #
    # ⚠️ BLOCKS CHANGE DETECTION: until this extracts home_team/away_team as
    # separate fields from date/time/venue, detect_changes() below cannot
    # build a stable fixture identity - team pairing is the only thing likely
    # to survive a rescheduling, but it can't be isolated from raw_text alone.
    fixtures = []
    for row in container.find_all("div", recursive=False):
        text = row.get_text(strip=True)
        if text:
            fixtures.append({
                "raw_text": text,
                # TODO once real structure is known: "home_team", "away_team",
                # "date", "time", "venue" as separate fields.
            })
    return fixtures


def fixture_identity(fixture):
    """
    Stable key for matching 'the same fixture' across two runs, so a
    rescheduling shows up as a CHANGE to an existing fixture rather than as
    one fixture disappearing and an unrelated new one appearing.

    ⚠️ PLACEHOLDER: falls back to raw_text, which is NOT stable across a
    date/time/venue change (the change target sits inside the same string
    as the identity). This makes change detection currently non-functional -
    it will treat every change as delete+add rather than a flagged update.

    Fix once parse_fixtures() extracts real fields: return something like
    tuple(sorted([fixture["home_team"], fixture["away_team"]])) instead.
    """
    return fixture.get("raw_text")


def detect_changes(previous_fixtures, current_fixtures):
    """
    Compares two fixture lists by fixture_identity() and returns a list of
    current fixtures annotated with a "change_status" field:
      "new"       - identity wasn't in the previous run
      "unchanged" - identity present and fixture dict is identical
      "updated"   - identity present but some field differs (date/venue/etc)

    Also returns fixtures that disappeared entirely (removed_fixtures),
    which usually means either the fixture was played and moved to results,
    or it was cancelled - the app would need to decide which given other
    context (e.g. cross-check against results data).
    """
    previous_by_id = {fixture_identity(f): f for f in previous_fixtures}
    current_by_id = {fixture_identity(f): f for f in current_fixtures}

    annotated = []
    for fid, fixture in current_by_id.items():
        if fid not in previous_by_id:
            status = "new"
        elif previous_by_id[fid] != fixture:
            status = "updated"
        else:
            status = "unchanged"
        annotated.append({**fixture, "change_status": status})

    removed_ids = set(previous_by_id) - set(current_by_id)
    removed_fixtures = [previous_by_id[fid] for fid in removed_ids]

    return annotated, removed_fixtures


def load_previous_output():
    try:
        with open(OUTPUT_PATH, "r") as f:
            data = json.load(f)
        return data.get("fixtures", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def main():
    divisions_html = fetch_json(f"divisionsspage/{AGEGROUP_ID}")
    divisions = parse_divisions(divisions_html)

    fixtures_html = fetch_json(f"fixturespage/{AGEGROUP_ID}")
    current_fixtures = parse_fixtures(fixtures_html)

    previous_fixtures = load_previous_output()
    annotated_fixtures, removed_fixtures = detect_changes(previous_fixtures, current_fixtures)

    payload = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "agegroup_id": AGEGROUP_ID,
        "divisions": divisions,
        "fixtures": annotated_fixtures,
        "removed_fixtures": removed_fixtures,
        "fixtures_note": "Empty means no fixtures currently published (release "
                          "is irregular, ~1 week's notice) - not an error state. "
                          "change_status/removed_fixtures are NOT reliable yet - "
                          "see fixture_identity() docstring for why.",
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(payload, f, indent=2)

    changed = sum(1 for f in annotated_fixtures if f["change_status"] != "unchanged")
    print(f"Wrote {len(divisions)} divisions, {len(annotated_fixtures)} fixtures "
          f"({changed} new/updated), {len(removed_fixtures)} removed")


if __name__ == "__main__":
    main()
