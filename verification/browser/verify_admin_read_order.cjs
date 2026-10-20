// Reuse the actual built-app HTTP fixture; never replace the app/cloud API,
// bootstrap or permission functions. RPC responses below are fictional only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2,'shared fixture boundary must remain unique');
harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';
assert.equal(harness.split(dispatch).length,2,'shared transport hook must remain unique');
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}
${dispatch}`);
const scenarios=async function(){
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1440]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();
   const old={id:'old',season:'2024/25',age_group:12,team_name:'Old snapshot'},latest={id:'new',season:'2025/26',age_group:12,team_name:'Latest snapshot'};
   let revision='new';
   f.rpcOverride=call=>call.name==='list_season_archives'?{body:revision==='new'?[latest]:[old]}:call.name==='list_audit_history'?{body:[{id:revision,summary:revision==='new'?'Latest audit':'Old audit',created_at:'2026-10-01'}]}:call.name==='get_club_compliance_status'?{body:{welfare_officer_name:revision==='new'?'Latest welfare contact':'Old welfare contact',deletion_due_at:revision==='new'?'2026-11-01':null}}:null;
   const p=f.page;
   for(const [view,fn,rpc]of [['season-history','refreshSeasonHistory','list_season_archives'],['audit-history','refreshAuditHistory','list_audit_history'],['club-compliance','refreshCompliancePanel','get_club_compliance_status']]){
    console.log('Checking',view,theme,width);await f.go('?view='+view);await f.ready();
    if(view==='season-history')await p.locator('#season-history-select').selectOption('new');
    for(const outcome of ['success','error']){
     revision='old';const tag=view+'-'+outcome;const held=f.hold(tag,c=>c.name===rpc);await p.evaluate(fn=>{window.__oldAdminRead=window[fn](false);},fn);await Promise.race([held,new Promise((_,reject)=>setTimeout(()=>reject(Error('Expected read not issued: '+view+'/'+rpc)),10000))]);console.log('Held',view,outcome);
     revision='new';await p.evaluate(fn=>window[fn](false),fn);
     f.release(tag,outcome==='error'?{status:503,body:{message:'Obsolete read failed'}}:null);await p.evaluate(()=>window.__oldAdminRead);
     if(view==='season-history'){assert.equal(await p.locator('#season-history-select').inputValue(),'new');assert.match(await p.locator('#season-history-select').innerText(),/Latest snapshot/);assert.doesNotMatch(await p.locator('#season-history-select').innerText(),/Old snapshot/);}
     if(view==='audit-history'){assert.match(await p.locator('#audit-history-list').innerText(),/Latest audit/);assert.doesNotMatch(await p.locator('#audit-history-list').innerText(),/Old audit/);}
     if(view==='club-compliance'){assert.equal(await p.locator('#compliance-welfare-name').inputValue(),'Latest welfare contact');assert.match(await p.locator('#club-cancel-status').innerText(),/Deletion scheduled/);assert.doesNotMatch(await p.locator('#compliance-status').innerText(),/Could not load/);}
     cases.push(`${view}-${outcome}-${theme}-${width}`);
    }
    assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
   }
   assert.equal(f.calls.filter(c=>/archive_current|rollover|request_club_cancellation|cancel_club_cancellation|set_dispute|set_club_safeguarding/.test(c.name)).length,0);
   measurements.push({theme,width});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built Admin read order: '+cases.length+' reverse success/error checks across history/audit/compliance; unchanged layouts, zero archive/rollover/cancellation/settings calls or external writes');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
// Compile only the fixture and this test function. Production code is served
// unmodified from dist and executes with the actual cloud client in Chromium.
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
