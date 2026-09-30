"""Identity safety and ordering for the focused badge review queue."""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from priority_badge_audit import club_for_team, priority_rows


class PriorityBadgeAuditTests(unittest.TestCase):
    def test_uses_exact_directory_link_before_club_name_prefix(self):
        clubs = {
            499: {"club_id": 499, "club_name": "Shooters Hill AFC"},
            250: {"club_id": 250, "club_name": "Cray Wanderers"},
            251: {"club_id": 251, "club_name": "Cray Wanderers Youth"},
        }
        links = [{"team_name": "Cray Wanderers Youth Lions", "club_id": 251}]
        self.assertEqual(club_for_team("Cray Wanderers Youth Lions", links, clubs)["club_id"], 251)
        self.assertIsNone(club_for_team("Cray Wanderers United", links, {499: clubs[499]}))

    def test_prioritises_published_and_soon_and_excludes_admitted(self):
        clubs = [
            {"club_id": 499, "club_name": "Shooters Hill AFC"},
            {"club_id": 250, "club_name": "Cray Wanderers"},
            {"club_id": 292, "club_name": "Junior Reds", "logo_status": "unverified"},
            {"club_id": 269, "club_name": "Eversley Rangers", "logo_status": "missing"},
        ]
        fixture = lambda day, team: {"date": day, "home": "Shooters Hill AFC Valiants", "away": team}
        feed = {"age_groups": [{"age_group": "U9",
            "fixtures": [fixture("2026-10-01", "Eversley Rangers Red"),
                         fixture("2026-10-05", "Cray Wanderers Lions")],
            "published_results": [fixture("2026-09-26", "Junior Reds Sabres")]}]}
        got = priority_rows({"clubs": clubs}, {"team_club_links": []},
                            feed, {"badges": [{"club_id": 250}]},
                            499, date(2026, 9, 27))
        self.assertEqual([row["club_id"] for row in got], [292, 269])
        self.assertEqual(got[0]["score"], 3)
        self.assertEqual(got[1]["score"], 2)

    def test_empty_feed_sections_can_be_null(self):
        catalog = {"clubs": [{"club_id": 499, "club_name": "Shooters Hill AFC"}]}
        feed = {"age_groups": [{"age_group": "U9", "fixtures": None,
                                "published_results": None}]}
        self.assertEqual(priority_rows(catalog, {"team_club_links": []},
                                       feed, {"badges": []}, 499, date(2026, 9, 30)), [])


if __name__ == "__main__":
    unittest.main()
