// Normalize only public U12+ scored matches; keep this preview in private R2.
import { normalize } from './fixtures.mjs';

function resultDate(heading) {
  const match = normalize(heading).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!match) throw new Error('Unsupported private results date heading');
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]) + (Number(match[3]) < 100 ? 2000 : 0);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 ||
      value.getUTCDate() !== day) throw new Error('Invalid private results date');
  return value.toISOString().slice(0, 10);
}

export async function parsePublishedResults(html, divisionId) {
  if (!Number.isSafeInteger(divisionId) || divisionId <= 0) {
    throw new Error('Invalid private division ID');
  }
  let found = false;
  let panelCount = 0;
  let ignoredDepth = 0;
  let outsideText = '';
  let activePanel;
  let activeRow;
  const results = [];
  const root = `div#results-${divisionId}`;
  const rewriter = new HTMLRewriter().on(root, {
    element() { found = true; },
    text(chunk) { if (ignoredDepth === 0) outsideText += chunk.text; },
  });
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'button']) {
    rewriter.on(`${root} ${tag}`, {
      element(element) {
        ignoredDepth++;
        element.onEndTag(() => { ignoredDepth--; });
      },
    });
  }
  rewriter.on(`${root} .panel.panel-static`, {
    element(element) {
      panelCount++;
      const panel = { heading: '', body: false, date: '' };
      activePanel = panel;
      element.onEndTag(() => {
        if (!panel.date || !panel.body) throw new Error('Unsupported private dated results panel');
        activePanel = undefined;
      });
    },
  }).on(`${root} .panel.panel-static .panel-heading`, {
    element(element) {
      const panel = activePanel;
      if (!panel) throw new Error('Unsupported private results heading');
      this.heading = '';
      element.onEndTag(() => { panel.date = resultDate(this.heading); });
    },
    text(chunk) { if (this.heading !== undefined) this.heading += chunk.text; },
  }).on(`${root} .panel.panel-static .panel-body`, {
    element() { if (activePanel) activePanel.body = true; },
  }).on(`${root} .panel.panel-static .panel-body .row`, {
    element(element) {
      const panel = activePanel;
      const row = { teams: [], scores: [] };
      activeRow = row;
      element.onEndTag(() => {
        if (!panel || row.teams.length !== 2 || row.scores.length !== 1) {
          throw new Error('Unsupported private results row');
        }
        const score = row.scores[0];
        if (score !== '' && score !== '-' && score !== 'Abandoned') {
          const match = score.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
          if (!match || !row.teams[0] || !row.teams[1] || !panel.date) {
            throw new Error('Unsupported private result score or team');
          }
          results.push({ date: panel.date, home: row.teams[0], away: row.teams[1],
            homeGoals: Number(match[1]), awayGoals: Number(match[2]) });
        }
        activeRow = undefined;
      });
    },
  }).on(`${root} .panel.panel-static .panel-body .row .resultTeam`, {
    element(element) {
      const row = activeRow;
      this.value = undefined;
      if (!row) return;
      this.value = '';
      element.onEndTag(() => { row.teams.push(normalize(this.value)); });
    },
    text(chunk) { if (this.value !== undefined) this.value += chunk.text; },
  }).on(`${root} .panel.panel-static .panel-body .row .resultScore`, {
    element(element) {
      const row = activeRow;
      this.value = undefined;
      if (!row) return;
      this.value = '';
      element.onEndTag(() => { row.scores.push(normalize(this.value)); });
    },
    text(chunk) { if (this.value !== undefined) this.value += chunk.text; },
  });
  await rewriter.transform(new Response(html, {
    headers: { 'content-type': 'text/html' },
  })).text();
  if (!found) throw new Error('Missing private results panel');
  if (!panelCount && normalize(outsideText)) {
    throw new Error('Unsupported populated private results panel');
  }
  return results;
}

export async function publishedResultsPreview(payloads, feed) {
  const preview = {};
  for (const age of feed.age_groups) {
    if (age.standings === null) continue;
    if (!Array.isArray(age.standings)) throw new Error('Malformed public results target');
    const results = [];
    for (const table of age.standings) {
      const divisionId = table.provider_division_id;
      const rows = await parsePublishedResults(payloads[`resultsTable/${divisionId}`], divisionId);
      results.push(...rows.map(row => ({ ...row, provider_division_id: divisionId,
        division_name: table.division_name })));
    }
    preview[age.agegroup_id] = results;
  }
  return preview;
}
