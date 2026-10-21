// Actual built portal, unchanged runtime, fictional read-only HTTP fixtures.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_registration_feedback.cjs','utf8');
const boundary='async function main(){';assert.equal(harness.split(boundary).length,2);harness=harness.slice(0,harness.indexOf(boundary));
const scenarios=async function(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true}),contexts=[],cases=[],measurements=[],errors=[],external=[],unexpected=[];
 const rows=Array.from({length:18},(_,i)=>({id:'fictional-'+i,player_name:i===0?null:i===1||i===2?'Taylor <Example> & "Second"':('LongPlayerName'.repeat(8)+' '+i),team:'U9 Example <Greens>',season:'2026/27',email:'parent'+i+'@example.invalid',status:i===0?'invited':'draft',delivery:'sent',revision:1,answers:{},submissions:[]}));
 const expected=row=>'Open registration for '+[row.player_name,row.team,row.season,row.email].filter(Boolean).join(' · ');
 try{
  for(const theme of ['dark','light'])for(const [width,height]of [[320,844],[393,844],[844,393],[1440,1000]]){
   console.log('Checking registration copy and names',theme,width);
   const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let admin=true,teamMode='normal',hold=null;const calls=[];
   await context.addInitScript(theme=>{if(!sessionStorage.getItem('fictional-seeded')){localStorage.clear();localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-admin',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-admin'}}));localStorage.setItem('grassrootsHub_theme_v1',theme);sessionStorage.setItem('fictional-seeded','1');}},theme);
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(u.origin!==base){external.push({method:req.method(),url:req.url()});return route.abort();}
    let body,status=200;
    if(u.pathname==='/auth/v1/user')body={id:admin?'fictional-admin':'fictional-parent',email:'parent1@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'};
    else if(u.pathname==='/auth/v1/logout')body={};
    else if(u.pathname==='/rest/v1/rpc/registration_api'){
     const c=JSON.parse(req.postData());calls.push(c);
     if(c.p_action==='list'){body={admin,applications:admin?rows:[rows[1]]};if(hold){const h=hold;hold=null;h.seen();await h.promise;}}
     else if(c.p_action==='get'){assert(admin||c.p_id===rows[1].id);body={...rows.find(x=>x.id===c.p_id),admin};}
     else if(c.p_action==='teams'){if(teamMode==='failed'){status=503;body={message:'Fictional team lookup failed'};}else body={teams:teamMode==='empty'?[]:[{id:'fictional-team',label:'U9 Example',season:'2026/27'}]};}
     else{unexpected.push(c);return route.abort();}
    }else if(u.pathname.startsWith('/functions/')||u.pathname.startsWith('/rest/')){unexpected.push({path:u.pathname,method:req.method()});return route.abort();}
    else return route.continue();
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   });
   const header=async management=>{assert.equal(await page.locator('#registration-role').innerText(),management?'Club Admin':'Parent registration');assert.equal(await page.locator('#registration-subtitle').innerText(),management?'Registration management':'New player registration');};
   const ready=async()=>{await page.getByRole('heading',{name:admin?'Player registrations':'Your registrations',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);};
   async function capture(state){
    const m=await page.locator('body').evaluate(n=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,role:n.querySelector('#registration-role').textContent,subtitle:n.querySelector('#registration-subtitle').textContent,clipped:[...n.querySelectorAll('#registration-role,#registration-subtitle,#registration-content h1,#registration-content h2,#registration-content p,#registration-content button')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.tagName),clippedHeadings:[...n.querySelectorAll('#registration-content h2')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent),buttonHeights:[...n.querySelectorAll('#registration-content button')].map(x=>x.getBoundingClientRect().height)}));
    assert(!m.pageOverflow);assert.deepEqual(m.clipped.filter(tag=>tag!=='H2'),[],'changed header, guidance and actions reflow');assert(m.clippedHeadings.every(text=>text.startsWith('LongPlayerName')),'only the documented pre-existing unbroken fixture headings may clip');assert(m.buttonHeights.every(h=>h>=52));measurements.push({theme,width,height,state,...m});await page.screenshot({path:path.join(out,`${theme}-${width}-${state}.png`)});
   }
   await page.goto(base+'/register.html?admin=1&from=parent-onboarding');await ready();await header(true);await capture('admin-list');
   const buttons=page.locator('[data-action="open"]');assert.equal(await buttons.count(),18);const names=await buttons.evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')));assert.deepEqual(names,rows.map(expected));assert.equal(new Set(names).size,18);assert.equal(await page.locator('#registration-content img').count(),0);assert(!(await page.locator('#registration-content').innerHTML()).includes('<Example>'));assert.equal(await page.getByRole('button',{name:'Invite a new player',exact:true}).count(),0);
   for(const row of rows.slice(0,3)){await page.getByRole('button',{name:expected(row),exact:true}).press('Enter');await page.getByRole('heading',{name:'Review registration',exact:true}).waitFor();assert.equal(calls.filter(c=>c.p_action==='get').at(-1).p_id,row.id);await header(true);await page.getByRole('button',{name:'Back to registrations',exact:true}).press('Enter');await ready();}
   await page.getByRole('button',{name:'Invite a parent',exact:true}).press('Enter');await page.getByRole('heading',{name:'Invite a parent',exact:true}).waitFor();await header(true);
   const next=page.locator('section').filter({has:page.getByRole('heading',{name:'What happens next',exact:true})});const explanation=await next.innerText();assert.match(explanation,/create an account, or sign in, using the same invited email address/);assert.match(explanation,/If email confirmation is required, they confirm it, reopen the original invitation and sign in/);assert.match(explanation,/club reviews it before granting permitted team access/);assert.equal(await page.locator('[name="team_id"]').inputValue(),'');await capture('invite-form');
   await page.getByRole('button',{name:'Send registration email',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.name),'team_id');await page.getByRole('button',{name:'Back to registrations',exact:true}).press('Enter');await ready();
   teamMode='empty';await page.getByRole('button',{name:'Invite a parent',exact:true}).click();await page.getByRole('heading',{name:'No teams available',exact:true}).waitFor();await page.getByRole('heading',{name:'Invite a parent',exact:true}).waitFor();assert.equal(await page.locator('#registration-invite').count(),0);await capture('no-teams');teamMode='failed';await page.getByRole('button',{name:'Retry available teams',exact:true}).click();await page.getByText('Fictional team lookup failed',{exact:true}).waitFor();teamMode='normal';await page.getByRole('button',{name:'Retry available teams',exact:true}).press('Enter');await page.getByRole('heading',{name:'Registration invitation',exact:true}).waitFor();
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');await capture('invite-computed-text-200');await page.evaluate(()=>document.documentElement.style.fontSize='100%');
   // Header alone stays unprivileged while the authenticated list read is pending.
   let release,seen;hold={promise:new Promise(r=>release=r),seen:()=>seen()};const entered=new Promise(r=>seen=r);await page.goto(base+'/register.html?admin=1');await entered;await header(false);release();await ready();await header(true);
   await page.getByRole('button',{name:'Sign out',exact:true}).press('Enter');await page.getByRole('heading',{name:'Sign in for registration',exact:true}).waitFor();await header(false);assert.equal(await page.locator('[data-action="open"]').count(),0);await capture('signed-out');
   admin=false;await page.evaluate(()=>localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:'fictional-parent',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fictional-parent'}})));await page.goto(base+'/register.html?admin=1&from=parent-onboarding');await ready();await header(false);assert.equal(await page.getByRole('button',{name:'Invite a parent',exact:true}).count(),0);assert.equal(await buttons.count(),1);assert.equal(await buttons.getAttribute('aria-label'),expected(rows[1]));await capture('parent-list');await buttons.press('Enter');await page.getByRole('heading',{name:'Your child’s details',exact:true}).waitFor();await header(false);assert.equal(calls.filter(c=>c.p_action==='get').at(-1).p_id,rows[1].id);
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await header(false);assert.equal(await page.locator('#registration-content').textContent(),'');
   assert(calls.every(c=>['list','get','teams'].includes(c.p_action)));cases.push({theme,width,height,contextualEscapedNames:18,nativeCorrectApplicationOpens:4,accountAndConfirmationCopy:true,eligibleAndEmptyRetry:true,nativeRequiredGuard:true,pendingAndSignoutHeaderReset:true,parentForgedQuery:true,syntheticPagehide:true,registrationWrites:0});await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(unexpected,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests:external,unexpectedRequests:unexpected},null,2));console.log('PASS registration copy and names:8 built theme/viewport cases;48 layouts/captures;18 escaped distinct contextual names, native correct application opening, account/email guidance, empty/retry/native validity and verified/unknown/Parent/signout header states;0 registration writes');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(r=>server.close(r));}
};
new Function('require','process',harness+'('+scenarios.toString()+')().catch(e=>{console.error(e);server.close();process.exitCode=1;});')(require,process);
