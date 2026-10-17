const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/cloud.js'),'utf8');
const start=source.indexOf('  async function saveTeamStateNow('),end=source.indexOf('  async function switchAdminTeam(',start);
assert.ok(start>=0&&end>start,'cloud save functions are present');
const saveFunctions=source.slice(start,end);

function cloudHarness(rpc,{editable=true,team=true,session:hasSession=true,timers=null}={}){
  const {harness,session,response}=require('./helpers/cloud_client_harness');
  const statuses=[];
  const h=harness(async r=>{
    if(r.path.endsWith('save_team_state'))return response(200,await rpc('save_team_state',r.body));
    if(r.path.endsWith('get_team_state_for_me'))return response(200,{state:{matches:[]},revision:2});
  });
  if(!editable)h.test.initialize(session('a'),'parent');
  if(!team)h.test.setTeam(null);if(!hasSession)h.test.clearSession();
  h.window.addEventListener('clubhub-cloud-status',event=>statuses.push([event.detail.text,event.detail.type]));
  const api={...h.api,queueStateSave(value){h.api.queueStateSave(value);if(timers){const task=[...h.timers.values()].find(t=>t.delay===700);if(task)timers.push(task.fn);}}};
  return {api,updates:h.updates,statuses};
}

(async()=>{
  const written=[];
  const success=cloudHarness(async(_name,args)=>{written.push(args.p_state);return {revision:2};});
  const report={matches:[{id:'today',status:'played',opponent:'Junior Reds Sabres',gf:5,ga:4}]};
  success.api.queueStateSave(report);
  await success.api.confirmStateSave(report);
  assert.equal(written.length,1,'the report commits once, without waiting for the debounce timer');
  assert.equal(written[0].matches[0].gf,5);
  assert.equal(success.updates.length,0,'an old normalized callback cannot replace a confirmed report');

  const conflict=cloudHarness(async()=>{throw new Error('STALE_STATE');});
  conflict.api.queueStateSave(report);
  await assert.rejects(()=>conflict.api.confirmStateSave(report),/STALE_STATE/);
  assert.equal(conflict.updates.length,0,'a conflicting server state does not erase the local score');
  assert.equal(await conflict.api.pullLatest({quiet:true}),null,'polling pauses until the unsynced report is resolved');
  assert.ok(conflict.statuses.some(([message])=>/local edits need retrying/.test(message)));
  for(const options of [{editable:false},{team:false}]){
    const blocked=cloudHarness(async()=>{throw Error('must not write');},options);
    await assert.rejects(()=>blocked.api.confirmStateSave(report),/not available for editing/);
    assert.equal(await blocked.api.pullLatest({quiet:true}),null,'an unconfirmed local match must not be replaced by polling');
  }
  const expired=cloudHarness(async()=>{throw Error('must not write');},{session:false});
  await assert.rejects(()=>expired.api.confirmStateSave(report),/session has expired/);
  assert.equal(await expired.api.pullLatest({quiet:true}),null,'an expired login cannot replace the local match');
  const empty=cloudHarness(async()=>null);
  await assert.rejects(()=>empty.api.confirmStateSave(report),/did not confirm/);
  assert.equal(await empty.api.pullLatest({quiet:true}),null,'an unconfirmed write must not be replaced by polling');
  // Match-plan edits use the same automatic queue. Pending or failed writes must
  // not look synced, and a conflict/empty reply must not replace the local plan.
  for(const result of ['success','conflict','unconfirmed']){
    const timers=[];const queued=cloudHarness(async()=>{if(result==='conflict')throw Error('STALE_STATE');return result==='unconfirmed'?null:{revision:2};},{timers});
    queued.api.queueStateSave({tactics:{matchPlanByFixture:{general:{focus:'Keep local focus'}}}});
    assert.deepEqual(queued.statuses.at(-1),['Changes queued…','working']);
    assert.equal(await queued.api.pullLatest({quiet:true}),null);
    timers.shift()();await new Promise(resolve=>setImmediate(resolve));
    if(result==='success'){assert.equal(queued.statuses.at(-1)[0],'Cloud synced');assert.equal(queued.updates.length,1);}
    else{assert.equal(queued.updates.length,0);assert(!queued.statuses.some(([text])=>text==='Cloud synced'));assert.equal(await queued.api.pullLatest({quiet:true}),null);}
  }
  console.log('Coach match commit and automatic plan queue: queued/saving/confirmed states, conflict and unconfirmed preservation checks passed');
})().catch(err=>{console.error(err);process.exitCode=1});
