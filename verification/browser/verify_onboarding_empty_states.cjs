// Built registration portal against isolated PostgreSQL; no live records or mail.
// The zero-team onboarding component check is explicitly separate from full app
// bootstrap, which correctly remains locked when no accessible teams exist.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_parent_registration.cjs','utf8');
const boundary='async function flow(browser,width,theme){';
assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const dispatch="   if(failDocument&&body.p_action==='document'";
assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   rpcActions.push(body.p_action);
   if(body.p_action==='teams'&&teamResponseMode!=='normal'){res.writeHead(teamResponseMode==='failed'?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(teamResponseMode==='failed'?{message:'Fictional team service unavailable'}:{teams:null}));return;}
${dispatch}`);
const entry="  if(u.pathname==='/cloud-config.js')";
assert.equal(harness.split(entry).length,2);
harness=harness.replace(entry,`  if(u.pathname==='/onboarding-component.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/app-design-system.css"></head><body><main id="view-player-onboarding"><h1>Parent onboarding</h1><label>Team<select id="player-onboarding-team"></select></label><p id="player-onboarding-status" role="status"></p><div id="player-onboarding-content"></div></main><script src="/player-onboarding.js"></script></body></html>');return;}
${entry}`);
const scenarios=async function(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});const results=[],errors=[],invitationRequests=[],actionLayouts=[];
 fixture=await registrationFixture();
 try{
  for(const theme of ['dark','light'])for(const [width,height] of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking onboarding empty states',theme,width);
   const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/functions/v1/registration-invite')invitationRequests.push({method:r.method(),path:new URL(r.url()).pathname});});
   await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   await fixture.owner();await fixture.q('update private.registration_packs set enabled=false');
   await page.goto(base+'/register.html');await page.getByRole('heading',{name:'Sign in for registration',exact:true}).waitFor();
   await auth(page,fixture.admin,theme);await page.reload();await page.getByRole('heading',{name:'Player registrations',exact:true}).waitFor();
   assert.match(await page.locator('#registration-content').innerText(),/No registrations yet/);
   assert.doesNotMatch(await page.locator('#registration-content').innerText(),/Open the original registration invitation/);
   await click(page,'Invite a parent');await page.getByRole('heading',{name:'No teams available',exact:true}).waitFor();
   assert.equal(await page.locator('#registration-invite').count(),0);assert.equal(await page.locator('[name="email"]').count(),0);
   const retryBox=await page.getByRole('button',{name:'Retry available teams',exact:true}).boundingBox(),backBox=await page.getByRole('button',{name:'Back to registrations',exact:true}).boundingBox();assert(backBox.y-retryBox.y-retryBox.height>=8,'empty-state recovery controls have a visible gap');
   await checkLayout(page,width,theme+'-no-eligible-team');
   teamResponseMode='failed';await click(page,'Retry available teams');await page.getByText('Fictional team service unavailable',{exact:true}).waitFor();
   assert.equal(await page.locator('#registration-invite').count(),0,'failed read cannot expose an invitation form');
   teamResponseMode='invalid';await click(page,'Retry available teams');await page.getByText('Available teams could not be loaded. Try again.',{exact:true}).waitFor();
   teamResponseMode='normal';await fixture.owner();await fixture.q('update private.registration_packs set enabled=true');
   await page.getByRole('button',{name:'Retry available teams',exact:true}).press('Enter');await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();
   assert.equal(await page.locator('[name="team_id"] option').count(),2,'only the SQL-approved pack team is selectable');
   assert.equal(await page.locator('[name="team_id"]').inputValue(),'');assert(await page.getByRole('button',{name:'Send registration email',exact:true}).isVisible());
   assert.equal(await page.evaluate(()=>document.activeElement.id),'registration-title');
   await checkLayout(page,width,theme+'-eligible-team-recovered');
   const send=page.getByRole('button',{name:'Send registration email',exact:true}),back=page.getByRole('button',{name:'Back to registrations',exact:true});
   for(const textScale of [100,200]){
    await page.evaluate(v=>document.documentElement.style.fontSize=v+'%',textScale);
    const layout=await page.locator('#registration-invite').evaluate(form=>{const send=form.querySelector('[type="submit"]'),back=form.querySelector('[data-action="list"]'),a=send.getBoundingClientRect(),b=back.getBoundingClientRect();return {sendType:send.type,backType:back.type,sendOwnsForm:send.form===form,backOwnsForm:back.form===form,gap:b.top-a.bottom,heights:[a.height,b.height],order:[...form.querySelectorAll('button')].map(n=>n.textContent.trim()),overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.equal(layout.sendType,'submit');assert.equal(layout.backType,'button');assert(layout.sendOwnsForm&&layout.backOwnsForm);assert.equal(layout.gap,16,'shared action rhythm separates Send and Back');assert(layout.heights.every(h=>h>=52));assert.deepEqual(layout.order,['Send registration email','Back to registrations']);assert(!layout.overflow);actionLayouts.push({theme,width,height,textScale,...layout});
    await back.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`invite-actions-${theme}-${width}-${textScale}.png`)});
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='100%');
   await send.click();assert.equal(await page.evaluate(()=>document.activeElement.name),'team_id','native required team guard still focuses Team');assert.equal(invitationRequests.length,0);
   await back.press('Enter');await page.getByRole('heading',{name:'Player registrations',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'registration-title','Back bypasses invalid form submission and restores list focus');
   await click(page,'Invite a parent');await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();await page.locator('[name="team_id"]').selectOption({index:1});await page.locator('[name="email"]').fill('parent@example.invalid');
   await page.locator('[name="email"]').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Send registration email','native Tab reaches submit first');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Back to registrations','native Tab reaches Back second');await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Player registrations',exact:true}).waitFor();assert.equal(invitationRequests.length,0,'Back with valid fields never sends an invitation');
   await auth(page,fixture.parent,theme);await page.reload();await page.getByRole('heading',{name:'Your registrations',exact:true}).waitFor();
   assert.match(await page.locator('#registration-content').innerText(),/Open the original registration invitation/);assert.equal(await page.getByRole('button',{name:'Invite a parent',exact:true}).count(),0);
   await checkLayout(page,width,theme+'-parent-empty');
   // Component-only zero-list rendering; this does not install a fake cloud
   // client or bypass the production app's bootstrap/access functions.
   await page.goto(base+'/onboarding-component.html');await page.evaluate(async theme=>{
    document.documentElement.dataset.theme=theme;window.__componentTeams=[];window.__componentReads=0;
    const data={team:{id:'fictional-team',ageGroup:'U9',teamName:'Example Greens'},players:[],requests:[],links:[],limit:10};
    window.ClubHubPlayerOnboarding.configure({allowed:()=>true,currentView:()=> 'player-onboarding',contextKey:()=> 'fictional-component-only',cloud:()=>window.__componentCloud,toast(){}});
    window.__componentCloud={visibleTeamList:()=>window.__componentTeams,loadAdminPlayerOnboarding:async()=>{window.__componentReads++;return data;}};
    await window.ClubHubPlayerOnboarding.enter();
   },theme);
   const select=page.locator('#player-onboarding-team');assert(await select.isDisabled());assert.match(await page.locator('#player-onboarding-content').innerText(),/No teams are available for parent onboarding in this view/);
   assert.equal(await page.evaluate(()=>window.__componentReads),0);
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
   await page.screenshot({path:path.join(out,`component-empty-${theme}-${width}.png`),fullPage:true});
   await page.evaluate(async()=>{window.__componentTeams=[{id:'fictional-team',ageGroup:'U9',teamName:'Example Greens'}];await ClubHubPlayerOnboarding.enter();});
   assert(!await select.isDisabled());assert.equal(await select.locator('option').count(),2);await select.selectOption('fictional-team');
   await page.getByRole('heading',{name:'Welcome the next player',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__componentReads),1);
   results.push({theme,width,height,portal:'actual built assets and SQL eligibility',component:'built standalone module, not full bootstrap',noInvitationWrites:true,invalidSendGuard:true,nativeTabOrder:true,blankAndFilledBack:true});await page.close();
  }
  assert.deepEqual(errors,[]);assert(rpcActions.every(x=>x==='list'||x==='teams'),'only registration reads were made');
  assert.deepEqual(invitationRequests,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),results,actionLayouts,pageErrors:errors,rpcActions,invitationRequests},null,2));
  console.log('PASS built onboarding and invitation actions: 8 SQL-backed portal theme/viewport cases; 16 measured action stacks at 100%/200% computed text, native required guard/Tab order/Back with blank and valid fields; eligibility recovery, failures, parent boundary and separate component-only zero-team cases; no invitation or access writes');
 }finally{await fixture.db.close();await browser.close();server.close();}
};
new Function('require','process',harness+"\nlet teamResponseMode='normal';const rpcActions=[];\n("+scenarios.toString()+")().catch(e=>{console.error(e);server.close();process.exitCode=1;});")(require,process);
