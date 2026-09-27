const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/cloud.js'),'utf8');
const start=source.indexOf('  async function saveTeamStateNow('),end=source.indexOf('  async function switchAdminTeam(',start);
assert.ok(start>=0&&end>start,'cloud save functions are present');
const saveFunctions=source.slice(start,end);

function cloudHarness(rpc){
  const updates=[],statuses=[];
  const api=new Function('rpc','fetchTeamState','emitStatus','setTimeout','clearTimeout','updates','statuses',`
    let saveTimer=null,saving=false,pendingState=null,unsyncedState=false,confirmingState=false;
    let session={user:{id:'coach'}},activeTeam={id:'u9'},activeRevision=1,lastRemoteUpdatedAt='';
    const configured=()=>true,canEdit=()=>true,hooks={onRemoteState:(row)=>updates.push(row)};
    ${saveFunctions}
    return {queueStateSave,confirmStateSave,pullLatest};
  `)(rpc,async()=>({state:{matches:[]},revision:2}),(...args)=>statuses.push(args),setTimeout,clearTimeout,updates,statuses);
  return {api,updates,statuses};
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
  console.log('Coach match commit and conflict preservation checks passed');
})().catch(err=>{console.error(err);process.exitCode=1});
