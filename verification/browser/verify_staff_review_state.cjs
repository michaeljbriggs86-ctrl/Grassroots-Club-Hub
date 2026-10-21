// Actual built bootstrap/cloud/native controls, with fictional HTTP only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}\n${dispatch}`);
const scenarios=async function(){
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking staff review state',theme,width);
   const f=await fixture({initial:'admin-a',role:'club_admin',theme,width});await f.ready();const p=f.page;await p.setViewportSize({width,height});
   const request={request_id:'fictional-request',user_id:'fictional-requester',team_id:'fictional-u12-a',requested_role:'coach',person_name:'Alex <Example>',person_email:'coach@example.invalid',team_name:'Example Greens',age_group:12};
   let rows=[request],failed=false;
   f.rpcOverride=c=>c.name==='list_pending_coach_requests'?failed?{status:503,body:{message:'Fictional unavailable'}}:{body:clone(rows)}:null;
   const panel=p.locator('#staff-request-review-panel'),status=p.locator('#staff-request-review-status'),dialog=p.locator('#app-confirm-dialog');
   async function open(){rows=[request];failed=false;await f.go('?view=staff-requests');await f.ready();await p.locator('#app-splash').waitFor({state:'hidden'});await p.locator('[data-coach-request-open]').click();assert.equal(await panel.getAttribute('aria-busy'),'false');await p.getByRole('button',{name:'Approve for this team',exact:true}).waitFor();}
   async function begin(){await p.getByRole('button',{name:'Approve for this team',exact:true}).click();await dialog.waitFor({state:'visible'});assert.equal(await panel.getAttribute('aria-busy'),'true');assert(await panel.locator('button').first().isDisabled());}
   async function settled(name,empty=false){await p.waitForFunction(()=>document.getElementById('staff-request-review-panel').getAttribute('aria-busy')==='false');assert.equal(await panel.locator('button').count(),empty?0:2);const m=await p.locator('#view-staff-request-review').evaluate(n=>({overflow:document.documentElement.scrollWidth>innerWidth+1,controls:[...n.querySelectorAll('button,a')].filter(x=>x.getClientRects().length).map(x=>({text:x.textContent.trim(),height:x.getBoundingClientRect().height})),busy:document.getElementById('staff-request-review-panel').getAttribute('aria-busy')}));assert(!m.overflow);assert(m.controls.every(x=>x.height>=44));measurements.push({theme,width,height,state:name,...m});}
   await open();await begin();await p.locator('#app-confirm-cancel').press('Enter');await dialog.waitFor({state:'hidden'});await settled('cancel');
   await begin();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await settled('escape');
   for(const mode of ['removed','changed','failed']){
    await open();await begin();rows=mode==='removed'?[]:mode==='changed'?[{...request,team_id:'fictional-u12-b'}]:[request];failed=mode==='failed';
    const held=f.hold('precheck-'+mode,c=>c.name==='list_pending_coach_requests');await p.locator('#app-confirm-accept').press('Enter');await held;
    assert.equal(await panel.getAttribute('aria-busy'),'true');assert.match(await status.innerText(),/Checking the current request/);f.release('precheck-'+mode);
    await status.getByText(mode==='failed'?/could not be confirmed/:/changed or is no longer available/).waitFor();await settled(mode,mode!=='failed');
    assert.equal(f.calls.filter(c=>c.name==='review_coach_request').length,0);await p.locator('#staff-request-review-title').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,`${theme}-${width}-${mode}.png`)});
   }
   // Navigation remains guarded during rechecking, then clears the terminal view.
   await open();await begin();const leave=f.hold('leaving',c=>c.name==='list_pending_coach_requests');await p.locator('#app-confirm-accept').click();await leave;await p.getByRole('link',{name:'Back to requests',exact:true}).click();assert.equal(await panel.getAttribute('aria-busy'),'true');assert(await p.locator('#view-staff-request-review').isVisible());f.release('leaving',{body:[]});await status.getByText(/changed or is no longer available/).waitFor();await p.getByRole('link',{name:'Back to requests',exact:true}).click();assert.equal(await panel.getAttribute('aria-busy'),'false');assert.equal(await panel.textContent(),'');await p.waitForLoadState('networkidle');assert.equal(f.calls.filter(c=>c.name==='review_coach_request').length,0);
   // No selected subject on an explicit review route is settled and has no actions.
   await f.go('?view=staff-request-review');await f.ready();await status.getByText(/Choose a current request/).waitFor();await settled('no-selection',true);
   // Actual accepted account transition during recheck clears old private state.
   await open();await begin();const changedAccount=f.hold('account',c=>c.name==='list_pending_coach_requests');await p.locator('#app-confirm-accept').click();await changedAccount;await f.callbackStart(f.callback('parent-b','signup'));await f.callbackDone();assert.equal(await panel.getAttribute('aria-busy'),'false');assert.equal(await panel.textContent(),'');assert.equal(await status.textContent(),'');f.release('account');await p.waitForLoadState('networkidle');assert.equal(f.calls.filter(c=>c.name==='review_coach_request').length,0);
   cases.push({theme,width,height,cancel:true,escape:true,removed:true,changed:true,failedRead:true,navigationGuardDuringRead:true,leaveAfterSettled:true,noSelection:true,accountClear:true,decisionRequests:0});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS staff review state: '+cases.length+' built cases; cancellation, Escape, removed/changed/failed recheck, leave/no-selection/account clearing; zero decision requests/external requests/writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
