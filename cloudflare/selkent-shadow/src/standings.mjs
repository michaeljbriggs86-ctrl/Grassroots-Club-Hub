// Normalize public U12+ league tables from the private provider capture.
// Display order is source row order; it is never an official league position.
import { normalize } from './fixtures.mjs';

const HEADERS = ['Team', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'Points'];
const STATS = ['played', 'won', 'drawn', 'lost', 'gf', 'ga', 'points'];
const DISCLAIMER = 'table does not yet take account of rules for determining winner';

function optionalNumber(value) {
  const text = normalize(value);
  if (['', '-', '–', '—'].includes(text)) return null;
  const compact = text.replaceAll(',', '');
  if (!/^[+-]?\d+$/u.test(compact)) throw new Error('Unsupported private standings statistic');
  const number = Number(compact);
  if (!Number.isSafeInteger(number)) throw new Error('Unsupported private standings statistic');
  return number;
}

function optionalId(value) {
  if (value === null) return null;
  const text = value.trim();
  if (!/^\d+$/u.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('Invalid private standings team attribute');
  }
  return Number(text);
}

function parseRow(cells, order) {
  if (!cells.length) return null;
  if (cells.length !== 8 || !normalize(cells[0].text)) {
    throw new Error('Unsupported private standings row');
  }
  const row = {
    row_order: order,
    provider_team_id: optionalId(cells[0].teamId),
    provider_division_id: optionalId(cells[0].divisionId),
    team_name: normalize(cells[0].text),
  };
  STATS.forEach((field, i) => { row[field] = optionalNumber(cells[i + 1].text); });
  return row;
}

export async function parseStandings(html) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('Empty private standings HTML');
  const tables = [];
  const disclaimers = [];
  let panel;
  let table;
  let row;

  const rewriter = new HTMLRewriter().on('div.panel.panel-static', {
    element(element) {
      const previous = panel;
      panel = { heading: '', updated: '', candidates: [] };
      element.onEndTag(() => { panel = previous; });
    },
  }).on('div.panel.panel-static .panel-heading', {
    element(element) {
      const parent = panel;
      this.value = '';
      element.onEndTag(() => {
        if (parent) parent.heading = parent.candidates[0] || normalize(this.value);
      });
    },
    text(chunk) { this.value += chunk.text; },
  }).on('div.panel.panel-static .panel-heading span', {
    element(element) {
      const parent = panel;
      const updated = (element.getAttribute('class') || '').split(/\s+/u).includes('pull-right');
      this.value = '';
      element.onEndTag(() => {
        if (parent && updated) parent.updated = normalize(this.value);
        if (parent && !updated && normalize(this.value)) {
          parent.candidates.push(normalize(this.value));
        }
      });
    },
    text(chunk) { this.value += chunk.text; },
  }).on('table', {
    element(element) {
      const previous = table;
      const current = { headers: [], body: false, rows: [], panel };
      table = current;
      element.onEndTag(() => {
        if (current.headers.length === HEADERS.length &&
            current.headers.every((value, i) => value === HEADERS[i])) {
          tables.push(current);
        }
        table = previous;
      });
    },
  }).on('table thead th', {
    element(element) {
      const parent = table;
      this.value = '';
      element.onEndTag(() => { if (parent) parent.headers.push(normalize(this.value)); });
    },
    text(chunk) { this.value += chunk.text; },
  }).on('table tbody', {
    element() { if (table) table.body = true; },
  }).on('table tbody > tr', {
    element(element) {
      const parent = table;
      const current = { cells: [] };
      row = current;
      element.onEndTag(() => {
        if (parent && parent.headers.length === HEADERS.length &&
            parent.headers.every((value, i) => value === HEADERS[i])) {
          const parsed = parseRow(current.cells, parent.rows.length + 1);
          if (parsed) parent.rows.push(parsed);
        }
        row = undefined;
      });
    },
  }).on('table tbody > tr > td', {
    element(element) {
      const parent = row;
      this.value = '';
      if (!parent) return;
      const cell = { text: '', teamId: element.getAttribute('data-team-id'),
        divisionId: element.getAttribute('data-division-id') };
      element.onEndTag(() => { cell.text = this.value; parent.cells.push(cell); });
    },
    text(chunk) { this.value += chunk.text; },
  });
  // A text callback does not replace the metadata element's end-tag handler.
  rewriter.on('*', {
    text(chunk) {
      this.node = (this.node || '') + chunk.text;
      if (chunk.lastInTextNode) {
        const text = normalize(this.node);
        if (text.toLowerCase().includes(DISCLAIMER)) disclaimers.push(text);
        this.node = '';
      }
    },
  });
  await rewriter.transform(new Response(html, {
    headers: { 'content-type': 'text/html' },
  })).text();
  if (tables.length !== 1 || !tables[0].body) {
    throw new Error('Expected one verified private standings table with tbody');
  }
  const match = tables[0];
  const updated = match.panel?.updated || '';
  const heading = normalize(match.panel?.heading || '').replace(/\s*Updated\s+at\s*:.*$/iu, '');
  const source = disclaimers.sort((a, b) => a.length - b.length)[0] || null;
  return {
    division_name: heading || null,
    updated_at_text: updated.replace(/^Updated\s+at\s*:\s*/iu, '') || null,
    source_order_authoritative_for_ties: false,
    source_disclaimer: source,
    rows: match.rows,
  };
}

export async function standingsPreview(payloads, feed) {
  const preview = {};
  for (const age of feed.age_groups) {
    if (age.standings === null) continue;
    if (!Array.isArray(age.standings)) throw new Error('Malformed public standings target');
    const tables = [];
    for (const current of age.standings) {
      const divisionId = current.provider_division_id;
      const parsed = await parseStandings(payloads[`resultsTable/${divisionId}`]);
      parsed.provider_division_id = divisionId;
      if (!parsed.division_name) parsed.division_name = current.division_name;
      tables.push(parsed);
    }
    preview[age.agegroup_id] = tables;
  }
  return preview;
}
