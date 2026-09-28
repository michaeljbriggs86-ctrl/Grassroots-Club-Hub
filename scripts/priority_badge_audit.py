#!/usr/bin/env python3
"""Select badge candidates for clubs playing the pilot club now.

Only schedules acquisition/review. No image is approved or published here.
"""
import argparse
from collections import defaultdict
from datetime import date, timedelta
import json
from pathlib import Path


def club_for_team(name, links, clubs):
    exact = {int(link["club_id"]) for link in links
             if link.get("team_name", "").casefold() == name.casefold()
             and str(link.get("club_id", "")).isdigit()}
    if len(exact) == 1:
        club_id = exact.pop()
        return clubs.get(club_id)
    if exact:
        return None
    # A team suffix such as "Ambers" may not be in the directory yet.
    # Match a complete club-name prefix, never a partial word or a fuzzy name.
    matches = [club for club in clubs.values()
               if name.casefold() == club["club_name"].casefold()
               or name.casefold().startswith(club["club_name"].casefold() + " ")]
    if not matches:
        return None
    matches.sort(key=lambda club: len(club["club_name"]), reverse=True)
    if len(matches) > 1 and len(matches[0]["club_name"]) == len(matches[1]["club_name"]):
        return None
    return matches[0]


def priority_rows(catalog, directory, feed, admitted, pilot_id, today):
    clubs = {int(c["club_id"]): c for c in catalog["clubs"]}
    if pilot_id not in clubs:
        raise ValueError("pilot club is absent from badge catalogue")
    links = directory["team_club_links"]
    admitted_ids = {int(c["club_id"]) for c in admitted["badges"]}
    counts = defaultdict(lambda: {"published": 0, "upcoming": 0, "score": 0})
    seen = set()
    for age in feed["age_groups"]:
        for kind, matches in (("published", age.get("published_results", [])),
                              ("upcoming", age.get("fixtures", []))):
            for match in matches:
                when = date.fromisoformat(match["date"])
                if kind == "published" and not today - timedelta(days=30) <= when <= today:
                    continue
                if kind == "upcoming" and not today <= when <= today + timedelta(days=14):
                    continue
                home = club_for_team(match["home"], links, clubs)
                away = club_for_team(match["away"], links, clubs)
                if home and int(home["club_id"]) == pilot_id:
                    opponent = away
                elif away and int(away["club_id"]) == pilot_id:
                    opponent = home
                else:
                    continue
                if not opponent or int(opponent["club_id"]) in admitted_ids | {pilot_id}:
                    continue
                key = (kind, age["age_group"], match["date"],
                       match["home"], match["away"])
                if key in seen:
                    continue
                seen.add(key)
                row = counts[int(opponent["club_id"])]
                row[kind] += 1
                row["score"] += 3 if kind == "published" else (2 if when <= today + timedelta(days=7) else 1)
    rows = []
    for club_id, count in counts.items():
        club = clubs[club_id]
        rows.append({
            "club_id": club_id,
            "club_name": club["club_name"],
            "score": count["score"],
            "published": count["published"],
            "upcoming": count["upcoming"],
            "candidate_status": club.get("logo_status", "missing"),
            "candidate_source": club.get("logo_source"),
            "technical_status": club.get("technical_quality_status"),
            "next_action": club.get("verification_action")
        })
    return sorted(rows, key=lambda row: (-row["score"],
                                         row["candidate_status"] == "missing",
                                         row["club_name"].casefold()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default="verification/club_badge_catalogue_seed_v25.json")
    parser.add_argument("--directory", default="data/directory.json")
    parser.add_argument("--results", default="data/results.json")
    parser.add_argument("--admitted", default="verification/pilot_verified_badges.json")
    parser.add_argument("--pilot-club-id", type=int, default=499)
    parser.add_argument("--reference-date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    files = [json.loads(Path(path).read_text(encoding="utf-8")) for path in
             (args.catalog, args.directory, args.results, args.admitted)]
    rows = priority_rows(*files, args.pilot_club_id, args.reference_date)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            "reference_date": args.reference_date.isoformat(),
            "pilot_club_id": args.pilot_club_id,
            "review_only": True,
            "clubs": rows
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(",".join(str(row["club_id"]) for row in rows))


if __name__ == "__main__":
    main()
