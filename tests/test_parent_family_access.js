#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const cloud=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function section(text,start,end){
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`Missing function boundary: ${start}`);
  return text.slice(a,b);
}
const a={id:'a',age_group:9,name:'Red'},b={id:'b',age_group:9,name:'Blue'};
const memory=new Map([['current','a']]);
const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};

// A remembered or profile team must not escape the server-filtered linked list.
let ctx={visibleTeams:[b],context:{team:a},localStorage:storage,ACTIVE_TEAM_KEY:'current',
  role:()=> 'parent',teamMatchesState:()=>false};
vm.runInNewContext(section(cloud,'function chooseActiveTeam(localState){','function sanitizeMiniSoccerParentStateClient'),ctx);
assert.equal(ctx.chooseActiveTeam(null).id,'b');
assert.equal(memory.get('current'),'b');

// Exercise real closure state: failed and unlinked switches cannot change identity/revision.
const {harness,session}=require('./helpers/cloud_client_harness');
let offline=true;
const h=harness(r=>{if(offline&&r.path.endsWith('get_team_state_for_me'))throw Error('offline');});
h.test.initialize(session('b'),'parent');h.events.length=0;h.localStorage.setItem('grassroots_hub_admin_active_team_v1','one');
(async()=>{
  await assert.rejects(h.api.switchParentTeam('other'),/not linked/);assert.equal(h.requests.length,0);
  await assert.rejects(h.api.switchParentTeam('two'),/offline/);
  assert.equal(h.api.currentTeam().id,'one');assert.equal(h.api.revision,1);
  assert.equal(h.store.get('grassroots_hub_admin_active_team_v1'),'one');assert.equal(h.updates.length,0);
  assert.equal(h.events.filter(e=>e.type==='clubhub-contacts-clear').length,0,'failed parent switch retains contact context');
  offline=false;await h.api.switchParentTeam('two');
  assert.equal(h.api.currentTeam().id,'two');assert.equal(h.api.context.team.id,'two');
  assert.equal(h.store.get('grassroots_hub_admin_active_team_v1'),'two');assert.equal(h.updates.length,1);
  assert.equal(h.events.filter(e=>e.type==='clubhub-contacts-clear').length,1);

  // Re-rendering the controls must retain a newly chosen team until Switch is pressed.
  let selected='';const select={options:[],disabled:false,get value(){return selected;},set value(v){selected=v;},
    set innerHTML(html){this.options=[...html.matchAll(/<option value="([^"]+)"/g)].map(m=>({value:m[1]}));selected=this.options[0]?.value||'';}};
  const nodes={'parent-family-account':{classList:{toggle:()=>{}}},'parent-family-team-select':select,
    'parent-family-team-note':{textContent:''},'parent-family-team-switch':{disabled:true}};
  const ui={CLOUD_MODE:true,currentRole:'parent',document:{getElementById:id=>nodes[id]},
    window:{ClubHubCloud:{visibleTeamList:()=>[{id:'a',ageGroup:'U9',teamName:'Red'},{id:'b',ageGroup:'U9',teamName:'Blue'}],currentTeam:()=>({id:'a'})}},
    esc:x=>x,matchTeamLabel:x=>x};
  vm.runInNewContext(section(app,'function renderParentFamilyControls(){','async function switchParentFamilyTeam'),ui);
  ui.renderParentFamilyControls();select.value='b';ui.renderParentFamilyControls();
  assert.equal(select.value,'b');assert.equal(nodes['parent-family-team-switch'].disabled,false);
  console.log('PASS linked-team selection, failed-switch rollback, successful switch, and UI selection');
})().catch(err=>{console.error(err);process.exitCode=1;});
