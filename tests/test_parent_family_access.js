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

// Switching to an unlinked team never fetches data; a failed fetch leaves the old team active.
let reads=[],updates=[];
ctx={visibleTeams:[a,b],context:{team:a},activeTeam:a,activeRevision:8,lastRemoteUpdatedAt:'old',
  localStorage:storage,ACTIVE_TEAM_KEY:'current',role:()=> 'parent',
  fetchTeamState:async id=>{reads.push(id);throw new Error('offline');},
  hooks:{onRemoteState:state=>updates.push(state)},updateCloudPanel:()=>{},oldShapeTeam:x=>x};
vm.runInNewContext(section(cloud,'async function switchParentTeam(teamId){','async function listCurrentClubLoginTeams'),ctx);
(async()=>{
  await assert.rejects(ctx.switchParentTeam('other'),/not linked/);
  assert.deepEqual(reads,[]);
  memory.set('current','a');
  await assert.rejects(ctx.switchParentTeam('b'),/offline/);
  assert.equal(ctx.activeTeam.id,'a');
  assert.equal(memory.get('current'),'a');
  assert.equal(ctx.activeRevision,8);
  assert.deepEqual(updates,[]);
  ctx.fetchTeamState=async id=>{reads.push(id);ctx.activeRevision=9;return {state:{team:id}};};
  await ctx.switchParentTeam('b');
  assert.equal(ctx.activeTeam.id,'b');
  assert.equal(ctx.context.team.id,'b');
  assert.equal(memory.get('current'),'b');
  assert.equal(updates.length,1);

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
