// Actual built app, cloud client and native dialog. Fictional HTTP replies only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}
${dispatch}`);
const scenarios=async function(){
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1440]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();await f.go('?view=club');await f.ready();const p=f.page;
   let mode='failed';f.rpcOverride=c=>c.name==='get_coach_qualifications'?mode==='failed'?{status:503,body:{message:'Fictional outage'}}:mode==='malformed'?{body:{records:null,revision:0}}:{body:{records:[],revision:0}}:null;
   await p.evaluate(()=>ClubHubCoachQualifications.open('fictional-admin-a','Alex Example'));
   const retry=p.locator('#coach-qualification-retry'),dialog=p.locator('#coach-qualification-dialog'),list=p.locator('#coach-qualification-list');
   assert(await retry.isVisible());assert.equal(await list.innerText(),'');assert.match(await dialog.innerText(),/Qualifications could not be loaded/);
   const capture=async label=>{
    const m=await dialog.evaluate(d=>({viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:d.scrollWidth>d.clientWidth+1,statusFont:parseFloat(getComputedStyle(d.querySelector('#coach-qualification-status')).fontSize),buttons:[...d.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height,clipped:b.scrollWidth>b.clientWidth+1}))}));
    assert(!m.viewportOverflow&&!m.dialogOverflow);assert(m.statusFont>=14);assert(m.buttons.every(b=>b.height>=44&&!b.clipped));measurements.push({theme,width,label,...m});
    await dialog.screenshot({path:path.join(out,`${theme}-${width}-${label}.png`)});
   };
   await capture('unavailable');
   // Double actual computed fonts, including fixed-pixel dialog text. Not browser zoom.
   await dialog.evaluate(d=>{const sizes=[d,...d.querySelectorAll('*')].map(n=>({n,size:parseFloat(getComputedStyle(n).fontSize)}));for(const {n,size}of sizes){n.dataset.testOriginalFont=n.style.fontSize;n.style.setProperty('font-size',(size*2)+'px','important');}});
   await capture('unavailable-200');
   await dialog.evaluate(d=>{for(const n of [d,...d.querySelectorAll('*')]){n.style.fontSize=n.dataset.testOriginalFont||'';delete n.dataset.testOriginalFont;}});
   mode='empty';const held=f.hold('retry',c=>c.name==='get_coach_qualifications');await retry.focus();await retry.press('Enter');await held;
   assert(await retry.isDisabled());assert(await p.locator('#coach-qualification-close').isEnabled());assert.match(await p.locator('#coach-qualification-status').innerText(),/Loading/);
   f.release('retry');await retry.waitFor({state:'hidden'});await p.waitForFunction(()=>document.activeElement?.id==='coach-qualification-name');
   assert.equal((await list.innerText()).match(/Not recorded/g).length,3);await capture('recovered-empty');
   mode='malformed';await p.evaluate(()=>ClubHubCoachQualifications.open('fictional-admin-a','Alex Example'));assert(await retry.isVisible());assert.equal(await list.innerText(),'');
   await retry.press('Enter');await p.waitForFunction(()=>document.activeElement?.id==='coach-qualification-retry'&&!document.getElementById('coach-qualification-retry').disabled);
   const late=f.hold('late',c=>c.name==='get_coach_qualifications');await retry.press('Enter');await late;await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.getElementById('coach-qualification-name').textContent==='Coach profile');
   assert.equal(await list.innerText(),'');assert.equal(await p.locator('#coach-qualification-name').textContent(),'Coach profile');f.release('late',{body:{records:[],revision:8}});
   // A newer subject stays selected even when the obsolete read finishes later.
   mode='empty';const old=f.hold('old',c=>c.name==='get_coach_qualifications');await p.evaluate(()=>{void ClubHubCoachQualifications.open('fictional-old','Old Example');});await old;
   await p.evaluate(()=>ClubHubCoachQualifications.open('fictional-admin-a','New Example'));f.release('old',{body:{records:[],revision:1}});
   await p.waitForFunction(()=>document.getElementById('coach-qualification-name').textContent==='Coach profile · New Example');
   await p.locator('#coach-qualification-close').click();assert.equal(await list.innerText(),'');
   assert.equal(f.calls.filter(c=>c.name==='save_coach_qualifications').length,0);cases.push({theme,width,readRecovery:true,noQualificationWrites:true});await f.close();
  }
  for(const theme of ['dark','light']){
   const f=await fixture({initial:'coach-a',role:'coach',width:393,theme});await f.ready();let failed=true;f.rpcOverride=c=>c.name==='get_coach_qualifications'?failed?{status:503,body:{message:'Fictional outage'}}:{body:{records:[],revision:0}}:null;
   await f.page.evaluate(()=>ClubHubCoachQualifications.open('fictional-coach-a','Own Example'));failed=false;await f.page.locator('#coach-qualification-retry').press('Enter');await f.page.locator('#coach-qualification-retry').waitFor({state:'hidden'});
   assert(await f.page.locator('#coach-qualification-readonly').isVisible());assert.equal(await f.page.locator('[data-edit-qualification]').count(),0);
   assert(f.calls.filter(c=>c.name==='get_coach_qualifications').every(c=>c.args.p_user_id==='fictional-coach-a'));assert.equal(f.calls.filter(c=>c.name==='save_coach_qualifications').length,0);cases.push({theme,role:'coach',ownReadOnly:true});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS qualification read recovery: '+cases.length+' actual built app cases; native Retry/Enter/Escape, malformed/failed/empty recovery, focus, late subjects, private close clearing, both themes and phone/wide layouts; zero qualification saves or external requests');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
