#!/usr/bin/env node
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8'),moduleSource=fs.readFileSync('app/src/main/assets/person-profiles.js','utf8');
const elements=new Map(),events={};
const node=id=>{if(!elements.has(id)){const flags=new Set();elements.set(id,{id,innerHTML:'',textContent:'',value:'',open:false,isConnected:true,focus(){this.focused=true;},classList:{add:x=>flags.add(x),toggle:(x,on)=>on?flags.add(x):flags.delete(x),contains:x=>flags.has(x)},addEventListener:(name,fn)=>events[id+':'+name]=fn});}return elements.get(id);};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={console,CLOUD_MODE:true,currentRole:'parent',currentView:'inbox',__clubTab:'overview',admin:false,preview:false,
 state:{meta:{ageGroup:'U9'},squad:[{name:'Own child',number:1,role:'goalkeeper'},{name:'Other child',number:2,role:'outfield'}]},
 document:{getElementById:node,activeElement:node('opener'),addEventListener:(name,fn)=>events['document:'+name]=fn},
 esc,isClubOverviewMode:()=>ctx.admin,isAdminTeamPreviewMode:()=>ctx.preview,isCoach:()=>['coach','assistant_coach'].includes(ctx.currentRole),
 accessRoleLabel:r=>({club_admin:'Club Admin',coach:'Coach',assistant_coach:'Assistant Coach',parent:'Parent',player:'Player',pending_parent:'Parent · pending'}[r]||'Parent'),
 inboxContactRoleLabel:r=>ctx.accessRoleLabel(r.role),
 playerForName:name=>ctx.state.squad.find(p=>p.name===name),selkentNorm:s=>String(s||'').toLowerCase(),ageGroupNumber:()=>Number(ctx.state.meta.ageGroup.slice(1)),
 playerSeasonSummary:()=>({goals:501,assists:20,awards:3,appearance:{appearances:4,recorded:5,starts:2,no_shows:1}}),appearanceStatFor:()=>({}),attendancePercent:()=>80,
 jerseyHTML:p=>`<span>Shirt ${p.number}</span>`,nextPublishedFixture:()=>null,fixtureResponseKey:f=>f.id,fixtureSummary:f=>f.id,listFixtureAvailability:async()=>[],toast(){},
 navigate(view){if(view!=='person')ctx.ClubHubPersonProfiles.leave();ctx.currentView=view;if(view==='person')ctx.ClubHubPersonProfiles.enter();},
 addEventListener:(name,fn)=>{(events['window:'+name]||=[]).push(fn);},history:{state:null,back:()=>ctx.navigate('inbox')},
};ctx.window=ctx;
let calls=[],qualificationReads=[],team='a';
const own={user_id:'me',full_name:'Own parent',club_id:'club'};
const c=(id,role='coach',tid='a')=>({user_id:id,full_name:id==='coach-a'?'Coach <script>':id,role,kind:role==='parent'?'parent':'staff',team_id:tid,team_name:'Valiants',age_group:9,email:'contact@example.invalid',phone:'07700 900123',player_names:role==='parent'?['Own child']:[]});
const cloud={context:{profile:own},session:{user:{id:'me'}},role:()=>ctx.currentRole,actingAsParent:()=>ctx.currentRole==='parent',currentTeam:()=>({id:team}),
 listContactDirectory:async()=>{calls.push('contacts');return{can_manage:ctx.admin,self:{...own,email:'self@example.invalid',phone:''},contacts:[c('coach-a'),c('parent-a','parent'),c('foreign','coach','b')]};},
 listParentPlayerLinks:async id=>[{parent_user_id:id||'me',team_id:'a',player_name:id==='parent-a'?'Other child':'Own child'}],
 listPlayerAccountLinks:async id=>[{user_id:id,team_id:'a',player_name:'Own child'}],
 listClubAccessAccounts:async()=>{calls.push('access');return[c('parent-a','parent'),c('coach-a')];},
 listClubCoaches:async()=>{calls.push('club');return[c('coach-a')];},listTeamMembers:async()=>{calls.push('team');return[c('parent-a','parent'),c('coach-a')];},
 listPendingParentRequests:async()=>{calls.push('requests');return[{request_id:'req',user_id:'pending',parent_name:'Pending <script>',child_name:'Typed child',parent_email:'pending@example.invalid'}];},
 getCoachQualifications:async id=>{qualificationReads.push(id);return{records:[{kind:'dbs',course:'dbs',completed_on:'2025-01-01',expires_on:'2028-01-01',club_checked:true}]};},
};ctx.ClubHubCloud=cloud;
ctx.ClubHubCoachQualifications={close(){},validate:r=>r,catalogue:[{kind:'dbs',label:'Enhanced DBS',courses:{dbs:'Enhanced DBS'}},{kind:'safeguarding',label:'Safeguarding',courses:{}},{kind:'first_aid',label:'First aid',courses:{}}],status:r=>r?{label:'In date',tone:'current'}:{label:'Not recorded',tone:'missing'},open(){}};
vm.createContext(ctx);vm.runInContext(moduleSource,ctx);
vm.runInContext(app.slice(app.indexOf('let __contactDirectoryIdentity='),app.indexOf('let __inboxStamp=')),ctx);
const ui=ctx.ClubHubPersonProfiles,tick=()=>new Promise(r=>setImmediate(r));
const body=()=>node('person-profile-body').innerHTML;
const open=async target=>{ui.open(target);await tick();};
const member=(id,source='contact')=>({kind:'member',id,source,teamId:''});
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
(async()=>{
 await open(member('coach-a'));assert.equal(ctx.currentView,'person');assert.match(body(),/mailto:contact%40example.invalid/);assert.match(body(),/tel:07700900123/);assert.doesNotMatch(body(),/Coaching qualifications|data-contact-user|Manage access/);assert.doesNotMatch(body(),/<script>/);assert.equal(qualificationReads.length,0,'parent never requests staff qualifications');
 assert.equal(node('person-profile-name').textContent,'Coach <script>');assert(node('person-profile-name').focused);
 await open(member('parent-a'));assert.equal(body(),'','parent cannot open another parent, even if backend accidentally includes it');
 await open(member('foreign'));assert.equal(body(),'','parent cannot open an off-team coach');
 for(const source of ['team','club','access','request']){await open(member(source==='request'?'req':'parent-a',source));assert.equal(body(),'');}
 assert(!calls.includes('team')&&!calls.includes('access')&&!calls.includes('requests'),'forbidden sources do not call staff endpoints');
 await open(member('me','self'));assert.match(body(),/data-contact-user="me"/);assert.match(body(),/Linked players for this team/);assert.match(body(),/Own child/);
 await open({kind:'player',name:'Other child'});assert.equal(body(),'','parent cannot open unlinked player');
 await open({kind:'player',name:'Own child'});assert.match(body(),/Attendance/);assert.doesNotMatch(body(),/Goals|Assists|Goal contributions|No-shows|501/,'U7–U11 parent screen excludes results and scoring');
 const saveStart=app.indexOf('async function saveProfileAvailability(status){'),saveEnd=app.indexOf('function openPlayerDialog(',saveStart);vm.runInContext(app.slice(saveStart,saveEnd),ctx);
 const listener=app.split('\n').find(line=>line.startsWith("document.getElementById('person-profile-body')?.addEventListener('click'"));vm.runInContext(listener,ctx);
 let availabilityWrites=[];ctx.refreshMatchAvailability=async()=>{};cloud.saveMatchAvailability=async value=>{availabilityWrites.push(value);};
 ctx.nextPublishedFixture=()=>({id:'fixture-a'});await open({kind:'player',name:'Own child'});assert.match(body(),/data-profile-availability/);
 events['person-profile-body:click']({target:{closest:()=>({dataset:{profileAvailability:'available'}})}});await tick();assert.equal(availabilityWrites.length,1);assert.equal(availabilityWrites[0].playerName,'Own child');
 ctx.listFixtureAvailability=async()=>{throw Error('offline')};await ui.refresh();assert.match(body(),/Shirt 1/,'availability outage keeps permitted player details');assert.equal(ui.selectedSnapshot().canRespond,false);
 await ctx.saveProfileAvailability('available');assert.equal(availabilityWrites.length,1,'failed availability load has no write controls');ctx.listFixtureAvailability=async()=>[];ctx.nextPublishedFixture=()=>null;
 ctx.currentRole='coach';cloud.actingAsParent=()=>false;ui.syncAccess();assert.equal(body(),'','capacity change clears all private DOM');
 await open(member('parent-a','team'));assert.match(body(),/Edit player links|Other child/);assert.doesNotMatch(body(),/data-contact-user|Coaching qualifications/);
 await open(member('coach-a'));assert.doesNotMatch(body(),/Coaching qualifications/,'coach cannot read colleagues qualifications');
 await open(member('me','self'));assert.match(body(),/Coaching qualifications|2028-01-01/);assert.equal(qualificationReads.at(-1),'me');
 ctx.currentRole='admin';ctx.admin=true;ui.syncAccess();await open(member('parent-a','access'));assert.match(body(),/data-contact-user="parent-a"/);
 const savedAccess=cloud.listClubAccessAccounts,savedLinks=cloud.listParentPlayerLinks;
 cloud.listClubAccessAccounts=async()=>[c('parent-b','parent','b')];let linkCalls=[];
 cloud.listParentPlayerLinks=async(id,teamId)=>{linkCalls.push([id,teamId]);return [
  {parent_user_id:id,team_id:'b',player_name:'Other child'},
  {parent_user_id:id,team_id:'a',player_name:'Wrong team child'},
  {parent_user_id:'someone-else',team_id:'b',player_name:'Wrong parent child'}];};
 await open({...member('parent-b','access'),teamId:'b'});
 assert.deepEqual(linkCalls.at(-1),['parent-b','b']);assert.match(body(),/Other child/);
 assert.doesNotMatch(body(),/Wrong team child|Wrong parent child|data-player-profile/,'club overview keeps verified names readable without an unresolvable action');
 assert.equal(team,'a','opening a profile never switches the workspace');
 await open(member('parent-b','access'));assert.deepEqual(linkCalls.at(-1),['parent-b','b'],'access row supplies subject team when target omits it');
 const count=linkCalls.length;await open({...member('parent-b','access'),teamId:'unauthorised'});
 assert.equal(linkCalls.length,count);assert.equal(body(),'','target must match a freshly authorised subject/team row');
 cloud.listParentPlayerLinks=async()=>{throw Error('denied or offline')};await open(member('parent-b','access'));
 assert.equal(body(),'');assert.match(node('person-profile-status').textContent,/unavailable/,'failed link read is never an empty-links claim');
 cloud.listParentPlayerLinks=async()=>[];await ui.refresh();assert.match(body(),/No linked players available/,'successful empty read remains distinct');
 cloud.listClubAccessAccounts=savedAccess;cloud.listParentPlayerLinks=savedLinks;
 await open(member('coach-a','club'));assert.match(body(),/Coaching qualifications|Manage access|data-remove-club-coach/);assert.equal(qualificationReads.at(-1),'coach-a');
 await open(member('req','request'));assert.match(body(),/Typed child|pending@example.invalid|review-request/);assert.doesNotMatch(body(),/<script>|mailto:/);
 ctx.currentRole='player';ctx.admin=false;ctx.state.meta.ageGroup='U15';ui.syncAccess();await open({kind:'player',name:'Own child'});assert.match(body(),/Goals/);assert.doesNotMatch(body(),/Edit player details|No-shows/);await open({kind:'player',name:'Other child'});assert.equal(body(),'');
 ctx.currentRole='coach';ui.syncAccess();const late=deferred(),old=cloud.listContactDirectory;cloud.listContactDirectory=()=>late.promise;ui.open(member('parent-a'));await tick();
 team='b';ui.syncAccess();late.resolve({self:own,contacts:[c('parent-a','parent')],can_manage:false});await tick();assert.equal(body(),'','late old-team response discarded');
 team='a';cloud.listContactDirectory=old;await open(member('coach-a'));const profileKey=ui.historyKey();ctx.navigate('inbox');assert.equal(body(),'','leaving removes details from DOM');ui.restore(profileKey);ctx.navigate('person');await tick();assert.match(body(),/contact@example.invalid/,'history re-fetches permitted target');
 ui.restore('unknown-session-key');await ui.enter();assert.equal(body(),'','reload cannot resolve an old opaque key');
 await open(member('coach-a'));events['window:clubhub-contacts-clear'].forEach(fn=>fn());assert.equal(body(),'');assert.equal(ui.selectedTarget(),null);
 await open(member('coach-a'));cloud.session.user.id='new-user';ui.syncAccess();assert.equal(body(),'','session/profile mismatch clears the screen before bootstrap finishes');assert.equal(ui.selectedTarget(),null);cloud.session.user.id='me';
 ctx.state.squad.push({name:'Own child',number:3,role:'outfield'});await open({kind:'player',name:'Own child'});assert.equal(body(),'','ambiguous player names are never selected arbitrarily');ctx.state.squad.pop();
 assert.doesNotMatch(moduleSource,/localStorage|sessionStorage|JSON\.stringify/,'profile data is never persisted');
 const html=fs.readFileSync('app/src/main/assets/index.html','utf8');assert.match(html,/data-view="person"/);assert.doesNotMatch(html,/id="player-profile-dialog"/);
 console.log('PASS individual screens: fresh access checks, role sections, parent/team/child privacy, private qualifications, mini stats, safe content, clear/back/history and late responses');
})().catch(e=>{console.error(e);process.exitCode=1;});
