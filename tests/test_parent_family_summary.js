#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/styles.css','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,`Missing source section: ${from}`);return app.slice(a,b);};
// Keep training-week checks independent of the day the suite runs.
const clock=Date.parse('2099-09-30T12:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const start=app.indexOf("let __parentFamilyKey=''");
const end=app.indexOf('async function switchParentFamilyTeam(',start);
assert(start>0&&end>start);
assert(html.includes('id="parent-home-family"')&&html.includes('id="parent-family-linked-list"')&&html.includes('id="parent-home-match-info"'));
assert.match(css,/\.club-logo-wrap\{overflow:hidden;isolation:isolate\}/);

const nodes=Object.fromEntries(['parent-home-family','parent-home-family-list','parent-family-linked-list','parent-home-match-info','parent-home-training','next-match-card','home-next-title'].map(id=>[id,{innerHTML:'',hidden:false,classList:{toggle(_name,hidden){nodes[id].hidden=hidden;}}}]));
let team={id:'one',ageGroup:'U9',teamName:'Valiants'};
let resolveOld;
const cloud={
  session:{user:{id:'parent-1'}},currentTeam:()=>team,
  listParentPlayerLinks:async()=>[
    {parent_user_id:'parent-1',team_id:'one',player_name:'Aavi',shirt_number:5},
    {parent_user_id:'other',team_id:'one',player_name:'Other child'},
    {parent_user_id:'parent-1',team_id:'other',player_name:'Wrong team'},
  ],
};
const context={CLOUD_MODE:true,currentRole:'parent',window:{ClubHubCloud:cloud},
  document:{getElementById:id=>nodes[id]||null},matchTeamLabel:x=>x,formatDate:x=>x,
  state:{selkent:{fixtures:[]},trainingSessions:[
    {id:'training-3',date:'2099-10-15',time:'18:00',venue:'Later pitch',note:''},
    {id:'training-1',date:'2099-10-01',time:'18:00',venue:'Local pitch',note:'Bring water'},
    {id:'training-2',date:'2099-10-08',time:'18:00',venue:'Second pitch',note:''},
  ]},
  esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  nextPublishedFixture:()=>({id:'fixture-one',date:'2026-10-04'}),resolvedFixture:f=>({...f,time:f.time||'10:00',groundName:'Home ground'}),fixtureDetailsConfirmed:()=>true,parentMatchdayReady:()=>true,fixtureResponseKey:f=>f.id,matchdayArrivalTime:()=> '09:30',selkentNorm:x=>String(x).toLowerCase(),
  ageGroupNumber:()=>Number(team.ageGroup.replace(/\D/g,'')),cupGroupFixtureLines:g=>g.opponents.join(' / '),
  __availabilityFixture:'fixture-one',__availabilityTeamId:'one',__availabilityLoadStatus:'ready',__availabilityRows:[{player_name:'Aavi',status:'available'}],Date:Clock};
vm.runInNewContext(`${take('function miniCupGroup(', 'function fixtureCompetitionLabel(')}\n${app.slice(start,end)}\nthis.family=refreshParentFamilySummary;this.render=renderParentFamilySummary;`,context);

(async()=>{
  await context.family();
  assert.match(nodes['parent-home-family-list'].innerHTML,/Aavi/);
  assert.match(nodes['parent-home-match-info'].innerHTML,/Aavi/);
  assert.match(nodes['parent-home-match-info'].innerHTML,/Available/);
  assert.match(nodes['parent-home-match-info'].innerHTML,/Kick-off 10:00/);
  assert.match(nodes['parent-home-match-info'].innerHTML,/Add to calendar/);
  assert.doesNotMatch(nodes['parent-home-match-info'].innerHTML,/All fixtures|View fixtures/);
  assert.equal(nodes['parent-home-training'].hidden,true);
  assert.match(nodes['parent-family-linked-list'].innerHTML,/Aavi/);
  assert.doesNotMatch(nodes['parent-home-family-list'].innerHTML,/Other child|Wrong team/);
  assert.doesNotMatch(nodes['parent-home-match-info'].innerHTML,/Other child|Wrong team/);

  const cup={id:'fixture-one',date:'2026-10-04',competition:'Selkent Cup',opponent:'Cup North'};
  context.state.selkent.fixtures=[cup,{...cup,id:'fixture-two',opponent:'Cup South',time:'09:45'}];
  context.fixtureDetailsConfirmed=f=>f.id==='fixture-two';
  context.nextPublishedFixture=()=>cup;
  context.render();
  assert.match(nodes['parent-home-match-info'].innerHTML,/Cup North \/ Cup South/);
  assert.match(nodes['parent-home-match-info'].innerHTML,/Group starts 09:45/);
  assert.doesNotMatch(nodes['parent-home-match-info'].innerHTML,/Add to calendar|Other child|Wrong team/);
  context.state.selkent.fixtures=[];
  context.fixtureDetailsConfirmed=()=>true;
  context.nextPublishedFixture=()=>({id:'fixture-one',date:'2026-10-04'});

  cloud.listParentPlayerLinks=()=>new Promise(resolve=>{resolveOld=resolve;});
  const stale=context.family(true);
  team={id:'two',ageGroup:'U12',teamName:'Juniors'};
  cloud.listParentPlayerLinks=async()=>[{parent_user_id:'parent-1',team_id:'two',player_name:'Second child'}];
  await context.family();
  resolveOld([{parent_user_id:'parent-1',team_id:'one',player_name:'Aavi'}]);
  await stale;
  assert.match(nodes['parent-home-family-list'].innerHTML,/Second child/);
  assert.doesNotMatch(nodes['parent-home-family-list'].innerHTML,/Aavi/);
  assert.doesNotMatch(nodes['parent-home-match-info'].innerHTML,/Aavi|Available/,'old team reply must not survive switch');

  cloud.session.user.id='new-parent';
  context.render();
  assert.doesNotMatch(nodes['parent-home-family-list'].innerHTML,/Second child/,'old account child must not appear while new links load');
  assert.match(nodes['parent-home-family-list'].innerHTML,/Checking approved child links/);
  cloud.session.user.id='parent-1';

  cloud.listParentPlayerLinks=async()=>[];
  await context.family(true);
  assert.match(nodes['parent-home-family-list'].innerHTML,/No child is linked/);
  cloud.listParentPlayerLinks=async()=>{throw Error('offline');};
  await context.family(true);
  assert.match(nodes['parent-home-family-list'].innerHTML,/could not be loaded/);
  context.parentMatchdayReady=()=>false;
  context.render();
  assert.equal(nodes['next-match-card'].hidden,true,'unconfirmed match is not the parent priority');
  assert.equal(nodes['parent-home-match-info'].hidden,true);
  assert.equal(nodes['parent-home-training'].hidden,false);
  assert.match(nodes['parent-home-training'].innerHTML,/Local pitch|Bring water/);
  assert.match(nodes['parent-home-training'].innerHTML,/Second pitch/);
  const thisWeek=nodes['parent-home-training'].innerHTML.split('<details')[0];
  assert.match(thisWeek,/<h3>Training this week<\/h3>[\s\S]*Local pitch/);
  assert.doesNotMatch(thisWeek,/Second pitch|Later pitch/,'later dates stay outside the current-week summary');
  assert.match(nodes['parent-home-training'].innerHTML,/<details class="training-later-dates">[\s\S]*Second pitch[\s\S]*Later pitch<\/span>/,'later training remains in its collapsed section');
  assert.equal(nodes['home-next-title'].textContent,'Training sessions');
  console.log('PASS parent home shows only current approved links, handles team switch and empty/error states');
})().catch(err=>{console.error(err);process.exitCode=1;});
