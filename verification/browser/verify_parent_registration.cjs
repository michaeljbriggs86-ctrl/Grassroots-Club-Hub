// Real built portal + real isolated PostgreSQL RPCs. Auth/provider transport is fictional.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.argv[2]||'playwright');process.env.PITCHKIND_PGLITE_PATH=process.argv[4]||'@electric-sql/pglite';
const {registrationFixture}=require('../../web/db-drafts/test/registration-fixture.cjs');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'parent-registration-review');fs.mkdirSync(out,{recursive:true});
let fixture,base,queue=Promise.resolve(),failDocument=false;
const server=http.createServer(async(req,res)=>{
 try{const u=new URL(req.url,base||'http://localhost');res.setHeader('Cache-Control','no-store');
  if(u.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');res.end(`window.CLUB_HUB_CLOUD={url:${JSON.stringify(base)},anonKey:'fictional-only-no-credentials'};`);return;}
  if(u.pathname==='/auth/v1/user'){const id=(req.headers.authorization||'').replace('Bearer ','');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id,email:id===fixture.admin?'admin@example.invalid':'parent@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'}));return;}
  if(u.pathname==='/rest/v1/rpc/registration_api'){
   let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw),id=(req.headers.authorization||'').replace('Bearer ','');
   if(failDocument&&body.p_action==='document'&&body.p_data.kind==='conduct'){failDocument=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Document temporarily unavailable'}));return;}
   const work=queue.then(async()=>{await fixture.as(id);return fixture.api(body.p_action,body.p_id,body.p_revision,body.p_data);});queue=work.catch(()=>{});
   try{const data=await work;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message}));}return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(500);res.end();}
});
const click=(page,name)=>page.getByRole('button',{name,exact:true}).click();
async function auth(page,id,theme){await page.evaluate(({id,theme})=>{localStorage.clear();localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify({access_token:id,refresh_token:'fictional-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id}}));localStorage.setItem('grassrootsHub_theme_v1',theme);},{id,theme});}
async function checkLayout(page,width,name){
 for(const zoom of [100,200]){await page.evaluate(v=>document.documentElement.style.fontSize=v+'%',zoom);await page.evaluate(()=>document.fonts.ready);
  const issues=await page.evaluate(()=>[...document.querySelectorAll('#registration-main input,#registration-main select,#registration-main textarea,#registration-main button,#registration-main h1,#registration-main p')].filter(n=>n.getClientRects().length).flatMap(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth+1?[{tag:n.tagName,text:n.textContent.slice(0,60),left:r.left,right:r.right}]:[]}));assert.deepEqual(issues,[],name+' fits '+width+' at '+zoom+'%');
  if(zoom===100||width===320)await page.screenshot({path:path.join(out,`${name}-${width}-${zoom}.png`),fullPage:true});
 }await page.evaluate(()=>document.documentElement.style.fontSize='100%');
 const badge=await page.locator('.registration-badge').evaluate(n=>({loaded:n.complete&&n.naturalWidth>=512,w:n.width,h:n.height}));assert(badge.loaded&&badge.w===64&&badge.h===64,'unchanged badge loads in its 64px slot');
}
async function flow(browser,width,theme){
 fixture=await registrationFixture();let token,id;
 try{await fixture.as(fixture.admin);id=(await fixture.api('invite',null,null,{email:'parent@example.invalid',team_id:fixture.team,request_key:fixture.uid(500)})).id;
  await fixture.as(null,'service_role');const lease=await fixture.delivery('lease',id);await fixture.as(null,'anon');const job=await fixture.delivery('redeem',null,{ticket:lease.ticket});token=job.token;await fixture.delivery('ack',job.id,{ack:job.ack,status:'sent',receipt:'fictional-provider-only'});
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/register.html');await page.getByRole('heading',{name:'Sign in for registration'}).waitFor();await auth(page,fixture.parent,theme);
  await page.goto(base+'/register.html#invite='+token);await page.getByRole('heading',{name:'Your child’s details',exact:true}).waitFor();assert(!page.url().includes(token),'claim token scrubbed from address');
  await click(page,'Continue');assert.match(await page.locator('#registration-status').innerText(),/Complete/);
  for(const [name,value] of Object.entries({first_name:'Invented',surname:'Child',dob:'2017-01-01',address:'Invented private address',postcode:'ZZ1 1ZZ',school_year:'Year 4'}))await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="gender"]').selectOption('boy');await page.locator('[name="medical"]').selectOption('yes');await page.locator('[name="medical_details"]').fill('Invented private medical note');
  await checkLayout(page,width,theme+'-player');await click(page,'Continue');
  for(const [name,value] of Object.entries({parent_first:'Invented',parent_surname:'Parent',mobile:'07700 900123',relationship:'Parent',parent_dob:'1980-01-01'}))await page.locator(`[name="${name}"]`).fill(value);
  await click(page,'Continue');await click(page,'Agree to fees & terms');assert.match(await page.locator('#registration-status').innerText(),/Read the full/);
  await click(page,'Read registration terms');await page.getByText('Full invented current terms',{exact:true}).waitFor();await click(page,'Back to agreements');await click(page,'Agree to fees & terms');await click(page,'I agree to membership');await click(page,'I acknowledge this');
  failDocument=true;await click(page,'Read code of conduct');await page.getByText('Document temporarily unavailable',{exact:true}).waitFor();await click(page,'I agree to the code');assert.match(await page.locator('#registration-status').innerText(),/Read the full/);
  await click(page,'Read code of conduct');await page.getByText('Full invented code',{exact:true}).waitFor();await click(page,'Back to agreements');await click(page,'I agree to the code');await click(page,'No, decline photos');await page.locator('[name="signature"]').fill('Invented Parent');await checkLayout(page,width,theme+'-agreements');
  await click(page,'Save and return later');await page.getByRole('heading',{name:'Registration saved',exact:true}).waitFor();
  const storage=await page.evaluate(()=>JSON.stringify(localStorage));assert(!storage.includes('private address')&&!storage.includes('medical note')&&!storage.includes('Invented Parent'),'private answers never enter storage');
  await page.reload();await page.getByRole('heading',{name:'Your registrations',exact:true}).waitFor();await click(page,'Open registration');await page.getByRole('heading',{name:'Your child’s details',exact:true}).waitFor();assert.equal(await page.locator('[name="address"]').inputValue(),'Invented private address');
  await click(page,'Continue');await click(page,'Continue');assert.equal(await page.getByRole('button',{name:'No, decline photos',exact:true}).getAttribute('aria-pressed'),'true');await click(page,'Continue');await click(page,'Submit registration');await page.getByRole('heading',{name:'Awaiting club review',exact:true}).waitFor();await checkLayout(page,width,theme+'-pending');
  await auth(page,fixture.admin,theme);await page.reload();await page.getByRole('heading',{name:'Player registrations',exact:true}).waitFor();await click(page,'Open registration');await page.getByRole('heading',{name:'Review registration',exact:true}).waitFor();assert.match(await page.locator('#registration-content').innerText(),/Invented private medical note/);
  if(width===393&&theme==='dark'){await click(page,'Request corrections');await page.locator('[name="note"]').fill('Confirm your school year');await click(page,'Send correction request');await page.getByText('corrections',{exact:false}).first().waitFor();await auth(page,fixture.parent,theme);await page.reload();await click(page,'Open registration');await page.getByRole('heading',{name:'Your child’s details',exact:true}).waitFor();await page.getByText('Confirm your school year',{exact:true}).waitFor();await page.locator('[name="school_year"]').fill('Year 5');await click(page,'Continue');await click(page,'Continue');await click(page,'Continue');await click(page,'Submit registration');await page.getByRole('heading',{name:'Awaiting club review',exact:true}).waitFor();await auth(page,fixture.admin,theme);await page.reload();await click(page,'Open registration');await page.getByRole('heading',{name:'Review registration',exact:true}).waitFor();}
  await click(page,'Approve team access');await page.getByRole('heading',{name:'Confirm approval',exact:true}).waitFor();await checkLayout(page,width,theme+'-approval');
  await click(page,'Confirm and approve');assert.match(await page.locator('#registration-status').innerText(),/Choose a player record/);await page.locator('[name="player_record"]').selectOption('__new');await page.locator('[name="shirt_number"]').fill('1');await page.locator('[name="player_role"]').selectOption('outfield');await page.locator('[name="verified"]').check();await click(page,'Confirm and approve');await page.getByRole('heading',{name:'Review registration',exact:true}).waitFor();assert.match(await page.locator('#registration-content').innerText(),/approved/);
  await auth(page,fixture.parent,theme);await page.reload();await click(page,'Open registration');await page.getByRole('heading',{name:'Team access approved',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Open club website',exact:true}).getAttribute('href'),'/');
  await fixture.as(fixture.parent);assert.equal((await fixture.q('select public.can_read_team($1) allowed',[fixture.team])).rows[0].allowed,true);assert.deepEqual(errors,[],'no browser errors');await page.close();return{width,theme,claim:true,privateDraft:true,photoRefusal:true,documentFailure:true,submitted:true,atomicApproval:true};
 }finally{await fixture.db.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true}),results=[];try{for(const theme of ['dark','light'])for(const width of [320,393,1024])results.push(await flow(browser,width,theme));fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));console.log('PASS built parent registration:',results.length,'theme/viewport full SQL-backed flows, 100%/200% text');}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
