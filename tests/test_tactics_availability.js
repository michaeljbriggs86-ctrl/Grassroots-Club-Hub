const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const declarations=app.slice(app.indexOf('let __availabilityRows=[];'),app.indexOf('let __parentPlayerLinks=[];'));
const start=app.indexOf('function availabilityStatusForPlayer(name){');
const functions=app.slice(start,app.indexOf('async function saveParentAvailability(',start));
assert.ok(declarations.startsWith('let __availabilityRows=[];')&&functions.startsWith('function availabilityStatusForPlayer(name){'));
let fixture={id:'first'},resolveFirst,resolveSecond;
const panel={classList:{add(){},remove(){}}};
const context={
  CLOUD_MODE:true,currentRole:'admin',nextPublishedFixture:()=>fixture,fixtureStableKey:f=>f.id,
  selkentNorm:x=>String(x||'').toLowerCase(),activePlayers:()=>[{name:'Oscar'}],
  document:{getElementById:id=>id==='match-availability-panel'?panel:null},
  isCoach:()=>false,isAdminTeamPreviewMode:()=>false,renderMatchdayDashboard:()=>{},
  window:{ClubHubCloud:{session:{user:{id:'admin'}},listMatchAvailability:key=>new Promise(resolve=>{if(key==='first')resolveFirst=resolve;else resolveSecond=resolve;}),listParentPlayerLinks:async()=>[]}}
};
vm.createContext(context);vm.runInContext(declarations+functions,context);
const run=async()=>{
  const first=context.refreshMatchAvailability();
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response');
  fixture={id:'second'};
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'no-response','previous fixture must not label the next match');
  const second=context.refreshMatchAvailability();
  resolveSecond([{player_name:'Oscar',status:'unsure'}]);await second;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'unsure');
  resolveFirst([{player_name:'Oscar',status:'unavailable'}]);await first;
  assert.equal(context.availabilityStatusForPlayer('Oscar'),'unsure','late previous fixture response must not overwrite current replies');
  assert.equal(context.availabilityCounts().unsure,1);
  assert.match(app,/tactics-availability-flag/);
  console.log('Tactics availability fixture checks passed');
};
run().catch(err=>{console.error(err);process.exitCode=1;});
