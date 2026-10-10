#!/usr/bin/env node
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8'),html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const take=(a,b)=>{const x=app.indexOf(a),y=app.indexOf(b,x);assert(x>=0&&y>x);return app.slice(x,y);};
const fixtures=[{date:'2026-10-10',opponent:'Chislehurst Wanderers Panthers',venue:'A'},{date:'2026-10-10',opponent:'Lewisham Borough Cobras',venue:'H'}];
function context({staff=true,group=true,confirmed=true,second=false,time='10:00',native=true}={}){
 const nodes=new Map(),calls=[],notices=[],copied=[];let allowed=staff,current=fixtures[0];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{hidden:true,toggle(_name,value){this.hidden=value;}},focus(){calls.push(['focus',id]);}});return nodes.get(id);};
 const g=new Proxy({measureText:s=>({width:String(s).length*18})},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a])});
 const canvas={width:0,height:0,getContext:()=>g,toDataURL:()=> 'data:image/png;base64,approved-test'};
 const target=fixtures[second?1:0];
 const c={Date,Intl,console,canConfirmFixtureDetails:()=>allowed,nextPublishedFixture:()=>current,miniCupGroup:()=>group?{fixtures}:null,fixtureDetailsConfirmed:f=>confirmed&&(!group||f===target),resolvedFixture:f=>({...f,time,groundName:'Marathon Sports Ground',address:'Shooters Hill'}),homeFixtureTeamNames:f=>f.venue==='A'?{home:f.opponent,away:'Shooters Hill AFC Valiants'}:{home:'Shooters Hill AFC Valiants',away:f.opponent},fixtureOverviewContext:()=>({ownTeam:'Shooters Hill AFC Valiants',ownProfile:{home:'Green and white',away:'Blue and white'},homeKit:'Green',awayKit:'White'}),fixtureKitChoice:f=>second&&f===fixtures[1]?'away':'home',kitColourDisplayText:x=>x,mapsShareHref:()=> 'https://www.google.com/maps/search/?api=1&query=Marathon',fixtureCompetitionLabel:()=> 'U9 Selkent Cup Two - Round 1',drawShareClubIdentity:async(_g,x,y,name)=>calls.push(['badge',name]),drawShareJersey:()=>{},document:{getElementById:node,createElement:type=>type==='canvas'?canvas:{click:()=>calls.push(['download'])}},navigator:{clipboard:{writeText:async s=>copied.push(s)}},window:native?{ClubHubNative:{shareMatchCard:(image,caption)=>calls.push(['native',image,caption])}}:{},toast:s=>notices.push(s),safeFileName:()=> 'test'};
 vm.createContext(c);vm.runInContext(take('function shareCardWrap(', 'function drawShareJersey(')+take('function syncMatchShareActions(', 'function renderFixtureConfirmationEditor(')+take('function matchdayArrivalTime(', 'function renderNextMatch('),c);
 return {c,nodes,node,calls,notices,copied,canvas,role:value=>allowed=value,fixture:value=>current=value};
}
function webContext(options={}){
 const t=context({native:false,...options}),shares=[],checks=[];
 const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,255]);
 t.canvas.toDataURL=()=> 'data:image/png;base64,'+bytes.toString('base64');
 Object.assign(t.c,{File:require('node:buffer').File,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary')});
 Object.assign(t.c.navigator,{userActivation:{isActive:true},canShare:data=>{checks.push(data);return true;},share:async data=>{shares.push(data);}});
 return {...t,shares,checks,bytes};
}
(async()=>{
 for(const group of [false,true])for(const staff of [false,true]){
  const t=context({staff,group});t.c.syncMatchShareActions(fixtures[0]);
  for(const id of ['next-match-share','matches-next-share'])assert.equal(t.node(id).classList.hidden,!staff);
  t.role(false);t.c.syncMatchShareActions(fixtures[0]);assert(t.node('matches-next-share').classList.hidden,'role change removes sharing');
  t.role(true);t.c.syncMatchShareActions(null);assert(t.node('next-match-share').classList.hidden,'no fixture clears stale action');
 }
 const matches=take('function renderMatchPageNextFixture(', 'function divisionOpponents('),editor=take('function renderFixtureConfirmationEditor(', 'function syncFixtureGroundEditor(');
 assert(matches.includes('syncMatchPlayedActionV141(f)'));assert(take('function syncMatchPlayedActionV141(', 'function renderMatchPageNextFixture(').includes("['next-match-share','matches-next-share']"));assert(!matches.includes("'matches-next-share')?.classList.add('hidden')"));
 assert(editor.includes('syncMatchShareActions(f)'));assert(!editor.includes("shareBtn.classList.toggle('hidden',!!miniCupGroup(f)"));
 for(const id of ['next-match-share','matches-next-share']){
  const button=html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`));assert(button);
  assert(button[0].includes('aria-label="Share match details"'));assert(button[0].includes('title="Share match details"'));
  assert(button[1].includes('<svg'));assert(button[1].includes('aria-hidden="true"'));assert(!button[1].includes('Share match'));
 }
 const cup=context();await cup.c.shareNextMatchImage();const shared=cup.calls.find(x=>x[0]==='native');assert(shared);
 assert.equal(cup.canvas.height,1380);assert.deepEqual(cup.calls.filter(x=>x[0]==='badge').map(x=>x[1]),['Shooters Hill AFC Valiants','Chislehurst Wanderers Panthers','Shooters Hill AFC Valiants','Shooters Hill AFC Valiants','Lewisham Borough Cobras']);
 assert.match(shared[2],/Chislehurst Wanderers Panthers v Shooters Hill AFC Valiants/);assert.match(shared[2],/Shooters Hill AFC Valiants v Lewisham Borough Cobras/);assert.match(shared[2],/U9 Selkent Cup Two - Round 1/);assert.match(shared[2],/Group start: 10:00\nArrival: 09:30/);assert(!shared[2].includes('Kick-off:'));
 assert(cup.calls.some(x=>x[0]==='fillText'&&x[1]==='GROUP START'));assert(cup.calls.some(x=>x[0]==='fillText'&&x[1]==='U9 Selkent Cup Two - Round 1'));
 const second=context({second:true});await second.c.shareNextMatchImage();assert.match(second.calls.find(x=>x[0]==='native')[2],/Our kit: Away - Blue and white/,'share uses confirmed group representative shirt');
 const ordinary=context({group:false});await ordinary.c.shareNextMatchImage();assert.equal(ordinary.canvas.height,1028);assert.equal(ordinary.calls.filter(x=>x[0]==='badge').length,3);assert.match(ordinary.calls.find(x=>x[0]==='native')[2],/Kick-off: 10:00/);
 // Put private values on the real fixture input and make private state unreadable.
 // Neither the exported caption nor any canvas text may contain those values.
 for(const group of [false,true]){
  const privateShare=context({group});
  Object.defineProperty(privateShare.c,'state',{get(){throw new Error('Sharing read private player state');}});
  const resolve=privateShare.c.resolvedFixture;
  privateShare.c.resolvedFixture=f=>({...resolve(f),gf:91,ga:87,score:'PRIVATE_SCORE',goals:['PRIVATE_GOALS'],assists:['PRIVATE_ASSISTS'],bookings:['PRIVATE_BOOKINGS'],players:['PRIVATE_CHILD'],notes:'PRIVATE_NOTE'});
  await privateShare.c.shareNextMatchImage();
  const exported=privateShare.calls.find(x=>x[0]==='native');assert(exported,'privacy test must actually export');
  const text=JSON.stringify([exported[2],privateShare.calls.filter(x=>x[0]==='fillText').map(x=>x[1])]);
  assert.doesNotMatch(text,/PRIVATE_|\b91\b|\b87\b/,'private values are absent from both PNG text and caption');
 }
 const browser=context({group:false,native:false});await browser.c.shareNextMatchImage();assert(browser.calls.some(x=>x[0]==='download'),'existing browser image download retained');
 for(const group of [false,true]){
  const w=webContext({group});await w.c.shareNextMatchImage();assert.equal(w.shares.length,1);
  const data=w.shares[0],file=data.files[0];assert.equal(data.title,'Matchday details');assert.equal(file.name,'PitchKind_2026-10-10_test.png');assert.equal(file.type,'image/png');assert.deepEqual(Buffer.from(await file.arrayBuffer()),w.bytes);
  assert.match(data.text,/Marathon Sports Ground/);assert.match(data.text,/Shooters Hill/);assert.match(data.text,/Our kit: Home - Green and white/);assert.match(data.text,/https:\/\/www.google.com\/maps\/search/);
  assert.match(data.text,group?/Group start: 10:00\nArrival: 09:30/:/Kick-off: 10:00\nArrival: 09:30/);
  if(group)assert.match(data.text,/Lewisham Borough Cobras/);
  assert.equal(w.checks[0].files[0],file);assert(!w.calls.some(x=>x[0]==='download'),'supported sharing never downloads');
 }
 const cancelled=webContext();cancelled.c.navigator.share=async()=>{throw {name:'AbortError'};};await cancelled.c.shareNextMatchImage();assert.equal(cancelled.notices.length,0);assert(!cancelled.calls.some(x=>x[0]==='download'),'cancelling does not download');
 const blocked=webContext();blocked.c.navigator.share=async()=>{throw {name:'NotAllowedError'};};await blocked.c.shareNextMatchImage();assert.match(blocked.notices[0],/Tap Share again/);assert(!blocked.calls.some(x=>x[0]==='download'));
 blocked.c.navigator.share=async data=>blocked.shares.push(data);const preparedBadges=blocked.calls.filter(x=>x[0]==='badge').length;await blocked.c.shareNextMatchImage();assert.equal(blocked.shares.length,1);assert.equal(blocked.calls.filter(x=>x[0]==='badge').length,preparedBadges,'retry uses prepared image within tap activation');
 const slow=webContext();slow.c.navigator.userActivation.isActive=false;await slow.c.shareNextMatchImage();assert.equal(slow.shares.length,0);assert.match(slow.notices[0],/Match image ready/);slow.c.navigator.userActivation.isActive=true;await slow.c.shareNextMatchImage();assert.equal(slow.shares.length,1);assert.equal(slow.calls.filter(x=>x[0]==='badge').length,5,'second tap opens prepared image without fetching badges');
 for(const clear of [t=>t.role(false),t=>t.fixture(null),t=>t.c.fixtureDetailsConfirmed=()=>false]){const t=webContext();t.c.navigator.userActivation.isActive=false;await t.c.shareNextMatchImage();clear(t);t.c.navigator.userActivation.isActive=true;await t.c.shareNextMatchImage();assert.equal(t.shares.length,0,'cached image cannot bypass role, fixture or confirmation guards');}
 const changed=webContext();changed.c.navigator.userActivation.isActive=false;await changed.c.shareNextMatchImage();const resolve=changed.c.resolvedFixture;changed.c.resolvedFixture=f=>({...resolve(f),time:'11:00'});changed.c.navigator.userActivation.isActive=true;await changed.c.shareNextMatchImage();assert.match(changed.shares[0].text,/Group start: 11:00\nArrival: 10:30/);assert.equal(changed.calls.filter(x=>x[0]==='badge').length,10,'changed details regenerate card');
 const unsupported=webContext();unsupported.c.navigator.canShare=()=>false;await unsupported.c.shareNextMatchImage();assert.equal(unsupported.shares.length,0);assert(unsupported.calls.some(x=>x[0]==='download'));
 const preferred=webContext({native:true});await preferred.c.shareNextMatchImage();assert(preferred.calls.some(x=>x[0]==='native'));assert.equal(preferred.shares.length,0,'native bridge keeps priority');
 const busy=webContext();let finish;busy.c.navigator.share=async data=>{busy.shares.push(data);await new Promise(resolve=>finish=resolve);};const first=busy.c.shareNextMatchImage();while(!finish)await new Promise(resolve=>setImmediate(resolve));await busy.c.shareNextMatchImage();assert.equal(busy.shares.length,1);finish();await first;assert(!busy.calls.some(x=>x[0]==='download'));
 const preparing=webContext();let ready;preparing.c.document.fonts={ready:new Promise(resolve=>ready=resolve)};const pending=preparing.c.shareNextMatchImage();await preparing.c.shareNextMatchImage();ready();await pending;assert.equal(preparing.shares.length,1,'double tap during rendering prepares one share');
 for(const options of [{staff:false},{confirmed:false},{time:''},{time:'27:60'}]){const t=context(options);await t.c.shareNextMatchImage();assert(!t.calls.some(x=>['native','badge','download'].includes(x[0])),'unauthorised or TBC share produces no image/export');}
 const copy=context();await copy.c.copyNextMatchDetails();assert.match(copy.copied[0],/Group start: 10:00/);assert.match(copy.copied[0],/Lewisham Borough Cobras/);
 console.log('PASS staff share visibility; Cup/ordinary PNG file and caption sharing; cancellation, activation/retry, cache invalidation, double-tap and fallback; native priority and TBC/read-only guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
