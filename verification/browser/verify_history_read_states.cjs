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
  const cases=[],measurements=[];
  for(const theme of ['light','dark'])for(const width of [320,393,1440])for(const role of ['club_admin','coach','assistant_coach']){
   const f=await fixture({initial:role==='club_admin'?'admin-a':'coach-a',role,width,theme});await f.ready();const p=f.page;
   let rows=[{id:'a',season:'2025/26',age_group:12,team_name:'Fictional Green'},{id:'b',season:'2025/26',age_group:13,team_name:'Fictional Blue'},{id:'c',season:'2025/26',age_group:14,team_name:'Long fictional team name to verify narrow layout wrapping'}];
   let auditRows=[{id:'audit-a',summary:'Fictional parent account linked to team. '.repeat(9),user_name:'Fictional Admin',team_name:'Fictional Blue',created_at:'2026-10-20T12:00:00Z'}];
   f.rpcOverride=c=>c.name==='list_season_archives'?{body:rows}:c.name==='list_audit_history'?{body:auditRows}:null;
   const first=f.hold('first',c=>c.name==='list_season_archives');await f.go('?view=season-history');await f.ready();await first;
   const select=p.locator('#season-history-select'),summary=p.locator('#season-history-summary'),open=p.locator('#open-season-archive'),refresh=p.locator('[data-page-refresh="season-history"]');
   assert.match(await summary.innerText(),/Loading season history/);assert.doesNotMatch(await summary.innerText(),/No season archives/);assert(await open.isDisabled());assert(Number(await open.evaluate(n=>getComputedStyle(n).opacity))<1);
   f.release('first',{status:503,body:{message:'Fictional read unavailable'}});await summary.getByText(/Season history unavailable/).waitFor();assert(await open.isDisabled());
   await refresh.click();await summary.getByText(/3 team archives available/).waitFor();assert.equal(await select.locator('option').count(),3);assert(!await open.isDisabled());
   await select.selectOption('b');await select.focus();await p.evaluate(()=>refreshSeasonHistory(false));assert.equal(await select.inputValue(),'b');assert.equal(await p.evaluate(()=>document.activeElement.id),'season-history-select');
   const held=f.hold('stale',c=>c.name==='list_season_archives');await refresh.click();await held;assert.match(await summary.innerText(),/Loading.*unrefreshed/);assert(await open.isDisabled());
   f.release('stale',{status:503,body:{message:'Fictional refresh failed'}});await summary.getByText(/unavailable.*unrefreshed/).waitFor();assert.equal(await select.inputValue(),'b');assert.equal(await p.evaluate(()=>document.activeElement.dataset.pageRefresh),'season-history');
   rows=rows.filter(r=>r.id!=='b');await refresh.click();await summary.getByText(/selected archive is no longer available/).waitFor();assert.equal(await select.inputValue(),'b');assert.match(await select.locator('option:checked').innerText(),/unavailable/);assert(await open.isDisabled());
   await select.selectOption('c');assert(!await open.isDisabled());assert.doesNotMatch(await summary.innerText(),/selected archive is no longer/);
   rows=[];await refresh.click();await summary.getByText('No season archives have been created yet.',{exact:true}).waitFor();assert(await open.isDisabled());assert(await select.isDisabled());
   const afterEmpty=f.hold('empty-error',c=>c.name==='list_season_archives');await refresh.click();await afterEmpty;f.release('empty-error',{status:503,body:{message:'Fictional empty refresh failed'}});await summary.getByText(/unavailable/).waitFor();assert.doesNotMatch(await summary.innerText(),/No season archives/);
   rows=[{id:'c',season:'2025/26',age_group:14,team_name:'Fictional returned team'}];await refresh.click();await summary.getByText(/1 team archive available/).waitFor();assert(!await open.isDisabled());
   const before=f.calls.filter(c=>c.name==='get_season_archive').length;
   await p.screenshot({path:path.join(out,`season-${role}-${theme}-${width}.png`),fullPage:true});
   await refresh.press('Tab');await p.keyboard.press('Shift+Tab');
   const layout=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1,focusOutline:getComputedStyle(document.activeElement).outlineStyle}));assert.equal(layout.theme,theme);assert(!layout.overflow);assert.notEqual(layout.focusOutline,'none');
   f.rpcOverride=c=>c.name==='list_season_archives'?{status:403,body:{message:'Access denied'}}:c.name==='list_audit_history'?{body:auditRows}:null;
   await refresh.click();await summary.getByText(/unavailable/).waitFor();assert.doesNotMatch(await select.innerText(),/Fictional/);assert(await open.isDisabled());assert.equal(f.calls.filter(c=>c.name==='get_season_archive').length,before);
   cases.push(`season-${role}-${theme}-${width}`);measurements.push({role,width,...layout});
   if(role==='club_admin'){
    await f.go('?view=audit-history');await f.ready();const list=p.locator('#audit-history-list'),status=p.locator('#audit-history-status'),retry=p.locator('#refresh-audit-history');
    await list.getByText(/Fictional parent account linked/).waitFor();const pending=f.hold('audit-error',c=>c.name==='list_audit_history');await retry.click();await pending;assert.match(await status.innerText(),/Loading.*unrefreshed/);
    f.release('audit-error',{status:503,body:{message:'Fictional audit unavailable'}});await status.getByText(/unavailable.*unrefreshed/).waitFor();assert.match(await list.innerText(),/Fictional parent/);assert.equal(await p.evaluate(()=>document.activeElement.id),'refresh-audit-history');
    auditRows=[];await retry.click();await status.getByText('No player or parent changes yet.',{exact:true}).waitFor();assert.equal(await list.innerText(),'');
    const denied=f.hold('audit-denied',c=>c.name==='list_audit_history');await retry.click();await denied;f.release('audit-denied',{status:403,body:{message:'Access denied'}});await status.getByText(/unavailable/).waitFor();assert.equal(await list.innerText(),'');assert.doesNotMatch(await status.innerText(),/No player/);
    await p.screenshot({path:path.join(out,`audit-${theme}-${width}.png`),fullPage:true});assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));cases.push(`audit-${theme}-${width}`);
   }
   assert.equal(f.calls.filter(c=>/get_season_archive|archive_current|rollover|restore/.test(c.name)).length,0);await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built history states: '+cases.length+' Admin/Coach/Assistant theme/viewport scenarios, loading/error/empty/retry, stable and removed selections, denied clearing, focus and count units; zero archive/detail/rollover calls');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
