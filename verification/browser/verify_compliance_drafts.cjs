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
  for(const theme of ['dark','light'])for(const [width,height]of [[320,740],[393,852],[844,390],[1440,1000]]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();let statusMode='loaded',accountMode='loaded';
   const a={user_id:'fictional-reviewer-a',role:'club_admin',full_name:'Fictional Admin'},b={user_id:'fictional-reviewer-b',role:'coach',full_name:'Fictional Coach'};
   const status={club_id:'fictional-club',primary_reviewer_name:'Saved Primary',primary_reviewer_user_id:a.user_id,backup_reviewer_name:'Saved Backup',backup_reviewer_user_id:b.user_id,fallback_to_county_fa:true,welfare_officer_name:'Saved Welfare',welfare_officer_contact:'saved@example.invalid',county_fa_name:'London FA',county_fa_safeguarding_contact:'Saved County',deletion_due_at:null,cancellation_requested_at:null,fully_configured:true};
   f.rpcOverride=call=>call.name==='get_club_compliance_status'?(statusMode==='error'||statusMode==='denied'?{status:statusMode==='denied'?403:503,body:{message:'Fictional status unavailable'}}:{body:statusMode==='partial'?{fully_configured:true}:status}):call.name==='list_club_access_accounts'?(accountMode==='invalid'?{body:{partial:true}}:accountMode==='error'?{status:503,body:{message:'Fictional accounts unavailable'}}:{body:accountMode==='empty'?[]:accountMode==='removed'?[a]:[a,b]}):null;
   await f.go('?view=club-compliance');await f.ready();const p=f.page;await p.setViewportSize({width,height});
   const primary=p.locator('#compliance-primary-user'),backup=p.locator('#compliance-backup-user'),save=p.locator('#save-compliance-settings'),warning=p.locator('#compliance-account-status'),refresh=p.locator('#refresh-compliance-settings');
   await p.waitForFunction(()=>document.getElementById('compliance-primary-user').value==='fictional-reviewer-a'&&!document.getElementById('compliance-primary-user').disabled);
   assert.equal(await backup.inputValue(),b.user_id);assert(await save.isDisabled());assert.equal(await primary.getAttribute('aria-describedby'),'compliance-account-status');
   await p.locator('#compliance-primary-reviewer').fill('Edited Primary');await p.locator('#compliance-welfare-name').fill('Edited Welfare');await p.locator('#compliance-welfare-contact').fill('edited@example.invalid');await primary.selectOption(b.user_id);await backup.selectOption(a.user_id);await p.locator('#compliance-fallback').uncheck();
   await p.locator('#compliance-welfare-contact').focus();await p.evaluate(()=>Promise.all([refreshCompliancePanel(),loadComplianceAccountChoices()]));assert.equal(await p.evaluate(()=>document.activeElement.id),'compliance-welfare-contact');
   for(const [id,value]of [['compliance-primary-reviewer','Edited Primary'],['compliance-welfare-name','Edited Welfare'],['compliance-welfare-contact','edited@example.invalid']])assert.equal(await p.locator('#'+id).inputValue(),value);
   assert.equal(await primary.inputValue(),b.user_id);assert.equal(await backup.inputValue(),a.user_id);assert(!await p.locator('#compliance-fallback').isChecked());
   await p.locator('#compliance-primary-reviewer').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'compliance-primary-user');
   const focus=await primary.evaluate(n=>({outline:getComputedStyle(n).outlineStyle,width:getComputedStyle(n).outlineWidth,shadow:getComputedStyle(n).boxShadow}));assert(focus.outline!=='none'||focus.shadow!=='none','visible native field focus');
   accountMode='removed';await refresh.click();await warning.getByText(/Selected reviewer account unavailable/).waitFor();assert.equal(await primary.inputValue(),b.user_id);assert.match(await primary.locator('option:checked').innerText(),/unavailable/);
   accountMode='invalid';await refresh.click();await warning.getByText(/Reviewer accounts unavailable/).waitFor();assert(await primary.isDisabled());assert(await p.locator('#retry-compliance-accounts').isVisible());
   accountMode='loaded';await p.locator('#retry-compliance-accounts').click();await p.waitForFunction(()=>!document.getElementById('compliance-primary-user').disabled);assert.equal(await primary.inputValue(),b.user_id);
   await primary.selectOption('');await backup.selectOption('');accountMode='empty';await refresh.click();await warning.getByText(/No eligible reviewer accounts/).waitFor();assert.equal(await primary.inputValue(),'');
   statusMode='error';await refresh.click();await p.locator('#compliance-status').getByText(/Compliance status unavailable/).waitFor();assert.doesNotMatch(await p.locator('#club-cancel-status').innerText(),/^Club active$/);assert(await p.locator('#request-club-cancellation').isDisabled());assert(await p.locator('#cancel-club-cancellation').isDisabled());assert.equal(await p.locator('#compliance-welfare-name').inputValue(),'Edited Welfare');
   await p.locator('#view-club-compliance .page-back').click();await p.getByRole('link',{name:/Data protection & safeguarding/}).click();assert.equal(await p.locator('#compliance-welfare-name').inputValue(),'Edited Welfare');assert.match(await p.locator('#compliance-status').innerText(),/unavailable/);
   statusMode='loaded';accountMode='loaded';await refresh.click();await p.waitForFunction(()=>document.getElementById('compliance-status').getAttribute('aria-busy')==='false'&&!document.getElementById('compliance-primary-user').disabled);assert.equal(await primary.inputValue(),'');assert.equal(await p.locator('#compliance-welfare-name').inputValue(),'Edited Welfare');
   assert(await p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}));
   const layout=await p.locator('#view-club-compliance').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.theme,fields:[...el.querySelectorAll('input,select')].map(n=>({id:n.id,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right}))}));assert(!layout.overflow);assert.equal(layout.theme,theme);assert(layout.fields.every(r=>r.left>=0&&r.right<=width+1));
   assert.equal(await save.evaluate(n=>getComputedStyle(n).opacity),'0.5');await save.scrollIntoViewIfNeeded();await p.mouse.wheel(0,300);await p.waitForFunction(()=>{const r=document.getElementById('save-compliance-settings').getBoundingClientRect();return r.y>=0&&r.bottom<innerHeight-50;});
   await p.screenshot({path:path.join(out,`compliance-${theme}-${width}.png`),fullPage:true});
   statusMode='denied';await refresh.click();await p.waitForFunction(()=>document.getElementById('compliance-welfare-name').value==='');assert(await save.isDisabled());
   assert.equal(f.calls.filter(c=>/set_dispute_reviewers|set_club_safeguarding_contacts|request_club_cancellation|cancel_club_cancellation/.test(c.name)).length,0);
   cases.push(`${theme}-${width}`);measurements.push({theme,width,height,...layout});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built compliance A1: 8 theme/viewport scenarios, saved IDs, all drafts/fallback, removed/malformed/empty/error/retry, navigation/focus/unload and denied clearing; zero settings/cancellation writes');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
// Compile only the fixture and this test function. Production code is served
// unmodified from dist and executes with the actual cloud client in Chromium.
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
