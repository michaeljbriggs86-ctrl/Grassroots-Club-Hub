/* Narrow, private registration intake. No contact or agreement data is persisted on-device. */
(()=>{
 'use strict';
 const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let options,identity='',cloudIdentity=null,version=0,target=null,data=null,draft=null,busy=false,dirty=false,documentReady=false,returnFocus=null;
 const mobileValue=value=>String(value||'').trim().replace(/ /g,'');
 const validMobile=value=>/^(\+[1-9][0-9]{6,14}|0[0-9]{9,10})$/.test(mobileValue(value));
 function clear(){version++;data=null;draft=null;target=null;busy=false;dirty=false;documentReady=false;el('registration-conduct-body')?.replaceChildren();const status=el('registration-conduct-status');if(status)status.textContent='';el('registration-conduct-dialog')?.close();}
 function syncAccess(){const key=options?.contextKey()||'',cloud=options?.cloud();if(key!==identity||cloud!==cloudIdentity){clear();identity=key;cloudIdentity=cloud;}return key;}
 function valid(v,key){return v===version&&key===identity&&key===options?.contextKey()&&cloudIdentity===options?.cloud()&&el('registration-conduct-dialog').open;}
 function status(message,error=false){const node=el('registration-conduct-status');node.textContent=message;node.classList.toggle('is-error',error);}
 function confirmLeave(){if(busy){options?.toast('Wait for the registration request to finish.');return false;}return !dirty||window.confirm('Discard your unsaved registration details?');}
 function close(){if(!confirmLeave())return false;clear();returnFocus?.focus();return true;}
 async function open(person){
  if(!syncAccess()||!person?.playerName||!['parent','admin'].includes(options.role()))return;
  if(el('registration-conduct-dialog').open&&!confirmLeave())return;
  clear();returnFocus=document.activeElement;target={teamId:options.cloud().currentTeam()?.id,playerName:person.playerName,season:options.season()};if(!target.teamId||!target.season)return;
  draft={mobile:'',accepted:false};el('registration-conduct-dialog').showModal();await load();
 }
 function render(){
  if(!target||!draft)return;const parent=options.role()==='parent',doc=data?.document,body=el('registration-conduct-body');
  el('registration-conduct-title').textContent=parent?'Registration details':'Registration check';
  const intro=`<p class="muted">${esc(target.playerName)} · ${esc(data?.team_name||options.teamLabel())}<br>${esc(target.season)}</p>`;
  if(!parent){body.innerHTML=intro+(data?`<section class="panel"><h3>Parent contact</h3>${data.evidence.length?data.evidence.map(row=>`<p>${esc(row.adult_name)}<br>Mobile number: ${esc(row.mobile||'Not provided')}</p>`).join(''):'<p>No parent submission recorded.</p>'}<p class="helper">Visible to club admin and this team’s staff. Other parents cannot see this number.</p></section><section class="panel"><h3>Code of conduct</h3>${data.evidence.length?data.evidence.map(row=>`<p>Accepted by ${esc(row.adult_name)}<br>Accepted: ${esc(new Date(row.accepted_at).toLocaleString('en-GB'))}<br>Document: ${esc(row.document_id)}<br><small>${esc(row.document_version)}</small></p>`).join(''):'<p>Awaiting parent/guardian acceptance.</p>'}<button type="button" class="secondary-button" data-conduct-action="read"${doc?.available?'':' disabled'}>Read the club code of conduct</button></section><section class="panel"><h3>Separate registration checks</h3><p>Contact details and agreement are parent evidence. Check the parent relationship and payment separately.</p><p class="helper">Agreement does not approve parent access or confirm payment. Admin cannot accept on a parent’s behalf.</p></section>`:'<section class="panel"><p>Registration evidence is unavailable.</p><button type="button" class="secondary-button" data-conduct-action="reload">Retry</button></section>');return;}
  if(data?.submitted){body.innerHTML=intro+`<section class="panel"><h3>Details submitted</h3><p>Mobile number: ${esc(data.mobile)}</p><p>Code of conduct: accepted by you.</p><p class="helper">The club has confirmed your submission. Payment and parent access are checked separately.</p></section>`;return;}
  body.innerHTML=intro+`<form id="registration-conduct-form" novalidate><fieldset${busy?' disabled':''}><section class="panel"><h3>Parent contact</h3><label for="registration-mobile">Parent/guardian mobile number *</label><input id="registration-mobile" name="tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" aria-describedby="registration-mobile-help registration-conduct-status" value="${esc(draft.mobile)}" required placeholder="e.g. 07700 900123" /><p class="helper" id="registration-mobile-help">Required. Used by club admin and your child’s team staff. Other parents cannot see it.</p></section><section class="panel"><h3>Code of conduct *</h3><button type="button" class="secondary-button" data-conduct-action="read"${doc?.available?'':' disabled'}>Read the club code of conduct</button><p>I have read and agree to abide by the club’s Code of Conduct and the terms of registration.</p><p id="registration-acceptance-state" aria-live="polite">${draft.accepted?'Accepted for this submission':'Not accepted yet'}</p><button type="button" class="primary-button" data-conduct-action="agree" aria-pressed="${draft.accepted}"${documentReady?'':' disabled'}>${draft.accepted?'Change agreement':'I agree'}</button><p class="helper">Opening the document does not record agreement.</p>${!doc?.available?'<p class="helper">Code of conduct unavailable. Your mobile entry is kept. Retry before continuing.</p><button type="button" class="secondary-button" data-conduct-action="reload">Retry</button>':''}</section><button type="submit" class="primary-button">${busy?'Submitting…':'Continue'}</button><p class="helper">These details support registration. The club checks payment and parent access separately.</p></fieldset></form>`;
 }
 async function load(){
  if(!target||busy)return;const key=identity,v=version;busy=true;status('Loading registration details…');render();
  try{const result=await options.cloud().getRegistrationContactConduct(target);if(!valid(v,key))return;if(result?.ok!==true||result.player_name!==target.playerName||result.team_id!==target.teamId||result.season!==target.season||!Array.isArray(result.evidence))throw Error('Registration details unavailable');
   if(data?.document?.version!==result.document?.version){draft.accepted=false;documentReady=false;}data=result;if(!dirty)draft.mobile=result.mobile||'';status('');
  }catch{if(valid(v,key)){data=null;documentReady=false;draft.accepted=false;status('Registration details are temporarily unavailable. Your entries are kept. Please retry.',true);}}
  finally{if(valid(v,key)){busy=false;render();}}
 }
 async function read(){
  if(busy||!data?.document?.available)return;
  const key=identity,v=version,reader=window.open('about:blank','_blank');if(!reader){status('Allow the document window, then retry.',true);return;}reader.opener=null;busy=true;status('Opening the full code of conduct…');
  try{const blob=await options.cloud().readRegistrationConductDocument(target);if(!valid(v,key)){reader.close();return;}if(blob.type!=='application/pdf')throw Error('Unavailable document');
   const url=URL.createObjectURL(blob);reader.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),300000);documentReady=true;status('Document opened. Choose “I agree” after reading it.');
  }catch{reader.close();if(valid(v,key)){documentReady=false;draft.accepted=false;status('The full code of conduct could not open. Your entries are kept. Retry reading the document before continuing.',true);}}
  finally{if(valid(v,key)){busy=false;render();el('registration-conduct-body').querySelector('[data-conduct-action="agree"]')?.focus();}}
 }
 async function submit(event){
  event.preventDefault();if(busy||!target||options.role()!=='parent')return;
  draft.mobile=el('registration-mobile').value;
  if(!validMobile(draft.mobile)){status('Enter a valid mobile number, for example 07700 900123 or +44 7700 900123.',true);el('registration-mobile').setAttribute('aria-invalid','true');el('registration-mobile').focus();return;}
  if(!documentReady||!data?.document?.available||!draft.accepted){status('Read and agree to the current code of conduct before continuing.',true);return;}
  const key=identity,v=version,submittedVersion=data.document.version;busy=true;status('Submitting registration details…');render();
  try{const result=await options.cloud().submitRegistrationContactConduct({...target,mobile:mobileValue(draft.mobile),documentVersion:submittedVersion,agree:true});if(!valid(v,key))return;
   if(result?.ok!==true||result.submitted!==true||result.team_id!==target.teamId||result.player_name!==target.playerName||result.season!==target.season||!result.evidence?.some(row=>row.adult_user_id===options.cloud().session?.user?.id&&row.document_version===submittedVersion&&row.accepted_at))throw Error('Submission not confirmed');data=result;dirty=false;status('Registration details submitted.');
  }catch{if(valid(v,key))status('The club has not confirmed your submission. Your entries are still here. Retry when connected.',true);}
  finally{if(valid(v,key)){busy=false;render();}}
 }
 document.addEventListener('input',event=>{if(event.target.id==='registration-mobile'&&draft){draft.mobile=event.target.value;dirty=true;event.target.removeAttribute('aria-invalid');}});
 document.addEventListener('click',event=>{const action=event.target.closest('[data-conduct-action]')?.dataset.conductAction;if(!action||!el('registration-conduct-dialog').open||busy)return;if(action==='reload')load();if(action==='read')read();if(action==='agree'&&documentReady){draft.accepted=!draft.accepted;dirty=true;render();el('registration-conduct-body').querySelector('[data-conduct-action="agree"]')?.focus();}});
 el('registration-conduct-body')?.addEventListener('submit',submit);el('registration-conduct-close')?.addEventListener('click',close);
 el('registration-conduct-dialog')?.addEventListener('cancel',event=>{event.preventDefault();close();});
 window.addEventListener('clubhub-contacts-clear',clear);
 window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
 window.ClubHubRegistrationConduct={configure:value=>{options=value;syncAccess();},open,syncAccess,confirmLeave,close,validMobile};
})();
