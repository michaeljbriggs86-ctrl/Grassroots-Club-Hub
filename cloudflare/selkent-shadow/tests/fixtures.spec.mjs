import { describe, expect, it } from 'vitest';
import { fixturePreview, parseFixtures, parseFixtureWeeks } from '../src/fixtures.mjs';
import noGamePage from '../../../tests/fixtures/selkent_fixturespage_2_6_2026_10_14.html?raw';

const page = `<a data-week-id="2">First</a><a data-week-id="3">Second</a>
<a data-week-id="3">Repeat</a><div id="fixtureContainer">
<h2 class="subHead">27/09/26 - Week 2</h2><div class="panel-title">Under 9D Navy</div>
<div class="fixtureRow" data-team-ids="139;972;">
  <div class="col-xs-5">Junior Reds &amp; Friends</div><div class="col-xs-1">v</div>
  <div class="col-xs-5">Shooters Hill AFC Valiants</div>
</div><div class="fixtureRow nonFixture" data-team-ids="2236;">
  <div class="col-xs-5">On Standby</div><div class="col-xs-5">Bye</div>
</div></div>`;

describe('private Cloudflare fixture normalization', () => {
  it('accepts the real 103-row No Game week without manufacturing fixtures', async () => {
    expect(await parseFixtures(noGamePage)).toEqual({ fixtures: [], status: 'verified_empty' });
  });

  it('does not hide unknown or malformed content behind known status rows', async () => {
    for (const changed of [
      noGamePage.replace('No Game', 'Unverified status'),
      noGamePage.replace('data-team-ids="807;"', 'data-team-ids="807;999;"'),
      noGamePage.replace('<div id="fixtureContainer">', '<div id="fixtureContainer"><div>Unknown match row</div>'),
      noGamePage.replace('fixtureRow nonFixture', 'unknownRow'),
      noGamePage.replace('No Game</div>', 'No Game</div><div>Unknown score</div>'),
    ]) await expect(parseFixtures(changed)).rejects.toThrow();
  });

  it('retains real fixtures when another advertised week contains only No Game', async () => {
    const feed = { age_groups: [{ agegroup_id: 2, fixture_week_ids: [5, 6] }] };
    const preview = await fixturePreview({
      'fixturespage/2': '<a data-week-id="5"></a><a data-week-id="6"></a>',
      'fixturespage/2/5': page, 'fixturespage/2/6': noGamePage,
    }, feed);
    expect(preview[2].fixtures).toHaveLength(1);
    expect(preview[2].fixture_parse_status).toBe('verified_multiweek_fixture_rows_v2');
  });

  it('discovers tabs, decodes names, skips standby rows and keeps team IDs', async () => {
    expect(await parseFixtureWeeks(page)).toEqual([2, 3]);
    expect(await parseFixtures(page)).toEqual({ status: 'verified_fixture_rows_v1', fixtures: [{
      date: '2026-09-27', division_name: 'Under 9D Navy',
      home: 'Junior Reds & Friends', away: 'Shooters Hill AFC Valiants',
      provider_team_ids: ['139', '972'],
    }] });
  });

  it('merges repeated weeks and rejects unknown populated markup', async () => {
    const feed = { age_groups: [{ agegroup_id: 3, fixture_week_ids: [2, 3] }] };
    const preview = await fixturePreview({
      'fixturespage/3': page, 'fixturespage/3/2': page, 'fixturespage/3/3': page,
    }, feed);
    expect(preview[3].fixtures).toHaveLength(1);
    expect(preview[3].fixture_parse_status).toBe('verified_multiweek_fixture_rows_v2');
    await expect(parseFixtures('<div id="fixtureContainer">Unrecognized</div>')).rejects.toThrow();
    expect(await parseFixtures('<div id="fixtureContainer"> \n </div>')).toEqual({
      fixtures: [], status: 'verified_empty',
    });
  });
});
