#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const css=fs.readFileSync('app/src/main/assets/app-design-system.css','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const take=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert(a>=0&&b>a);return app.slice(a,b);};
const league={date:'2026-10-04',competition:'League',opponent:'First league opponent'};
const cup='U9 Selkent Cup Two - Round 1';
const first={date:'2026-10-10',competition:cup,opponent:'Chislehurst Wanderers Panthers',venue:'A'};
const second={date:first.date,competition:cup,opponent:'Lewisham Borough Cobras',venue:'H'};
const fixtures=[league,first,second];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const elems={
  'selkent-fixtures-list':{innerHTML:''},'selkent-fixtures-count':{textContent:''},
  'selkent-fixtures-meta':{textContent:''},'selkent-fixtures-heading':{textContent:''}
};
const ctx={state:{selkent:{fixtures}},CLOUD_MODE:true,currentRole:'parent',ageGroupNumber:()=>9,
  selkentNorm:norm,matchTeamLabel:s=>s,upcomingFixtures:()=>fixtures,
  ownTeamDisplayName:()=> 'Shooters Hill AFC Valiants',clubIdentityBadgeHtml:()=>'',canConfirmFixtureDetails:()=>ctx.currentRole==='coach',fixtureCompetitionLabel:f=>f.competition,formatDate:s=>s,
  esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),
  parentMatchdayReady:()=>false,parentCupGroupDetails:()=>null,
  resolvedFixture:f=>f,fixtureDetailsConfirmed:()=>false,
  document:{getElementById:id=>elems[id]||null},setStableHtml:(el,markup)=>{el.innerHTML=markup;}};
vm.createContext(ctx);
vm.runInContext(take('function miniCupGroup(', 'function fixtureCompetitionLabel(')
  +take('function cupGroupFixtureLines(', 'async function syncSelkent(')
  +take('function homeFixtureTeamNames(', 'function canConfirmFixtureDetails()')
  +take('function canonicalCardFixtureRows(', 'function canonicalMatchCardData('),ctx);
ctx.renderSelkentFixtures();
assert.equal(elems['selkent-fixtures-count'].textContent,'2','parent gets league fixture and one Cup event');
assert.equal(elems['selkent-fixtures-heading'].textContent,'Upcoming matchdays');
let rendered=elems['selkent-fixtures-list'].innerHTML;
assert.equal((rendered.match(/Cup group matchday/g)||[]).length,1);
assert.match(rendered,/Chislehurst Wanderers Panthers[\s\S]*Lewisham Borough Cobras/);
assert.match(rendered,/Group start TBC/);
assert.match(rendered,/Venue<\/span><strong>Marathon Sports Ground/);
assert.doesNotMatch(rendered,/Arrive|Open in Maps|3-2|Match played/);
ctx.currentRole='coach';ctx.renderSelkentFixtures();
assert.equal(elems['selkent-fixtures-count'].textContent,'1','coach further list merges the Cup rows');
assert.equal((elems['selkent-fixtures-list'].innerHTML.match(/Cup group matchday/g)||[]).length,1);
ctx.currentRole='parent';ctx.parentMatchdayReady=f=>f.date===first.date;
ctx.parentCupGroupDetails=()=>({time:'09:00',groundName:'London Marathon Playing Fields',address:'Shooters Hill Road, SE18 4LT'});
ctx.renderSelkentFixtures();
rendered=elems['selkent-fixtures-list'].innerHTML;
assert.match(rendered,/Group starts 09:00/);
assert.match(rendered,/London Marathon Playing Fields/);
assert.doesNotMatch(rendered,/Kick-off 09:00|Arrive 08:30/);
ctx.currentRole='coach';ctx.upcomingFixtures=()=>[first,second];ctx.renderSelkentFixtures();
assert.equal(elems['selkent-fixtures-count'].textContent,'0','the next Cup event is not repeated under Further fixtures');
assert.match(html,/<p class="kicker">Fixtures<\/p><h3 id="selkent-fixtures-heading">Further fixtures<\/h3>/);
assert.doesNotMatch(css,/body\.role-parent #view-matches #selkent-fixtures-panel/);
console.log('PASS parent future fixtures and coach Cup matchday grouping');
