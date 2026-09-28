import { describe, expect, it } from 'vitest';
import { parsePublishedResults, publishedResultsPreview } from '../src/published-results.mjs';

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
});
