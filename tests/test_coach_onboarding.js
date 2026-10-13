const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/coach-onboarding.js','utf8');
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
function harness(){
 const events={},nodes=new Map();
 class Node{
  constructor(id){this.id=id;this.value='';this.checked=false;this.disabled=false;this.textContent='';this.html='';this.dataset={};this.classList={toggle(){}};}
  get innerHTML(){return this.html;}set innerHTML(value){this.html=value;for(const tag of value.match(/<(?:input|select|h3)\b[^>]*\bid="[^"]+"[^>]*>/g)||[]){const n=node(tag.match(/\bid="([^"]+)"/)[1]);n.value=tag.match(/\bvalue="([^"]*)"/)?.[1]||'';n.checked=/\bchecked\b/.test(tag);}}
  replaceChildren(){this.html='';}focus(){this.focused=true;}setAttribute(){}addEventListener(event,fn){(events[this.id+':'+event]??=[]).push(fn);}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const state={allowed:true,key:'admin|club',view:'coach-onboarding',confirm:true,calls:[],qualError:{data:{code:'PGRST202'}},records:[],revision:0,
 requests:[{request_id:'r1',user_id:'new',person_name:'Morgan <Example>',person_email:'morgan@example.invalid',requested_role:'coach',team_id:'t1'}],
 accounts:[{user_id:'c1',full_name:'Taylor Example',role:'assistant_coach',team_id:'t1'},{user_id:'owner',full_name:'Owner',role:'club_admin'}],
 assignments:[{user_id:'c1',role:'assistant_coach',team_id:'t1'}]};
 const catalogue=[{kind:'dbs',label:'Enhanced DBS'},{kind:'safeguarding',label:'Safeguarding Children'},{kind:'first_aid',label:'First aid in football'}];
 const qualificationApi={catalogue,validate:r=>{if(!catalogue.some(x=>x.kind===r.kind)||!r.expires_on)throw Error('Invalid record');return r;},status:r=>!r?{tone:'missing',label:'Not recorded'}:r.expires_on<'2026-10-13'?{tone:'expired',label:'Expired'}:r.club_checked?{tone:'current',label:'In date'}:{tone:'missing',label:'Needs club check'},open:async(id,name)=>state.calls.push({kind:'qual-open',id,name})};
 const api={visibleTeamList:()=>[{id:'t1',ageGroup:'U9',teamName:'Example Greens'},{id:'t2',ageGroup:'U10',teamName:'Example Blues'}],listPendingCoachRequests:async()=>state.requests,listClubAccessAccounts:async()=>state.accounts,listClubCoaches:async()=>state.assignments,
 getCoachQualifications:async id=>{if(state.qualDeferred)return await state.qualDeferred;if(state.qualError)throw state.qualError;return {records:state.records,revision:state.revision};},
 reviewCoachRequest:async(id,approve)=>{state.calls.push({kind:'review',id,approve});if(state.reviewDeferred)return await state.reviewDeferred;state.requests=[];if(approve){state.accounts.push({user_id:'new',full_name:'Morgan Example',role:'coach',team_id:'t1'});state.assignments.push({user_id:'new',role:'coach',team_id:'t1'});}return {ok:true};},
 assignCoachTeam:async(id,team)=>{state.calls.push({kind:'assign',id,team});if(state.assignError)throw state.assignError;state.assignments.push({user_id:id,role:'assistant_coach',team_id:team});return {ok:true};}};
 const w={ClubHubCoachQualifications:qualificationApi,confirm:()=>state.confirm,addEventListener:(event,fn)=>(events['window:'+event]??=[]).push(fn)};
 vm.runInContext(source,vm.createContext({window:w,document:{getElementById:node,addEventListener:(event,fn)=>(events[event]??=[]).push(fn)}}));
 const flow=w.ClubHubCoachOnboarding;flow.configure({cloud:()=>api,allowed:()=>state.allowed,currentView:()=>state.view,contextKey:()=>state.key,confirm:async()=>state.confirm,toast(){},onSaved(){}});
 const click=(kind,index)=>events.click[0]({target:{closest:selector=>selector==='[data-coach-onboard-action]'&&index===undefined?{dataset:{coachOnboardAction:kind}}:selector==='[data-coach-onboard-'+kind+']'&&index!==undefined?{dataset:{[kind==='request'?'coachOnboardRequest':'coachOnboardPerson']:String(index)}}:null}});
 const change=id=>events.change[0]({target:node(id)});
 return {state,api,w,node,flow,click,change,body:()=>node('coach-onboarding-content').innerHTML,message:()=>node('coach-onboarding-status').textContent};
}
(async()=>{
 let h=harness();await h.flow.enter();assert.match(h.body(),/Coach onboarding|Welcome coaching staff/);assert.match(h.body(),/Morgan &lt;Example&gt;/);assert(!h.body().includes('Owner</strong>'),'pure admin excluded');
 await h.click('request',0);await h.click('approve');assert.match(h.message(),/identity/);assert.equal(h.state.calls.length,0);
 h.node('coach-onboard-verified').checked=true;h.change('coach-onboard-verified');h.state.confirm=false;assert.equal(h.flow.confirmLeave(),false);
 let resolve;h.state.reviewDeferred=new Promise(r=>resolve=r);const save=h.click('approve');await flush();await h.click('approve');assert.equal(h.state.calls.filter(c=>c.kind==='review').length,1);assert.equal(h.flow.confirmLeave(),false,'busy navigation blocked');
 h.state.accounts.push({user_id:'new',full_name:'Morgan Example',role:'coach',team_id:'t1'});h.state.requests=[];h.state.assignments.push({user_id:'new',role:'coach',team_id:'t1'});resolve({ok:true});await save;
 assert.match(h.body(),/Account approved/);assert.match(h.body(),/Example Greens/);assert.equal(h.flow.confirmLeave(),true,'saved changes do not require discard');
 await h.click('next');assert.match(h.body(),/Qualification recording is awaiting activation/);assert.match(h.body(),/Review qualification records<|Review qualification records/);assert(/data-coach-onboard-action="qual-edit" disabled/.test(h.body()));await h.click('qual-edit');assert(!h.state.calls.some(c=>c.kind==='qual-open'));
 await h.click('next');assert.match(h.body(),/Onboarding in progress/);assert(!h.body().includes('Setup checks recorded'));
 await h.click('finish');assert.match(h.body(),/Continue setup/);
 h=harness();await h.flow.enter();await h.click('person',0);h.node('coach-onboard-team').value='t2';h.change('coach-onboard-team');await h.click('next');assert.match(h.message(),/Add the selected team/);h.state.confirm=false;await h.click('assign');assert.equal(h.state.calls.length,0,'cancelled team confirmation writes nothing');
 h.node('coach-onboard-team').value='t2';h.change('coach-onboard-team');h.state.confirm=true;await h.click('assign');assert.equal(h.state.calls.filter(c=>c.kind==='assign').length,1);assert.match(h.body(),/Example Blues/);
 h.node('coach-onboard-team').value='t2';await h.click('assign');assert.equal(h.state.calls.filter(c=>c.kind==='assign').length,1,'existing assignment cannot be submitted twice');
 h=harness();await h.flow.enter();await h.click('request',0);h.state.requests[0]={...h.state.requests[0],requested_role:'assistant_coach'};h.node('coach-onboard-verified').checked=true;await h.click('approve');assert.equal(h.state.calls.length,0,'changed request cannot be approved');assert.match(h.message(),/changed/);
 h=harness();await h.flow.enter();await h.click('request',0);h.state.confirm=false;await h.click('decline');assert.equal(h.state.calls.length,0);h.state.confirm=true;await h.click('decline');assert.deepEqual(h.state.calls[0],{kind:'review',id:'r1',approve:false});assert.match(h.message(),/declined/);
 h=harness();h.state.requests.push({request_id:'owner-request',user_id:'pending-owner',person_name:'Admin Example',requested_role:'club_admin',team_id:'t1'});await h.flow.enter();assert(!h.body().includes('Admin Example'),'owner requests never enter coach flow');
 h=harness();h.state.accounts[0].team_id=null;h.state.assignments=[];await h.flow.enter();await h.click('person',0);await h.click('next');assert.match(h.message(),/Assign an active coaching team/);
 h=harness();h.state.qualError=null;h.state.records=['dbs','safeguarding','first_aid'].map(kind=>({kind,course:'example',completed_on:'2025-01-01',expires_on:'2028-01-01',club_checked:true}));await h.flow.enter();await h.click('person',0);await h.click('next');await h.click('qual-edit');assert.equal(h.state.calls[0].id,'c1');await h.click('next');assert.match(h.body(),/Setup checks recorded/);
 h.state.records[1].club_checked=false;await h.click('qual-refresh');assert.match(h.body(),/Onboarding in progress/);h.state.records[1].club_checked=true;h.state.records[2].expires_on='2026-01-01';await h.click('qual-refresh');assert.match(h.body(),/Onboarding in progress/);
 h.state.records=[{kind:'uefa',expires_on:'2028-01-01'}];await h.click('qual-refresh');assert.match(h.body(),/Qualification records are unavailable/);assert(!h.body().includes('Setup checks recorded'));
 h=harness();await h.flow.enter();h.state.qualDeferred=new Promise(r=>resolve=r);const loading=h.click('person',0);await flush();h.state.allowed=false;h.state.key='parent|club';h.flow.syncAccess();resolve({records:[],revision:0});await loading;assert.equal(h.body(),'','late qualification response cannot expose another context');
 h=harness();let resolveFacts;h.api.listPendingCoachRequests=()=>new Promise(r=>resolveFacts=r);const pending=h.flow.enter();await flush();h.state.allowed=false;h.state.key='admin|other';h.flow.syncAccess();resolveFacts(h.state.requests);await pending;assert.equal(h.body(),'','late queue replies stay cleared');
 h=harness();await h.flow.enter();await h.click('request',0);h.node('coach-onboard-verified').checked=true;h.state.reviewDeferred=new Promise(r=>resolve=r);const submitted=h.click('approve');await flush();h.state.allowed=false;h.state.key='parent|club';h.flow.syncAccess();resolve({ok:true});await submitted;assert.equal(h.body(),'','late write response stays cleared');
 h=harness();await h.flow.enter();await h.click('person',0);h.state.assignError=Error('Connection interrupted');h.node('coach-onboard-team').value='t2';await h.click('assign');assert.match(h.message(),/confirm saved progress/);assert(!h.body().includes('Example Blues</li>'));
 const html=fs.readFileSync('app/src/main/assets/index.html','utf8'),app=fs.readFileSync('app/src/main/assets/app.js','utf8'),build=fs.readFileSync('cloudflare/web-app/build.py','utf8');
 assert.match(html,/data-page-route="coach-onboarding"/);assert.match(app,/'coach-onboarding':.*access:'admin'/);assert.match(app,/ClubHubCoachOnboarding\?\.confirmLeave/);assert(build.includes('"coach-onboarding.js"'));assert(!/localStorage|sessionStorage|location|fetch\(/.test(source),'private data uses only current-session memory and existing cloud API');
 console.log('PASS coach onboarding: approval/decline, fixed requested roles, owner separation, assignments, pending qualification storage, current/unchecked/expired records, retries, double submission, dirty navigation and stale identity replies');
})().catch(error=>{console.error(error);process.exitCode=1;});
