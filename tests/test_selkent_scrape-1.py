import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from scrape import (
    SelkentFeedError,
    UnverifiedFixtureMarkupError,
    has_unparsed_published_results,
    parse_divisions,
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

    def test_populated_fixture_markup_fails_closed(self):
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
