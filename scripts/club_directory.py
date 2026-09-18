"""
Crawls Selkent's official club directory (/public/clubs/directory) - a
different data source from the age-group divisions sweep in
scrape_directory.py. This is the AUTHORITATIVE club list: each club has a
stable numeric ID and a canonical name (e.g. club "AFC Green Court", id 432).

This matters because the divisions/team data does NOT use these same names -
a division panel lists team names like "AFC Green Court Dukes", which is a
TEAM fielded by the club "AFC Green Court", not a separate club. Treating
team-name strings as club identity (as an earlier version of this pipeline
did) fragments one real club into multiple unrelated-looking entries the
moment a team's name diverges from the club's name - which is the normal
case, not the exception, once a club fields more than one team.

Confirmed structure (Sept 2026): a flat list of
  <div class="col-sm-3"><a href="https://www.selkent.org.uk/public/clubs/{id}">{name}</a></div>
No pagination observed - full list (~130 clubs) on one page.
"""

import re
import requests
from bs4 import BeautifulSoup

DIRECTORY_URL = "https://www.selkent.org.uk/public/clubs/directory"


def scrape_club_directory():
    resp = requests.get(DIRECTORY_URL, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    clubs = []
    for a in soup.select('a[href*="/public/clubs/"]'):
        href = a.get("href", "")
        m = re.search(r"/public/clubs/(\d+)", href)
        if not m:
            continue
        clubs.append({
            "club_id": int(m.group(1)),
            "club_name": a.get_text(strip=True),
        })

    return clubs


def link_teams_to_clubs(clubs, team_names):
    """
    Heuristic linking only - NOT authoritative. Matches a team name to a
    club by checking whether the team name starts with the club's name
    (e.g. club "AFC Green Court" matches team "AFC Green Court Dukes").

    This is a reasonable heuristic given observed samples but is UNVERIFIED
    across the full ~130-club list. Known risk: if two clubs have a name
    that's a prefix of one another (e.g. a hypothetical "Dartford" and
    "Dartford Royals" both as registered clubs), a team like "Dartford
    Royals Blue" could match both - the longest-prefix match is picked to
    reduce this, but ambiguous cases should be reviewed, not trusted blind.

    Returns (linked, unmatched_teams, ambiguous_matches) so failures are
    visible rather than silently wrong.
    """
    linked = []
    unmatched = []
    ambiguous = []

    for team_name in team_names:
        matches = [c for c in clubs if team_name.startswith(c["club_name"])]
        if not matches:
            unmatched.append(team_name)
        elif len(matches) == 1:
            linked.append({"team_name": team_name, **matches[0]})
        else:
            best = max(matches, key=lambda c: len(c["club_name"]))
            linked.append({"team_name": team_name, **best})
            ambiguous.append({
                "team_name": team_name,
                "matched": best["club_name"],
                "other_candidates": [c["club_name"] for c in matches if c != best],
            })

    return linked, unmatched, ambiguous
