import { describe, expect, it } from 'vitest';
import { parsePublishedResults, publishedResultsPreview } from '../src/published-results.mjs';
import officialLeagueOutcome from '../../../tests/fixtures/selkent_resultsTable_4250_outcome_2026_10_16.html?raw';

const html = `<div id="results-4249"><h3>Results<button>Print</button></h3>
<div class="panel panel-static"><div class="panel-heading">27/09/26 (Week 2)</div>
<div class="panel-body">
<div class="row"><div class="resultTeam">Alpha &amp; Sons</div>
<div class="resultScore">9 - 1</div><div class="resultTeam">Bravo</div></div>
<div class="row"><div class="resultTeam">Charlie</div>
<div class="resultScore">Abandoned</div><div class="resultTeam">Delta</div></div>
<div class="row"><div class="resultTeam">Echo</div>
<div class="resultScore"> - </div><div class="resultTeam">Foxtrot</div></div>
<div class="row"><div class="resultTeam">Golf</div>
<div class="resultScore"></div><div class="resultTeam">Hotel</div></div>
</div></div></div>`;

// Unchanged official public resultsTable/4250, captured 16 October 2026.
// Provenance and response hashes are recorded beside the shared HTML fixture.
const expectedOfficialResults = [
  { date: '2026-10-04', home: 'Eagles & Stars FC', away: 'Old Roan FC Gold', homeGoals: 1, awayGoals: 0 },
  { date: '2026-10-04', home: 'London Legends Gold', away: 'Metrogas FC Red', homeGoals: 4, awayGoals: 5 },
  { date: '2026-10-04', home: 'Regans FC Black', away: 'Lewisham Project Gold', homeGoals: 3, awayGoals: 5 },
  { date: '2026-09-27', home: 'Dulwich Village Black', away: 'Dynamo Youth Silver', homeGoals: 1, awayGoals: 3 },
  { date: '2026-09-27', home: 'Metrogas FC Red', away: 'Regans FC Black', homeGoals: 4, awayGoals: 3 },
  { date: '2026-09-27', home: 'Old Roan FC Gold', away: 'London Legends Gold', homeGoals: 3, awayGoals: 3 },
  { date: '2026-09-27', home: 'SE Dons Football Club', away: 'Cray Valley (PM) FC Black', homeGoals: 3, awayGoals: 3 },
];
const officialOutcomeRow = officialLeagueOutcome.match(/<div class="row">\s*<div class="col-xs-5 resultTeam"[^>]*>Lewisham Project Gold<\/div>\s*<div class="col-xs-2 resultScore">\s*W - L\s*<\/div>\s*<div class="col-xs-5 resultTeam">Eagles & Stars FC\s*<\/div>\s*<\/div>/)?.[0];

describe('private Cloudflare published results parser', () => {
  it('decodes scored U12+ matches and omits unplayed and abandoned rows', async () => {
    expect(await parsePublishedResults(html, 4249)).toEqual([{
      date: '2026-09-27', home: 'Alpha & Sons', away: 'Bravo', homeGoals: 9, awayGoals: 1,
    }]);
    const preview = await publishedResultsPreview({ 'resultsTable/4249': html }, {
      age_groups: [
        { agegroup_id: 3, age_group: 'U9', standings: null },
        { agegroup_id: 6, age_group: 'U12', standings: [
          { provider_division_id: 4249, division_name: 'Under 12 Test' },
        ] },
      ],
    });
    expect(Object.keys(preview)).toEqual(['6']);
    expect(preview[6][0]).toMatchObject({ provider_division_id: 4249,
      division_name: 'Under 12 Test' });
  });

  it('fails closed for unsupported results and accepts verified empty panel', async () => {
    const unknown = html.replace('9 - 1', 'Awarded');
    await expect(parsePublishedResults(unknown, 4249)).rejects.toThrow('Unsupported private result');
    await expect(parsePublishedResults('<div id="results-4249"><h3>Results</h3>' +
      '<div>Unknown match data</div></div>', 4249)).rejects.toThrow('Unsupported populated');
    await expect(parsePublishedResults('<div id="results-4249"><h3>Results' +
      '<button>Print</button></h3></div>', 4249)).resolves.toEqual([]);
    await expect(parsePublishedResults(html.replace('27/09/26', '31/02/26'), 4249))
      .rejects.toThrow('Invalid private results date');
  });

  it('keeps all seven official league scores without inventing goals for a walkover', async () => {
    const results = await parsePublishedResults(officialLeagueOutcome, 4250);
    expect(results).toEqual(expectedOfficialResults);
    expect(results.some(row => row.home === 'Lewisham Project Gold' && row.away === 'Eagles & Stars FC')).toBe(false);
    expect(results.every(row => Number.isInteger(row.homeGoals) && Number.isInteger(row.awayGoals))).toBe(true);
  });

  it('recognises only verified win-loss directions and whitespace variants as nonnumeric', async () => {
    for (const outcome of ['W - L', 'L - W', 'W-L', 'L-W', 'W  -\n L', 'L\u00a0-\tW']) {
      expect(await parsePublishedResults(officialLeagueOutcome.replace('W - L', outcome), 4250))
        .toEqual(expectedOfficialResults);
    }
  });

  it('rejects unknown outcomes even beside a recognised walkover', async () => {
    for (const outcome of ['W - W', 'L - L', 'W - 0', '0 - L', 'P - P', 'w - l',
      'W — L', 'W - L awarded', 'Awarded', 'Won on penalties']) {
      await expect(parsePublishedResults(officialLeagueOutcome.replace('W - L', outcome), 4250))
        .rejects.toThrow('Unsupported private result');
    }
    await expect(parsePublishedResults(officialLeagueOutcome.replace('1 - 0', 'Awarded'), 4250))
      .rejects.toThrow('Unsupported private result');
  });

  it('rejects a walkover without both teams or the verified cells', async () => {
    expect(officialOutcomeRow).toBeTruthy();
    for (const changedRow of [
      officialOutcomeRow.replace('>Lewisham Project Gold</div>', '></div>'),
      officialOutcomeRow.replace('>Eagles & Stars FC ', '> '),
      officialOutcomeRow.replace(/<div class="col-xs-5 resultTeam"[^>]*>Lewisham Project Gold<\/div>/, ''),
      officialOutcomeRow.replace('col-xs-2 resultScore', 'col-xs-2 unverifiedScore'),
      officialOutcomeRow.replace('W - L', 'W - L</div><div class="resultScore">W - L'),
    ]) {
      await expect(parsePublishedResults(officialLeagueOutcome.replace(officialOutcomeRow, changedRow), 4250))
        .rejects.toThrow('Unsupported private result');
    }
  });

  it('keeps youth results withheld in the private preview while preserving public league scores', async () => {
    const age_groups = ['U7', 'U8', 'U9', 'U10', 'U11'].map((age_group, index) => ({
      agegroup_id: index + 1, age_group, standings: null,
    }));
    age_groups.push({ agegroup_id: 6, age_group: 'U12', standings: [
      { provider_division_id: 4250, division_name: 'Under 12A Silver' },
    ] });
    // No youth result payload exists. Suppressed age groups must not be parsed or fabricated.
    const payloads = { 'resultsTable/4250': officialLeagueOutcome };
    expect(await publishedResultsPreview(payloads, { age_groups })).toEqual({
      6: expectedOfficialResults.map(row => ({ ...row, provider_division_id: 4250,
        division_name: 'Under 12A Silver' })),
    });
    await expect(publishedResultsPreview({
      'resultsTable/4250': officialLeagueOutcome.replace('W - L', 'W - W'),
    }, { age_groups })).rejects.toThrow('Unsupported private result');
  });
});
