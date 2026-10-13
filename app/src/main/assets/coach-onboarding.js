/* Admin coach onboarding. Saved account, assignment and qualification facts; private drafts in memory only. */
(()=>{
  'use strict';
  const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const coachingRoles=['coach','assistant_coach'],roleLabel=r=>r==='assistant_coach'?'Assistant Coach':r==='club_admin'?'Club Admin · Coach':'Coach';
  let options,identity='',cloudIdentity=null,version=0,data=null,selected=null,step=0,busy=false,dirty=false;
  function active(){return !!options?.allowed()&&options.currentView()==='coach-onboarding';}
  function clear(){version++;data=null;selected=null;step=0;busy=false;dirty=false;el('coach-onboarding-content')?.replaceChildren();el('coach-onboarding-content')?.setAttribute('aria-busy','false');status('');}
  function syncAccess(){const key=options?.allowed()?options.contextKey():'',cloud=options?.cloud();if(identity!==key||cloudIdentity!==cloud){clear();identity=key;cloudIdentity=cloud;}return key;}
  function valid(v,key){return v===version&&key===identity&&key===options.contextKey()&&cloudIdentity===options.cloud()&&active();}
  function status(message,error=false){const node=el('coach-onboarding-status');if(node){node.textContent=message;node.classList.toggle('is-error',error);}}
  function confirmLeave(){if(busy){options?.toast('Wait for the coach onboarding action to finish.');return false;}if(dirty&&!window.confirm('Discard this unsaved coach onboarding selection? Saved approvals and team assignments are kept.'))return false;dirty=false;return true;}
  function leave(){clear();}
  function teamLabel(t){return [t?.ageGroup,t?.teamName].filter(Boolean).join(' ');}
  function snapshot(){return {v:version,key:identity,cloud:options.cloud()};}
  function current(s){return valid(s.v,s.key);}
  function validateRows(rows,kind){if(!Array.isArray(rows))throw Error('Coach onboarding returned an invalid list.');for(const r of rows){if(!r||typeof r.user_id!=='string'||!r.user_id||!['coach','assistant_coach','club_admin','parent','pending_parent','player'].includes(r.role||r.requested_role))throw Error('Coach onboarding returned an invalid account.');if(kind==='requests'&&(!r.request_id||!r.team_id))throw Error('Coach request is incomplete.');}return rows;}
  async function facts(cloud){
    const [requests,accounts,assignments]=await Promise.all([cloud.listPendingCoachRequests(),cloud.listClubAccessAccounts(),cloud.listClubCoaches()]);
    validateRows(requests,'requests');validateRows(accounts,'accounts');validateRows(assignments,'assignments');
    const teams=cloud.visibleTeamList();if(!Array.isArray(teams))throw Error('Club teams are unavailable.');
    const activeTeam=id=>teams.some(t=>t.id===id);
    const people=accounts.filter(p=>coachingRoles.includes(p.role)||(p.role==='club_admin'&&(p.coach_team_id||assignments.some(a=>a.user_id===p.user_id)))).map(p=>{
      const primary=p.role==='club_admin'?p.coach_team_id:p.team_id;
      return {...p,teamIds:[...new Set([primary,...assignments.filter(a=>a.user_id===p.user_id).map(a=>a.team_id)].filter(id=>id&&activeTeam(id)))]};
    });
    // Club Admin sign-up requests keep their separate owner-only review path.
    return {requests:requests.filter(r=>coachingRoles.includes(r.requested_role)&&activeTeam(r.team_id)),people,teams};
  }
  async function enter(){const key=syncAccess();if(!key||!active())return;clear();const s=snapshot();busy=true;status('Loading coach requests and assignments…');try{const result=await facts(s.cloud);if(!current(s))return;data=result;busy=false;status('');render();}catch(_){if(current(s)){busy=false;status('Coach onboarding is unavailable. Refresh to retry.',true);el('coach-onboarding-content').innerHTML='<button type="button" class="secondary-button" data-coach-onboard-action="reload">Retry</button>';}}}
  function qualificationSummary(records,available=true,api=window.ClubHubCoachQualifications){
    if(!available||!api)return {complete:false,checked:0,renewals:0,label:'Qualification records unavailable'};
    const items=api.catalogue.map(item=>{const record=records.find(r=>r.kind===item.kind),state=api.status(record);return {record,state};});
    const checked=items.filter(x=>x.record?.club_checked===true&&!['expired','missing'].includes(x.state.tone)).length;
    const renewals=items.filter(x=>x.state.tone==='due').length;
    return {complete:checked===3,checked,renewals,label:checked===3?(renewals?'Three club checks recorded · renewal due':'Three club checks recorded'):`${checked} of 3 current club checks`};
  }
  function queue(){return `<section class="panel onboarding-overview"><p class="kicker">Club staff</p><h3>Welcome coaching staff</h3><p class="muted">Review email sign-up requests, assign coaching teams, then check the three qualification records.</p><div class="onboarding-metrics"><div><strong>${data.requests.length}</strong><span>Requests to review</span></div><div><strong>${data.people.length}</strong><span>Coaching accounts</span></div><div><strong>${data.people.filter(p=>!p.teamIds.length).length}</strong><span>Awaiting a team</span></div></div></section><section class="panel"><h3>Requests to review</h3><div class="onboarding-queue">${data.requests.length?data.requests.map((r,i)=>`<article><div><strong>${esc(r.person_name||'New coach')}</strong><p>${esc(roleLabel(r.requested_role))} · ${esc(teamLabel(data.teams.find(t=>t.id===r.team_id)))}</p><p class="helper">Email sign-up</p></div><button type="button" class="secondary-button" data-coach-onboard-request="${i}">Review request</button></article>`).join(''):'<p class="muted">No Coach or Assistant Coach requests waiting. Coaches sign up with their own email and password, choose their team and request access.</p>'}</div><p class="helper">Club Admin requests remain in Staff access requests for owner review.</p></section><section class="panel"><h3>Continue setup</h3><p class="helper">Open a coaching account to check its saved teams and qualification status.</p><div class="onboarding-queue">${data.people.length?data.people.map((p,i)=>`<article><div><strong>${esc(p.full_name||'Coach')}</strong><p>${esc(roleLabel(p.role))} · Account approved</p><p>${p.teamIds.length?esc(p.teamIds.map(id=>teamLabel(data.teams.find(t=>t.id===id))).join(' · ')):'Team not assigned'}</p></div><button type="button" class="secondary-button" data-coach-onboard-person="${i}">Continue onboarding</button></article>`).join(''):'<p class="muted">Approved coaching accounts will appear here.</p>'}</div></section><button type="button" class="secondary-button" data-coach-onboard-action="reload">Refresh onboarding</button>`;}
  async function begin(person,request=null){if(!active()||busy)return;selected={userId:person?.user_id||request.user_id,person,request,verified:false,records:[],qualAvailable:false,qualPending:false,teamChoice:''};step=request?1:2;dirty=false;status('');render();if(person)await refreshQualifications();}
  async function refreshQualifications(){
    if(!active()||busy||!selected?.person)return;const s=snapshot(),target=selected;busy=true;render();
    try{const result=await s.cloud.getCoachQualifications(target.userId);if(!current(s)||selected!==target)return;
      const api=window.ClubHubCoachQualifications;if(!api||!Array.isArray(result?.records)||result.records.length>3||!Number.isSafeInteger(Number(result.revision))||Number(result.revision)<0||result.revision===null)throw Error('Invalid qualification response');
      const kinds=new Set();for(const r of result.records){api.validate(r);if(kinds.has(r.kind))throw Error('Duplicate qualification record');kinds.add(r.kind);}
      target.records=result.records;target.qualAvailable=true;target.qualPending=false;
    }catch(error){if(current(s)&&selected===target){target.records=[];target.qualAvailable=false;target.qualPending=['PGRST202','42883'].includes(String(error?.code||error?.data?.code));}}
    finally{if(current(s)&&selected===target){busy=false;render();}}
  }
  function panel(title,content){return `<section class="panel"><h3>${esc(title)}</h3>${content}</section>`;}
  function qualificationCards(){const api=window.ClubHubCoachQualifications;return (api?.catalogue||[{kind:'dbs',label:'Enhanced DBS'},{kind:'safeguarding',label:'Safeguarding Children'},{kind:'first_aid',label:'First aid in football'}]).map(item=>{const r=selected.records.find(x=>x.kind===item.kind),s=selected.qualAvailable?api.status(r):{tone:'missing',label:'Not confirmed'};return panel(item.label,`<p><span class="qualification-state ${s.tone}">${esc(s.label)}</span></p><p class="helper">${selected.qualAvailable?(r?`${r.club_checked?'Club checked':'Needs club check'} · ${item.kind==='dbs'?'FA renewal':'Expiry'}: ${esc(r.expires_on)}`:'Add this qualification to the coach profile.'):(selected.qualPending?'Qualification recording is awaiting activation.':'Qualification records are unavailable. Refresh to retry.')}</p>`);}).join('');}
  function render(){
    if(!active()||!data)return;const body=el('coach-onboarding-content');if(!step||!selected){body.innerHTML=queue();body.setAttribute('aria-busy','false');return;}
    const labels=['Account approval','Team assignment','Qualification review','Review setup'],p=selected.person,r=selected.request,q=qualificationSummary(selected.records,selected.qualAvailable),teamIds=p?.teamIds||[];
    const progress=`<ol class="onboarding-progress" aria-label="Coach onboarding progress">${labels.map((label,i)=>`<li${step===i+1?' aria-current="step"':''}><span>${i+1}</span>${['Account','Teams','Checks','Review'][i]}</li>`).join('')}</ol>`;
    let content='';
    if(step===1)content=panel(r.person_name||'New coach',`<dl class="onboarding-review"><dt>Email</dt><dd>${esc(r.person_email||'Not supplied')}</dd><dt>Requested role</dt><dd>${esc(roleLabel(r.requested_role))}</dd><dt>Requested team</dt><dd>${esc(teamLabel(data.teams.find(t=>t.id===r.team_id)))}</dd></dl>`)+panel('Confirm the appointment',`<label class="checkbox-line"><input id="coach-onboard-verified" type="checkbox" aria-describedby="coach-onboarding-status"${selected.verified?' checked':''}${busy?' disabled':''} />I have checked this person’s identity and coaching appointment.</label><p class="helper">Approval grants staff access for the requested role and team. Qualification checks remain separate.</p><div class="onboarding-actions"><button type="button" class="secondary-button" data-coach-onboard-action="decline"${busy?' disabled':''}>Decline request</button><button type="button" class="primary-button" data-coach-onboard-action="approve"${busy?' disabled':''}>${busy?'Working…':'Approve account & continue'}</button></div>`);
    if(step===2){const available=data.teams.filter(t=>!teamIds.includes(t.id));content=panel(p.full_name||'Coach',`<p>${esc(roleLabel(p.role))} · Account approved</p>`)+panel('Current assignments',teamIds.length?`<ul>${teamIds.map(id=>`<li>${esc(teamLabel(data.teams.find(t=>t.id===id)))}</li>`).join('')}</ul>`:'<p class="muted">No active coaching team assigned.</p>')+panel(teamIds.length?'Additional team':'Assign a team',`<label>Coaching team<select id="coach-onboard-team" aria-describedby="coach-onboarding-status"${busy?' disabled':''}><option value="">Choose a team</option>${available.map(t=>`<option value="${esc(t.id)}"${selected.teamChoice===t.id?' selected':''}>${esc(teamLabel(t))}</option>`).join('')}</select></label><p class="helper">Existing assignments stay in place. Adding a team grants coaching access to that team.</p><button type="button" class="secondary-button" data-coach-onboard-action="assign"${busy||!available.length?' disabled':''}>Add team</button>`);}
    if(step===3)content=qualificationCards()+panel('Coach profile',`<p class="helper">Record only Enhanced DBS, safeguarding and first aid. Club checks and dates remain on the coach profile.</p><div class="onboarding-actions"><button type="button" class="secondary-button" data-coach-onboard-action="qual-refresh"${busy?' disabled':''}>Refresh checks</button><button type="button" class="primary-button" data-coach-onboard-action="qual-edit"${busy||!selected.qualAvailable?' disabled':''}>Review qualification records</button></div>`);
    if(step===4)content=panel(p.full_name||'Coach',`<dl class="onboarding-review"><dt>Account</dt><dd>${esc(roleLabel(p.role))} · Approved</dd><dt>Teams</dt><dd>${teamIds.length?esc(teamIds.map(id=>teamLabel(data.teams.find(t=>t.id===id))).join(' · ')):'Awaiting assignment'}</dd><dt>Qualifications</dt><dd>${esc(q.label)}</dd></dl>`)+qualificationCards()+panel(teamIds.length&&q.complete?'Setup checks recorded':'Onboarding in progress',`<p>${teamIds.length&&q.complete?'Account, coaching team and three current club checks are recorded.':'Saved account approval and assignments are kept. Outstanding team or qualification checks remain visible when you return.'}</p><p class="helper">${q.renewals?'A renewal is due within 60 days. Review the coach document matrix. ':''}FA Club Portal remains the source for acceptance. This summary does not replace the club’s clearance process.</p>`);
    const actions=`<div class="onboarding-actions"><button type="button" class="secondary-button" data-coach-onboard-action="${step<=2?'list':'back'}"${busy?' disabled':''}>${step<=2?'Return to list':'Back'}</button>${step>1?`<button type="button" class="primary-button" data-coach-onboard-action="${step===4?'finish':'next'}"${busy?' disabled':''}>${step===4?'Return to onboarding':step===3?'Review setup':'Continue to qualifications'}</button>`:''}</div>`;
    body.innerHTML=progress+`<div class="coach-onboarding-form"><h3 id="coach-onboard-step-title" tabindex="-1">${labels[step-1]}</h3>${content}${actions}</div>`;body.setAttribute('aria-busy',String(busy));el('coach-onboard-step-title')?.focus({preventScroll:true});
  }
  function sameRequest(a,b){return a&&b&&a.request_id===b.request_id&&a.user_id===b.user_id&&a.team_id===b.team_id&&a.requested_role===b.requested_role;}
  async function action(kind){
    if(!active()||busy||!selected)return;const target=selected,s=snapshot(),teamId=el('coach-onboard-team')?.value||'';
    if(kind==='approve'){target.verified=!!el('coach-onboard-verified')?.checked;if(!target.verified){status('Confirm the identity and coaching appointment before approving access.',true);el('coach-onboard-verified')?.focus();return;}}
    if(kind==='assign'&&(!teamId||!data.teams.some(t=>t.id===teamId)||target.person?.teamIds.includes(teamId))){status('Choose an unassigned active team.',true);el('coach-onboard-team')?.focus();return;}
    if(kind==='assign')target.teamChoice=teamId;
    busy=true;status('Checking saved account status…');render();
    try{
      const latest=await facts(s.cloud);if(!current(s)||selected!==target)return;data=latest;
      if(kind==='approve'||kind==='decline'){
        const r=latest.requests.find(x=>x.request_id===target.request?.request_id);
        if(!sameRequest(r,target.request))throw Error('This request changed or has already been reviewed. Refresh before continuing.');
        if(kind==='decline'&&!await options.confirm({title:'Decline coaching request',body:`Decline the request from ${r.person_name||'this coach'}?`,detail:'No coaching access will be granted.',confirmLabel:'Decline request'})){if(current(s)){busy=false;status('');render();}return;}
        if(!current(s)||selected!==target)return;
        const result=await s.cloud.reviewCoachRequest(r.request_id,kind==='approve');if(!current(s)||selected!==target)return;if(!result?.ok)throw Error('The cloud did not confirm the request review.');
        dirty=false;options.onSaved?.();
        if(kind==='decline'){const refreshed=await facts(s.cloud);if(!current(s))return;data=refreshed;selected=null;step=0;busy=false;status('Request declined.');render();return;}
      }else{
        const person=latest.people.find(p=>p.user_id===target.userId);if(!person)throw Error('This coaching account is no longer available. Refresh onboarding.');
        if(!latest.teams.some(t=>t.id===teamId))throw Error('This team is no longer active. Refresh onboarding.');
        if(!person.teamIds.includes(teamId)){
          if(!await options.confirm({title:'Add coaching team',body:`Assign ${person.full_name||'this coach'} to ${teamLabel(latest.teams.find(t=>t.id===teamId))}?`,detail:'This grants coaching access to the additional team. Existing teams stay assigned.',confirmLabel:'Add team'})){if(current(s)){busy=false;status('');render();}return;}
          if(!current(s)||selected!==target)return;const result=await s.cloud.assignCoachTeam(target.userId,teamId);if(!current(s)||selected!==target)return;if(!result?.ok)throw Error('The cloud did not confirm this assignment.');
        }
        dirty=false;target.teamChoice='';options.onSaved?.();
      }
      const refreshed=await facts(s.cloud);if(!current(s)||selected!==target)return;data=refreshed;const person=data.people.find(p=>p.user_id===target.userId);if(!person)throw Error('The saved account could not be refreshed. Reload onboarding.');target.person=person;target.request=null;target.verified=false;step=2;busy=false;status(kind==='approve'?'Account approved. Review its saved team assignments.':'Team assignment confirmed.');render();await refreshQualifications();
    }catch(error){if(current(s)&&selected===target){busy=false;status((error.message||'Could not complete this action.')+' Refresh onboarding to confirm saved progress before retrying.',true);render();}}
  }
  async function refreshSelected(){if(!active()||busy||!selected)return;const target=selected,s=snapshot();busy=true;render();try{const latest=await facts(s.cloud);if(!current(s)||selected!==target)return;data=latest;const p=latest.people.find(x=>x.user_id===target.userId);if(p){target.person=p;target.request=null;target.verified=false;if(step===1)step=2;}else{const r=latest.requests.find(x=>sameRequest(x,target.request));if(!r){selected=null;step=0;status('This account or request is no longer available.',true);}}dirty=false;if(selected)selected.teamChoice='';busy=false;render();if(selected?.person)await refreshQualifications();}catch(_){if(current(s)){busy=false;status('Saved progress is unavailable. Refresh to retry.',true);render();}}}
  document.addEventListener('change',event=>{if(!active()||busy)return;if(event.target.id==='coach-onboard-team'){selected.teamChoice=event.target.value;dirty=!!event.target.value;}if(event.target.id==='coach-onboard-verified'){selected.verified=event.target.checked;dirty=true;}});
  document.addEventListener('click',async event=>{
    if(!active()||busy)return;const a=event.target.closest?.('[data-coach-onboard-action]')?.dataset.coachOnboardAction;
    if(a==='reload'||a==='list'||a==='finish'){if(!confirmLeave())return;if(a==='reload'&&selected){await refreshSelected();return;}await enter();return;}
    if(a==='approve'||a==='decline'||a==='assign'){await action(a);return;}
    if(a==='qual-refresh'){await refreshSelected();return;}
    if(a==='qual-edit'){if(selected?.person&&selected.qualAvailable)await window.ClubHubCoachQualifications?.open(selected.userId,selected.person.full_name||'Coach');return;}
    if(a==='next'){if(step===2&&!selected.person.teamIds.length){status('Assign an active coaching team before continuing.',true);return;}if(dirty){status('Add the selected team or clear the selection before continuing.',true);return;}step++;status('');render();if(step===4)await refreshSelected();return;}
    if(a==='back'){if(!confirmLeave())return;step--;status('');render();return;}
    const r=event.target.closest?.('[data-coach-onboard-request]');if(r){const request=data.requests[Number(r.dataset.coachOnboardRequest)];if(request)await begin(null,request);return;}
    const p=event.target.closest?.('[data-coach-onboard-person]');if(p){const person=data.people[Number(p.dataset.coachOnboardPerson)];if(person)await begin(person);}
  });
  el('coach-qualification-dialog')?.addEventListener('close',()=>{if(active()&&selected?.person)refreshSelected();});
  window.addEventListener('beforeunload',event=>{if(active()&&(busy||dirty)){event.preventDefault();event.returnValue='';}});
  window.ClubHubCoachOnboarding={configure:value=>{options=value;syncAccess();},enter,leave,syncAccess,confirmLeave,qualificationSummary};
})();
