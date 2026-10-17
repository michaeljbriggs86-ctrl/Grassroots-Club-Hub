#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const cloud=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const start=source.indexOf('let __coachTeamsLoaded=false');
const end=source.indexOf('async function setAdminUiMode(mode){',start);
assert(start>=0&&end>start);
assert(html.includes('id="mobile-context-switch"')&&html.includes('id="context-switch-dialog"'));

const teams=[{id:'red',ageGroup:'U9',teamName:'Red'},{id:'blue',ageGroup:'U12',teamName:'Blue'}];
let current=teams[0],mode='club',role='admin',own=teams[0];
const switches=[],notices=[],store=new Map();
const dialog={close:()=>switches.push('close')};
const context={CLOUD_MODE:true,currentRole:role,adminUiMode:mode,
  window:{ClubHubCloud:{currentTeam:()=>current,visibleTeamList:()=>teams,coachTeam:()=>own,switchToParentSignIn:async()=>switches.push('parent-signin')}},
  matchTeamLabel:x=>x,isClubOverviewMode:()=>context.adminUiMode==='club',
  dualCoachTeam:()=>own,
  isAdminCoachMode:()=>context.adminUiMode==='coach',isAdminTeamPreviewMode:()=>context.adminUiMode==='view',
  localStorage:{setItem:(k,v)=>store.set(k,v)},ADMIN_UI_MODE_KEY:'mode',
  document:{getElementById:id=>id==='context-switch-dialog'?dialog:null},
  renderAll:()=>{},navigate:()=>{},toast:x=>notices.push(x),
  setAdminUiMode:async x=>{context.adminUiMode=x;return true;},
  switchAdminTeamAndLoad:async t=>{switches.push(t.id);current=t;},
  switchParentFamilyTeam:async id=>{switches.push('parent:'+id);current=teams.find(t=>t.id===id);return true;}
};
vm.runInNewContext(source.slice(start,end),context);

(async()=>{
  let choices=context.availableAccountContexts();
  assert.deepEqual(Array.from(choices.map(c=>c.kind)),['club','coach','preview','parent-signin']);
  assert.equal(choices[0].active,true);
  assert.equal(choices.find(c=>c.kind==='coach').teamId,undefined);
  const button={disabled:false};
  await context.switchAccountContext(choices.find(c=>c.kind==='preview'&&c.teamId==='blue'),button);
  assert.equal(context.adminUiMode,'view');assert.equal(current.id,'blue');assert.equal(store.get('mode'),'view');
  assert.equal(context.availableAccountContexts().find(c=>c.teamId==='blue').active,true);
  const before=switches.length;
  await context.switchAccountContext({kind:'preview',teamId:'unlinked'},button);
  assert.equal(switches.length,before);
  await context.switchAccountContext(context.availableAccountContexts().find(c=>c.kind==='coach'),button);
  assert.equal(context.adminUiMode,'coach');
  current=teams[0];const previous=current;
  const closed=switches.filter(x=>x==='close').length;
  context.switchAdminTeamAndLoad=async()=>{throw new Error('offline');};
  await context.switchAccountContext(context.availableAccountContexts().find(c=>c.kind==='preview'&&c.teamId==='blue'),button);
  assert.equal(context.adminUiMode,'coach');assert.equal(current,previous);
  assert.equal(switches.filter(x=>x==='close').length,closed);
  assert(notices.includes('offline'));
  await context.switchAccountContext(context.availableAccountContexts().find(c=>c.kind==='parent-signin'),button);
  assert(switches.includes('parent-signin'));

  // Two assigned coaching teams: each is its own switchable entry
  context.adminUiMode='club';own=teams[0];
  const rows=[{team_id:'red',age_group:9,name:'Red',is_active:true},{team_id:'blue',age_group:12,name:'Blue',is_active:false}];
  context.window.ClubHubCloud.listMyCoachTeams=async()=>rows;
  context.window.ClubHubCloud.switchMyCoachTeam=async id=>{switches.push('coach:'+id);};
  context.location={reload:()=>switches.push('reload')};
  await context.loadCoachTeams();
  choices=context.availableAccountContexts();
  assert.deepEqual(Array.from(choices.map(c=>c.kind)),['club','coach-team','coach-team','parent-signin']);
  assert.equal(choices[1].title,'U9 Red');assert.equal(choices[2].detail,'Coach · edit your team');
  assert.equal(choices[1].active,false,'club overview mode is not a coaching mode');
  await context.switchAccountContext(choices[2],button);
  assert(switches.includes('coach:blue')&&switches.includes('reload'));assert.equal(store.get('mode'),'coach');
  context.adminUiMode='club';

  rows.length=0;await context.loadCoachTeams(true);
  context.currentRole='parent';own=null;current=teams[0];
  choices=context.availableAccountContexts();
  assert.deepEqual(Array.from(choices.map(c=>c.kind)),['parent','parent']);
  await context.switchAccountContext(choices[1],button);
  assert.equal(current.id,'blue');assert(switches.includes('parent:blue'));
  context.window.ClubHubCloud.visibleTeamList=()=>[teams[0]];
  await context.switchAccountContext({kind:'parent',teamId:'blue'},button);
  assert.equal(switches.filter(x=>x==='parent:blue').length,1);
  context.currentRole='coach';choices=context.availableAccountContexts();
  assert.deepEqual(Array.from(choices.map(c=>c.kind)),['parent-signin']);
  const visible=[];
  context.document.getElementById=id=>['mobile-context-switch','account-context-switch'].includes(id)?{classList:{toggle:(name,hidden)=>visible.push([id,name,hidden])}}:id==='context-switch-dialog'?dialog:null;
  context.renderAccountContextControls();
  assert(visible.every(([,name,hidden])=>name==='hidden'&&hidden===false),'the More selector stays visible for a Coach with one action');
  await context.switchAccountContext(choices[0],button);
  assert.equal(switches.filter(x=>x==='parent-signin').length,2);
  const {harness}=require('./helpers/cloud_client_harness');
  const h=harness(r=>{if(r.path.endsWith('get_team_state_for_me'))throw Error('offline');});
  const previousTeam=h.test.getTeam(),previousRevision=h.api.revision;
  h.localStorage.setItem('grassroots_hub_admin_active_team_v1','one');
  await assert.rejects(h.api.switchAdminTeam('two'),/offline/);
  assert.equal(h.test.getTeam(),previousTeam);assert.equal(h.api.revision,previousRevision);
  assert.equal(h.store.get('grassroots_hub_admin_active_team_v1'),'one');
  assert.deepEqual(h.events.filter(e=>e.type==='clubhub-contacts-clear').map(e=>e.type),['clubhub-contacts-clear'],'old contact details clear before an admin team request, even when the switch fails');
  console.log('PASS account contexts and authorized transitions');
})().catch(e=>{console.error(e);process.exitCode=1;});
