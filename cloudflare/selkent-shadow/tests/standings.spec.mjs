import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/SYNTHETIC_resultsTable_nonzero.html?raw';
import { parseStandings, standingsPreview } from '../src/standings.mjs';

describe('private Cloudflare standings parser', () => {
  it('matches the verified synthetic league table, including tied source order', async () => {
    const table = await parseStandings(fixture);
    expect(table.division_name).toBe('SYNTHETIC Under 12 Test Division');
    expect(table.updated_at_text).toBe('SYNTHETIC');
    expect(table.source_disclaimer).toContain('equal points');
    expect(table.source_order_authoritative_for_ties).toBe(false);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]).toEqual({
      row_order: 1, provider_team_id: 900001, provider_division_id: 990001,
      team_name: 'Synthetic Albion', played: 5, won: 4, drawn: 1, lost: 0,
      gf: 13, ga: 4, points: 13,
    });
    expect(table.rows[1].row_order).toBe(2);
    expect(table.rows[1].points).toBe(13);
    expect(table.rows[0].position).toBeUndefined();
    const preview = await standingsPreview({ 'resultsTable/990001': fixture }, {
      age_groups: [
        { agegroup_id: 2, age_group: 'U9', standings: null },
        { agegroup_id: 12, age_group: 'U12', standings: [
          { provider_division_id: 990001, division_name: 'Synthetic backup' },
        ] },
      ],
    });
    expect(Object.keys(preview)).toEqual(['12']);
    expect(preview[12][0].provider_division_id).toBe(990001);
  });

  it('preserves unknown values and decodes team names', async () => {
    const changed = fixture.replace('Synthetic Albion', 'Synthetic &amp; Albion')
      .replace('<td style="text-align:center;">13</td>', '<td style="text-align:center;">—</td>');
    const table = await parseStandings(changed);
    expect(table.rows[0].team_name).toBe('Synthetic & Albion');
    expect(table.rows[0].gf).toBe(null);
  });

  it('fails closed for invalid statistics, IDs, and table shape', async () => {
    await expect(parseStandings(fixture.replace('<td style="text-align:center;">13</td>',
      '<td style="text-align:center;">thirteen</td>')))
      .rejects.toThrow('Unsupported private standings statistic');
    await expect(parseStandings(fixture.replace('data-team-id="900001"',
      'data-team-id="abc"'))).rejects.toThrow('Invalid private standings team attribute');
    await expect(parseStandings('<table><thead><tr><th>Team</th></tr></thead>' +
      '<tbody><tr><td>Bad</td></tr></tbody></table>'))
      .rejects.toThrow('Expected one verified private standings table');
  });
});
