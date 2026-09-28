"""Private shadow comparison: real parsers on synthetic, non-provider data."""

import importlib.util
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve()
MODULE = HERE.parents[1] / "compare_snapshot.py"
SPEC = importlib.util.spec_from_file_location("compare_shadow", MODULE)
compare = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(compare)

TABLE = (HERE.parents[3] / "tests/fixtures/SYNTHETIC_resultsTable_nonzero.html").read_text()


def examples():
    base = '<a data-week-id="2"></a><div id="fixtureContainer"></div>'
    week = '''<div id="fixtureContainer"><h2 class="subHead">27/09/26</h2>
    <div class="panel-title">U8 Test</div>
    <div class="fixtureRow" data-team-ids="10;11;">
    <div class="col-xs-5">Example Home</div><div class="col-xs-5">Example Away</div>
    </div></div>'''
    parsed_table = compare.parse_standings_html(TABLE)
    parsed_table["provider_division_id"] = 990001
    rows, _ = compare.parse_fixtures(week)
    feed = {
        "schema_version": 2, "provider": "Selkent",
        "last_updated": "2026-09-28T00:05:00Z",
        "age_groups": [
            {"agegroup_id": 2, "age_group": "U8", "fixture_week_ids": [2],
             "fixtures": rows, "fixture_parse_status": "verified_multiweek_fixture_rows_v2",
             "standings": None, "published_results": None,
             "published_results_status": "not_publicly_published"},
            {"agegroup_id": 12, "age_group": "U12", "fixture_week_ids": [],
             "fixtures": [], "fixture_parse_status": "verified_empty",
             "standings": [parsed_table], "published_results": [],
             "published_results_status": "verified_scored_rows_v1"},
        ],
    }
    snapshot = {
        "schema": "pitchkind-selkent-shadow-v1",
        "collected_at": "2026-09-28T00:15:00Z",
        "canonical_feed_last_updated": feed["last_updated"],
        "payloads": {"fixturespage/2": base, "fixturespage/2/2": week,
                     "fixturespage/12": '<div id="fixtureContainer"></div>',
                     "resultsTable/990001": TABLE},
    }
    return snapshot, feed


class ShadowParityTests(unittest.TestCase):
    def test_exact_parity_on_synthetic_fixtures_and_standings(self):
        snapshot, feed = examples()
        summary = compare.compare_snapshot(snapshot, feed)
        self.assertEqual(summary["status"], "exact")
        self.assertEqual(summary["parsed_counts"]["fixtures"], 1)
        self.assertEqual(summary["parsed_counts"]["standings_rows"],
                         len(feed["age_groups"][1]["standings"][0]["rows"]))
        self.assertNotIn("Example Home", str(summary))

    def test_drift_is_counted_without_printing_match_details(self):
        snapshot, feed = examples()
        feed["age_groups"][0]["fixtures"] = []
        summary = compare.compare_snapshot(snapshot, feed)
        self.assertEqual(summary["status"], "drift")
        self.assertEqual(summary["different_age_group_counts"]["fixture_age_groups"], 1)
        self.assertNotIn("Example Home", str(summary))

    def test_scored_results_are_compared_with_the_public_feed(self):
        snapshot, feed = examples()
        soup = BeautifulSoup(snapshot["payloads"]["resultsTable/990001"], "html.parser")
        result_panel = soup.select_one("#results-990001")
        scored = BeautifulSoup('''<div class="panel panel-static">
          <div class="panel-heading">27/09/26 (Week 2)</div>
          <div class="panel-body"><div class="row">
            <div class="resultTeam">Home Example</div>
            <div class="resultScore">1 - 2</div>
            <div class="resultTeam">Away Example</div>
          </div></div></div>''', "html.parser")
        result_panel.append(scored)
        snapshot["payloads"]["resultsTable/990001"] = str(soup)
        expected = compare.parse_published_results(str(soup))
        feed["age_groups"][1]["published_results"] = [
            {**row, "provider_division_id": 990001,
             "division_name": feed["age_groups"][1]["standings"][0]["division_name"]}
            for row in expected
        ]
        self.assertEqual(compare.compare_snapshot(snapshot, feed)["status"], "exact")
        feed["age_groups"][1]["published_results"][0]["homeGoals"] = 9
        summary = compare.compare_snapshot(snapshot, feed)
        self.assertEqual(summary["status"], "drift")
        self.assertEqual(summary["different_age_group_counts"]["results_age_groups"], 1)

    def test_restricted_result_leak_fails_even_if_feed_timestamp_differs(self):
        snapshot, feed = examples()
        feed["last_updated"] = "2026-09-28T00:45:00Z"
        feed["age_groups"][0]["published_results"] = [{"homeGoals": 3}]
        with self.assertRaisesRegex(ValueError, "Restricted public age group"):
            compare.compare_snapshot(snapshot, feed)

    def test_private_provider_text_never_appears_in_parser_exception(self):
        snapshot, feed = examples()
        snapshot["payloads"]["fixturespage/2/2"] = (
            '<div id="fixtureContainer">PRIVATE-HTML-SAMPLE</div>')
        with self.assertRaises(ValueError) as raised:
            compare.compare_snapshot(snapshot, feed)
        self.assertNotIn("PRIVATE-HTML-SAMPLE", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
