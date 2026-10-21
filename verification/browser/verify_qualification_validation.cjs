// Actual built app, cloud permissions and native controls. Fictional HTTP only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}\n${dispatch}`);
const scenarios=async function(){
 async function visibleFeedback(p,id){
  const m=await p.locator('#'+id).evaluate(n=>{const d=document.getElementById('coach-qualification-dialog'),r=n.getBoundingClientRect(),b=d.getBoundingClientRect();return {visible:n.getClientRects().length>0,top:r.top,bottom:r.bottom,dialogTop:b.top,dialogBottom:b.bottom,viewportHeight:innerHeight,focus:document.activeElement.id};});
  assert(m.visible&&m.top>=Math.max(0,m.dialogTop)-1&&m.bottom<=Math.min(m.viewportHeight,m.dialogBottom)+1,'feedback visible inside modal and viewport '+JSON.stringify(m));return m;
 }
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking qualification validation',theme,width);
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();const p=f.page;await p.setViewportSize({width,height});
   const day=await p.evaluate(()=>ClubHubCoachQualifications.today()),shift=days=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
   const record=(kind,expiry,checked=true)=>({kind,course:kind==='dbs'?'fa_enhanced_dbs':kind==='safeguarding'?'fa_safeguarding_children':'fa_ifaif',completed_on:'2025-01-01',expires_on:expiry,club_checked:checked});
   const coach={user_id:'fictional-review-coach',role:'coach',full_name:'Alex <Example> & coaching team',team_id:'fictional-u12-a',team_name:'Example Greens',age_group:12};
   let records=['dbs','safeguarding','first_aid'].map(k=>record(k,shift(120))),readMode='loaded',saveMode='failed';
   f.rpcOverride=c=>{
    if(['list_club_access_accounts','list_club_coaches'].includes(c.name))return {body:[coach]};
    if(c.name==='list_contact_directory')return {body:{self:{user_id:'fictional-admin-a'},contacts:[{...coach,kind:'staff',email:'coach@example.invalid'}],can_manage:true}};
    if(c.name==='get_coach_qualifications')return readMode==='failed'?{status:503,body:{message:'Fictional read unavailable'}}:{body:{records:clone(records),revision:4}};
    if(c.name==='save_coach_qualifications')return {status:saveMode==='conflict'?409:503,body:{code:saveMode==='conflict'?'40001':'XX000',message:'Fictional rejected save'}};
    return null;
   };
   await f.go('?view=app-access');await f.ready();await p.locator('#app-splash').waitFor({state:'hidden'});
   await p.locator('#admin-access-list [data-person-profile]').first().click();
   await p.getByRole('button',{name:'Manage qualifications',exact:true}).waitFor();
   const profile=p.locator('#person-profile-body');
   for(const expiry of [shift(120),day,shift(30),shift(-1)])for(const checked of [false,true]){
    records=[record('safeguarding',expiry,checked)];await p.evaluate(()=>ClubHubPersonProfiles.refresh());
    const article=profile.locator('article').filter({has:p.getByRole('heading',{name:'Safeguarding Children',exact:true})});
    assert.match(await article.innerText(),checked?/Club checked/:/Needs club check/);
    if(expiry===day)assert.match(await article.innerText(),/Due today/);else if(expiry<day)assert.match(await article.innerText(),/Expired/);else if(expiry===shift(30))assert.match(await article.innerText(),/Due within 60 days/);
    if(expiry===shift(30)){await article.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,`${theme}-${width}-profile-${checked?'checked':'unchecked'}.png`)});}
   }
   records=[];await p.evaluate(()=>ClubHubPersonProfiles.refresh());assert.equal((await profile.innerText()).match(/Not recorded/g).length,3);assert.doesNotMatch(await profile.innerText(),/Club checked|Needs club check/);
   readMode='failed';await p.evaluate(()=>ClubHubPersonProfiles.refresh());assert.match(await profile.innerText(),/Qualification records could not be loaded/);assert.doesNotMatch(await profile.innerText(),/Not recorded|Club checked|Needs club check/);
   readMode='loaded';records=['dbs','safeguarding','first_aid'].map(k=>record(k,shift(120)));await p.evaluate(()=>ClubHubPersonProfiles.refresh());await p.getByRole('button',{name:'Manage qualifications',exact:true}).click();
   const dialog=p.locator('#coach-qualification-dialog'),editor=p.locator('#coach-qualification-editor'),completed=p.locator('#coach-qualification-completed'),expiry=p.locator('#coach-qualification-expiry'),check=p.locator('#coach-qualification-checked'),save=p.getByRole('button',{name:'Save record',exact:true});
   for(const label of ['Enhanced DBS','Safeguarding Children','First aid in football'])assert.equal(await dialog.getByRole('button',{name:'Edit '+label,exact:true}).count(),1);
   await dialog.getByRole('button',{name:'Edit Safeguarding Children',exact:true}).click();
   const layout=await p.locator('.qualification-check').evaluate(n=>{const b=n.querySelector('input').getBoundingClientRect(),t=n.querySelector('span').getBoundingClientRect();return {direction:getComputedStyle(n).flexDirection,height:n.getBoundingClientRect().height,boxLeft:b.left,boxTop:b.top,textLeft:t.left,textTop:t.top,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};});
   assert.equal(layout.direction,'row');assert(layout.height>=44&&layout.textLeft>layout.boxLeft&&Math.abs(layout.textTop-layout.boxTop)<8&&!layout.pageOverflow);measurements.push({theme,width,height,state:'inline-check',...layout});
   for(const [field,value,pattern]of [['completed','',/valid issue/],['completed',shift(1),/up to today/],['expiry','',/recorded expiry/],['expiry','2024-01-01',/must be after/],['expiry','2025-01-01',/must be after/]]){
    await completed.fill('2025-01-01');await expiry.fill(shift(120));await (field==='completed'?completed:expiry).fill(value);
    const before=f.calls.filter(c=>c.name==='save_coach_qualifications').length;await save.click();
    const input=field==='completed'?completed:expiry,error=p.locator('#coach-qualification-'+field+'-error');assert.match(await error.innerText(),pattern);assert.equal(await input.getAttribute('aria-invalid'),'true');assert.equal(await input.getAttribute('aria-describedby'),'coach-qualification-'+field+'-error');assert.equal(await input.inputValue(),value);assert.equal(f.calls.filter(c=>c.name==='save_coach_qualifications').length,before);
    assert.equal(await p.evaluate(()=>document.activeElement.id),'coach-qualification-'+field);measurements.push({theme,width,height,state:field+'-'+(value||'missing'),...await visibleFeedback(p,'coach-qualification-'+field+'-error')});
   }
   await p.screenshot({path:path.join(out,`${theme}-${width}-expiry-error.png`)});
   await completed.fill('2025-01-01');await expiry.fill('2028-01-01');assert.equal(await expiry.getAttribute('aria-invalid'),null);assert(!await p.locator('#coach-qualification-expiry-error').isVisible());
   await check.check();await completed.fill('2025-01-02');assert(!await check.isChecked(),'date edit clears club check');
   await save.click();await p.locator('#coach-qualification-form-error').waitFor({state:'visible'});assert.match(await p.locator('#coach-qualification-form-error').innerText(),/Could not save qualifications/);assert.equal(await expiry.inputValue(),'2028-01-01');assert.equal(await p.evaluate(()=>document.activeElement.id),'coach-qualification-form-error');
   measurements.push({theme,width,height,state:'rejected-save',...await visibleFeedback(p,'coach-qualification-form-error')});
   saveMode='conflict';await save.press('Enter');await p.getByText('This profile changed elsewhere. Close and reopen it before saving.',{exact:true}).last().waitFor();assert.equal(await completed.inputValue(),'2025-01-02');assert.equal(await expiry.inputValue(),'2028-01-01');
   measurements.push({theme,width,height,state:'revision-conflict',...await visibleFeedback(p,'coach-qualification-form-error')});await p.screenshot({path:path.join(out,`${theme}-${width}-revision-conflict.png`)});
   const saves=f.calls.filter(c=>c.name==='save_coach_qualifications');assert.equal(saves.length,2);assert(saves.every(c=>c.args.p_user_id===coach.user_id&&c.args.p_expected_revision===4&&c.args.p_records.length===3));
   await dialog.getByRole('button',{name:'Edit Enhanced DBS',exact:true}).click();assert(!await p.locator('#coach-qualification-form-error').isVisible());assert(!await p.locator('#coach-qualification-expiry-error').isVisible());
   await expiry.fill('2024-01-01');await save.click();assert.equal(await expiry.getAttribute('aria-invalid'),'true');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await p.locator('#coach-qualification-expiry-error').textContent(),'');assert.equal(await expiry.getAttribute('aria-invalid'),null);assert.equal(await p.locator('#coach-qualification-list').textContent(),'');
   records=[];await p.getByRole('button',{name:'Manage qualifications',exact:true}).click();for(const label of ['Enhanced DBS','Safeguarding Children','First aid in football'])assert.equal(await dialog.getByRole('button',{name:'Add '+label,exact:true}).count(),1);await p.keyboard.press('Escape');
   assert.equal(f.calls.filter(c=>/^(?:approve_|assign_|unassign_|mark_|delete_|create_)/.test(c.name)).length,0);
   cases.push({theme,width,height,profileCheckedStates:8,validationBlocksWrites:true,fictionalRejectedSaves:saves.length,revisionConflict:true,privateErrorsCleared:true});await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS qualification validation: '+cases.length+' built app cases; independent club-check display, inline checkbox, visible associated errors/focus, zero invalid writes, fictional rejected/conflict saves and cleared private errors; zero external requests/writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
