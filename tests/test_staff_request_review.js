// Exercise reviewed staff decisions using invented accounts and deferred APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf('/** Staff requests stay private'),end=source.indexOf('let __complianceStatus=',start);
assert(start>=0&&end>start);
function fixture(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,attributes:{},classList:{add(){},toggle(){}},replaceChildren(){this.innerHTML='';},setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;}});return nodes.get(id);};
 const request={request_id:'request-1',user_id:'adult-1',team_id:'team-1',requested_role:'coach',person_name:'Example <Coach>',person_email:'coach@example.invalid',team_name:'Example Greens'};
 let rows=[request],key='admin-a|club-a',allow=true,confirmation=true,list=()=>Promise.resolve(rows),calls=[],routes=[];
 const cloud={actingAsParent:()=>false,listPendingCoachRequests:()=>list(),reviewCoachRequest:async(id,approve)=>{calls.push([id,approve]);rows=[];}};
 const c={CLOUD_MODE:true,currentView:'staff-requests',__adminAccessRows:[],__adminCoachRows:[],__clubCoachStamp:0,
  window:{ClubHubCloud:cloud},document:{getElementById:node,addEventListener(){}},isClubOverviewMode:()=>allow,personProfileContextKey:()=>key,
  accessRoleLabel:r=>r==='club_admin'?'Club Admin':r==='assistant_coach'?'Assistant Coach':'Coach',esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  appConfirm:()=>Promise.resolve(confirmation),toast(){},auditEvent(){},refreshClubCoaches:async()=>{},
  navigate(v){routes.push(v);c.currentView=v;if(v==='staff-request-review')c.renderStaffRequestReview();else c.clearStaffRequestReview();}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 return {c,node,request,calls,routes,setRows:x=>rows=x,setKey:x=>key=x,setAllowed:x=>allow=x,setConfirm:x=>confirmation=x,setList:x=>list=x};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
(async()=>{
 let f=fixture();await f.c.refreshCoachRequests();assert.match(f.node('coach-requests-list').innerHTML,/data-coach-request-open/);assert.doesNotMatch(f.node('coach-requests-list').innerHTML,/data-coach-request-approve/);
 f.c.openStaffRequestReview('request-1');assert.equal(f.c.currentView,'staff-request-review');assert.match(f.node('staff-request-review-panel').innerHTML,/Example &lt;Coach&gt;/);assert.match(f.node('staff-request-review-panel').innerHTML,/Requested role: Coach/);
 f.setConfirm(false);await f.c.reviewCoachRequestClick('request-1',true);assert.equal(f.calls.length,0,'cancel cannot approve');
 f.setConfirm(true);await f.c.reviewCoachRequestClick('request-1',true);assert.deepEqual(f.calls,[['request-1',true]]);assert.equal(f.c.currentView,'staff-requests');
 for(const field of ['user_id','team_id','requested_role','person_email']){
  f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');f.setRows([{...f.request,[field]:'changed'}]);await f.c.reviewCoachRequestClick('request-1',true);assert.equal(f.calls.length,0,'changed '+field+' cannot approve');assert.match(f.node('staff-request-review-status').textContent,/changed/);
 }
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');f.setRows([]);await f.c.reviewCoachRequestClick('request-1',true);assert.equal(f.calls.length,0,'withdrawn or owner-filtered request cannot approve');
 assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','removed review must settle busy');assert.equal(f.node('staff-request-review-panel').innerHTML,'');assert.match(f.node('staff-request-review-status').textContent,/changed or is no longer available/);
 f=fixture();f.node('staff-request-review-panel').setAttribute('aria-busy','true');f.c.renderStaffRequestReview();assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','no-selection render must settle busy');
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');f.setConfirm(false);await f.c.reviewCoachRequestClick('request-1',true);assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','cancel settles busy with actions available');assert.doesNotMatch(f.node('staff-request-review-panel').innerHTML,/ disabled/);
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');f.setList(()=>Promise.reject(Error('offline')));await f.c.reviewCoachRequestClick('request-1',true);assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','failed precheck settles busy');assert.equal(f.calls.length,0);assert.match(f.node('staff-request-review-status').textContent,/could not be confirmed/);
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');const leaving=deferred();f.setList(()=>leaving.promise);const departing=f.c.reviewCoachRequestClick('request-1',true);await Promise.resolve();assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'true');f.c.navigate('staff-requests');assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','leaving clears obsolete busy');assert.equal(f.node('staff-request-review-panel').innerHTML,'');leaving.resolve([f.request]);await departing;assert.equal(f.calls.length,0,'leaving blocks late decision');
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');const read=deferred();f.setList(()=>read.promise);const first=f.c.reviewCoachRequestClick('request-1',true);await Promise.resolve();await f.c.reviewCoachRequestClick('request-1',true);read.resolve([f.request]);await first;assert.equal(f.calls.length,1,'duplicate clicks submit only once');
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');const late=deferred();f.setList(()=>late.promise);const action=f.c.reviewCoachRequestClick('request-1',true);await Promise.resolve();f.setKey('admin-b|club-b');f.c.syncStaffRequestContext();assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false','context clear settles busy before late response');late.resolve([f.request]);await action;assert.equal(f.calls.length,0,'account/club switch blocks in-flight review');assert.equal(f.node('staff-request-review-panel').innerHTML,'');assert.equal(f.node('staff-request-review-panel').getAttribute('aria-busy'),'false');
 f=fixture();const pending=deferred();f.setList(()=>pending.promise);const load=f.c.refreshCoachRequests();f.setAllowed(false);f.c.syncStaffRequestContext();pending.resolve([f.request]);await load;assert.equal(f.node('coach-requests-list').innerHTML,'','role loss clears and rejects late private data');
 f=fixture();f.setList(()=>Promise.reject(Error('offline')));await f.c.refreshCoachRequests();assert.match(f.node('staff-requests-empty').textContent,/unavailable/);f.setList(()=>Promise.resolve([]));await f.c.refreshCoachRequests();assert.match(f.node('staff-requests-empty').textContent,/No staff requests/);
 f=fixture();await f.c.refreshCoachRequests();f.c.openStaffRequestReview('request-1');await f.c.reviewCoachRequestClick('request-1',false);assert.deepEqual(f.calls,[['request-1',false]],'decline uses existing scoped API');
 console.log('PASS staff review: request detail, escaped content, cancel, approval/decline, changed/removed request, owner filtering, duplicate clicks, stale account and role, empty and retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
