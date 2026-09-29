#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const declarations=app.slice(app.indexOf('let __availabilityRows=[];'),app.indexOf('let __parentPlayerLinks=[];'));
const start=app.indexOf('function availabilityStatusForPlayer(name){');
const end=app.indexOf('async function saveParentAvailability(',start);
assert(start>0&&end>start);
let fixture={id:'fixture-one'},teamId='team-one',fail=false;
const cls=()=>({add(){},remove(){},toggle(){}});
const panel={classList:cls()},count={textContent:''},buttons=['available','unsure','unavailable'].map(status=>({dataset:{availabilityStatus:status},disabled:false,selected:false,classList:{remove(){},toggle(name,chosen){if(name==='selected')this.owner.selected=chosen;}}}));
buttons.forEach(b=>b.classList.owner=b);
const select={disabled:false,options:[],_value:'',set innerHTML(markup){this.markup=markup;this.options=[...markup.matchAll(/<option value="([^"]*)"/g)].map(x=>x[1]);this._value=this.options[0]||'';},get innerHTML(){return this.markup||'';},get value(){return this._value;},set value(v){this._value=v;}};
const nodes={'match-availability-panel':panel,'parent-availability-controls':{classList:cls()},'coach-availability-summary':{classList:cls(),replaceChildren(){}},'match-availability-count':count,'availability-player':select,'availability-reminder-send':{classList:cls()}};
const cloud={session:{user:{id:'parent-1'}},currentTeam:()=>({id:teamId}),listParentPlayerLinks:async()=>[
  {parent_user_id:'parent-1',team_id:'team-one',player_name:'Aavi',shirt_number:5},
  {parent_user_id:'someone-else',team_id:'team-one',player_name:'Oscar'},
  {parent_user_id:'parent-1',team_id:'team-two',player_name:'Lindi'}
]};
const ctx={CLOUD_MODE:true,currentRole:'parent',nextPublishedFixture:()=>fixture,fixtureResponseKey:f=>f.id,
  listFixtureAvailability:async()=>{if(fail)throw Error('offline');return [
    {player_name:'Aavi',status:'available'},
    {player_name:'Oscar',status:'unavailable'},
    {player_name:'Lindi',status:'unsure'}
  ];},selkentNorm:x=>String(x||'').toLowerCase(),
  document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>buttons},
  isCoach:()=>false,isAdminTeamPreviewMode:()=>false,renderMatchdayDashboard:()=>{},renderParentHomeMatchInfo:()=>{},
  window:{ClubHubCloud:cloud},esc:x=>String(x),toast:()=>{}};
vm.createContext(ctx);vm.runInContext(declarations+app.slice(start,end),ctx);

(async()=>{
  await ctx.refreshMatchAvailability();
  assert.equal(count.textContent,'1 update');
  assert.deepEqual(Array.from(vm.runInContext('__availabilityRows.map(r=>r.player_name)',ctx)),['Aavi']);
  assert.deepEqual(Array.from(vm.runInContext('__parentPlayerLinks.map(r=>r.player_name)',ctx)),['Aavi']);
  assert.deepEqual(select.options,['Aavi']);
  assert.equal(buttons[0].selected,true);

  fixture={id:'fixture-two'};fail=true;
  await ctx.refreshMatchAvailability();
  assert.equal(count.textContent,'Availability unavailable');
  assert.equal(select.disabled,true);
  assert(buttons.every(b=>b.disabled));
  assert.equal(vm.runInContext('__availabilityRows.length',ctx),0);
  console.log('PASS parent availability shows only approved current-team child and fails closed on refresh error');
})().catch(err=>{console.error(err);process.exitCode=1;});
