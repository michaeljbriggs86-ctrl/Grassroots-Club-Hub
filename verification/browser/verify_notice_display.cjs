// Actual built app/bootstrap/cloud; fictional HTTP responses only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}\n${dispatch}`);
const scenarios=async function(){
 async function measure(p,name,enlarge=false){
  const panel=p.locator('#communications-notices-panel');
  if(enlarge)await panel.evaluate(el=>{const sizes=[el,...el.querySelectorAll('*')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size]of sizes){n.dataset.previousFont=n.style.fontSize;n.style.setProperty('font-size',size*2+'px','important');}});
  const m=await panel.evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1||el.scrollWidth>el.clientWidth+1,rows:[...el.querySelectorAll('.admin-announcement-row')].map(row=>{const b=row.querySelector('button'),text=row.querySelector('p'),r=row.getBoundingClientRect(),br=b.getBoundingClientRect();return{rowHeight:r.height,buttonHeight:br.height,buttonWidth:br.width,topOffset:br.top-r.top,textClipped:text.scrollWidth>text.clientWidth+1,buttonClipped:b.scrollWidth>b.clientWidth+1,whiteSpace:getComputedStyle(text).whiteSpace};})}));
  assert(!m.overflow,name+' reflows');assert(m.rows.every(r=>r.buttonHeight>=48&&r.buttonWidth>=48&&r.buttonHeight<100&&r.topOffset<15&&!r.textClipped&&!r.buttonClipped&&r.whiteSpace==='pre-wrap'),name+' stable actions and plain text: '+JSON.stringify(m));
  measurements.push({name,enlarge,...m});await panel.screenshot({path:path.join(out,name+'.png')});
  if(enlarge)await panel.evaluate(el=>{for(const n of [el,...el.querySelectorAll('*')]){n.style.fontSize=n.dataset.previousFont||'';delete n.dataset.previousFont;}});
 }
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking notice display',theme,width);
   const f=await fixture({initial:'admin-a',role:'club_admin',theme,width});await f.ready();const p=f.page;await p.setViewportSize({width,height});
   const malicious='Fictional "title" <img src=x onerror=alert(1)> & friends';
   const paragraphs='Meet by the clubhouse.\n\nBring water and a warm layer.\nThank you.';
   let rows=[{id:'fictional-short',title:malicious,body:paragraphs,audience:'whole_club',created_at:'2026-10-20T10:00:00Z',read_count:1,target_count:3,pinned:true,important:true,expires_at:'2026-01-01T00:00:00Z'},{id:'fictional-max',title:'Long fictional update',body:('Fictional readable paragraph with ordinary wrapping. '.repeat(100)).slice(0,4000),audience:'parents',created_at:'2026-10-20T10:00:00Z'},{id:'fictional-word',title:'Fictional unbroken word',body:'X'.repeat(4000),audience:'coaches',created_at:'2026-10-20T10:00:00Z'}];
   f.rpcOverride=c=>c.name==='list_announcements_for_me'?{body:rows}:c.name==='list_message_contacts'?{body:[]}:null;
   await f.go('?view=inbox&messages=notices');await f.ready();await p.locator('#app-splash').waitFor({state:'hidden'});const list=p.locator('#admin-announcements-list');await list.getByRole('button',{name:'Remove: '+malicious,exact:true}).waitFor();
   assert.equal(await list.locator('img,script').count(),0,'title remains escaped plain text');
   const first=list.locator('article').first();assert.equal(await first.locator('p').textContent(),paragraphs,'stored newlines unchanged');assert.equal(await first.locator('p').innerText(),paragraphs,'authored paragraph and line breaks visible');
   assert.match(await first.innerText(),/1\/3 read · Pinned · Important · Expired/);
   assert.deepEqual(await list.locator('button').allTextContents(),['Remove','Remove','Remove']);
   assert.deepEqual(await list.locator('button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label'))),rows.map(r=>'Remove: '+r.title));
   await p.locator('#announcement-title').fill('Unsent fictional draft');await p.locator('#announcement-body').fill(paragraphs);
   const remove=first.getByRole('button',{name:'Remove: '+malicious,exact:true});await remove.focus();
   await p.evaluate(()=>refreshAnnouncements(false));assert(await remove.evaluate(n=>document.activeElement===n),'unchanged refresh keeps action focus');
   assert.equal(await p.locator('#announcement-body').inputValue(),paragraphs,'composer draft kept');
   await measure(p,`${theme}-${width}-notices`);await measure(p,`${theme}-${width}-notices-200`,true);
   await first.screenshot({path:path.join(out,`${theme}-${width}-paragraph-action.png`)});
   // Native Remove retains the existing confirmation; dismissal must not write.
   const confirmation=new Promise(resolve=>p.once('dialog',async d=>{assert.equal(d.type(),'confirm');assert.equal(d.message(),'Remove this club announcement?');await d.dismiss();resolve();}));
   await remove.press('Enter');await confirmation;
   for(const tab of ['notifications','inbox','notices']){
    const control=p.locator(`[data-communications-tab="${tab}"]`);await control.focus();await control.press('Enter');
    assert.equal(await p.locator('#communications-tabs [aria-current="page"]').count(),1);
    assert.equal(await control.getAttribute('aria-current'),'page');assert(await control.evaluate(n=>document.activeElement===n),'section activation retains native button focus');
    assert.equal(await p.locator(`#communications-${tab==='inbox'?'inbox':tab}-panel`).isVisible(),true);
   }
   const writes=f.calls.filter(c=>/create_announcement|delete_announcement|mark_announcement_read|send_message|mark_message|mark_notification|mark_all_notifications/.test(c.name));assert.deepEqual(writes,[]);
   // Exercise actual parent capacity transition; hidden Admin navigation must
   // not retain a current marker or the Admin Remove controls.
   await p.evaluate(()=>ClubHubCloud.setMyCapacity(true));await f.boot();await f.ready();await p.evaluate(()=>setCommunicationsTab('notices'));
   assert.equal(await p.locator('#communications-tabs [aria-current]').count(),0);
   assert.equal(await list.locator('button').count(),0);
   cases.push({theme,width,height,paragraphs:true,maxLength:4000,names:true,confirmationDismissed:true,nativeNavigation:true,parentCapacityCleared:true,zeroWrites:true});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));console.log('PASS notice display: '+cases.length+' actual built app cases; 16 layouts; native navigation and cancelled confirmation; no notice/message/receipt writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
