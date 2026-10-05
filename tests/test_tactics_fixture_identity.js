const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const keyFunctions=source.slice(source.indexOf('function fixtureStableKey(f={}){'),source.indexOf('function fixtureFingerprint(f={}){'));
const migration=source.slice(source.indexOf('function adoptLegacyTacticsFixture(f,key){'),source.indexOf('function tacticsMatchPlan(){'));
const tracking=source.slice(source.indexOf('function likelySameFixture(before={},after={}){'),source.indexOf('function updateFixtureTracking(previousFixture,nextFixture){'));
const old={date:'2026-10-04',opponent:'Junior Reds Sabres',venue:'A',competition:'Division'};
const next={...old,date:'2026-11-01'};
const archived={...old,date:'2026-09-27'};
const stored=new Map();
const state={selkent:{legacyResponseFixtureKey:''},tactics:{
  lineupByFixture:{},positionsByFixture:{},formationByFixture:{},matchdaySelections:{},matchdayAutoPrepared:{},matchPlanByFixture:{},activeFixtureKey:''
}};
let reported=false;
const context={state,miniCupGroup:()=>null,selkentNorm:x=>String(x||'').toLowerCase().trim(),nextPublishedFixture:()=>old,fixtureIsReported:()=>reported,
  window:{ClubHubCloud:{listMatchAvailability:async key=>stored.get(key)||[]}}};
vm.createContext(context);vm.runInContext(keyFunctions+tracking+migration,context);

async function run(){
  const legacy=context.fixtureStableKey(old),first=context.fixtureResponseKey(old),second=context.fixtureResponseKey(next);
  assert.notEqual(first,second,'return fixtures on different dates get separate keys');
  assert.equal(context.fixtureResponseKey(archived),`2026-09-27|${legacy}`);
  assert.equal(context.sameTrackedFixture(archived,old),false,'a past match is not treated as a reschedule');
  const future={...old,date:'2099-10-04'};
  assert.equal(context.sameTrackedFixture(future,{...future,date:'2099-10-11'}),true,'a future date change may be a reschedule');
  reported=true;
  assert.equal(context.sameTrackedFixture(future,{...future,date:'2099-11-01'}),false,'a reported match followed by a return fixture is new');
  reported=false;
  stored.set(legacy,[{player_name:'Oscar',status:'available'},{player_name:'Umut',status:'unsure'}]);
  state.selkent.legacyResponseFixtureKey=first;
  stored.set(first,[{player_name:'Oscar',status:'unavailable'}]);
  const current=await context.listFixtureAvailability(old);
  assert.equal(current.find(r=>r.player_name==='Oscar').status,'unavailable','a new response overrides the archived one');
  assert.equal(current.find(r=>r.player_name==='Umut').status,'unsure','the tracked fixture retains a legacy response');
  assert.equal((await context.listFixtureAvailability(next)).length,0,'a later return fixture cannot inherit those replies');
  assert.equal((await context.listFixtureAvailability(archived)).length,0,'legacy fallback applies only to the recorded snapshot');
  assert.equal(stored.get(legacy).length,2,'legacy rows are retained rather than rewritten');

  state.tactics.lineupByFixture[legacy]=['p9'];
  state.tactics.positionsByFixture[legacy]={p9:{x:50,y:17}};
  state.tactics.matchdaySelections[legacy]=['p9'];
  state.tactics.matchPlanByFixture[legacy]={focus:'Look up'};
  state.tactics.activeFixtureKey=legacy;
  context.adoptLegacyTacticsFixture(old,first);
  assert.equal(state.tactics.activeFixtureKey,first);
  assert.deepEqual(Array.from(state.tactics.matchdaySelections[first]),['p9']);
  assert.equal(state.tactics.positionsByFixture[first].p9.y,17);
  assert.equal(state.tactics.matchPlanByFixture[first].focus,'Look up');
  state.tactics.matchPlanByFixture[first].focus='Keep moving';
  assert.equal(state.tactics.matchPlanByFixture[legacy].focus,'Look up','the old plan remains intact');
  context.adoptLegacyTacticsFixture(next,second);
  assert.equal(state.tactics.matchPlanByFixture[second],undefined,'the return fixture starts with a blank plan');
  console.log('Dated fixture identity and scoped legacy data checks passed');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
