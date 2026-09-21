import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import scrape

from scrape import (
    SelkentFeedError,
    UnverifiedFixtureMarkupError,
    collect_fixtures,
    has_unparsed_published_results,
    merge_fixture_rows,
    parse_divisions,
    parse_fixture_week_ids,
    parse_fixtures,
    parse_public_results_agegroups,
    parse_results_divisions,
)


class GeneralizedSelkentFeedTests(unittest.TestCase):
    def test_parse_divisions_remains_available_for_directory_scraper(self):
        html = """
        <div class="panel-division">
          <div class="panel-title">Under 9 Test</div>
          <div class="panel-body">
            <div>Example Athletic</div>
            <div>Example Borough</div>
          </div>
          <div class="panel-footer">2 teams</div>
        </div>
        """

        self.assertEqual(
            parse_divisions(html),
            [
                {
                    "division_name": "Under 9 Test",
                    "teams": [
                        "Example Athletic",
                        "Example Borough",
                    ],
                    "team_count_label": "2 teams",
                }
            ],
        )

    def test_parse_public_results_agegroups(self):
        html = """
        <ul id="agegroupTabs">
          <li>
            <a class="tabAgegroup"
               data-agegroup-id="6"
               data-format-type="9">U12</a>
          </li>
          <li>
            <a class="tabAgegroup"
               data-agegroup-id="8"
               data-format-type="9">U13</a>
          </li>
        </ul>
        """

        self.assertEqual(
            parse_public_results_agegroups(html),
            {
                6: {"age_group": "U12", "format_type": "9"},
                8: {"age_group": "U13", "format_type": "9"},
            },
        )

    def test_parse_results_divisions(self):
        html = """
        <ul id="divisionTabs">
          <li>
            <a class="tabDivision"
               data-division-id="4253"
               aria-controls="Under 12B Silver">
              U12B Silver
            </a>
          </li>
          <li>
            <a class="tabDivision"
               data-division-id="4254"
               aria-controls="Under 12C">
              U12C
            </a>
          </li>
        </ul>
        """

        self.assertEqual(
            parse_results_divisions(html),
            [
                {
                    "provider_division_id": 4253,
                    "division_name": "Under 12B Silver",
                },
                {
                    "provider_division_id": 4254,
                    "division_name": "Under 12C",
                },
            ],
        )

    def test_verified_empty_fixture_container_is_allowed(self):
        fixtures, status = parse_fixtures(
            '<div id="fixtureContainer"> \n\t </div>'
        )

        self.assertEqual(fixtures, [])
        self.assertEqual(status, "verified_empty")

    def test_verified_populated_fixture_rows_parse(self):
        html = """
        <div id="fixtureContainer">
          <h2 class="subHead">
            <a name="U92026-09-27"></a>
            27/09/26 - Week 2
          </h2>
          <div class="panel panel-static">
            <div class="panel-heading">
              <div class="panel-title">Under 9D Navy</div>
            </div>
            <div class="panel-body">
              <div class="row fixtureRow"
                   data-team-ids="139;972;">
                <div class="col-xs-5">Junior Reds Sabres</div>
                <div class="col-xs-1">v</div>
                <div class="col-xs-5">Shooters Hill AFC Valiants</div>
              </div>
              <div class="row fixtureRow nonFixture"
                   data-team-ids="2236;">
                <div class="col-xs-5">Blackheath Rhinos Grey</div>
                <div class="col-xs-1"></div>
                <div class="col-xs-5">On Standby</div>
              </div>
            </div>
          </div>
        </div>
        """

        fixtures, status = parse_fixtures(html)

        self.assertEqual(status, "verified_fixture_rows_v1")
        self.assertEqual(
            fixtures,
            [
                {
                    "date": "2026-09-27",
                    "division_name": "Under 9D Navy",
                    "home": "Junior Reds Sabres",
                    "away": "Shooters Hill AFC Valiants",
                    "provider_team_ids": ["139", "972"],
                }
            ],
        )


    def test_fixture_week_ids_are_discovered_from_real_provider_shape(self):
        html = """
        <div>
          <a data-week-id="2" role="tab" data-toggle="tab">27/09/26</a>
          <a data-week-id="3" role="tab" data-toggle="tab">04/10/26</a>
          <a data-week-id="3" role="tab" data-toggle="tab">duplicate</a>
        </div>
        """
        self.assertEqual(parse_fixture_week_ids(html), [2, 3])

    def test_verified_week_three_valiants_fixture_parses(self):
        html = """
        <div id="fixtureContainer">
          <h2 class="subHead">04/10/26 - Week 3</h2>
          <div class="panel panel-static">
            <div class="panel-heading">
              <div class="panel-title">Under 9D Navy</div>
            </div>
            <div class="panel-body">
              <div class="row fixtureRow" data-team-ids="972;999;">
                <div class="col-xs-5">Shooters Hill AFC Valiants</div>
                <div class="col-xs-1">v</div>
                <div class="col-xs-5">Phoenix Sports Panthers</div>
              </div>
            </div>
          </div>
        </div>
        """
        fixtures, status = parse_fixtures(html)
        self.assertEqual(status, "verified_fixture_rows_v1")
        self.assertEqual(fixtures[0]["date"], "2026-10-04")
        self.assertEqual(fixtures[0]["home"], "Shooters Hill AFC Valiants")
        self.assertEqual(fixtures[0]["away"], "Phoenix Sports Panthers")

    def test_collect_fixtures_fetches_every_advertised_week_without_u9_special_case(self):
        base = """
        <div>
          <a data-week-id="2" role="tab" data-toggle="tab">27/09/26</a>
          <a data-week-id="3" role="tab" data-toggle="tab">04/10/26</a>
          <div id="fixtureContainer"></div>
        </div>
        """
        week_two = """
        <div id="fixtureContainer">
          <h2 class="subHead">27/09/26 - Week 2</h2>
          <div class="panel-title">Under 8 Test</div>
          <div class="fixtureRow" data-team-ids="10;11;">
            <div class="col-xs-5">Example Home</div>
            <div class="col-xs-1">v</div>
            <div class="col-xs-5">Example Away</div>
          </div>
        </div>
        """
        week_three = """
        <div id="fixtureContainer">
          <h2 class="subHead">04/10/26 - Week 3</h2>
          <div class="panel-title">Under 8 Test</div>
          <div class="fixtureRow" data-team-ids="12;13;">
            <div class="col-xs-5">Second Home</div>
            <div class="col-xs-1">v</div>
            <div class="col-xs-5">Second Away</div>
          </div>
        </div>
        """
        payloads = {
            "fixturespage/2": base,
            "fixturespage/2/2": week_two,
            "fixturespage/2/3": week_three,
        }

        with patch.object(scrape, "fetch_json", side_effect=lambda path: payloads[path]) as fetch:
            with patch.object(scrape, "_sleep_between_requests", return_value=None):
                result = collect_fixtures({2: "U8"})

        self.assertEqual(
            [call.args[0] for call in fetch.call_args_list],
            ["fixturespage/2", "fixturespage/2/2", "fixturespage/2/3"],
        )
        self.assertEqual(result[2]["fixture_week_ids"], [2, 3])
        self.assertEqual(
            [row["date"] for row in result[2]["fixtures"]],
            ["2026-09-27", "2026-10-04"],
        )
        self.assertEqual(
            result[2]["fixture_parse_status"],
            "verified_multiweek_fixture_rows_v2",
        )

    def test_merge_fixture_rows_deduplicates_stable_provider_identity(self):
        row = {
            "date": "2026-10-04",
            "division_name": "Under 9D Navy",
            "home": "Shooters Hill AFC Valiants",
            "away": "Phoenix Sports Panthers",
            "provider_team_ids": ["972", "999"],
        }
        self.assertEqual(merge_fixture_rows([row], [dict(row)]), [row])

    def test_unknown_populated_fixture_markup_still_fails_closed(self):
        html = """
        <div id="fixtureContainer">
          <div>Fictional Home v Fictional Away</div>
        </div>
        """

        with self.assertRaises(UnverifiedFixtureMarkupError):
            parse_fixtures(html)

    def test_missing_fixture_container_is_rejected(self):
        with self.assertRaises(SelkentFeedError):
            parse_fixtures("<div>nothing here</div>")

    def test_empty_results_panel_is_not_a_published_result(self):
        html = """
        <div class="row">
          <div id="results-4253">
            <h3>
              Results
              <span><button type="button">Print</button></span>
            </h3>
          </div>
        </div>
        """

        self.assertFalse(has_unparsed_published_results(html))

    def test_nonempty_results_panel_is_detected(self):
        html = """
        <div class="row">
          <div id="results-4253">
            <h3>Results</h3>
            <div>Fictional Athletic 2 - 1 Example Borough</div>
          </div>
        </div>
        """

        self.assertTrue(has_unparsed_published_results(html))


if __name__ == "__main__":
    unittest.main()
