// Exercise the existing Home Respond journey with fictional data and blocked services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'parent-availability-review');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(url.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[],externalWrites=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base)return route.continue();if(route.request().method()!=='GET')externalWrites.push(route.request().url());if(url.hostname==='www.google.com'&&url.pathname==='/maps')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body style="background:#dce8df;color:#183c28;display:grid;place-items:center;font:14px system-ui">Fictional venue map</body>'});return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 async function prepare(width=393,theme='dark'){
  await page.setViewportSize({width,height:800});await page.goto(base+'/');await page.waitForFunction(()=>typeof renderAll==='function'&&typeof openParentHomeMatchReply==='function');
  await page.evaluate(({theme})=>{
   applyTheme(theme);document.getElementById('app-splash')?.remove();document.body.classList.remove('splash-active','auth-open');document.getElementById('activation-gate').classList.add('hidden');document.querySelector('.app-shell').classList.remove('account-locked');currentRole='parent';account={role:'parent',user:'Fictional parent'};adminUiMode='team';
   const clone=value=>JSON.parse(JSON.stringify(value));window.__homeReply={uid:'fictional-parent',team:'fictional-team',parentCapacity:true,hold:false,fail:false,calls:0,saves:[],focuses:[],links:[{parent_user_id:'fictional-parent',team_id:'fictional-team',player_name:'Example Child A'},{parent_user_id:'fictional-parent',team_id:'fictional-team',player_name:'Example Child B'},{parent_user_id:'other-parent',team_id:'fictional-team',player_name:'Other Family Child'}],rows:[{player_name:'Example Child A',status:'available'},{player_name:'Example Child B',status:'unavailable'},{player_name:'Other Family Child',status:'unsure'}]};
   const api=window.ClubHubCloud;Object.defineProperty(api,'session',{configurable:true,get:()=>({user:{id:__homeReply.uid}})});Object.defineProperty(api,'context',{configurable:true,get:()=>({profile:{user_id:__homeReply.uid,club_id:'fictional-club',role:currentRole},real_role:'club_admin',acting_as_parent:__homeReply.parentCapacity})});
   Object.assign(api,{role:()=>currentRole,currentTeam:()=>({id:__homeReply.team,ageGroup:'U9',teamName:'Example Greens',leagueName:'Example Greens'}),realRole:()=> 'club_admin',actingAsParent:()=>__homeReply.parentCapacity,isStaffAccount:()=>true,canAdmin:()=>false,canEdit:()=>false,visibleTeamList:()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listPlayerAppearanceStats:async()=>[],listMessageContacts:async()=>[],listClubMessages:async()=>[],getKickoffPushSettings:async()=>({available:false}),
    listParentPlayerLinks:async()=>{if(__homeReply.hold)await new Promise(resolve=>{__homeReply.releaseLinks=resolve;});return clone(__homeReply.links);},listMatchAvailability:async()=>{__homeReply.calls++;const snapshot=clone(__homeReply.rows);if(__homeReply.hold)await new Promise(resolve=>{__homeReply.release=()=>{resolve();__homeReply.releaseLinks?.();};});if(__homeReply.fail)throw Error('Fictional offline');return snapshot;},saveMatchAvailability:async payload=>{__homeReply.saves.push(payload);}});
   fetchClubDirectoryDetails=async()=>({});refreshFixtureOverviewDirectory=()=>{};
   const fixture={date:'2099-10-18',opponent:'Example United',competition:'Division',venue:'H',time:''};
   state=normalizeState({meta:{clubName:'Shooters Hill AFC',teamName:'Example Greens',ageGroup:'U9',season:'2026/27'},division:{name:'Under 9 Example',teamName:'Example Greens'},selkent:{enabled:false,fixtures:[fixture],fixtureOverrides:{}},squad:[{name:'Example Child A',number:1},{name:'Example Child B',number:2}],matches:[],goals:[],awards:[]});
   state.selkent.fixtureOverrides[fixtureKitSelectionKey(fixture)]={time:'10:30',groundName:'Example Playing Fields',address:'Public ground address',confirmedAt:'2026-10-16T11:00:00Z'};
   __parentFamilyKey='';__parentFamilyLinks=[];__parentFamilyStatus='loading';__parentHomeReplyRequest=null;renderAll();navigate('home',false);
   document.addEventListener('focusin',event=>{if(event.target.matches('[data-availability-status]'))__homeReply.focuses.push(event.target.dataset.availabilityStatus);});
  },{theme});await page.waitForFunction(()=>document.querySelectorAll('[data-parent-home-reply]').length===2&&__availabilityLoadStatus==='ready');await page.evaluate(()=>document.fonts.ready);
 }
 const homeReply=()=>page.locator('#parent-home-match-info [data-parent-home-reply="Example Child B"]');
 const choices=()=>page.locator('#parent-availability-controls [data-availability-status]');
 async function waitFocused(){await page.waitForFunction(()=>document.activeElement?.dataset.availabilityStatus==='unavailable'&&document.getElementById('availability-player').value==='Example Child B');}
 async function visibleFocus(){return page.evaluate(()=>{const n=document.activeElement,r=n.getBoundingClientRect(),dialog=document.getElementById('next-fixture-dialog').getBoundingClientRect();return {status:n.dataset.availabilityStatus,top:r.top,bottom:r.bottom,visible:r.top>=Math.max(0,dialog.top)&&r.bottom<=Math.min(innerHeight,dialog.bottom),height:r.height};});}
 const measurements=[];
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1024]){
   await prepare(width,theme);await homeReply().click();await waitFocused();const geometry=await visibleFocus();assert(geometry.visible,'Respond brings actual availability choices into the viewport');assert(geometry.height>=44);assert.equal(await page.locator('#availability-player').inputValue(),'Example Child B');assert.doesNotMatch(await page.locator('#parent-availability-controls').innerText(),/Other Family/);assert.equal(await page.evaluate(()=>__homeReply.saves.length),0,'opening never submits a response');await page.screenshot({path:path.join(out,`respond-${width}-${theme}.png`)});measurements.push({width,theme,geometry});
  }
  await prepare(320);await page.evaluate(()=>__homeReply.hold=true);await homeReply().click();await page.waitForFunction(()=>!!__homeReply.release);for(const button of await choices().all())assert(await button.isDisabled(),'choices remain disabled during the fresh load');assert.equal(await page.evaluate(()=>__homeReply.focuses.length),0);await page.evaluate(()=>{__homeReply.hold=false;__homeReply.release();});await waitFocused();
  await prepare(320,'light');await page.evaluate(()=>__homeReply.fail=true);await homeReply().click();await page.waitForFunction(()=>document.activeElement?.matches('[data-availability-retry]'));for(const button of await choices().all())assert(await button.isDisabled());assert.equal(await page.evaluate(()=>__homeReply.saves.length),0);await page.screenshot({path:path.join(out,'respond-retry-320-light.png')});await page.evaluate(()=>__homeReply.fail=false);await page.locator('#match-availability-warning [data-availability-retry]').click();await waitFocused();
  for(const change of ['team','account','capacity','fixture','unconfirmed','close','unlink']){
   await prepare();await page.evaluate(()=>__homeReply.hold=true);await homeReply().click();await page.waitForFunction(()=>!!__homeReply.release);
   await page.evaluate(change=>{
    if(change==='team')__homeReply.team='different-team';if(change==='account')__homeReply.uid='different-parent';if(change==='capacity'){currentRole='coach';__homeReply.parentCapacity=false;}if(change==='fixture')state.selkent.fixtures[0].opponent='Different United';if(change==='unconfirmed')state.selkent.fixtureOverrides={};if(change==='close')document.getElementById('next-fixture-dialog').close();if(change==='unlink')__homeReply.links=__homeReply.links.filter(link=>link.player_name!=='Example Child B');
    __homeReply.focuses=[];__homeReply.hold=false;__homeReply.release();
   },change);
   await page.waitForFunction(()=>!__parentHomeReplyRequest);assert.equal(await page.evaluate(()=>__homeReply.focuses.length),0,'late '+change+' response cannot focus an old child');assert.equal(await page.evaluate(()=>__homeReply.saves.length),0);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({measurements,errors,external_writes:externalWrites},null,2));console.log('PASS built Parent Home Respond: own child selected, choices visible/focused, delayed loads, truthful Retry, scope/fixture/dialog races, both themes/phone/wider; no live writes.');
 }catch(error){await page.screenshot({path:path.join(out,'failed-check.png'),fullPage:true});throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
