"""Public cupspage captures fetched 2026-10-11; whitespace normalized only."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from scrape import build_payload, collect_cup_results, parse_published_cup_results, SelkentFeedError, UnverifiedPublishedResultsMarkupError


class CupResultsTests(unittest.TestCase):
    def source(self, age_id):
        return (ROOT / f"tests/fixtures/selkent_cupspage_{age_id}_2026_10_11.html").read_text()

    def test_real_scored_cups_and_unplayed_ties(self):
        rows = parse_published_cup_results(self.source(6), 6)
        self.assertEqual(len(rows), 30)
        cannons = next(r for r in rows if r['away'] == 'Shooters Hill AFC Cannons')
        self.assertEqual((cannons['date'], cannons['homeGoals'], cannons['awayGoals'], cannons['competition']),
                         ('2026-10-11', 2, 3, 'Selkent Cup Two'))
        self.assertEqual(cannons['provider_match_ref'], 'B')
        self.assertFalse(any(r['away'] == 'Shooters Hill AFC Lions' for r in rows))
        u15 = parse_published_cup_results(self.source(9), 9)
        self.assertEqual(next(r for r in u15 if r['away'] == 'Shooters Hill AFC Cannons')['awayGoals'], 5)
        self.assertFalse(any('withdrawn' in r['away'] for r in u15))

    def test_date_override_and_range_start(self):
        rows = parse_published_cup_results(self.source(7), 7)
        self.assertEqual(next(r for r in rows if r['home'] == 'IEXEL F.C Gold')['date'], '2026-10-11')
        self.assertEqual(next(r for r in rows if r['home'] == 'North Kent Wolves FC')['date'], '2026-10-04')

    def test_single_competition_with_no_scored_matches(self):
        self.assertEqual(parse_published_cup_results(self.source(11), 11), [])

    def test_unknown_score_or_markup_fails_closed(self):
        for html in [self.source(6).replace('2 - 3', 'Won on penalties'),
                     self.source(6).replace('class="col-xs-1 vCol"', 'class="new-score"'),
                     '<p>Results moved</p>', self.source(6).replace('11/10/26', '32/10/26')]:
            with self.subTest(html=html[:40]), self.assertRaises(UnverifiedPublishedResultsMarkupError):
                parse_published_cup_results(html, 6)

    def test_only_advertised_public_eligible_ages_are_fetched(self):
        tabs = '<ul id="cupTabs"><a data-agegroup-id="4">U9</a><a data-agegroup-id="6">U12</a><a data-agegroup-id="8">U13</a></ul>'
        with patch('scrape.fetch_text', side_effect=[tabs, '<ul id="cupTabs"><a data-agegroup-id="11">U17</a></ul>']), patch('scrape.fetch_json', return_value=self.source(6)) as fetch, patch('scrape._sleep_between_requests'):
            results = collect_cup_results({4: {'age_group': 'U9', 'format_type': '9'}, 6: {'age_group': 'U12', 'format_type': '9'}})
        self.assertEqual(set(results), {6})
        fetch.assert_called_once_with('cupspage/6')

    def outcome_source(self):
        return (ROOT / 'tests/fixtures/selkent_cupspage_8_outcome_2026_10_12.html').read_text()

    def test_u12x_cups_are_deferred_without_skipping_neighbouring_ages(self):
        tabs = '<ul id="cupTabs"><a data-agegroup-id="6">U12</a><a data-agegroup-id="22">U12X</a><a data-agegroup-id="8">U13</a></ul>'
        ages = {6: {'age_group': 'U12', 'format_type': '9'},
                22: {'age_group': 'U12X', 'format_type': '9'},
                8: {'age_group': 'U13', 'format_type': '9'}}
        with patch('scrape.fetch_text', side_effect=[tabs, '<ul id="cupTabs"><a data-agegroup-id="11">U17</a></ul>']), patch('scrape.fetch_json', return_value=self.source(6)) as fetch, patch('scrape._sleep_between_requests'):
            results = collect_cup_results(ages)
        self.assertEqual(set(results), {6, 8})
        self.assertEqual([call.args[0] for call in fetch.call_args_list], ['cupspage/6', 'cupspage/8'])
        with patch('scrape.fetch_text', return_value=tabs), patch('scrape.fetch_json', side_effect=SelkentFeedError('provider failure')):
            with self.assertRaises(SelkentFeedError):
                collect_cup_results(ages)

    def test_deferred_cups_still_validate_provider_metadata(self):
        tabs = '<ul id="cupTabs"><a data-agegroup-id="22">U12</a></ul>'
        with patch('scrape.fetch_text', return_value=tabs), patch('scrape.fetch_json') as fetch:
            with self.assertRaises(SelkentFeedError):
                collect_cup_results({22: {'age_group': 'U12X', 'format_type': '9'}})
            fetch.assert_not_called()

    def test_payload_marks_deferred_cups_and_preserves_u12x_league_data(self):
        fixture = {'age_group': 'U12X', 'fixtures': [{'home': 'Home', 'away': 'Away'}],
                   'fixture_parse_status': 'verified_populated', 'fixture_week_ids': [1]}
        league = {'age_group': 'U12X', 'format_type': '9', 'standings': [{'rows': []}],
                  'published_results': [{'home': 'Home', 'away': 'Away', 'homeGoals': 1, 'awayGoals': 0}],
                  'published_results_status': 'verified_scored_rows_v1'}
        with patch('scrape.discover_fixture_agegroups', return_value=({22: 'U12X'}, 'public')), patch('scrape.discover_public_results_agegroups', return_value={22: {'age_group': 'U12X', 'format_type': '9'}}), patch('scrape.collect_fixtures', return_value={22: fixture}), patch('scrape.collect_standings', return_value={22: league}), patch('scrape.collect_cup_results', return_value={}):
            payload = build_payload()
        age = payload['age_groups'][0]
        self.assertEqual(age['fixtures'], fixture['fixtures'])
        self.assertEqual(age['standings'], league['standings'])
        self.assertEqual(age['published_results'], league['published_results'])
        self.assertEqual(age['cup_results_status'], 'deferred')
        self.assertEqual(payload['coverage']['published_results']['deferred_cup_age_groups'],
                         [{'agegroup_id': 22, 'age_group': 'U12X', 'reason': age['cup_results_deferred_reason']}])

    def test_live_win_loss_outcome_does_not_stop_numeric_results(self):
        html = self.outcome_source()
        rows = parse_published_cup_results(html, 8)
        self.assertEqual([(r['homeGoals'], r['awayGoals']) for r in rows], [(2, 3), (3, 1), (3, 5)],
                         'all three neighbouring numeric cup scores are retained')
        self.assertFalse(any(r['home'] == 'Sporting Club Vista' for r in rows))
        self.assertTrue(all(isinstance(r['homeGoals'], int) and isinstance(r['awayGoals'], int) for r in rows))
        for marker in ['L - W', 'W-L', 'L-W']:
            with self.subTest(marker=marker):
                self.assertEqual(parse_published_cup_results(html.replace('W - L', marker), 8), rows)

    def test_unknown_outcomes_and_missing_teams_still_fail_closed(self):
        html = self.outcome_source()
        for marker in ['W - W', 'L - L', 'W - 0', 'P - P', 'Won on penalties', 'w - l']:
            with self.subTest(marker=marker), self.assertRaises(UnverifiedPublishedResultsMarkupError):
                parse_published_cup_results(html.replace('W - L', marker), 8)
        with self.assertRaises(UnverifiedPublishedResultsMarkupError):
            parse_published_cup_results(html.replace('Sporting Club Vista ', ''), 8)


if __name__ == '__main__':
    unittest.main()
