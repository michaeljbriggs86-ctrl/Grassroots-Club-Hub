#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const start=app.indexOf(from),end=app.indexOf(to,start);assert(start>=0&&end>start);return app.slice(start,end);};
const cup='U9 Selkent Cup Two - Round 1';
const first={date:'2026-10-10',competition:cup,opponent:'Chislehurst Wanderers Panthers',venue:'A'};
const second={date:first.date,competition:cup,opponent:'Lewisham Borough Cobras',venue:'H'};
const state={selkent:{fixtures:[first,second],fixtureOverrides:{}}};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ctx={state,ageGroupNumber:()=>9,selkentNorm:norm,matchTeamLabel:s=>s,
  fixtureKitSelectionKey:f=>f.opponent,ownTeamDisplayName:()=> 'Shooters Hill AFC Valiants',clubIdentityBadgeHtml:()=>'',esc:x=>String(x),Date};
vm.createContext(ctx);
vm.runInContext(take('function miniCupGroup(', 'function fixtureCompetitionLabel(')
  +take('function fixtureOverride(', 'function pilotKitDefaults(')
  +take('function homeFixtureTeamNames(', 'function canConfirmFixtureDetails()')
  +take('function canonicalCardFixtureRows(', 'function canonicalMatchCardData(')
  +take('function cupGroupFixtureLines(', 'function groupFixtureCardHtmlV15('),ctx);
assert.deepEqual(Array.from(ctx.miniCupGroup(first).opponents),
  ['Chislehurst Wanderers Panthers','Lewisham Borough Cobras']);
assert.equal(ctx.parentMatchdayReady(first),false,'training stays primary before coach confirmation');
state.selkent.fixtureOverrides[second.opponent]={time:'09:00',groundName:'London Marathon Playing Fields',
  address:'Shooters Hill Road, London SE18 4LT',confirmedAt:'2026-10-01T12:00:00Z'};
assert.equal(ctx.parentMatchdayReady(first),true,'one confirmed group start and venue covers the group');
assert.equal(ctx.parentCupGroupDetails(first).time,'09:00');
assert.equal(ctx.parentMatchdayReady(second),true,'second team fixture uses the same group details');
assert.equal(ctx.miniCupGroup(first).opponents.length,2,'group identity survives a reported fixture');
assert.equal(ctx.miniCupGroup({...first,competition:'League'}),null);
ctx.ageGroupNumber=()=>14;
assert.equal(ctx.miniCupGroup(first),null,'older age cup tie is not a mini group');

const panel={innerHTML:'',hidden:true,classList:{toggle(_name,hide){panel.hidden=hide;}}};
const training={innerHTML:'',hidden:false,classList:{toggle(_name,hide){training.hidden=hide;}}};
const card={hidden:false,classList:{toggle(_name,hide){card.hidden=hide;}}};
const title={textContent:''};
ctx.ageGroupNumber=()=>9;
Object.assign(ctx,{CLOUD_MODE:true,currentRole:'parent',nextPublishedFixture:()=>first,
  document:{getElementById:id=>({'parent-home-match-info':panel,'parent-home-training':training,
    'next-match-card':card,'home-next-title':title})[id]},
  window:{ClubHubCloud:{currentTeam:()=>({id:'team'}),session:{user:{id:'parent'}}}},
  __parentFamilyStatus:'ready',__parentFamilyKey:'parent:team',__parentFamilyLinks:[],
  __availabilityFixture:'',__availabilityTeamId:'',__availabilityRows:[],__availabilityLoadStatus:'ready',
  fixtureResponseKey:()=>'',parentTrainingRowsHtml:()=>'<p>Training</p>',esc:s=>String(s),
  formatDate:s=>s,matchdayArrivalTime:()=>{throw Error('do not derive a Cup arrival time');}});
vm.runInContext(take('function renderParentHomeMatchInfo(', 'function renderParentFamilySummary('),ctx);
ctx.renderParentHomeMatchInfo();
assert.equal(panel.hidden,false);
assert.match(panel.innerHTML,/Cup group matchday/);
assert.match(panel.innerHTML,/Chislehurst Wanderers Panthers[\s\S]*Shooters Hill AFC Valiants[\s\S]*Lewisham Borough Cobras/);
assert.equal((panel.innerHTML.match(/Group game/g)||[]).length,2);
assert.match(panel.innerHTML,/Group starts 09:00/);
assert.match(panel.innerHTML,/order may change/);
assert.doesNotMatch(panel.innerHTML,/Kick-off|Add to calendar|Arrive 08:30/);
console.log('PASS parent mini Cup group details and confirmation priority');
