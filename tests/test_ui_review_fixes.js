#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const cloud=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const slice=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a);assert(a>=0&&b>a,`missing ${start}`);return src.slice(a,b);};
const classes=()=>{const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),toggle(x,on){if(on)s.add(x);else s.delete(x);},contains:x=>s.has(x),[Symbol.iterator]:()=>s[Symbol.iterator]()};};

// Run the actual route parser, role guards and navigation against a browser-history stand-in.
const events={},entries=[],views=['home','matches','squad','add','league','club','inbox','more'].map(view=>({dataset:{view},classList:classes()}));
const tabs=views.map(v=>({dataset:{nav:v.dataset.view},classList:classes(),attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}}));
let reduced=false;
const win={location:{href:'https://example.test/?keep=yes&view=matches#auth_callback'},matchMedia:()=>({matches:reduced}),addEventListener:(name,fn)=>events[name]=fn,scrollTo:()=>{}};
win.history={pushState(_state,_title,url){entries.push({mode:'push',url});win.location.href=url;},replaceState(_state,_title,url){entries.push({mode:'replace',url});win.location.href=url;}};
const env={window:win,URL,CLOUD_MODE:true,currentRole:'coach',currentView:'home',__clubTab:'overview',__squadPage:0,__communicationsTab:'inbox',__booting:false,
  isAdmin:()=>env.currentRole==='admin',isCoach:()=>['coach','assistant_coach'].includes(env.currentRole),isPublishedLeagueTeam:()=>false,isClubOverviewMode:()=>env.currentRole==='admin',
  document:{body:{classList:classes()},querySelector:()=>null,querySelectorAll:q=>q==='.view'?views:q==='.top-nav-tabs .nav-item'?tabs:[],getElementById:id=>id==='match-id'?{value:''}:null},
  localStorage:{setItem(){}},ADMIN_UI_MODE_KEY:'admin-mode',setDefaultDate(){},renderTeamIdentity(){},applyAccessMode(){},syncMobileNavigation(){},applyMiniResultVisibility(){},setCommunicationsTab(){},refreshInbox(){},toast(){},
  setClubTab(tab){env.__clubTab=tab;env.syncNavigationUrl();}
};
vm.createContext(env);
vm.runInContext(slice(app,'// Screen routes use','function setCommunicationsTab('),env);
assert.equal(env.navigationViewFromUrl(),'matches','a bookmarked screen is restored after account bootstrap');
env.navigate('matches',false);assert.equal(entries.length,0,'bootstrap rendering cannot overwrite the pending route');
vm.runInContext('__navigationReady=true;',env);
env.navigate('squad',false);assert.equal(entries.length,1);
assert.equal(new URL(win.location.href).searchParams.get('keep'),'yes');
assert.equal(new URL(win.location.href).hash,'#auth_callback','screen routing preserves auth callback fragments');
env.navigate('squad',false);assert.equal(entries.length,1,'reselecting a screen does not add a history entry');
win.location.href=entries[0].url.replace('view=squad','view=matches');events.popstate();
assert.equal(env.currentView,'matches');assert.equal(entries.length,1,'Back does not create a new history entry');
env.currentRole='parent';win.location.href='https://example.test/?view=squad';events.popstate();
assert.equal(env.currentView,'home');assert.equal(entries.at(-1).mode,'replace','a forbidden deep link is replaced');
env.currentRole='player';env.navigate('inbox',false);assert.equal(env.currentView,'home');
win.location.href='https://example.test/?view=club-results';const playerEntries=entries.length;events.popstate();assert.equal(env.currentView,'home');assert.equal(entries.length,playerEntries+1);assert.equal(entries.at(-1).mode,'replace','a player cannot enter staff club pages through Back');
env.currentRole='coach';env.navigate('league',false);assert.equal(env.currentView,'matches','unpublished teams route to Matches');
assert.equal(tabs.find(t=>t.dataset.nav==='matches').attrs['aria-current'],'page','the actual destination receives the active marker');
env.navigate('<script>',false);assert.equal(env.currentView,'home','unknown URL values never become views');
env.currentRole='admin';env.navigate('club-fixtures',false);assert.equal(new URL(win.location.href).searchParams.get('view'),'club-fixtures');
assert.equal(entries.at(-1).mode,'push');
const before=entries.length;env.navigate('club-results',false);assert.equal(entries.length,before+1,'club tab navigation adds one history entry');
win.location.href='https://example.test/?view=club-fixtures';events.popstate();assert.equal(env.__clubTab,'fixtures');
reduced=true;assert.equal(env.preferredScrollBehavior(),'auto');reduced=false;assert.equal(env.preferredScrollBehavior(),'smooth');
delete win.matchMedia;assert.equal(env.preferredScrollBehavior(),'smooth');

// Keyboard movement uses the same real plan/local/cloud persistence as a drag.
const keys={},status={textContent:''};let saves=0,plans=0,queued=0,prevented=0;
const button={style:{left:'50%',top:'40%'},setAttribute(){},getAttribute:()=> 'Test player',addEventListener:(name,fn)=>keys[name]=fn};
const tactics={state:{tactics:{positions:{p1:{x:50,y:40}}}},__tacticsSelected:null,__tacticsDragInProgress:false,slotPos:p=>p,isCoach:()=>true,CLOUD_MODE:true,
  document:{getElementById:()=>status},window:{ClubHubCloud:{queueStateSave(){queued++;}}},rememberTacticsPlan(){plans++;},persistLocalState(){saves++;},Math};
vm.createContext(tactics);vm.runInContext(slice(app,'function enableTacticsKeyboard(','function enableTacticsTapMove('),tactics);tactics.enableTacticsKeyboard(button,'p1');
const key=(key,extra={})=>keys.keydown({key,preventDefault(){prevented++;},...extra});
key('ArrowRight');assert.equal(tactics.state.tactics.positions.p1.x,51);assert.equal(button.style.left,'51%');
key('ArrowUp',{shiftKey:true});assert.equal(tactics.state.tactics.positions.p1.y,35);assert.equal(saves,2);assert.equal(plans,2);assert.equal(queued,2);assert.match(status.textContent,/51% across, 35% down/);
key('ArrowLeft',{ctrlKey:true});key('Enter');assert.equal(saves,2,'modified shortcuts and native button activation are untouched');
tactics.state.tactics.positions.p1={x:93,y:95};key('ArrowRight');key('ArrowDown');assert.equal(saves,2,'pitch limits do not trigger redundant saves');
tactics.isCoach=()=>false;key('ArrowUp');assert.equal(saves,2,'read-only roles cannot move players');assert.equal(prevented,4);
// A selected pitch player can also be moved with a single tap, without dragging.
const taps={};let bound=0,redraws=0,focused=0;
const moved={dataset:{tacticsId:'p1'},focus(){focused++;},getAttribute:()=> 'Test player'};
const pitch={addEventListener:(name,fn)=>{bound++;taps[name]=fn;},getBoundingClientRect:()=>({left:100,top:200,width:200,height:400}),querySelectorAll:()=>[moved]};
Object.assign(tactics,{isCoach:()=>true,footballFormat:()=>({onPitch:1}),renderTacticsBoard(){redraws++;},__tacticsSelected:'p1'});tactics.state.tactics.lineup=['p1','bench'];
vm.runInContext(slice(app,'function enableTacticsTapMove(','function enableTacticsDrag('),tactics);tactics.enableTacticsTapMove(pitch);tactics.enableTacticsTapMove(pitch);assert.equal(bound,1);
const tap=(x,y,player=false)=>taps.click({clientX:x,clientY:y,target:{closest:()=>player?{}:null}});
tap(200,400,true);assert.equal(saves,2,'tapping another player preserves the existing swap interaction');
tap(140,440);assert.equal(tactics.state.tactics.positions.p1.x,20);assert.equal(tactics.state.tactics.positions.p1.y,60);assert.equal(redraws,1);assert.equal(focused,1);assert.equal(saves,3);assert.equal(queued,3);
tactics.__tacticsSelected='bench';tap(200,400);assert.equal(saves,3,'a bench player has no pitch position to move');
tactics.__tacticsSelected='p1';tactics.isCoach=()=>false;tap(200,400);assert.equal(saves,3,'read-only roles cannot tap to move');

// Future/postponed fixtures never become recent form; abandoned history still appears.
const matches=[{id:'played',status:'played',date:'2026-10-01'},{id:'future',status:'scheduled',date:'2026-10-18'},{id:'postponed',status:'postponed',date:'2026-10-05'},{id:'abandoned',status:'abandoned',date:'2026-10-04'}];
const recentCode=slice(app,'  // Form and recent results','  const scoring=');
const recentNodes=new Map();const history={sorted:matches.sort((a,b)=>a.date.localeCompare(b.date)),matchStatus:m=>m.status,resultOf:m=>m.id,clubListingHtml:x=>x,formatDate:x=>x,esc:x=>x,matchScoreText:m=>m.id,document:{getElementById:id=>{if(!recentNodes.has(id))recentNodes.set(id,{innerHTML:''});return recentNodes.get(id);}}};
vm.runInNewContext(recentCode,history);assert.match(recentNodes.get('recent-form').innerHTML,/abandoned/);assert.match(recentNodes.get('recent-form').innerHTML,/played/);assert.doesNotMatch(recentNodes.get('recent-form').innerHTML,/future|postponed/);
history.sorted=[];vm.runInNewContext(`{${recentCode}}`,history);assert.match(recentNodes.get('recent-form').innerHTML,/No matches yet/);

// Generated field labels remain available after placeholder text disappears.
const fields={authIcon:()=>'',escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.runInNewContext(slice(cloud,'  function authField(','  function authMainScreen('),fields);
const field=fields.authField({id:'password',type:'password',placeholder:'Password',value:'already entered'});
assert.match(field,/<label class="a11y-only" for="password">Password<\/label>/);assert.match(field,/name="password"/);
assert.match(fields.authField({id:'child',placeholder:'Child',label:'Child & guardian'}),/Child &amp; guardian/);
console.log('PASS UI review fixes: protected routes/history, reduced-motion scrolling, keyboard tactics, recent form and persistent labels');
