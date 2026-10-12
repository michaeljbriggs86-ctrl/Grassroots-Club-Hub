/* Admin player onboarding. Drafts and private team data stay in memory. */
(()=>{
  'use strict';
  let options,identity='',cloudIdentity=null,version=0,teamId='',data=null,step=0,draft=null,busy=false,dirty=false;
  const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  const teamLabel=t=>[t.ageGroup,t.teamName].filter(Boolean).join(' ');
  function active(){return options?.allowed()&&options?.currentView()==='player-onboarding';}
  function clearPrivate(){const select=el('player-onboarding-team');if(select)select.disabled=false;version++;data=null;draft=null;dirty=false;busy=false;step=0;const body=el('player-onboarding-content');if(body)body.replaceChildren();const status=el('player-onboarding-status');if(status)status.textContent='';}
  function syncAccess(){const key=options?.allowed()?options.contextKey():'';const cloud=options?.cloud();if(key!==identity||cloud!==cloudIdentity){clearPrivate();teamId='';identity=key;cloudIdentity=cloud;}return key;}
  function valid(v,key){return v===version&&key===identity&&key===options?.contextKey()&&cloudIdentity===options?.cloud()&&active();}
  function leave(){clearPrivate();}
  function confirmLeave(){if(busy){options?.toast('Wait for the onboarding save to finish.');return false;}if(!dirty)return true;if(!window.confirm('Discard this unsaved player onboarding?'))return false;dirty=false;return true;}
  function status(message,error=false){const node=el('player-onboarding-status');if(node){node.textContent=message;node.classList.toggle('is-error',error);}}
  function linksFor(player){return (data?.links||[]).filter(l=>norm(l.player_name)===norm(player.name));}
  function validatePlayer(player,squad=[],limit=null){
    const name=String(player?.name||'').trim(),number=Number(player?.number);
    if(/[\u0000-\u001f\u007f]/.test(name))return 'Player names cannot contain control characters.';
    if(name.length<2||name.length>80)return 'Enter the player’s name, between 2 and 80 characters.';
    if(!Number.isInteger(number)||number<1||number>99)return 'Choose a whole shirt number from 1 to 99.';
    if(!['outfield','goalkeeper'].includes(player?.role))return 'Choose an outfield player or goalkeeper.';
    if(squad.some(p=>norm(p.name)===norm(name)))return 'This player is already in the squad. Continue their onboarding below.';
    if(squad.some(p=>Number(p.number)===number))return `Shirt #${number} is already assigned. Choose another number.`;
    if(Number(limit)>0&&squad.filter(p=>p?.name).length>=Number(limit))return 'This squad has reached its registration limit.';
    return '';
  }
  async function enter(){
    const key=syncAccess();if(!key||!active())return;
    const select=el('player-onboarding-team');const teams=options.cloud().visibleTeamList();
    select.innerHTML='<option value="">Choose a team</option>'+teams.map(t=>`<option value="${esc(t.id)}">${esc(teamLabel(t))}</option>`).join('');
    if(!teams.some(t=>t.id===teamId))teamId='';select.value=teamId;
    if(!teamId){el('player-onboarding-content').innerHTML='<div class="empty-state"><strong>Start with a team</strong><p>Choose the squad you want to add a player to.</p></div>';status('');return;}
    await load();
  }
  async function load(){
    const key=syncAccess();if(!key||!active()||!teamId)return;
    clearPrivate();const v=version;status('Loading squad and parent requests…');el('player-onboarding-team').disabled=true;
    try{const result=await options.cloud().loadAdminPlayerOnboarding(teamId);if(!valid(v,key))return;data=result;status('');render();}
    catch(error){if(valid(v,key)){status(error.message||'Player onboarding could not load.',true);el('player-onboarding-content').innerHTML='<div class="empty-state"><button type="button" class="secondary-button" data-onboard-action="reload">Retry</button></div>';}}
    finally{if(valid(v,key))el('player-onboarding-team').disabled=false;}
  }
  function queue(){
    const squad=data.players.filter(p=>p?.name&&p.status!=='inactive'),linked=squad.filter(p=>linksFor(p).length),waiting=squad.filter(p=>!linksFor(p).length);
    return `<section class="panel onboarding-overview"><p class="kicker">${esc(teamLabel(data.team))}</p><h3>Welcome the next player</h3><p class="muted">Add the player to the real squad, then connect a verified parent account.</p><div class="onboarding-metrics"><div><strong>${squad.length}</strong><span>Players</span></div><div><strong>${linked.length}</strong><span>Parent access linked</span></div><div><strong>${data.requests.length}</strong><span>Requests to review</span></div></div><button type="button" class="primary-button" data-onboard-action="new">Onboard a new player</button>${Number(data.limit)>0?`<p class="helper">${Math.max(0,data.limit-data.players.filter(p=>p?.name).length)} of ${data.limit} registration places available.</p>`:''}</section><section class="panel"><h3>Parent requests</h3><p class="helper">Review the relationship before approving access.</p>${data.requests.length?`<div class="onboarding-queue">${data.requests.map((r,i)=>`<article><div><strong>${esc(r.parent_name||'Parent')}</strong><p>Requested child: ${esc(r.child_name)}</p></div><button type="button" class="secondary-button" data-onboard-request="${i}">Review</button></article>`).join('')}</div>`:'<p class="muted">No parent requests waiting. Parents sign up using their email and type their child’s name.</p>'}</section><details class="panel settings-accordion"><summary><span>Players awaiting a parent link (${waiting.length})</span><span class="settings-chevron">⌄</span></summary><div class="settings-accordion-body onboarding-queue">${waiting.length?waiting.map(p=>`<article><div><strong>${esc(p.name)}</strong><p>#${esc(p.number)} · ${p.role==='goalkeeper'?'Goalkeeper':'Outfield'}</p></div><button type="button" class="secondary-button" data-onboard-player="${data.players.indexOf(p)}">Continue</button></article>`).join(''):'<p class="muted">Every active player has a linked parent account.</p>'}</div></details>`;
  }
  function begin(player=null,request=null){
    draft={name:player?.name||request?.child_name||'',number:player?.number||'',role:player?.role==='goalkeeper'?'goalkeeper':'outfield',existing:!!player,requestId:request?.request_id||'',verified:false};dirty=true;step=1;status('');render();
  }
  function readFields(){
    if(!draft)return;
    if(step===1&&!draft.existing){draft.name=el('onboard-player-name').value.trim();draft.number=el('onboard-player-number').value;draft.role=el('onboard-player-role').value;}
    if(step===2){draft.requestId=el('onboard-parent-request').value;draft.verified=!!el('onboard-parent-verified')?.checked;}
  }
  function request(){return data.requests.find(r=>r.request_id===draft?.requestId);}
  function review(){const r=request();return `<dl class="onboarding-review"><dt>Team</dt><dd>${esc(teamLabel(data.team))}</dd><dt>Player</dt><dd>${esc(draft.name)}</dd><dt>Shirt</dt><dd>#${esc(draft.number)}</dd><dt>Position</dt><dd>${draft.role==='goalkeeper'?'Goalkeeper':'Outfield'}</dd><dt>Squad</dt><dd>${draft.existing?'Already registered':'Add as an active player'}</dd><dt>Parent access</dt><dd>${r?`${esc(r.parent_name)}<small>${esc(r.parent_email||'')}</small>`:'Awaiting parent sign-up or staff review'}</dd></dl><p class="helper">${r?'Confirming will approve this request and link the parent to this player.':'This adds the player without granting parent access. You can review a parent request later.'}</p>`;}
  function render(){
    if(!active()||!data)return;const body=el('player-onboarding-content');
    if(!step){body.innerHTML=queue();return;}
    const labels=['Player details','Parent access','Review','Complete'];
    const progress=`<ol class="onboarding-progress" aria-label="Player onboarding progress">${labels.map((name,i)=>`<li${i+1===step?' aria-current="step"':''}><span>${i+1}</span>${name}</li>`).join('')}</ol>`;
    let content='';
    if(step===1)content=draft.existing?`<p class="helper">Continue onboarding for an existing squad player.</p><dl class="onboarding-review"><dt>Player</dt><dd>${esc(draft.name)}</dd><dt>Shirt</dt><dd>#${esc(draft.number)}</dd></dl>`:`<div class="onboarding-fields"><label>Player’s name<input id="onboard-player-name" name="player_name" aria-describedby="player-onboarding-status" value="${esc(draft.name)}" maxlength="80" autocomplete="off" required /></label><label>Shirt number<input id="onboard-player-number" name="shirt_number" autocomplete="off" aria-describedby="player-onboarding-status" type="number" min="1" max="99" step="1" inputmode="numeric" value="${esc(draft.number)}" required /></label><label>Position<select id="onboard-player-role" name="position" autocomplete="off"><option value="outfield"${draft.role==='outfield'?' selected':''}>Outfield</option><option value="goalkeeper"${draft.role==='goalkeeper'?' selected':''}>Goalkeeper</option></select></label></div><p class="helper">Use the name recognised by the club. Shirt numbers must be unique within this squad.</p>`;
    if(step===2)content=`<label>Parent request<select id="onboard-parent-request" name="parent_request" autocomplete="off" aria-describedby="player-onboarding-status"><option value="">Complete parent access later</option>${data.requests.map(r=>`<option value="${esc(r.request_id)}"${r.request_id===draft.requestId?' selected':''}>${esc(r.parent_name)} · ${esc(r.child_name)}</option>`).join('')}</select></label><p class="helper">Parents create their own email account. Choose a request only after checking this is the player’s parent or guardian.</p><div id="onboard-parent-confirmation">${parentConfirmation()}</div>`;
    if(step===3)content=review();
    if(step===4)content=`<div class="onboarding-complete"><p class="kicker">${draft.existing?'Parent access updated':'Player added'}</p><h3>${esc(draft.name)} is in ${esc(teamLabel(data.team))}</h3><ul><li>Squad record confirmed</li><li>${draft.parentLinked?'Parent account linked':'Parent access awaiting sign-up or review'}</li></ul><p class="muted">${draft.parentLinked?'The parent can view the child’s permitted team information.':'The player is in the squad. A coach or Admin can link a parent when their request arrives.'}</p></div><button type="button" class="primary-button" data-onboard-action="reload">Return to onboarding</button>`;
    const actions=step<4?`<div class="onboarding-actions"><button type="button" class="secondary-button" data-onboard-action="${step===1?'cancel':'back'}"${busy?' disabled':''}>${step===1?'Cancel':'Back'}</button><button type="button" class="primary-button" data-onboard-action="${step===3?'save':'next'}"${busy?' disabled':''}>${busy?'Saving…':step===3?(draft.existing?'Approve parent link':request()?'Add player & approve parent':'Add player to squad'):'Continue'}</button></div>`:'';
    body.innerHTML=progress+`<section class="panel onboarding-form" aria-labelledby="onboarding-step-title"><h3 id="onboarding-step-title" tabindex="-1">${labels[step-1]}</h3><fieldset${busy?' disabled':''}>${content}</fieldset>${actions}</section>`;el('player-onboarding-team').disabled=busy;el('onboarding-step-title')?.focus({preventScroll:true});
  }
  function parentConfirmation(){const r=request();return r?`<div class="onboarding-parent-check"><strong>${esc(r.parent_name)}</strong><p>${esc(r.parent_email||'')}</p><p>Requested child: ${esc(r.child_name)}</p><label class="checkbox-line"><input id="onboard-parent-verified" name="parent_verified" aria-describedby="player-onboarding-status" type="checkbox"${draft.verified?' checked':''} />I have checked that this parent or guardian should have access to ${esc(draft.name)}.</label></div>`:'<p class="muted">Parent access stays unapproved until a staff member reviews a real request.</p>';}
  function playerProblem(message){
    status(message,true);
    const target=el(/shirt|number/i.test(message)?'onboard-player-number':'onboard-player-name');
    target?.setAttribute('aria-invalid','true');target?.focus();
  }
  async function save(){
    if(busy||!active()||!draft)return;
    const r=request();if(draft.existing&&!r){status('Choose a parent request to complete this player’s onboarding.',true);step=2;render();return;}
    if(r&&!draft.verified){status('Confirm the parent or guardian relationship before approving access.',true);step=2;render();return;}
    if(!draft.existing){const problem=validatePlayer(draft,data.players,data.limit);if(problem){status(problem,true);step=1;render();return;}}
    const key=identity,v=version;busy=true;status('Saving player onboarding…');render();
    try{
      let result;
      if(draft.existing)result=await options.cloud().approveParentRequest(r.request_id,draft.name);
      else result=await options.cloud().onboardAdminPlayer({teamId,name:draft.name,number:Number(draft.number),role:draft.role,parentRequestId:r?.request_id||null});
      if(!valid(v,key))return;if(!result?.ok)throw Error('The cloud did not confirm this onboarding. Refresh before trying again.');
      draft.parentLinked=!!r;dirty=false;busy=false;step=4;status('Player onboarding saved.');render();options.onSaved?.();
    }catch(error){if(valid(v,key)){busy=false;status((error.message||'Could not save onboarding.')+' Your entries are still here. Refresh the squad before retrying if the connection was interrupted.',true);render();}}
  }
  document.addEventListener('input',event=>{if(active()&&event.target.closest?.('.onboarding-form'))dirty=true;});
  document.addEventListener('change',async event=>{
    if(!active())return;
    if(event.target.id==='player-onboarding-team'){const chosen=event.target.value;if(!confirmLeave()){event.target.value=teamId;return;}teamId=chosen;await enter();}
    if(event.target.id==='onboard-parent-request'){draft.requestId=event.target.value;draft.verified=false;el('onboard-parent-confirmation').innerHTML=parentConfirmation();dirty=true;}
  });
  document.addEventListener('click',event=>{
    if(!active()||busy)return;const action=event.target.closest?.('[data-onboard-action]')?.dataset.onboardAction;
    if(action==='reload'){if(confirmLeave())load();return;}
    if(action==='new'){begin();return;}
    if(action==='cancel'){if(confirmLeave()){draft=null;step=0;status('');render();}return;}
    if(action==='back'){readFields();step--;status('');render();return;}
    if(action==='next'){
      readFields();if(step===1&&!draft.existing){const problem=validatePlayer(draft,data.players,data.limit);if(problem){playerProblem(problem);return;}}
      if(step===2&&draft.requestId&&!draft.verified){status('Confirm the parent or guardian relationship to continue.',true);el('onboard-parent-verified')?.focus();return;}
      if(step===2&&draft.existing&&!draft.requestId){status('Choose a parent request, or return to the onboarding list.',true);return;}
      step++;status('');render();return;
    }
    if(action==='save'){save();return;}
    const p=event.target.closest?.('[data-onboard-player]');if(p){const player=data.players[Number(p.dataset.onboardPlayer)];if(player&&player.status!=='inactive')begin(player);return;}
    const q=event.target.closest?.('[data-onboard-request]');if(q){const r=data.requests[Number(q.dataset.onboardRequest)];if(r){const player=data.players.find(p=>p.status!=='inactive'&&norm(p.name)===norm(r.child_name));begin(player,r);}return;}
  });
  window.addEventListener('beforeunload',event=>{if(active()&&(dirty||busy)){event.preventDefault();event.returnValue='';}});
  window.ClubHubPlayerOnboarding={configure:value=>{options=value;syncAccess();},enter,leave,syncAccess,confirmLeave,validatePlayer};
})();
