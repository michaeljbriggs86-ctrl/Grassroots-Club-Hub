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
  for(const role of ['club_admin','coach','assistant_coach','parent'])for(const theme of ['dark','light'])for(const width of [320,393,1440]){
   const initial=role==='club_admin'?'admin-a':role==='parent'?'parent-b':'coach-a';
   const f=await fixture({initial,role,width,theme});await f.ready();let state='loaded';
   const a={user_id:'fictional-recipient-a',role:'coach',full_name:'Coach Example A',team_id:'fictional-u12-a'},b={user_id:'fictional-recipient-b',role:'club_admin',full_name:'Admin Example B'};
   f.rpcOverride=call=>call.name==='list_message_contacts'?(state==='error'?{status:503,body:{message:'Fictional contact outage'}}:{body:state==='empty'?[]:state==='removed'?[b]:[a,b]}):call.name==='list_active_messages'?{body:[]}:null;
   await f.go('?view=inbox');await f.ready();const p=f.page,select=p.locator('#inbox-contact-select'),send=p.locator('#send-inbox-message'),body=p.locator('#inbox-message-body'),subject=p.locator('#inbox-subject');
   await select.selectOption(a.user_id);await subject.fill('Training note for A');await body.fill('Hello. Please confirm Monday’s training location.');
   await p.waitForFunction(()=>!document.getElementById('send-inbox-message').disabled);
   // Ordinary same-recipient refresh does not replace the focused editor.
   await body.focus();await p.evaluate(()=>refreshInbox(false));assert.equal(await p.evaluate(()=>document.activeElement.id),'inbox-message-body');assert.equal(await body.inputValue(),'Hello. Please confirm Monday’s training location.');
   state='removed';await p.locator('#refresh-club-inbox').click();await p.getByText('Your draft is still here. Choose an available recipient before sending.',{exact:true}).waitFor();
   assert.equal(await select.inputValue(),'');assert(await send.isDisabled());assert.equal(await subject.inputValue(),'Training note for A');
   const before=f.calls.filter(c=>c.name==='send_club_message').length;await p.evaluate(()=>sendInboxMessage());assert.equal(f.calls.filter(c=>c.name==='send_club_message').length,before);
   // Native focus order and explicit recipient selection use the real select.
   await select.focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'inbox-subject');await select.focus();await select.press('Space');await p.keyboard.press('End');await p.keyboard.press('Enter');
   assert.equal(await select.inputValue(),b.user_id);assert(await send.isEnabled());assert.match(await p.locator('#inbox-compose-hint').innerText(),/Admin Example B/);
   state='error';await p.locator('#refresh-club-inbox').click();await p.locator('[data-inbox-retry]').waitFor();assert(await send.isDisabled());assert.equal(await subject.inputValue(),'Training note for A');
   state='removed';await p.locator('[data-inbox-retry]').click();await p.waitForFunction(()=>!document.getElementById('send-inbox-message').disabled);
   const held=f.hold('late-contacts',c=>c.name==='list_message_contacts');await p.locator('#refresh-club-inbox').click();await held;
   state='loaded';await p.locator('#refresh-club-inbox').click();await p.waitForFunction(()=>!document.getElementById('send-inbox-message').disabled);f.release('late-contacts',{status:503,body:{message:'Late failure'}});
   await p.waitForFunction(()=>document.getElementById('inbox-thread').textContent.includes('No messages'));assert(await send.isEnabled());
   state='empty';await p.locator('#refresh-club-inbox').click();await p.getByText('Your draft is still here. Choose an available recipient before sending.',{exact:true}).waitFor();assert(await send.isDisabled());
   const layout=await p.locator('#view-inbox').evaluate(el=>({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1,helper:el.querySelector('#inbox-compose-hint').textContent,description:el.querySelector('#send-inbox-message').getAttribute('aria-describedby')}));
   assert.equal(layout.theme,theme);assert(!layout.overflow);assert.equal(layout.description,'inbox-compose-hint');
   assert.equal(await send.evaluate(el=>getComputedStyle(el).opacity),'0.5');
   await send.scrollIntoViewIfNeeded();await p.mouse.wheel(0,300);await p.waitForFunction(()=>{const r=document.getElementById('send-inbox-message').getBoundingClientRect();return r.y>=0&&r.bottom<innerHeight-50;});
   const actionBox=await send.boundingBox();assert(actionBox&&actionBox.y>=0&&actionBox.y+actionBox.height<p.viewportSize().height-50,'guarded Send remains reachable above mobile navigation');
   await p.screenshot({path:path.join(out,`draft-${role}-${theme}-${width}.png`),fullPage:true});
   assert.equal(f.calls.filter(c=>c.name==='send_club_message').length,0);assert.equal(f.calls.filter(c=>c.name==='mark_club_messages_read').length,0);
   measurements.push({role,theme,width,...layout});cases.push(`${role}-${theme}-${width}`);await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built inbox draft safety: '+cases.length+' role/theme/viewport scenarios; retained recipient/draft/focus, keyboard focus/retarget, loading/error/retry/empty/stale failure and zero sends/read receipts/external requests');
 }catch(error){for(const context of contexts)for(const page of context.pages())if(!page.isClosed()){console.error('Draft diagnostic',await page.locator('#view-inbox').innerText().catch(()=>''));console.error('Draft state',await page.evaluate(()=>({selected:__inboxSelected,binding:__inboxDraftBinding,read:__inboxReadState,contacts:__inboxContacts,identity:__inboxIdentity,current:personProfileContextKey()})).catch(()=>null));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
// Compile only the fixture and this test function. Production code is served
// unmodified from dist and executes with the actual cloud client in Chromium.
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
