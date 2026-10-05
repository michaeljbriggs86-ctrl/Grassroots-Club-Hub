const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const declarations=app.slice(app.indexOf('let __availabilityRows=[];'),app.indexOf('let __parentPlayerLinks=[];'));
const start=app.indexOf('function availabilityStatusForPlayer(name){');
const functions=app.slice(start,app.indexOf('async function saveParentAvailability(',start));
assert.ok(declarations.startsWith('let __availabilityRows=[];')&&functions.startsWith('function availabilityStatusForPlayer(name){'));
let fixture={id:'first'},teamId='team-one',fail=false;
const pending=new Map();
const panel={classList:{add(){},remove(){}}};
let cleared=0,boardRenders=0,dashboardRenders=0;
const coachSummary={innerHTML:'',replaceChildren(){cleared++;this.innerHTML='';},classList:{toggle(){}}};
const count={textContent:''},select={innerHTML:'',disabled:false,classList:{toggle(){}}};
const statusButton={disabled:false,classList:{remove(){}}};
const context={
  CLOUD_MODE:true,currentRole:'admin',nextPublishedFixture:()=>fixture,fixtureStableKey:f=>f.id,fixtureResponseKey:f=>f.id,
  listFixtureAvailability:f=>context.window.ClubHubCloud.listMatchAvailability(f.id),
  selkentNorm:x=>String(x||'').toLowerCase(),activePlayers:()=>[{name:'Oscar'}],
  document:{getElementById:id=>({'match-availability-panel':panel,'coach-availability-summary':coachSummary,'match-availability-count':count,'availability-player':select})[id]||null,querySelectorAll:()=>[statusButton]},renderParentHomeMatchInfo:()=>{},renderTacticsBoard:()=>{boardRenders++;},toast:()=>{},
  isCoach:()=>false,isAdminTeamPreviewMode:()=>false,renderMatchdayDashboard:()=>{dashboardRenders++;},
  window:{ClubHubCloud:{session:{user:{id:'admin'}},currentTeam:()=>({id:teamId}),listMatchAvailability:key=>fail?Promise.reject(Error('offline')):new Promise(resolve=>pending.set(`${teamId}:${key}`,resolve)),listParentPlayerLinks:async()=>[]}}
};
vm.createContext(context);vm.runInContext(declarations+functions,context);
const run=async()=>{
  const first=context.refreshMatchAvailability();
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response');
  fixture={id:'second'};
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response','previous fixture must not label the next match');
  const second=context.refreshMatchAvailability();
  pending.get('team-one:second')([{player_name:'Oscar',status:'unsure'}]);await second;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'unsure');
  pending.get('team-one:first')([{player_name:'Oscar',status:'unavailable'}]);await first;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'unsure','late previous fixture response must not overwrite current replies');
  assert.equal(context.availabilityCounts().unsure,1);
  const oldTeamPending=context.refreshMatchAvailability();
  teamId='team-two';
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response','a team switch cannot reuse cached replies for the same fixture key');
  const clearsBefore=cleared;
  const newTeamPending=context.refreshMatchAvailability();
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response');
  assert.equal(cleared,clearsBefore+1,'old team summary is cleared while new replies load');
  assert.equal(select.disabled,true);
  assert.equal(statusButton.disabled,true);
  pending.get('team-two:second')([{player_name:'Oscar',status:'available'}]);await newTeamPending;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'available');
  pending.get('team-one:second')([{player_name:'Oscar',status:'unavailable'}]);await oldTeamPending;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'available','late reply from another team cannot overwrite this team');
  coachSummary.innerHTML='Previously available: Oscar';
  const clearsBeforeFailure=cleared,boardsBeforeFailure=boardRenders,dashboardsBeforeFailure=dashboardRenders;
  fail=true;await context.refreshMatchAvailability(false);
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'available','failed same-context refresh retains already-loaded replies');
  assert.equal(coachSummary.innerHTML,'Previously available: Oscar','failed same-context refresh retains the Coach summary');
  assert.equal(cleared,clearsBeforeFailure);
  assert.equal(boardRenders,boardsBeforeFailure+1,'the pitch repaints with the retained same-context replies');
  assert.equal(dashboardRenders,dashboardsBeforeFailure+1,'the matchday summary must repaint after failure');
  assert.equal(count.textContent,'Some replies could not load. Retry.');
  assert.match(app,/tactics-availability-flag/);
  console.log('Tactics availability fixture checks passed');
};
run().catch(err=>{console.error(err);process.exitCode=1;});
