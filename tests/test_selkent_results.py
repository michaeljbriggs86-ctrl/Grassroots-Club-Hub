import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.selkent_results import (
    StandingsParseError,
    parse_standings_html,
)


FIXTURE_PATH = (
    Path(__file__).parent
    / "fixtures"
    / "SYNTHETIC_resultsTable_nonzero.html"
)


class SelkentStandingsParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = FIXTURE_PATH.read_text(encoding="utf-8")
        cls.parsed = parse_standings_html(cls.html)

    def test_fixture_is_explicitly_synthetic(self):
        self.assertIn(
            "SYNTHETIC TEST FIXTURE — NOT REAL SELKENT DATA",
            self.html,
        )

    def test_reads_division_metadata(self):
        self.assertEqual(
            self.parsed["division_name"],
            "SYNTHETIC Under 12 Test Division",
        )
        self.assertEqual(
            self.parsed["updated_at_text"],
            "SYNTHETIC",
        )

    def test_parses_all_four_rows(self):
        rows = self.parsed["rows"]
        self.assertEqual(len(rows), 4)

    def test_first_row_non_zero_values(self):
        row = self.parsed["rows"][0]

        self.assertEqual(
            row,
            {
                "row_order": 1,
                "provider_team_id": 900001,
                "provider_division_id": 990001,
                "team_name": "Synthetic Albion",
                "played": 5,
                "won": 4,
                "drawn": 1,
                "lost": 0,
                "gf": 13,
                "ga": 4,
                "points": 13,
            },
        )

    def test_multi_digit_values_are_preserved(self):
        first = self.parsed["rows"][0]
        fourth = self.parsed["rows"][3]

        self.assertEqual(first["gf"], 13)
        self.assertEqual(first["points"], 13)
        self.assertEqual(fourth["ga"], 17)

    def test_equal_points_preserve_source_row_order(self):
        first = self.parsed["rows"][0]
        second = self.parsed["rows"][1]

        self.assertEqual(first["points"], 13)
        self.assertEqual(second["points"], 13)

        self.assertEqual(first["row_order"], 1)
        self.assertEqual(second["row_order"], 2)

    def test_parser_never_invents_position(self):
        self.assertNotIn("position", self.parsed)

        for row in self.parsed["rows"]:
            self.assertNotIn("position", row)

    def test_tied_order_is_explicitly_non_authoritative(self):
        self.assertFalse(
            self.parsed["source_order_authoritative_for_ties"]
        )
        self.assertIsNotNone(self.parsed["source_disclaimer"])
        self.assertIn(
            "equal points",
            self.parsed["source_disclaimer"].lower(),
        )

    def test_provider_ids_are_preserved_as_metadata(self):
        ids = [
            row["provider_team_id"]
            for row in self.parsed["rows"]
        ]

        self.assertEqual(
            ids,
            [900001, 900002, 900003, 900004],
        )

        division_ids = {
            row["provider_division_id"]
            for row in self.parsed["rows"]
        }

        self.assertEqual(division_ids, {990001})

    def test_blank_or_dash_stat_is_unknown_not_zero(self):
        html = self.html.replace(
            '<td style="text-align:center;">13</td>',
            '<td style="text-align:center;">—</td>',
            1,
        )

        parsed = parse_standings_html(html)
        self.assertIsNone(parsed["rows"][0]["gf"])

    def test_invalid_stat_fails_closed(self):
        html = self.html.replace(
            '<td style="text-align:center;">13</td>',
            '<td style="text-align:center;">thirteen</td>',
            1,
        )

        with self.assertRaises(StandingsParseError):
            parse_standings_html(html)

    def test_wrong_table_shape_is_rejected(self):
        html = """
        <table>
          <thead>
            <tr><th>Team</th><th>Points</th></tr>
          </thead>
          <tbody>
            <tr><td>Fake</td><td>3</td></tr>
          </tbody>
        </table>
        """

        with self.assertRaises(StandingsParseError):
            parse_standings_html(html)


if __name__ == "__main__":
    unittest.main()
