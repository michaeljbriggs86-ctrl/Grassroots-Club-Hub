"""
Sweeps every Selkent age group's divisions endpoint to build a full
club/team/league directory, separate from the per-team fixtures sync in
scrape.py (different purpose, different update cadence - this barely
changes mid-season, so it doesn't need daily polling).

Two identity spaces, kept separate (see club_directory.py for why):
  - CLUBS: from /public/clubs/directory - stable numeric ID + canonical name
  - TEAMS: from division panels - a team belongs to a club, but its name
    often differs from the club's name once the club fields >1 team

Age-group IDs are discovered dynamically from Selkent's own /public/divisions/all
page (parsing the tab list's data-agegroup-id attributes) rather than
hardcoded, since Selkent could add/renumber age groups between seasons.
The Sept 2026 IDs below are FALLBACK/VALIDATION DATA ONLY - used if dynamic
discovery fails, and to sanity-check that discovery found a plausible set
(e.g. catches a badly-parsed page returning zero or one id).

Confirmed panel-parsing (parse_divisions, reused from scrape.py) works for
all five format categories - mini-soccer (U9, U8), 9-a-side (U12), X-category
(U10X), and 11-a-side (U14, Senior) - each spot-checked against real payload
data with team counts matching their own footer labels exactly. See
STILL_TO_VERIFY below (currently empty).
"""

import json
import os
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

from scrape import BASE_URL, fetch_json, parse_divisions
from club_directory import scrape_club_directory, link_teams_to_clubs

DIVISIONS_ALL_URL = f"{BASE_URL}/divisions/all"

# FALLBACK/VALIDATION ONLY - not the primary source of truth. See docstring.
FALLBACK_AGEGROUP_LABELS = {
    20: "U8X", 2: "U8", 3: "U9", 21: "U10X", 4: "U10", 5: "U11",
    22: "U12X", 6: "U12", 8: "U13", 23: "U14X", 7: "U14", 9: "U15",
    10: "U16", 11: "U17", 17: "Senior",
}

STILL_TO_VERIFY = {}

OUTPUT_PATH = "data/directory.json"
DIAGNOSTICS_PATH = "data/directory_scrape_diagnostics.json"

DELAY_BETWEEN_REQUESTS_SECONDS = 1.5


def discover_agegroup_ids():
    try:
        resp = requests.get(DIVISIONS_ALL_URL, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        discovered = {}
        for tab in soup.select("#divisionTabs a[data-agegroup-id]"):
            agegroup_id = int(tab["data-agegroup-id"])
            label = tab.get_text(strip=True)
            discovered[agegroup_id] = label

        if len(discovered) < len(FALLBACK_AGEGROUP_LABELS) * 0.8:
            print(f"WARNING: dynamic discovery found only {len(discovered)} "
                  f"age groups (expected ~{len(FALLBACK_AGEGROUP_LABELS)}) - "
                  f"falling back to known-good Sept 2026 list.")
            return dict(FALLBACK_AGEGROUP_LABELS), False

        return discovered, True

    except Exception as e:
        print(f"WARNING: dynamic age-group discovery failed ({e}) - "
              f"falling back to known-good Sept 2026 list.")
        return dict(FALLBACK_AGEGROUP_LABELS), False


def build_league_directory(agegroup_labels):
    leagues = []
    failed_ids = []

    for agegroup_id, label in agegroup_labels.items():
        try:
            html = fetch_json(f"divisionsspage/{agegroup_id}")
            divisions = parse_divisions(html)
            for division in divisions:
                leagues.append({
                    "age_group": label,
                    "agegroup_id": agegroup_id,
                    "division_name": division["division_name"],
                    "teams": division["teams"],
                    "team_count_label": division["team_count_label"],
                })
        except Exception as e:
            failed_ids.append({"agegroup_id": agegroup_id, "label": label, "error": str(e)})

        time.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)

    return leagues, failed_ids


def load_previous_output():
    try:
        with open(OUTPUT_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH) or ".", exist_ok=True)

    agegroup_labels, discovery_was_dynamic = discover_agegroup_ids()

    clubs = scrape_club_directory()
    leagues, failed_agegroups = build_league_directory(agegroup_labels)

    all_team_names = [team for division in leagues for team in division["teams"]]
    linked_teams, unmatched_teams, ambiguous_matches = link_teams_to_clubs(clubs, all_team_names)

    diagnostics = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "discovery_was_dynamic": discovery_was_dynamic,
        "agegroups_swept": len(agegroup_labels),
        "failed_agegroups": failed_agegroups,
        "still_to_verify": STILL_TO_VERIFY,
        "unmatched_teams": unmatched_teams,
        "ambiguous_club_matches": ambiguous_matches,
    }
    with open(DIAGNOSTICS_PATH, "w") as f:
        json.dump(diagnostics, f, indent=2)

    if failed_agegroups:
        print(f"PUBLICATION SKIPPED: {len(failed_agegroups)} age group(s) "
              f"failed - {[f['label'] for f in failed_agegroups]}. "
              f"Previous directory.json left unchanged. See "
              f"{DIAGNOSTICS_PATH} for details.")
        return

    payload = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "clubs": clubs,
        "leagues": leagues,
        "team_club_links": linked_teams,
        "note": "Panel parsing confirmed against all five format categories "
                "(mini-soccer, 9-a-side, X-category, 11-a-side, Senior) as of "
                "Sept 2026. Club/team linking is heuristic (name-prefix "
                "match) - see ambiguous_club_matches in diagnostics for "
                "anything flagged as uncertain.",
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"PUBLISHED: {len(clubs)} clubs, {len(leagues)} league divisions, "
          f"{len(linked_teams)} teams linked ({len(unmatched_teams)} unmatched, "
          f"{len(ambiguous_matches)} ambiguous) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
