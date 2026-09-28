// Private fixture normalization in the Workers runtime. Never served to visitors.
import { namedEntities } from './html-entities.mjs';

function decodeEntities(value) {
  return value.replace(/&(#(?:[xX][\da-fA-F]+|\d+);?|[a-zA-Z][a-zA-Z\d]{0,31};?)/gu, (reference, name) => {
    if (name[0] === '#') {
      const hex = name[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : '\ufffd';
    }
    for (let length = name.length; length > 0; length--) {
      if (Object.hasOwn(namedEntities, name.slice(0, length))) {
        return namedEntities[name.slice(0, length)] + name.slice(length);
      }
    }
    return reference;
  });
}

const normalize = value => decodeEntities(value).replace(/\s+/gu, ' ').trim();
const folded = value => normalize(value).toLowerCase();

export async function parseFixtureWeeks(html) {
  const ids = new Set();
  await new HTMLRewriter().on('[data-week-id]', {
    element(element) {
      const raw = (element.getAttribute('data-week-id') || '').trim();
      if (/^\d+$/.test(raw)) ids.add(Number(raw));
    },
  }).transform(new Response(html, { headers: { 'content-type': 'text/html' } })).text();
  return [...ids].sort((a, b) => a - b);
}

export async function parseFixtures(html) {
  let found = false;
  let content = '';
  let date = '';
  let division = '';
  let activeRow = null;
  const fixtures = [];
  const rewriter = new HTMLRewriter()
    .on('#fixtureContainer', {
      element() { found = true; },
      text(chunk) { content += chunk.text; },
    })
    .on('#fixtureContainer h2.subHead', {
      element(element) {
        this.heading = '';
        element.onEndTag(() => {
          const match = this.heading.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (!match) throw new Error('Unsupported private fixture date heading');
          const year = Number(match[3]) + (match[3].length <= 2 ? 2000 : 0);
          date = `${String(year).padStart(4, '0')}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        });
      },
      text(chunk) { this.heading += chunk.text; },
    })
    .on('#fixtureContainer .panel-title', {
      element(element) {
        this.value = '';
        element.onEndTag(() => { division = normalize(this.value); });
      },
      text(chunk) { this.value += chunk.text; },
    })
    .on('#fixtureContainer .fixtureRow', {
      element(element) {
        if ((element.getAttribute('class') || '').split(/\s+/).includes('nonFixture')) return;
        const row = { date, division_name: division, columns: [],
          provider_team_ids: (element.getAttribute('data-team-ids') || '').split(';').filter(Boolean) };
        activeRow = row;
        element.onEndTag(() => {
          if (row.columns.length < 2 || !row.date || !row.division_name) {
            throw new Error('Unsupported private fixture row');
          }
          fixtures.push({ date: row.date, division_name: row.division_name,
            home: row.columns[0], away: row.columns.at(-1), provider_team_ids: row.provider_team_ids });
          activeRow = null;
        });
      },
    })
    .on('#fixtureContainer .fixtureRow > div.col-xs-5', {
      element(element) {
        const row = activeRow;
        this.column = undefined;
        if (!row) return;
        this.column = '';
        element.onEndTag(() => { row.columns.push(normalize(this.column)); });
      },
      text(chunk) { if (this.column !== undefined) this.column += chunk.text; },
    });
  await rewriter.transform(new Response(html, { headers: { 'content-type': 'text/html' } })).text();
  if (!found) throw new Error('Missing private fixture container');
  if (!normalize(content)) return { fixtures: [], status: 'verified_empty' };
  if (!fixtures.length) throw new Error('Unsupported populated private fixture container');
  return { fixtures, status: 'verified_fixture_rows_v1' };
}

function identity(row) {
  const ids = row.provider_team_ids.map(String).map(value => value.trim()).filter(Boolean);
  const participants = ids.length >= 2 ? ['provider_ids', ...ids] :
    ['names', folded(row.home), folded(row.away)];
  return JSON.stringify([row.date, folded(row.division_name), participants]);
}

export function mergeFixtures(groups) {
  const unique = new Map();
  for (const group of groups) for (const row of group) {
    const key = identity(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) => {
    const left = [a.date, folded(a.division_name), folded(a.home), folded(a.away)];
    const right = [b.date, folded(b.division_name), folded(b.home), folded(b.away)];
    for (let i = 0; i < left.length; i++) {
      if (left[i] < right[i]) return -1;
      if (left[i] > right[i]) return 1;
    }
    return 0;
  });
}

export async function fixturePreview(payloads, feed) {
  const preview = {};
  for (const age of feed.age_groups) {
    const base = payloads[`fixturespage/${age.agegroup_id}`];
    const discovered = await parseFixtureWeeks(base);
    const weeks = age.fixture_week_ids;
    const groups = [];
    if (weeks.length) {
      for (const week of weeks) {
        const page = await parseFixtures(payloads[`fixturespage/${age.agegroup_id}/${week}`]);
        groups.push(page.fixtures);
      }
    } else {
      groups.push((await parseFixtures(base)).fixtures);
    }
    const fixtures = mergeFixtures(groups);
    preview[age.agegroup_id] = {
      discovered_week_ids: discovered,
      fixtures,
      fixture_parse_status: weeks.length
        ? (fixtures.length ? 'verified_multiweek_fixture_rows_v2' : 'verified_empty_multiweek_v2')
        : (fixtures.length ? 'verified_fixture_rows_v1' : 'verified_empty'),
    };
  }
  return preview;
}
