// Actual built portal and native controls, fictional read-only HTTP only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_registration_feedback.cjs','utf8');
const boundary='async function main(){';assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const scenarios=async function(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true}),contexts=[],cases=[],measurements=[],errors=[],external=[],unexpected=[];
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking registration return navigation',theme,width);
   const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let admin=true,mode='normal',hold=null;const calls=[];
   await context.addInitScript(theme=>{if(!sessionStorage.getItem('fictional-seeded')){localStorage.clear();localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-admin',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-admin'}}));localStorage.setItem('grassrootsHub_theme_v1',theme);sessionStorage.setItem('fictional-seeded','1');}},theme);
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(u.origin!==base){external.push({method:req.method(),url:req.url()});return route.abort();}
    let body,status=200;
    if(u.pathname==='/auth/v1/user')body={id:admin?'fictional-admin':'fictional-parent',email:'parent@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'};
    else if(u.pathname==='/auth/v1/logout')body={};
    else if(u.pathname==='/rest/v1/rpc/registration_api'){
     const c=JSON.parse(req.postData());calls.push(c);if(!['list','teams'].includes(c.p_action)){unexpected.push(c);return route.abort();}
     if(c.p_action==='teams')body={teams:[{id:'fictional-eligible',label:'U9 Example',season:'2026/27'}]};
     else{const responseAdmin=admin;body={admin:responseAdmin,applications:[]};if(mode==='failed'){status=503;body={message:'Fictional management read unavailable'};}if(mode==='denied'){status=403;body={message:'Registration is not available for this account'};}if(hold){const h=hold;hold=null;h.seen();await h.promise;}}
    }else if(u.pathname.startsWith('/functions/')||u.pathname.startsWith('/rest/')){unexpected.push({path:u.pathname});return route.abort();}
    else return route.continue();
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   });
   const footer=page.locator('#registration-return');
   const source='?admin=1&from=parent-onboarding&team=forged-ineligible&return=https%3A%2F%2Fexample.invalid';
   async function open(query=source){await page.goto(base+'/register.html'+query);}
   async function ready(){await page.getByRole('heading',{name:admin?'Player registrations':'Your registrations',exact:true}).waitFor();}
   async function check(adminReturn,state,capture=false){assert.equal(await footer.getAttribute('href'),adminReturn?'/?view=player-onboarding':'/');assert.equal(await footer.innerText(),adminReturn?'Back to Parent onboarding':'Back to club website');if(capture){await footer.scrollIntoViewIfNeeded();const m=await footer.evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,clipped:n.scrollWidth>n.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}));assert(m.height>=44&&!m.clipped&&!m.pageOverflow);measurements.push({theme,width,height,state,...m});await page.screenshot({path:path.join(out,`${theme}-${width}-${state}.png`)});}}
   await open();await ready();await check(true,'admin-source',true);assert.equal(await page.locator('#registration-invite').count(),0,'management entry does not pretend to start an invitation');
   await page.getByRole('button',{name:'Invite a new player',exact:true}).press('Enter');await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();assert.equal(await page.locator('[name="team_id"]').inputValue(),'','a URL team never assigns or preselects a team');await check(true,'admin-form',true);await page.getByRole('button',{name:'Back to registrations',exact:true}).press('Enter');await ready();await check(true,'admin-list-return');
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');await check(true,'admin-computed-text-200',true);await page.evaluate(()=>document.documentElement.style.fontSize='100%');
   await open('?admin=1');await ready();await check(false,'admin-standalone');await open('?admin=1&from=https%3A%2F%2Fexample.invalid');await ready();await check(false,'unrecognized-source');
   let release,seen;hold={promise:new Promise(r=>release=r),seen:()=>seen()};const entered=new Promise(r=>seen=r);await open();await entered;await check(false,'pending-read');release();await ready();await check(true,'loaded-read');
   // A recoverable read error retains navigation based on the already verified same account.
   await page.getByRole('button',{name:'Invite a new player',exact:true}).click();await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();mode='failed';await page.getByRole('button',{name:'Back to registrations',exact:true}).click();await page.getByText('Fictional management read unavailable',{exact:true}).waitFor();await check(true,'recoverable-read-error');mode='normal';await page.getByRole('button',{name:'Back to registrations',exact:true}).click();await ready();
   mode='denied';await page.getByRole('button',{name:'Invite a new player',exact:true}).click();await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();await page.getByRole('button',{name:'Back to registrations',exact:true}).click();await page.getByRole('heading',{name:'Registration access changed',exact:true}).waitFor();await check(false,'denied');mode='normal';
   await open();await ready();await check(true,'admin-before-signout');await page.getByRole('button',{name:'Sign out',exact:true}).press('Enter');await page.getByRole('heading',{name:'Sign in for registration',exact:true}).waitFor();await check(false,'signed-out',true);
   admin=false;await page.evaluate(()=>localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-parent',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-parent'}})));await open();await ready();await check(false,'parent-forged-admin',true);assert.equal(await page.getByRole('button',{name:'Invite a new player',exact:true}).count(),0);
   // Accepted-account change races a held old Admin response; original serial/identity guards must win.
   admin=true;await page.evaluate(()=>localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-admin',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-admin'}})));let releaseOld,seenOld;hold={promise:new Promise(r=>releaseOld=r),seen:()=>seenOld()};const enteredOld=new Promise(r=>seenOld=r);await open();await enteredOld;admin=false;await page.evaluate(()=>{localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-parent',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-parent'}}));window.dispatchEvent(new StorageEvent('storage',{key:'grassroots_hub_cloud_session_v1'}));});await ready();releaseOld();await page.waitForLoadState('networkidle');await check(false,'late-admin-response');assert.equal(await page.getByRole('button',{name:'Invite a new player',exact:true}).count(),0);
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await check(false,'synthetic-pagehide');assert(calls.every(c=>['list','teams'].includes(c.p_action)));cases.push({theme,width,height,serverAdminSourceGate:true,standaloneAndForgedQueries:true,noTeamPrefill:true,nativeBack:true,pendingAndReadFailure:true,deniedAndSignoutReset:true,parentAndLateAccountBoundary:true,registrationWrites:0});await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(unexpected,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests:external,unexpectedRequests:unexpected},null,2));console.log('PASS registration return navigation:8 built theme/viewport cases;40 footer measurements/captures; verified Admin/source gate, standalone and forged queries, no team prefill, native Back, read/denied/signout/Parent and late-account boundaries;0 registration writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(r=>server.close(r));}
};
new Function('require','process',harness+'('+scenarios.toString()+')().catch(e=>{console.error(e);server.close();process.exitCode=1;});')(require,process);
