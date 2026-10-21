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
  const parent={user_id:'fictional-parent-b',role:'parent',full_name:'Fictional Parent B',team_id:'fictional-u12-b',team_name:'Example Whites',age_group:12};
  const child='Fictional linked child';
  const coach={user_id:'fictional-coach-a',role:'coach',full_name:'Fictional Coach A',team_id:'fictional-u12-a',team_name:'Example Greens',age_group:12};
  const dual={user_id:'fictional-dual',role:'club_admin',full_name:'Fictional Dual Admin',team_id:'fictional-u12-b',coach_team_id:'fictional-u12-a',team_name:'Example Greens with a long fictional coaching team name',age_group:12};
  const admin={user_id:'fictional-office',role:'club_admin',full_name:'Fictional Office Admin',team_id:'fictional-u12-a',coach_team_id:null};
  const assistant={user_id:'fictional-assistant',role:'assistant_coach',full_name:'Fictional Assistant',team_id:'fictional-u15',team_name:'Example U15',age_group:15};
  for(const theme of ['dark','light'])for(const [width,height]of [[320,740],[393,852],[844,390],[1440,1000]]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();
   await f.page.setViewportSize({width,height});let linkState='loaded',accessState='loaded',contactState='loaded',qualificationState='loaded';
   f.rpcOverride=call=>{
    if(call.name==='list_club_access_accounts')return accessState==='error'?{status:503,body:{message:'Fictional access outage'}}:{body:accessState==='empty'?[]:[parent,coach,dual,admin,assistant]};
    if(call.name==='list_contact_directory')return contactState==='failed'?{status:503,body:{message:'Fictional contact unavailable'}}:{body:{self:{user_id:f.actors['admin-a'].user.id},contacts:[{...parent,kind:'parent',email:'parent@example.invalid'},{...coach,kind:'staff',email:'coach@example.invalid'}],can_manage:true}};
    if(call.name==='get_coach_qualifications')return qualificationState==='failed'?{status:503,body:{message:'Fictional qualifications unavailable'}}:{body:{records:[],revision:0}};
    if(call.name==='list_parent_player_links')return linkState==='failed'||linkState==='denied'?{status:linkState==='denied'?403:503,body:{message:'Fictional link unavailable'}}:{body:linkState==='empty'?[]:[
     {parent_user_id:parent.user_id,team_id:parent.team_id,player_name:child},
     {parent_user_id:parent.user_id,team_id:'fictional-u12-a',player_name:'Wrong team child'},
     {parent_user_id:'someone-else',team_id:parent.team_id,player_name:'Wrong parent child'}]};
   };
   await f.go('?view=app-access');await f.ready();
   await f.page.locator('#app-splash').waitFor({state:'hidden'});
   const select=f.page.locator('#admin-access-filter'),list=f.page.locator('#admin-access-list');
   await f.page.waitForFunction(()=>document.querySelectorAll('#admin-access-list [data-person-profile]').length===5);
   const reads=f.calls.filter(c=>c.name==='list_club_access_accounts').length;
   for(const [value,names]of [['club_admin',[dual.full_name,admin.full_name]],['staff',[coach.full_name,dual.full_name,assistant.full_name]],['parent',[parent.full_name]],['pending_parent',[]],['player',[]],['all',[parent.full_name,coach.full_name,dual.full_name,admin.full_name,assistant.full_name]]]){
    await select.selectOption(value);
    assert.equal(await list.locator('[data-person-profile]').count(),names.length,value+' count');
    for(const row of [parent,coach,dual,admin,assistant])assert.equal((await list.innerText()).includes(row.full_name),names.includes(row.full_name),value+' membership '+row.full_name);
   }
   assert.equal(f.calls.filter(c=>c.name==='list_club_access_accounts').length,reads,'filters only render current accounts');
   await select.selectOption('staff');
   const refresh=f.page.getByRole('button',{name:'Refresh access',exact:true});
   const pending=f.hold('pending-access',c=>c.name==='list_club_access_accounts');await refresh.press('Enter');await pending;
   assert.match(await list.innerText(),/Loading club access/);await select.selectOption('club_admin');assert.match(await list.innerText(),/Loading club access/);await select.selectOption('staff');
   f.release('pending-access');await list.getByRole('button',{name:/Fictional Dual Admin/}).waitFor();
   assert.equal(await select.inputValue(),'staff');assert.equal(await list.locator('[data-person-profile]').count(),3);
   const filterLayout=await f.page.locator('#view-app-access').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,controls:[...el.querySelectorAll('button,select,a')].filter(n=>n.getClientRects().length).map(n=>({height:n.getBoundingClientRect().height,clipped:n.scrollWidth>n.clientWidth+1}))}));
   assert(!filterLayout.overflow);assert(filterLayout.controls.every(n=>n.height>=44&&!n.clipped));measurements.push({width,height,theme,state:'staff-dual-filter',...filterLayout});
   await f.page.screenshot({path:path.join(out,`staff-filter-${theme}-${width}.png`),fullPage:true});
   await select.selectOption('parent');
   const opener=()=>f.page.getByRole('button',{name:/Fictional Parent B/});
   await opener().click();await f.page.getByRole('heading',{name:'Fictional Parent B',exact:true,level:2}).waitFor();
   await f.page.getByText(child,{exact:true}).waitFor();
   assert.equal(f.calls.filter(c=>c.name==='list_parent_player_links').at(-1).args.p_team_id,parent.team_id);
   assert.equal(await f.page.evaluate(()=>ClubHubCloud.currentTeam().id),'fictional-u12-a');
   assert.equal(await f.page.locator('#person-profile-body [data-player-profile]').count(),0);
   assert(!/Wrong (team|parent) child/.test(await f.page.locator('#person-profile-body').innerText()));
   assert.equal(await f.page.evaluate(()=>document.activeElement.id),'person-profile-name');
   await f.page.keyboard.press('Shift+Tab');assert.equal(await f.page.evaluate(()=>document.activeElement.id),'person-profile-back');
   await f.page.keyboard.press('Enter');await f.page.getByRole('heading',{name:'App access',exact:true}).waitFor();
   assert.equal(await select.inputValue(),'parent');
   for(const failure of ['failed','denied']){
    linkState=failure;await opener().click();await f.page.getByText('Linked players could not be loaded. Retry person details to try again.',{exact:true}).waitFor();
    assert.match(await f.page.locator('#person-profile-body').innerText(),/Parent/);
    assert.doesNotMatch(await f.page.locator('#person-profile-body').innerText(),/No linked players available|Fictional linked child/);
    assert(await f.page.getByRole('button',{name:'Retry person details'}).isVisible());
    linkState='loaded';await f.page.getByRole('button',{name:'Retry person details'}).click();await f.page.getByText(child,{exact:true}).waitFor();
    await f.page.locator('#person-profile-back').click();await opener().waitFor();
   }
   linkState='empty';await opener().click();await f.page.getByText('No linked players available for this team.',{exact:true}).waitFor();
   await f.page.locator('#person-profile-back').click();await opener().waitFor();
   // Contact and qualification failures retain only independent fresh sections.
   await select.selectOption('staff');const coachOpener=f.page.getByRole('button',{name:/Fictional Coach A/});
   contactState='failed';await coachOpener.click();await f.page.getByText('Contact details could not be loaded. Retry person details to try again.',{exact:true}).waitFor();
   assert(await f.page.getByRole('heading',{name:'Coaching qualifications',exact:true}).isVisible());
   assert.doesNotMatch(await f.page.locator('#person-profile-body').innerText(),/coach@example.invalid/);
   const partialLayout=await f.page.locator('#view-person').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,retryHeight:document.getElementById('person-profile-retry').getBoundingClientRect().height,text:el.innerText}));
   assert(!partialLayout.overflow);assert(partialLayout.retryHeight>=44);measurements.push({width,height,theme,state:'contact-failure',...partialLayout});
   await f.page.screenshot({path:path.join(out,`partial-${theme}-${width}.png`),fullPage:true});

   contactState='loaded';qualificationState='failed';await f.page.getByRole('button',{name:'Retry person details'}).press('Enter');
   await f.page.getByText('Qualification records could not be loaded. Retry person details or open the qualification record.',{exact:true}).waitFor();
   assert.match(await f.page.locator('#person-profile-body').innerText(),/coach@example.invalid/);
   qualificationState='loaded';await f.page.getByRole('button',{name:'Retry person details'}).press('Enter');
   await f.page.getByRole('button',{name:'Manage qualifications',exact:true}).waitFor();
   assert(!await f.page.locator('#person-profile-retry').isVisible());assert.equal(await f.page.evaluate(()=>document.activeElement.id),'person-profile-name');
   await f.page.locator('#person-profile-back').click();await select.selectOption('parent');await opener().waitFor();
   // Actual read wrapper + rendered filter changes retain a genuine failure.
   accessState='error';await f.page.getByRole('button',{name:'Refresh access',exact:true}).click();
   await f.page.getByText(/Club access is temporarily unavailable/).waitFor();
   for(const value of ['all','club_admin','staff','parent','pending_parent','player']){await select.selectOption(value);assert.match(await f.page.locator('#admin-access-list').innerText(),/temporarily unavailable/);}
   await f.page.screenshot({path:path.join(out,`access-unavailable-${theme}-${width}.png`),fullPage:true});
   accessState='empty';await refresh.press('Enter');await f.page.getByText('No accounts match this filter.',{exact:true}).waitFor();assert.equal(await select.inputValue(),'player');
   await f.page.screenshot({path:path.join(out,`access-empty-${theme}-${width}.png`),fullPage:true});
   accessState='loaded';await f.page.getByRole('button',{name:'Refresh access',exact:true}).click();
   await f.page.getByText('No accounts match this filter.',{exact:true}).waitFor();assert.equal(await select.inputValue(),'player');
   await select.selectOption('parent');await opener().waitFor();linkState='loaded';
   // Late actual HTTP completion cannot resurrect a previous team profile.
   const held=f.hold('late-links',c=>c.name==='list_parent_player_links');await opener().click();await held;
   await f.page.locator('#person-profile-back').click();f.release('late-links');await opener().waitFor();
   assert.equal(await f.page.locator('#person-profile-body').innerText(),'');
   await opener().click();await f.page.getByText(child,{exact:true}).waitFor();
   const layout=await f.page.locator('#view-person').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,heading:document.activeElement.id,body:el.innerText}));
   assert(!layout.overflow,`${width}/${theme}: no viewport overflow`);
   await f.page.screenshot({path:path.join(out,`parent-${theme}-${width}.png`),fullPage:true});
   // Relevant keyboard action can be reached in a short viewport by scrolling.
   await f.page.locator('#person-profile-back').focus();await f.page.keyboard.press('Enter');await opener().waitFor();
   measurements.push({width,height,theme,...layout});cases.push(`parent-access-state-keyboard-${theme}-${width}`);await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built Admin A1: '+cases.length+' theme/viewport scenarios; subject team, unavailable/denied/retry/empty, stale response, retained filter and keyboard; zero external requests/writes');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
// Compile only the fixture and this test function. Production code is served
// unmodified from dist and executes with the actual cloud client in Chromium.
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
