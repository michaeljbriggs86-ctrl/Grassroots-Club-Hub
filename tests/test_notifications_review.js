const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const block=source.slice(source.indexOf('let __appNotifications=[]'),source.indexOf('async function reviewCoachAccessNotification()'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
function fixture(){
 const nodes=new Map(),calls=[];
 function el(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,disabled:false,attrs:{},classList:{toggle(){},contains(){return false;}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},querySelectorAll(){return [];},close(){this.open=false;},showModal(){this.open=true;}});return nodes.get(id);}
 const api={session:{user:{id:'user-a'}},context:{profile:{club_id:'club-a'}},currentTeam:()=>({id:'team-a'}),actingAsParent:()=>false,listNotifications:async()=>[],markNotificationRead:async id=>calls.push(['app',id]),markAnnouncementRead:async id=>calls.push(['notice',id])};
 const c={CLOUD_MODE:true,currentRole:'coach',window:{ClubHubCloud:api},document:{getElementById:el},__announcementRows:[],__announcementStamp:0,__announcementScopeKey:'',__announcementLoadVersion:0,Date,Promise,Set,
  esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),isClubOverviewMode:()=>false,renderAnnouncements(){c.renderNotificationCenter();},refreshAnnouncements:async()=>{},toast(){},navigate(){}};
 vm.createContext(c);vm.runInContext(block,c);
 const run=s=>vm.runInContext(s,c),seed=rows=>{c.renderNotificationCenter();run('__appNotifications='+JSON.stringify(rows)+';__notificationStamp=Date.now();');c.renderNotificationCenter();};
 return {c,el,api,calls,run,seed};
}
const rows=[{id:'a',title:'Fixture <update>',body:'Example update',type:'fixture_change',created_at:'2026-10-13T12:00:00Z',read_at:null},{id:'b',title:'Reminder',body:'Please respond',type:'availability_reminder',created_at:'2026-10-12T12:00:00Z',read_at:null}];
(async()=>{
 let f=fixture(),load=deferred();f.api.listNotifications=()=>load.promise;const pending=f.c.refreshNotifications(false);assert.match(f.el('notification-list').innerHTML,/Loading notifications/);load.reject(Error('offline'));await pending;assert.match(f.el('notification-list').innerHTML,/Could not load/);assert.doesNotMatch(f.el('notification-list').innerHTML,/No notifications yet/);
 f.api.listNotifications=async()=>[];await f.c.refreshNotifications(false);assert.match(f.el('notification-list').innerHTML,/No notifications yet/);
 f=fixture();f.seed(rows);assert.match(f.el('notification-list').innerHTML,/Fixture &lt;update>/);assert.equal(f.el('notification-badge').textContent,'2');
 assert.match(f.el('notification-list').innerHTML,/notification-type[^]*Fixture update/);assert.match(f.el('notification-list').innerHTML,/Availability reminder/);
 assert.match(f.el('notification-list').innerHTML,/<svg[^]*aria-hidden="true"/,'decorative type icons do not duplicate accessible labels');
 f.c.__announcementRows=[{id:'notice-read',title:'Training reminder',body:'Fictional notice',important:true,read_at:'2026-10-13T13:00:00Z',created_at:'2026-10-13T11:00:00Z'}];f.c.renderNotificationCenter();
 assert.match(f.el('notification-list').innerHTML,/notification-item read important[^]*Club notice[^]*Read · Important/);assert.equal(f.el('notification-badge').textContent,'2','read club notice does not increase unread count');
 assert.equal(f.c.notificationPresentation({type:'unrecognised_<img>'}).label,'Unrecognised <img>');
 f.seed([{...rows[0],type:'unrecognised_<img>',title:'Unknown update'}]);assert.match(f.el('notification-list').innerHTML,/Unrecognised &lt;img>/);assert.doesNotMatch(f.el('notification-list').innerHTML,/<img>/);f.c.__announcementRows=[];f.seed(rows);
 const read=deferred();f.api.markNotificationRead=id=>{f.calls.push(['app',id]);return read.promise};const first=f.c.markAppNotificationRead('a');await f.c.markAppNotificationRead('a');assert.equal(f.calls.length,1);assert.equal(f.run('__appNotifications[0].read_at'),null);read.resolve();await first;assert(f.run('__appNotifications[0].read_at'));assert.equal(f.el('notification-badge').textContent,'1');
 f=fixture();f.seed(rows);f.api.markNotificationRead=async id=>{f.calls.push(['app',id]);if(id==='b')throw Error('offline');};await f.c.markAllNotificationsRead();assert(f.run('__appNotifications[0].read_at'));assert.equal(f.run('__appNotifications[1].read_at'),null);assert.match(f.el('notification-status').textContent,/Some updates/);assert.equal(f.el('notification-badge').textContent,'1');f.api.markNotificationRead=async id=>f.calls.push(['retry',id]);await f.c.markAllNotificationsRead();assert.deepEqual(f.calls.at(-1),['retry','b']);assert.equal(f.el('notification-badge').textContent,'0');
 f=fixture();load=deferred();f.api.listNotifications=()=>load.promise;const stale=f.c.refreshNotifications(false);f.api.currentTeam=()=>({id:'team-b'});f.c.renderNotificationCenter();load.resolve(rows);await stale;assert.equal(f.run('__appNotifications.length'),0,'late old-team rows cannot return');
 f=fixture();f.seed(rows);const write=deferred();f.api.markNotificationRead=()=>write.promise;const oldWrite=f.c.markAppNotificationRead('a');f.api.session.user.id='user-b';f.c.renderNotificationCenter();write.resolve();await oldWrite;assert.equal(f.run('__appNotifications.length'),0,'late old-account writes cannot restore rows');
 f=fixture();f.seed(rows);f.c.currentRole='pending';f.c.renderNotificationCenter();assert.equal(f.el('notification-list').innerHTML,'');assert.equal(f.el('communications-notifications-list').innerHTML,'');assert.equal(f.el('notification-badge').textContent,'0');
 f=fixture();f.c.currentRole='parent';f.seed([{...rows[0],type:'parent_access_request'},{...rows[1],type:'coach_access_request'}]);assert.equal(f.run('notificationRows().length'),0,'staff request records do not appear in parent capacity');
 console.log('PASS notifications: loading/error/retry, escaped cards, confirmed reads, duplicate guard, partial bulk success, stale team/account, denied role and parent filtering');
})().catch(e=>{console.error(e);process.exitCode=1;});

