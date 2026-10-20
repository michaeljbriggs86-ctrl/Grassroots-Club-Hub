// Actual built app/bootstrap/cloud and permissions; fictional HTTP responses.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}\n${dispatch}`);
const scenarios=async function(){
 async function hintMatches(p){await p.waitForFunction(()=>{const r=document.getElementById('coach-document-table'),h=document.getElementById('coach-document-scroll-hint');return h.hidden===!(r.querySelector('table')&&r.scrollWidth>r.clientWidth+1)&&r.hasAttribute('aria-describedby')===!h.hidden;});}
 async function capture(p,theme,width,label,enlarge=false){
  const panel=p.locator('#view-coach-documents');
  if(enlarge)await panel.evaluate(el=>{const sizes=[el,...el.querySelectorAll('*')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size]of sizes){n.dataset.oldFont=n.style.fontSize;n.style.setProperty('font-size',size*2+'px','important');}});
  await hintMatches(p);
  const m=await panel.evaluate(el=>{const r=el.querySelector('#coach-document-table'),h=el.querySelector('#coach-document-scroll-hint');return{pageOverflow:document.documentElement.scrollWidth>innerWidth+1,hasTable:!!r.querySelector('table'),tableOverflow:r.scrollWidth>r.clientWidth+1,hintShown:!h.hidden,controls:[...el.querySelectorAll('button,select,a')].filter(n=>n.getClientRects().length).map(n=>({label:n.textContent.trim(),height:n.getBoundingClientRect().height,clipped:n.tagName==='BUTTON'&&n.scrollWidth>n.clientWidth+1}))};});
  assert(!m.pageOverflow,label+' no page overflow');assert(m.controls.every(n=>n.height>=44&&!n.clipped),label+' usable controls: '+JSON.stringify(m.controls));assert.equal(m.hintShown,m.hasTable&&m.tableOverflow);
  measurements.push({theme,width,label,enlarge,...m});await panel.screenshot({path:path.join(out,`${theme}-${width}-${label}.png`)});
  if(enlarge)await panel.evaluate(el=>{for(const n of [el,...el.querySelectorAll('*')]){n.style.fontSize=n.dataset.oldFont||'';delete n.dataset.oldFont;}});
 }
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking Coach documents',theme,width);
   const f=await fixture({initial:'admin-a',role:'club_admin',theme,width});await f.ready();const p=f.page;await p.setViewportSize({width,height});
   const record=(kind,expiry,checked=true)=>({kind,course:kind==='dbs'?'fa_enhanced_dbs':kind==='safeguarding'?'fa_safeguarding_children':'fa_ifaif',completed_on:'2025-01-01',expires_on:expiry,club_checked:checked});
   const current={user_id:'fictional-current',full_name:'Morgan Example',role:'coach',revision:1,records:['dbs','safeguarding','first_aid'].map(k=>record(k,'2028-01-01'))};
   const mixed=[current,{user_id:'fictional-due',full_name:'Casey <Example> & team',role:'assistant_coach',revision:2,records:[record('dbs','2026-10-25',false),record('safeguarding','2026-10-01')]},{user_id:'fictional-missing',full_name:'Taylor Example',role:'club_admin',revision:0,records:[]}];
   let mode='mixed';f.rpcOverride=c=>c.name!=='list_coach_qualifications'?null:mode==='failed'?{status:503,body:{message:'Fictional outage'}}:mode==='malformed'?{body:{data:null}}:{body:mode==='empty'?[]:mode==='one'?[current]:mixed};
   const pending=f.hold('pending-matrix',c=>c.name==='list_coach_qualifications');await f.go('?view=coach-documents');await f.ready();await pending;await p.locator('#app-splash').waitFor({state:'hidden'});
   const status=p.locator('#coach-document-status'),region=p.locator('#coach-document-table'),hint=p.locator('#coach-document-scroll-hint'),filter=p.locator('#coach-document-filter'),refresh=p.locator('#coach-document-refresh');
   assert.equal(await status.innerText(),'Loading coach documents…');assert.equal(await hint.isVisible(),false);assert.equal(await region.locator('table').count(),0);
   f.release('pending-matrix');await status.getByText(/^3 coaches .*Data loaded/).waitFor();await hintMatches(p);
   assert.equal(await region.locator('thead th').count(),4);assert.match(await region.innerText(),/Enhanced DBS/);assert.match(await region.innerText(),/Safeguarding Children/);assert.match(await region.innerText(),/First aid in football/);assert.equal(await region.locator('script').count(),0);
   const loaded=await status.innerText(),readCount=f.calls.filter(c=>c.name==='list_coach_qualifications').length;
   await p.clock.setSystemTime(new Date(Date.now()+15*60*1000));
   for(const value of ['due','missing','all']){await filter.focus();await filter.selectOption(value);await hintMatches(p);assert.equal(await status.innerText(),loaded,'filter keeps last successful load time');assert(await filter.evaluate(n=>document.activeElement===n),'filter retains focus');}
   assert.equal(f.calls.filter(c=>c.name==='list_coach_qualifications').length,readCount,'filter does not read');
   await capture(p,theme,width,'loaded');await capture(p,theme,width,'loaded-200',true);
   if(width<700){await region.focus();const before=await region.locator('tbody th').first().evaluate(n=>n.getBoundingClientRect().x);await region.press('ArrowRight');await p.waitForFunction(()=>document.getElementById('coach-document-table').scrollLeft>0);const after=await region.locator('tbody th').first().evaluate(n=>n.getBoundingClientRect().x);assert(Math.abs(before-after)<1,'sticky Coach column stays in place under native keyboard scroll');}
   const responsiveReads=f.calls.filter(c=>c.name==='list_coach_qualifications').length;await p.setViewportSize({width:1440,height:1000});await hintMatches(p);assert.equal(await hint.isVisible(),false,'fitting table needs no hint');await p.setViewportSize({width:320,height:844});await hintMatches(p);assert.equal(await hint.isVisible(),true,'resize reveals overflowing-table hint');assert.equal(f.calls.filter(c=>c.name==='list_coach_qualifications').length,responsiveReads);await p.setViewportSize({width,height});await hintMatches(p);
   await refresh.press('Enter');await p.waitForFunction(old=>document.getElementById('coach-document-status').textContent.includes('Data loaded')&&document.getElementById('coach-document-status').textContent!==old,loaded);assert.match(await status.innerText(),/^3 coaches/);
   mode='failed';await refresh.press('Enter');await status.getByText('Coach documents unavailable. Refresh to retry; no expiry status can be confirmed.',{exact:true}).waitFor();assert.equal(await hint.isVisible(),false);assert.doesNotMatch(await status.innerText(),/Data loaded|0 coaches/);
   await filter.selectOption('due');assert.match(await status.innerText(),/unavailable/);assert.equal(await hint.isVisible(),false);await capture(p,theme,width,'unavailable');
   mode='malformed';await refresh.press('Enter');await status.getByText(/unavailable/).waitFor();assert.equal(await region.locator('table').count(),0);assert.equal(await hint.isVisible(),false);
   mode='empty';await refresh.press('Enter');await status.getByText(/^0 coaches · 0 missing records · 0 unchecked records\. Data loaded/).waitFor();assert.match(await region.innerText(),/No coaching accounts yet/);assert.equal(await hint.isVisible(),false);
   mode='one';await refresh.press('Enter');await status.getByText(/^1 coach · 0 missing records · 0 unchecked records\. Data loaded/).waitFor();assert.match(await region.innerText(),/No coaches match this filter/);assert.equal(await hint.isVisible(),false);await capture(p,theme,width,'filtered-empty');
   await filter.selectOption('all');await hintMatches(p);assert.equal(await region.locator('tbody tr').count(),1);
   // Reverse replies must not refill a newer successful empty response or stamp.
   const older=f.hold('old-matrix',c=>c.name==='list_coach_qualifications');await p.evaluate(()=>{window.testOldMatrixRead=ClubHubCoachQualifications.refreshMatrix();});await older;mode='empty';await p.evaluate(()=>ClubHubCoachQualifications.refreshMatrix());const latest=await status.innerText();f.release('old-matrix',{body:mixed});await p.evaluate(()=>window.testOldMatrixRead);assert.equal(await status.innerText(),latest);assert.match(latest,/^0 coaches/);assert.equal(await hint.isVisible(),false);
   const oldContext=f.hold('old-context-matrix',c=>c.name==='list_coach_qualifications');await p.evaluate(()=>{window.testOldMatrixRead=ClubHubCoachQualifications.refreshMatrix();});await oldContext;await p.evaluate(()=>ClubHubCloud.setMyCapacity(true));await f.boot();await f.ready();f.release('old-context-matrix',{body:mixed});await p.evaluate(()=>window.testOldMatrixRead);
   assert.equal(await status.textContent(),'','Parent capacity clears successful-load status');assert.equal(await region.locator('table').count(),0);assert.equal(await hint.isVisible(),false);
   assert.deepEqual(f.calls.filter(c=>/save_coach_qualifications|send_message|mark_announcement_read|mark_club_messages_read|mark_notification_read/.test(c.name)),[]);
   cases.push({theme,width,height,freshness:true,correctCounts:true,conditionalScrollHint:true,nativeKeyboardScroll:width<700,lateReplies:true,parentCapacityCleared:true,zeroQualificationWrites:true});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));console.log('PASS Coach documents display: '+cases.length+' actual built app cases, '+measurements.length+' layouts; controlled-clock filters, correct counts, conditional overflow guidance, native keyboard scroll and context isolation; zero qualification/message/receipt writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
