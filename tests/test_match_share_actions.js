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
 const c={Date,Intl,console,canConfirmFixtureDetails:()=>allowed,nextPublishedFixture:()=>current,miniCupGroup:()=>group?{fixtures}:null,fixtureDetailsConfirmed:f=>confirmed&&(!group||f===target),resolvedFixture:f=>({...f,time,groundName:'Marathon Sports Ground',address:'Shooters Hill'}),homeFixtureTeamNames:f=>f.venue==='A'?{home:f.opponent,away:'Shooters Hill AFC Valiants'}:{home:'Shooters Hill AFC Valiants',away:f.opponent},fixtureOverviewContext:()=>({ownProfile:{home:'Green and white',away:'Blue and white'},homeKit:'Green',awayKit:'White'}),fixtureKitChoice:f=>second&&f===fixtures[1]?'away':'home',kitColourDisplayText:x=>x,mapsShareHref:()=> 'https://www.google.com/maps/search/?api=1&query=Marathon',fixtureCompetitionLabel:()=> 'U9 Selkent Cup Two - Round 1',drawShareClubIdentity:async(_g,x,y,name)=>calls.push(['badge',name]),drawShareJersey:()=>{},document:{getElementById:node,createElement:type=>type==='canvas'?canvas:{click:()=>calls.push(['download'])}},navigator:{clipboard:{writeText:async s=>copied.push(s)}},window:native?{ClubHubNative:{shareMatchCard:(image,caption)=>calls.push(['native',image,caption])}}:{},toast:s=>notices.push(s),safeFileName:()=> 'test'};
 vm.createContext(c);vm.runInContext(take('function shareCardWrap(', 'function drawShareJersey(')+take('function syncMatchShareActions(', 'function renderFixtureConfirmationEditor(')+take('function matchdayArrivalTime(', 'function renderNextMatch('),c);
 return {c,nodes,node,calls,notices,copied,canvas,role:value=>allowed=value,fixture:value=>current=value};
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
 for(const id of ['next-match-share','matches-next-share'])assert(html.includes(`id="${id}">Share match</button>`));
 const cup=context();await cup.c.shareNextMatchImage();const shared=cup.calls.find(x=>x[0]==='native');assert(shared);
 assert.equal(cup.canvas.height,1500);assert.deepEqual(cup.calls.filter(x=>x[0]==='badge').map(x=>x[1]),['Chislehurst Wanderers Panthers','Shooters Hill AFC Valiants','Shooters Hill AFC Valiants','Lewisham Borough Cobras']);
 assert.match(shared[2],/Chislehurst Wanderers Panthers v Shooters Hill AFC Valiants/);assert.match(shared[2],/Shooters Hill AFC Valiants v Lewisham Borough Cobras/);assert.match(shared[2],/U9 Selkent Cup Two - Round 1/);assert.match(shared[2],/Group start: 10:00\nArrival: 09:30/);assert(!shared[2].includes('Kick-off:'));
 assert(cup.calls.some(x=>x[0]==='fillText'&&x[1]==='GROUP START'));assert(cup.calls.some(x=>x[0]==='fillText'&&x[1]==='U9 Selkent Cup Two - Round 1'));
 const second=context({second:true});await second.c.shareNextMatchImage();assert.match(second.calls.find(x=>x[0]==='native')[2],/Our kit: Away - Blue and white/,'share uses confirmed group representative shirt');
 const ordinary=context({group:false});await ordinary.c.shareNextMatchImage();assert.equal(ordinary.canvas.height,1080);assert.equal(ordinary.calls.filter(x=>x[0]==='badge').length,2);assert.match(ordinary.calls.find(x=>x[0]==='native')[2],/Kick-off: 10:00/);
 const browser=context({group:false,native:false});await browser.c.shareNextMatchImage();assert(browser.calls.some(x=>x[0]==='download'),'existing browser image download retained');
 for(const options of [{staff:false},{confirmed:false},{time:''},{time:'27:60'}]){const t=context(options);await t.c.shareNextMatchImage();assert(!t.calls.some(x=>['native','badge','download'].includes(x[0])),'unauthorised or TBC share produces no image/export');}
 const copy=context();await copy.c.copyNextMatchDetails();assert.match(copy.copied[0],/Group start: 10:00/);assert.match(copy.copied[0],/Lewisham Borough Cobras/);
 console.log('PASS staff share visibility, role/no-fixture clearing, confirmed two-game Cup image/caption, representative kit, ordinary/native/browser paths and TBC/read-only export guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
