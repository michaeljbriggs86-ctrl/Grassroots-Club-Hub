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
  for(const theme of ['dark','light'])for(const [width,height]of [[320,740],[393,852],[844,390],[1440,1000]]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();
   await f.page.setViewportSize({width,height});let linkState='loaded',accessState='loaded';
   f.rpcOverride=call=>{
    if(call.name==='list_club_access_accounts')return accessState==='error'?{status:503,body:{message:'Fictional access outage'}}:{body:[parent]};
    if(call.name==='list_contact_directory')return{body:{self:{user_id:f.actors['admin-a'].user.id},contacts:[],can_manage:true}};
    if(call.name==='list_parent_player_links')return linkState==='failed'||linkState==='denied'?{status:linkState==='denied'?403:503,body:{message:'Fictional link unavailable'}}:{body:linkState==='empty'?[]:[
     {parent_user_id:parent.user_id,team_id:parent.team_id,player_name:child},
     {parent_user_id:parent.user_id,team_id:'fictional-u12-a',player_name:'Wrong team child'},
     {parent_user_id:'someone-else',team_id:parent.team_id,player_name:'Wrong parent child'}]};
   };
   await f.go('?view=app-access');await f.ready();
   const select=f.page.locator('#admin-access-filter');await select.selectOption('parent');
   const opener=()=>f.page.getByRole('button',{name:/Fictional Parent B/});
   await opener().click();await f.page.getByRole('heading',{name:'Fictional Parent B',exact:true}).waitFor();
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
    linkState=failure;await opener().click();await f.page.getByText(/These details are unavailable/).waitFor();
    assert.equal(await f.page.locator('#person-profile-body').innerText(),'');
    assert(await f.page.getByRole('button',{name:'Retry person details'}).isVisible());
    linkState='loaded';await f.page.getByRole('button',{name:'Retry person details'}).click();await f.page.getByText(child,{exact:true}).waitFor();
    await f.page.locator('#person-profile-back').click();await opener().waitFor();
   }
   linkState='empty';await opener().click();await f.page.getByText('No linked players available for this team.',{exact:true}).waitFor();
   await f.page.locator('#person-profile-back').click();await opener().waitFor();
   // Actual read wrapper + rendered filter changes retain a genuine failure.
   accessState='error';await f.page.getByRole('button',{name:'Refresh access',exact:true}).click();
   await f.page.getByText(/Club access is temporarily unavailable/).waitFor();
   for(const value of ['staff','parent','player']){await select.selectOption(value);assert.match(await f.page.locator('#admin-access-list').innerText(),/temporarily unavailable/);}
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
