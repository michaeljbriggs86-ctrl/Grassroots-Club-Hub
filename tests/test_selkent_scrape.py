import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import scrape

from scrape import (
    SelkentFeedError,
    UnverifiedFixtureMarkupError,
    collect_fixtures,
    collect_standings,
    parse_published_results,
    UnverifiedPublishedResultsMarkupError,
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

    def test_real_status_only_week_is_verified_empty(self):
        # Unchanged public HTML from fixturespage/2/6, captured 14 October 2026.
        html = (ROOT / "tests/fixtures/selkent_fixturespage_2_6_2026_10_14.html").read_text()
        self.assertEqual(parse_fixtures(html), ([], "verified_empty"))

    def test_status_only_week_does_not_mask_unknown_or_malformed_content(self):
        html = (ROOT / "tests/fixtures/selkent_fixturespage_2_6_2026_10_14.html").read_text()
        cases = [
            html.replace("No Game", "Unverified status", 1),
            html.replace('data-team-ids="807;"', 'data-team-ids="807;999;"', 1),
            html.replace('<div id="fixtureContainer">', '<div id="fixtureContainer"><div>Unknown match row</div>', 1),
            html.replace('fixtureRow nonFixture', 'unknownRow', 1),
            html.replace('No Game</div>', 'No Game</div><div>Unknown score</div>', 1),
        ]
        for changed in cases:
            with self.subTest(change=cases.index(changed)):
                with self.assertRaises(UnverifiedFixtureMarkupError):
                    parse_fixtures(changed)

    def test_multiweek_collection_keeps_matches_when_another_week_has_no_games(self):
        no_games = (ROOT / "tests/fixtures/selkent_fixturespage_2_6_2026_10_14.html").read_text()
        matches = '''<div id="fixtureContainer"><h2 class="subHead">18/10/26 - Week 5</h2>
          <div class="panel-title">Under 8 Test</div><div class="fixtureRow" data-team-ids="10;11;">
          <div class="col-xs-5">Example Home</div><div class="col-xs-5">Example Away</div></div></div>'''
        payloads = {"fixturespage/2": '<a data-week-id="5"></a><a data-week-id="6"></a>',
                    "fixturespage/2/5": matches, "fixturespage/2/6": no_games}
        with patch.object(scrape, "fetch_json", side_effect=lambda path: payloads[path]), \
             patch.object(scrape, "_sleep_between_requests", return_value=None):
            result = collect_fixtures({2: "U8"})[2]
        self.assertEqual(result["fixture_week_ids"], [5, 6])
        self.assertEqual(len(result["fixtures"]), 1)
        self.assertEqual(result["fixtures"][0]["date"], "2026-10-18")

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

        self.assertEqual(parse_published_results(html), [])

    def test_real_published_result_shape_ignores_unplayed_matches(self):
        html = """
        <div id="results-4242" class="col-xs-12 col-md-6">
          <h3>Results<span class="pull-right"><button>Print</button></span></h3>
          <div class="panel panel-static">
            <div class="panel-heading">27/09/26 (Week 2)</div>
            <div class="panel-body">
              <div class="row">
                <div class="col-xs-5 resultTeam">Cray Wanderers Spartans</div>
                <div class="col-xs-2 resultScore"></div>
                <div class="col-xs-5 resultTeam">Ebbsfleet United Blue</div>
              </div>
              <div class="row">
                <div class="col-xs-5 resultTeam">Dartford FC White</div>
                <div class="col-xs-2 resultScore"> - </div>
                <div class="col-xs-5 resultTeam">Ballon Dor FC</div>
              </div>
              <div class="row">
                <div class="col-xs-5 resultTeam">Parkwood Rangers Rebels</div>
                <div class="col-xs-2 resultScore">9 - 1</div>
                <div class="col-xs-5 resultTeam">Eversley Rangers</div>
              </div>
            </div>
          </div>
        </div>
        """
        self.assertEqual(parse_published_results(html), [{
            "date": "2026-09-27", "home": "Parkwood Rangers Rebels",
            "away": "Eversley Rangers", "homeGoals": 9, "awayGoals": 1,
        }])

    def test_unknown_populated_results_still_fail_closed(self):
        html = '<div id="results-4253"><h3>Results</h3><div>Home 2 - 1 Away</div></div>'
        with self.assertRaises(UnverifiedPublishedResultsMarkupError):
            parse_published_results(html)

    def test_verified_abandoned_match_is_omitted_without_hiding_scored_match(self):
        # Observed in Selkent's public resultsTable/4273 on 2026-09-27.
        html = '''<div id="results-4273"><div class="panel panel-static">
          <div class="panel-heading">27/09/26 (Week 2)</div><div class="panel-body">
          <div class="row"><div class="resultTeam">Baldon Sports Tigers</div>
          <div class="resultScore">Abandoned</div>
          <div class="resultTeam">Phoenix Sports Cobras</div></div>
          <div class="row"><div class="resultTeam">Metrogas FC Black</div>
          <div class="resultScore">6 - 3</div>
          <div class="resultTeam">Crayford Arrows Black</div></div>
          </div></div></div>'''
        self.assertEqual(parse_published_results(html), [{
            'date': '2026-09-27', 'home': 'Metrogas FC Black',
            'away': 'Crayford Arrows Black', 'homeGoals': 6, 'awayGoals': 3,
        }])

    def test_unverified_score_status_still_fails_closed(self):
        html = '''<div id="results-4253"><div class="panel panel-static">
          <div class="panel-heading">27/09/26 (Week 2)</div><div class="panel-body">
          <div class="row"><div class="resultTeam">Home</div>
          <div class="resultScore">Awarded</div><div class="resultTeam">Away</div>
          </div></div></div></div>'''
        with self.assertRaises(UnverifiedPublishedResultsMarkupError):
            parse_published_results(html)

    def test_collect_standings_includes_only_scored_public_division_results(self):
        divisions = '<a class="tabDivision" data-division-id="4242" aria-controls="Under12X A Navy">A</a>'
        table = '''<div id="results-4242"><h3>Results</h3>
          <div class="panel panel-static"><div class="panel-heading">27/09/26 (Week 2)</div>
          <div class="panel-body"><div class="row">
          <div class="resultTeam">Parkwood Rangers Rebels</div>
          <div class="resultScore">9 - 1</div>
          <div class="resultTeam">Eversley Rangers</div>
          </div></div></div></div>'''
        with patch.object(scrape, 'fetch_json', side_effect=[divisions, table]), \
             patch.object(scrape, 'parse_standings_html', return_value={'rows': []}), \
             patch.object(scrape, '_sleep_between_requests', return_value=None):
            result = collect_standings({6: {'age_group': 'U12X', 'format_type': '9'}})
        self.assertEqual(result[6]['published_results'], [{
            'date': '2026-09-27', 'home': 'Parkwood Rangers Rebels',
            'away': 'Eversley Rangers', 'homeGoals': 9, 'awayGoals': 1,
            'provider_division_id': 4242, 'division_name': 'Under12X A Navy',
        }])


class LeagueOutcomeRegressionTests(unittest.TestCase):
    # Current official public HTML, not a reconstruction of the failed run.
    # Source/date/response hashes are recorded beside the unchanged fixture.
    fixture_path = ROOT / "tests/fixtures/selkent_resultsTable_4250_outcome_2026_10_16.html"
    expected_results = [
        {"date": "2026-10-04", "home": "Eagles & Stars FC", "away": "Old Roan FC Gold", "homeGoals": 1, "awayGoals": 0},
        {"date": "2026-10-04", "home": "London Legends Gold", "away": "Metrogas FC Red", "homeGoals": 4, "awayGoals": 5},
        {"date": "2026-10-04", "home": "Regans FC Black", "away": "Lewisham Project Gold", "homeGoals": 3, "awayGoals": 5},
        {"date": "2026-09-27", "home": "Dulwich Village Black", "away": "Dynamo Youth Silver", "homeGoals": 1, "awayGoals": 3},
        {"date": "2026-09-27", "home": "Metrogas FC Red", "away": "Regans FC Black", "homeGoals": 4, "awayGoals": 3},
        {"date": "2026-09-27", "home": "Old Roan FC Gold", "away": "London Legends Gold", "homeGoals": 3, "awayGoals": 3},
        {"date": "2026-09-27", "home": "SE Dons Football Club", "away": "Cray Valley (PM) FC Black", "homeGoals": 3, "awayGoals": 3},
    ]

    def source(self):
        return self.fixture_path.read_text()

    def outcome_row(self):
        soup = BeautifulSoup(self.source(), "html.parser")
        score = next(cell for cell in soup.select("#results-4250 .resultScore")
                     if cell.get_text(" ", strip=True) == "W - L")
        return soup, score, score.parent

    def collected_results(self):
        return [{**row, "provider_division_id": 4250,
                 "division_name": "Under 12A Silver"} for row in self.expected_results]

    def fixture_html(self, age):
        # Fictional future fixture in the already verified provider shape.
        return f'''<div id="fixtureContainer"><h2 class="subHead">18/10/26 - Week 5</h2>
          <div class="panel-title">{age} Example Division</div>
          <div class="row fixtureRow" data-team-ids="10;11;">
          <div class="col-xs-5">Example Home</div><div class="col-xs-1">v</div>
          <div class="col-xs-5">Example Away</div></div></div>'''

    def payload(self, results_html=None):
        ages = {1: "U7", 2: "U8", 3: "U9", 4: "U10", 5: "U11", 6: "U12"}
        results_parent = '''<ul id="agegroupTabs"><a class="tabAgegroup"
          data-agegroup-id="6" data-format-type="9">U12</a></ul>'''
        public_ages = parse_public_results_agegroups(results_parent)
        payloads = {f"fixturespage/{age_id}": self.fixture_html(age)
                    for age_id, age in ages.items()}
        payloads.update({"results/9/6": '''<a class="tabDivision" data-division-id="4250"
          aria-controls="Under 12A Silver">Under 12A Silver</a>''',
                         "resultsTable/4250": self.source() if results_html is None else results_html})
        with patch.object(scrape, "discover_fixture_agegroups", return_value=(ages, "public")), \
             patch.object(scrape, "discover_public_results_agegroups", return_value=public_ages), \
             patch.object(scrape, "collect_cup_results", return_value={}), \
             patch.object(scrape, "fetch_json", side_effect=lambda target: payloads[target]) as fetch, \
             patch.object(scrape, "_sleep_between_requests", return_value=None):
            result = scrape.build_payload()
        return result, [call.args[0] for call in fetch.call_args_list]

    def test_official_league_walkover_does_not_invent_or_hide_numeric_scores(self):
        raw = self.fixture_path.read_bytes()
        provenance = json.loads(self.fixture_path.with_suffix(".provenance.json").read_text())
        self.assertEqual(len(raw), provenance["html_bytes"])
        self.assertEqual(hashlib.sha256(raw).hexdigest(), provenance["html_sha256"])
        results = parse_published_results(self.source())
        self.assertEqual(results, self.expected_results)
        self.assertFalse(any(row["home"] == "Lewisham Project Gold" and
                             row["away"] == "Eagles & Stars FC" for row in results))
        self.assertTrue(all(type(row["homeGoals"]) is int and type(row["awayGoals"]) is int
                            for row in results))

    def test_known_league_outcome_directions_and_spacing_are_nonnumeric(self):
        for outcome in ["W - L", "L - W", "W-L", "L-W", "W  -\n L", "L\u00a0-\tW"]:
            with self.subTest(outcome=outcome):
                self.assertEqual(parse_published_results(self.source().replace("W - L", outcome)),
                                 self.expected_results)

    def test_unknown_outcomes_do_not_hide_behind_a_recognised_walkover(self):
        for outcome in ["W - W", "L - L", "W - 0", "0 - L", "P - P", "w - l",
                        "W — L", "W - L awarded", "Awarded", "Won on penalties"]:
            with self.subTest(outcome=outcome), self.assertRaises(UnverifiedPublishedResultsMarkupError):
                parse_published_results(self.source().replace("W - L", outcome))
        # A valid walkover does not hide an unrelated unknown neighbouring score.
        with self.assertRaises(UnverifiedPublishedResultsMarkupError):
            parse_published_results(self.source().replace("1 - 0", "Awarded", 1))

    def test_walkovers_with_missing_teams_or_malformed_cells_still_fail_closed(self):
        for team_index in [0, 1]:
            soup, _score, row = self.outcome_row()
            row.select(".resultTeam")[team_index].clear()
            with self.subTest(missing_team=team_index), self.assertRaises(UnverifiedPublishedResultsMarkupError):
                parse_published_results(str(soup))
        for change in ["missing-score", "extra-score", "missing-team-cell", "invalid-date"]:
            soup, score, row = self.outcome_row()
            if change == "missing-score":
                score.extract()
            elif change == "extra-score":
                row.append(BeautifulSoup('<div class="resultScore">W - L</div>', "html.parser"))
            elif change == "missing-team-cell":
                row.select(".resultTeam")[0].extract()
            else:
                row.find_parent(class_="panel-static").select_one(".panel-heading").string = "32/09/26 (Week 2)"
            with self.subTest(change=change), self.assertRaises(UnverifiedPublishedResultsMarkupError):
                parse_published_results(str(soup))

    def test_walkover_collection_keeps_official_standings_and_all_valid_fixtures(self):
        payload, targets = self.payload()
        by_age = {entry["age_group"]: entry for entry in payload["age_groups"]}
        self.assertEqual(len(by_age), 6)
        for age, entry in by_age.items():
            self.assertEqual(entry["fixtures"], [{"date": "2026-10-18",
                "division_name": f"{age} Example Division", "home": "Example Home",
                "away": "Example Away", "provider_team_ids": ["10", "11"]}])
            self.assertEqual(entry["fixture_parse_status"], "verified_fixture_rows_v1")
        self.assertEqual(by_age["U12"]["published_results"], self.collected_results())
        table = by_age["U12"]["standings"][0]
        self.assertEqual(table["division_name"], "Under 12A Silver")
        self.assertEqual(len(table["rows"]), 10)
        self.assertEqual(table["rows"][0], {"row_order": 1, "provider_team_id": 208,
            "provider_division_id": 4250, "team_name": "Lewisham Project Gold", "played": 2,
            "won": 2, "drawn": 0, "lost": 0, "gf": 5, "ga": 3, "points": 4})
        self.assertFalse(table["source_order_authoritative_for_ties"])
        # Only the advertised public U12 results endpoint was fetched; youth fixtures remain available.
        self.assertEqual([target for target in targets if target.startswith("results")],
                         ["results/9/6", "resultsTable/4250"])
        for age in ["U7", "U8", "U9", "U10", "U11"]:
            self.assertIsNone(by_age[age]["standings"])
            self.assertIsNone(by_age[age]["published_results"])
            self.assertEqual(by_age[age]["published_results_status"], "not_publicly_published")

    def test_unknown_league_outcome_aborts_refresh_and_preserves_published_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "results.json"
            previous = {"last_updated": "2026-10-16T02:05:58.429342+00:00", "known_good": True}
            original = json.dumps(previous).encode()
            output.write_bytes(original)
            real_build = scrape.build_payload
            # Exercise main's actual write boundary with a real unknown-outcome parse failure.
            def fail_build(_previous):
                with patch.object(scrape, "build_payload", real_build):
                    return self.payload(self.source().replace("W - L", "W - W"))[0]
            with patch.object(scrape, "OUTPUT_PATH", output), \
                 patch.object(scrape, "build_payload", side_effect=fail_build):
                with self.assertRaises(UnverifiedPublishedResultsMarkupError):
                    scrape.main()
            self.assertEqual(output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
