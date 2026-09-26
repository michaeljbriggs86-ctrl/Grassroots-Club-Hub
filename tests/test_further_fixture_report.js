#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const first = source.indexOf('function furtherFixtureCardHtml(');
const last = source.indexOf('async function syncSelkent(', first);
assert.ok(first >= 0 && last > first);

function render(coach) {
  const fixtures = [{id:'next',date:'2026-09-27',opponent:'Sabres'},
    {id:'second',date:'2026-10-04',opponent:'Panthers'},
    {id:'third',date:'2026-10-11',opponent:'Rovers'}];
  const elements = {
    'selkent-fixtures-list': {innerHTML:''},
    'selkent-fixtures-count': {textContent:''},
    'selkent-fixtures-meta': {textContent:''},
  };
  const context = {
    document: {getElementById: id => elements[id] || null},
    upcomingFixtures: () => fixtures,
    resolvedFixture: f => f,
    fixtureDetailsConfirmed: () => false,
    fixtureOverviewContext: f => ({homeTeam:'Home',awayTeam:f.opponent,homeKit:'',awayKit:''}),
    kitWarningHtml: () => '', kitToggleHtml: () => '',
    matchTeamSideHtml: (_, name) => name,
    formatDate: date => date, fixtureCompetitionLabel: () => 'League',
    esc: value => String(value), isCoach: () => coach,
  };
  vm.runInNewContext(source.slice(first, last), context);
  const reportStart = source.indexOf('function openFurtherFixtureMatchReport(');
  const reportEnd = source.indexOf('function fixtureStableKey(', reportStart);
  assert.ok(reportStart >= 0 && reportEnd > reportStart);
  context.openFixtureMatchReport = f => f?.id;
  vm.runInNewContext(source.slice(reportStart, reportEnd), context);
  context.renderSelkentFixtures();
  return {html:elements['selkent-fixtures-list'].innerHTML,
    count:elements['selkent-fixtures-count'].textContent,
    second:context.openFurtherFixtureMatchReport(0),
    third:context.openFurtherFixtureMatchReport(1)};
}

const coach = render(true);
assert.equal(coach.count, '2');
assert.match(coach.html, /data-further-match-played="0"/);
assert.match(coach.html, /data-further-match-played="1"/);
assert.equal(coach.second, 'second');
assert.equal(coach.third, 'third');
assert.doesNotMatch(render(false).html, /data-further-match-played/);
console.log('PASS further fixture report actions map to the right matches and stay coach-only');
