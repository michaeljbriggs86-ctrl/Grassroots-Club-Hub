#!/usr/bin/env node
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const elements=new Map(),events={};
function node(id){if(!elements.has(id)){const flags=new Set();elements.set(id,{id,innerHTML:'',textContent:'',value:'',open:false,isConnected:true,
 classList:{add:k=>flags.add(k),toggle:(k,on)=>on?flags.add(k):flags.delete(k),contains:k=>flags.has(k)},addEventListener:(k,fn)=>{events[id+':'+k]=fn;}});}return elements.get(id);}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={CLOUD_MODE:true,currentRole:'parent',currentView:'contacts',admin:false,document:{getElementById:node},esc:escape,
 isClubOverviewMode:()=>ctx.admin,inboxContactRoleLabel:c=>c.role==='parent'?'Parent':c.role==='assistant_coach'?'Assistant Coach':c.role==='club_admin'?'Club Admin':'Coach',
 window:{addEventListener:(type,fn)=>events[type]=fn}};
const profile={user_id:'me',club_id:'club'};let team='a',calls=[],saved=[];
const self={user_id:'me',full_name:'Own Name',email:'own@example.invalid',phone:''};
const contact=(id,role='coach',tid='a')=>({user_id:id,role,kind:role==='parent'?'parent':'staff',team_id:tid,team_name:'A <script>',age_group:9,full_name:'Name <script>',email:'coach@example.invalid',phone:'+44 7700 900123'});
const cloud={context:{profile},role:()=>ctx.currentRole,currentTeam:()=>({id:team}),visibleTeamList:()=>[{id:'a',ageGroup:'U9',teamName:'A'},{id:'b',ageGroup:'U10',teamName:'B'}],
 listContactDirectory:async id=>{calls.push(id);return{self,can_manage:true,contacts:[contact('coach'),contact('parent','parent'),contact('other','coach','b')]};},
 saveMemberContactDetails:async input=>{saved.push(input);return{ok:true}}};
ctx.window.ClubHubCloud=cloud;vm.createContext(ctx);
let importerVisible=false,importerOptions=null;
ctx.window.ClubHubContactImport={reset:()=>{importerVisible=false;},show:value=>{importerVisible=value;},configure:value=>{importerOptions=value;}};
vm.runInContext(source.slice(source.indexOf("let __contactDirectoryIdentity="),source.indexOf('let __inboxStamp=')),ctx);
const open=()=>{ctx.syncContactDirectoryContext();node('member-contacts-panel').open=true;};
const list=()=>node('member-contacts-list').innerHTML;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 open();await ctx.refreshContactDirectory();
 assert.deepEqual(calls,['a']);assert(list().includes('data-person-profile="coach"'));assert(!list().includes('mailto:'));assert(!list().includes('coach@example.invalid'));assert(ctx.memberContactDetails(contact('coach')).includes('mailto:coach%40example.invalid'));assert(ctx.memberContactDetails(contact('coach')).includes('tel:+447700900123'));
 assert(!list().includes('<script>'));assert(list().includes('&lt;script&gt;'));
 assert(!list().includes('Parent</p>'));assert(!list().includes('data-contact-user'),'parent cannot edit anyone else');
 assert(node('member-contacts-self').innerHTML.includes('data-person-profile="me"'),'member can open own profile');
 assert(node('member-contacts-team-wrap').classList.contains('hidden'));
 assert.equal(importerVisible,false);assert.equal(importerOptions.isAdmin(),false,'parent has no import controls');
 ctx.currentRole='coach';open();await ctx.refreshContactDirectory();
 assert(list().includes('Parent'),'coach sees team parents');assert(!list().includes('data-contact-user'),'coach cannot edit parent contact');
 assert.equal(importerVisible,false);assert.equal(importerOptions.isAdmin(),false,'coach has no import controls');
 ctx.currentRole='admin';ctx.admin=true;open();await ctx.refreshContactDirectory();
 assert.equal(calls.at(-1),null,'club admin can read whole club');assert(list().includes('data-person-profile="parent"'));assert(!node('member-contacts-team-wrap').classList.contains('hidden'));
 assert.equal(importerVisible,true);assert.equal(importerOptions.isAdmin(),true);
 node('member-contacts-team').value='b';await ctx.refreshContactDirectory();assert.equal(calls.at(-1),'b');assert(!list().includes('data-person-profile="parent"'),'admin team filter enforced in UI too');
 const leave=deferred();const originalList=cloud.listContactDirectory;cloud.listContactDirectory=()=>leave.promise;const leaving=ctx.refreshContactDirectory();ctx.currentView='inbox';node('member-contacts-panel').open=false;ctx.resetContactDirectory();leave.resolve({self,can_manage:true,contacts:[contact('late-parent','parent')]});await leaving;assert.equal(list(),'','leaving Contacts discards late responses');ctx.currentView='contacts';cloud.listContactDirectory=originalList;open();
 const old=cloud.listContactDirectory,late=deferred();cloud.listContactDirectory=()=>late.promise;
 const pending=ctx.refreshContactDirectory();ctx.currentRole='parent';ctx.admin=false;ctx.syncContactDirectoryContext();
 assert.equal(list(),'','changing capacity clears sensitive contact DOM immediately');assert.equal(node('member-contacts-panel').open,false);assert(node('member-contacts-team-wrap').classList.contains('hidden'));
 assert.equal(importerVisible,false,'changing capacity also clears import');
 late.resolve({self,can_manage:true,contacts:[contact('private-parent','parent')]});await pending;assert.equal(list(),'','late admin response discarded');
 cloud.listContactDirectory=old;open();await ctx.refreshContactDirectory();
 cloud.listContactDirectory=async()=>{throw new Error('backend missing')};await ctx.refreshContactDirectory();assert.equal(list(),'');assert.equal(node('member-contacts-self').innerHTML,'');assert.match(node('member-contacts-status').textContent,/unavailable/);
 cloud.listContactDirectory=old;open();await ctx.refreshContactDirectory();
 const button={disabled:false,isConnected:true},status={textContent:''},form={isConnected:true,dataset:{contactUser:'me'},elements:{email:{value:' member@example.invalid '},phone:{value:' 020 7946 0123 '}},reportValidity:()=>true,querySelector:s=>s.startsWith('button')?button:status};
 await ctx.saveContactDetailsForm(form);assert.deepEqual(JSON.parse(JSON.stringify(saved)),[{userId:'me',email:'member@example.invalid',phone:'020 7946 0123'}]);assert.equal(button.disabled,false);assert.equal(node('member-contacts-status').textContent,'Contact details saved.');
 const saveLate=deferred();cloud.saveMemberContactDetails=()=>saveLate.promise;const saving=ctx.saveContactDetailsForm(form);team='b';ctx.syncContactDirectoryContext();saveLate.resolve({ok:true});await saving;assert.equal(list(),'');
 events['clubhub-contacts-clear']();assert.equal(node('member-contacts-self').innerHTML,'');assert(node('member-contacts-panel').classList.contains('hidden'));
 ctx.currentRole='player';ctx.syncContactDirectoryContext();assert.equal(ctx.contactDirectoryIdentity(),'');assert(node('member-contacts-panel').classList.contains('hidden'));
 const malicious=ctx.memberContactDetails({...contact('evil'),email:'javascript:alert(1)',phone:'1 Road, London'},false);assert(!malicious.includes('href='),'invalid contacts never become executable links');
 assert(!fs.readFileSync('app/src/main/assets/index.html','utf8').match(/id="member-contacts[^>]*address/i));
 console.log('PASS member contacts: role views, safe links, filtering, editing, outages, capacity/team/account races');
})().catch(e=>{console.error(e);process.exit(1)});
