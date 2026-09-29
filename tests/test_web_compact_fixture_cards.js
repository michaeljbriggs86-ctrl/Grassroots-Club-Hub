#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf('function furtherFixtureCardHtml(');
const end=source.indexOf('function renderSelkentFixtures(',start);
assert.ok(start>=0&&end>start);
const context={
  resolvedFixture: f=>f,
  fixtureDetailsConfirmed: f=>f.confirmed,
  fixtureOverviewContext: ()=>({homeTeam:'Home FC',awayTeam:'Away FC',homeKit:'Green',awayKit:'Red',ground:'Community Ground',address:'High Street',mapHref:'https://www.google.com/maps/search/?api=1',mapEmbedHref:'https://www.google.com/maps/embed'}),
  kitWarningHtml: ()=>'',kitToggleHtml: ()=>'',
  esc: value=>String(value||''),formatDate:()=> '27 Sep 26',
  fixtureCompetitionLabel:()=> 'League',
  matchTeamSideHtml: side=>`<span>${side} badge and kit</span>`,
  clubListingHtml: name=>`<span class=\"club-listing\">${name}</span>`
};
vm.runInNewContext(source.slice(start,end),context);
const confirmed=context.furtherFixtureCardHtml({confirmed:true,date:'2026-09-27',opponent:'Away FC',time:'10:00'});
assert.match(confirmed,/<strong><span class=\"club-listing\">Home FC<\/span> <span>v<\/span> <span class=\"club-listing\">Away FC<\/span><\/strong>/,'teams must be visible before expansion');
assert.match(confirmed,/<small>League · Community Ground<\/small>/,'ground must be visible before expansion');
assert.match(confirmed,/<details class="further-fixture-details"><summary>Match details<\/summary>/);
assert.match(confirmed,/<div class="further-fixture-body">[\s\S]*Home badge and kit[\s\S]*Away badge and kit[\s\S]*High Street/,'badges, kits and address stay in detail');
assert.ok(confirmed.indexOf('</details>')<confirmed.indexOf('Open in Maps'),'Maps link stays visible before expansion');
const unconfirmed=context.furtherFixtureCardHtml({confirmed:false,date:'2026-09-27',opponent:'Away FC'});
assert.match(unconfirmed,/Awaiting confirmation/);
assert.doesNotMatch(unconfirmed,/Open in Maps|google\.com\/maps\/embed/,'unconfirmed venue cannot be shared');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert.match(html,/<div class="match-venue-card next-fixture-venue">[\s\S]*?id="matches-next-map"/,'next match keeps direct Maps link');
assert.match(html,/<details class="matchday-dashboard-note">/,'optional coach note is collapsed');
console.log('PASS compact fixture cards retain venue, maps and expanded match details');
