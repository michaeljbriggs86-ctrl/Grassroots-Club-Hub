#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/app-design-system.css','utf8');
assert(html.indexOf('id="home-next-match"')<html.indexOf('id="home-club-notices"'));
assert.match(css,/#parent-home-match-info \.parent-home-reply\{display:grid/);
assert.match(css,/body\.role-parent #view-matches #selkent-fixtures-panel/);
const start=app.indexOf('function upcomingTrainingSessions(){'),end=app.indexOf('function renderParentHomeMatchInfo(){',start);
assert(start>0&&end>start);
const inputs={
  'training-session-date':{value:'2099-10-01'},'training-session-time':{value:'18:00'},
  'training-session-venue':{value:'Local pitch'},'training-session-note':{value:'Bring water'},
  'training-session-list':{innerHTML:''},
};
let saves=0,resets=0;
const ctx={state:{trainingSessions:[]},Date,document:{getElementById:id=>inputs[id]||null},
  requireCoach:()=>true,saveState:()=>{saves++;},uid:()=> 'training-1',toast:()=>{},
  formatDate:x=>x,esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;')};
vm.runInNewContext(`${app.slice(start,end)}\nthis.add=addTrainingSession;this.render=renderTrainingSessionSettings;this.upcoming=upcomingTrainingSessions;`,ctx);
ctx.add({preventDefault(){},target:{reset(){resets++;}}});
assert.equal(saves,1);
assert.equal(resets,1);
assert.equal(ctx.state.trainingSessions[0].venue,'Local pitch');
ctx.render();
assert.match(inputs['training-session-list'].innerHTML,/2099-10-01.*18:00/);
assert.equal(ctx.upcoming().length,1);
const matchStart=app.indexOf('function renderMatchPageNextFixture(){'),matchEnd=app.indexOf('function divisionOpponents(){',matchStart);
const card={hidden:false,classList:{toggle(_name,value){card.hidden=value;}}};
const placeholder={hidden:true,classList:{toggle(_name,value){placeholder.hidden=value;}}};
const matchCtx={CLOUD_MODE:true,currentRole:'parent',nextPublishedFixture:()=>({date:'2099-10-04'}),parentMatchdayReady:()=>false,
  document:{getElementById:id=>id==='matches-next-fixture'?card:id==='parent-matches-placeholder'?placeholder:null}};
vm.runInNewContext(`${app.slice(matchStart,matchEnd)}\nrenderMatchPageNextFixture();`,matchCtx);
assert.equal(card.hidden,true);
assert.equal(placeholder.hidden,false);
const fixtureStart=app.indexOf('function renderSelkentFixtures(){'),fixtureEnd=app.indexOf('async function syncSelkent(',fixtureStart);
const list={innerHTML:'future fixture'},count={textContent:'4'},meta={textContent:'old'};
const fixturesCtx={CLOUD_MODE:true,currentRole:'parent',document:{getElementById:id=>({
  'selkent-fixtures-list':list,'selkent-fixtures-count':count,'selkent-fixtures-meta':meta
})[id]},setStableHtml:(node,markup)=>{node.innerHTML=markup;},upcomingFixtures:()=>{throw Error('future fixtures must not be rendered for parents');}};
vm.runInNewContext(`${app.slice(fixtureStart,fixtureEnd)}\nrenderSelkentFixtures();`,fixturesCtx);
assert.equal(list.innerHTML,'');
assert.equal(count.textContent,'0');
const historyStart=app.indexOf('function applyMatchFilter(){'),historyEnd=app.indexOf('function ensureTournamentState(){',historyStart);
const rendered={};
const historyCtx={CLOUD_MODE:true,currentRole:'parent',state:{matches:[
  {id:'past',competition:'League',opponent:'Earlier opponent',status:'played',date:'2099-09-01'},
  {id:'later',competition:'League',opponent:'Later opponent',status:'scheduled',date:'2099-10-11'},
]},document:{getElementById:()=>({value:''})},isPublishedLeagueTeam:()=>true,isLeagueMatch:m=>m.competition==='League',
  isDivisionMatch:()=>false,isFriendlyMatch:()=>false,isCupMatch:()=>false,isVaseMatch:()=>false,isShieldMatch:()=>false,
  competitionBucket:()=>false,isPlayedMatch:m=>m.status==='played',
  renderMatchGroup:(id,_count,rows)=>{rendered[id]=rows.map(m=>m.id);},renderCompetitionGameTable:()=>{},renderTournamentEvents:()=>{}};
vm.runInNewContext(`${app.slice(historyStart,historyEnd)}\napplyMatchFilter();`,historyCtx);
assert.deepEqual(rendered['league-match-list'],['past']);
historyCtx.currentRole='coach';
vm.runInNewContext(`${app.slice(historyStart,historyEnd)}\napplyMatchFilter();`,historyCtx);
assert.deepEqual(rendered['league-match-list'],['later','past']);
console.log('PASS parent sees training until matchday is confirmed and cannot browse later fixtures');
