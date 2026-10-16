/* Team-scoped kick-off receipts. Never infer seen from read, delivery or navigation. */
(function(){
 'use strict';
 const cloud=()=>window.ClubHubCloud;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const busy=new Set(),errors=new Map(),cards=new Map(),blocked=new Map();
 let scope='',push={loading:false,busy:false,available:false,on:false,key:'',error:''},pushVersion=0,pushStamp=0;
 let admin={scope:'',rows:[],loading:false,error:'',stamp:0,version:0};
 const identity=()=>[cloud()?.session?.user?.id||'',cloud()?.context?.profile?.club_id||'',cloud()?.role?.()||'',cloud()?.actingAsParent?.()?'parent':'staff',cloud()?.currentTeam?.()?.id||''].join('|');
 const adult=()=>!!cloud()?.session?.user?.id&&['club_admin','admin','coach','assistant_coach','parent'].includes(cloud()?.context?.profile?.role||cloud()?.role?.());
 const parentCapacity=()=>cloud()?.role?.()==='parent'||!!cloud()?.actingAsParent?.();
 const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const stamp=value=>{const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';};
 const notificationStamp=()=>typeof __notificationStamp==='undefined'?0:__notificationStamp;
 const notificationUnavailable=()=>typeof __notificationLoading!=='undefined'&&__notificationLoading||typeof __notificationError!=='undefined'&&!!__notificationError;
 function resetAdmin(){const version=admin.version+1;admin={scope:'',rows:[],loading:false,error:'',stamp:0,version};const panel=document.getElementById('kickoff-admin-panel');if(panel){panel.hidden=true;const list=panel.querySelector('[data-kickoff-admin-list]');if(list)list.innerHTML='';const status=panel.querySelector('[data-kickoff-admin-status]');if(status)status.textContent='';}}
 function reset(){scope=identity();busy.clear();errors.clear();cards.clear();blocked.clear();resetAdmin();++pushVersion;pushStamp=0;push={loading:false,busy:false,available:false,on:false,key:'',error:''};}
 function sync(){if(scope!==identity())reset();}
 function redraw(){if(typeof renderNotificationCenter==='function')renderNotificationCenter();}
 function rowDisabled(row){const id=String(row.update_id);if(blocked.has(id)&&notificationStamp()>blocked.get(id)&&!notificationUnavailable())blocked.delete(id);return notificationUnavailable()||blocked.has(id);}
 function actionContext(row){const d=row.details||{},parts=[row.team_name,d.date,d.time?'Kick-off '+d.time:'',d.ground,d.status==='provisional'?'Provisional':d.status==='confirmed'?'Confirmed':''].filter(Boolean);return `<p class="kickoff-context">${parts.map(esc).join(' · ')}${row.revision?` · Update ${esc(row.revision)}`:''}</p>`;}
 function childResponse(row,child,disabled){
  const id=String(row.update_id),link=String(child.parent_link_id||''),key=id+':'+link,pending=busy.has(key),message=errors.get(key),current=child.response_current===true&&['available','unavailable'].includes(child.status);
  const label=child.status==='available'?'Available':child.status==='unavailable'?'Unavailable':child.status==='unsure'?'Unsure':'';
  const saved=current?`${label} · saved ${stamp(child.responded_at)}`:label?`Current availability: ${label}. Please respond to these updated details.`:'No response yet';
  return `<fieldset class="kickoff-child" data-kickoff-child="${esc(link)}" ${disabled||pending?'disabled':''} ${pending?'aria-busy="true"':''}><legend>${esc(child.player_name||'Your child')}</legend><p class="kickoff-helper" data-kickoff-child-status role="status">${pending?'Saving your response…':esc(saved)}</p><div class="kickoff-availability-actions">${['available','unavailable'].map(status=>`<button type="button" class="${current&&status===child.status?'primary-button':'secondary-button'}" data-kickoff-availability="${status}" data-kickoff-update="${esc(id)}" data-kickoff-parent-link="${esc(link)}" aria-pressed="${current&&status===child.status?'true':'false'}" ${disabled||pending?'disabled':''}>${current&&status===child.status?'✓ ':''}${status==='available'?'Available':'Unavailable'}</button>`).join('')}</div>${message?`<p class="kickoff-error" role="alert">${esc(message)}</p>`:''}</fieldset>`;
 }
 function renderAcknowledgement(row){
  sync();if(row.type!=='kickoff_update'||!row.update_id)return '';
  const id=String(row.update_id);cards.set(id,row);
  const fetchBlocked=rowDisabled(row),disabled=fetchBlocked||[...busy].some(token=>token.startsWith(id+':')),pending=busy.has(id),message=errors.get(id),isParent=parentCapacity(),children=isParent&&row.can_respond_as_parent===true&&Array.isArray(row.children)?row.children:[];
  const previous=row.previous_details,changed=previous&&['time','date','ground','status'].some(key=>previous[key]!==row.details?.[key]);
  let action='';
  if(isParent){
   const complete=children.filter(child=>child.response_current===true&&['available','unavailable'].includes(child.status)).length;
   action=children.length?`<div class="kickoff-parent-responses"><strong>Can your child attend?</strong><p class="kickoff-helper">Choosing an option also acknowledges this update.</p>${children.length>1?`<p class="kickoff-helper" role="status">${complete} of ${children.length} responses saved</p>`:''}${children.map(child=>childResponse(row,child,disabled)).join('')}</div>`:'<div class="kickoff-link-required"><strong>Link a child before responding</strong><p class="kickoff-helper">No approved child is linked to this team. Ask your coach to check access. Availability controls stay hidden until your linked child is approved.</p></div>';
  }else if(row.can_acknowledge_as_coach===true){
   action=row.coach_acknowledged_at?`<div class="kickoff-seen" role="status"><strong>✓ Acknowledged</strong><p class="kickoff-helper">Saved ${esc(stamp(row.coach_acknowledged_at))}</p></div>`:`<p class="kickoff-helper">Confirm that you have seen and acknowledged these details.</p><button type="button" class="primary-button" data-kickoff-coach-confirm="${esc(id)}" ${disabled||pending?'disabled':''} ${pending?'aria-busy="true"':''}>${pending?'Saving…':'Confirm'}</button>`;
  }else action='<p class="kickoff-helper">Only the assigned coach can acknowledge these details in the Coach profile.</p>';
  return `<div class="kickoff-confirmation" data-kickoff-card="${esc(id)}">${row.revision?`<p class="kickoff-context">Update ${esc(row.revision)}</p>`:''}${changed?`<p class="kickoff-helper">These details have changed. Please ${isParent?'respond':'confirm'} again.</p>`:''}${fetchBlocked?'<p class="kickoff-helper" role="status">Refresh latest updates before responding.</p>':''}${action}${message?`<p class="kickoff-error" role="alert">${esc(message)}</p>`:''}${blocked.has(id)?'<button type="button" class="secondary-button" data-kickoff-refresh>Refresh latest update</button>':''}</div>`;
 }
 function currentRow(id,revision){const row=cards.get(id);return row&&String(row.revision||'')===String(revision||'')?row:null;}
 function applyServerRow(row){if(typeof __notificationLoading!=='undefined'&&__notificationLoading){++__notificationLoadVersion;__notificationLoading=false;}if(typeof __appNotifications!=='undefined')__appNotifications=__appNotifications.map(existing=>String(existing.update_id)===String(row.update_id)?row:existing);cards.set(String(row.update_id),row);}
 async function refreshLatest(){if(typeof refreshNotifications==='function'){if(typeof __notificationStamp!=='undefined')__notificationStamp=0;await refreshNotifications(false);}}
 async function responseError(error,id,key){
  const changed=/KICKOFF_DETAILS_CHANGED|KICKOFF_AVAILABILITY_CHANGED/.test(String(error?.message||error));
  if(changed){blocked.set(id,notificationStamp());errors.set(key,'These details changed while you were responding. Review the latest update and try again.');await refreshLatest();}
  else if(/42501|access|permission|approved|linked child/i.test(String(error?.message||error))){blocked.set(id,notificationStamp());errors.set(key,'Your access has changed. Refresh latest updates before responding.');await refreshLatest();}
  else errors.set(key,'Could not save your response. Try again.');
 }
 async function confirmCoach(id){
  sync();const row=cards.get(id);if(!adult()||parentCapacity()||row?.can_acknowledge_as_coach!==true||rowDisabled(row)||busy.has(id)||row.coach_acknowledged_at)return;
  const key=identity(),revision=row.revision;busy.add(id);errors.delete(id);redraw();
  try{
   const result=await cloud().acknowledgeKickoffAsCoach(id);
   if(key!==identity()||!currentRow(id,revision))return;
   if(String(result?.update_id)!==id||String(result?.revision||'')!==String(revision||'')||!stamp(result?.coach_acknowledged_at)||!stamp(result?.read_at))throw Error('No confirmation returned');
   applyServerRow({...currentRow(id,revision),coach_acknowledged_at:result.coach_acknowledged_at,read_at:result.read_at});pushStamp=0;
   window.dispatchEvent(new CustomEvent('clubhub-kickoff-response-saved',{detail:{update_id:id,capacity:'coach'}}));
  }catch(error){if(key===identity())await responseError(error,id,id);}
  finally{if(key===identity()){busy.delete(id);redraw();}}
 }
 async function respondParent(id,link,status){
  sync();const row=cards.get(id),child=Array.isArray(row?.children)?row.children.find(value=>String(value.parent_link_id)===link):null,token=id+':'+link;
  if(!adult()||!parentCapacity()||row?.can_respond_as_parent!==true||!child||!['available','unavailable'].includes(status)||rowDisabled(row)||[...busy].some(token=>token.startsWith(id+':')))return;
  const key=identity(),revision=row.revision;busy.add(token);errors.delete(token);errors.delete(id);redraw();
  try{
   const result=await cloud().respondKickoffParentAvailability(id,link,status);
   if(key!==identity()||!currentRow(id,revision))return;
   const saved=result?.children?.find(value=>String(value.parent_link_id)===link);
   if(String(result?.update_id)!==id||String(result?.revision||'')!==String(revision||'')||saved?.response_current!==true||saved.status!==status||!stamp(saved.responded_at))throw Error('No response returned');
   applyServerRow(result);pushStamp=0;
   window.dispatchEvent(new CustomEvent('clubhub-kickoff-response-saved',{detail:{update_id:id,fixture_key:row.fixture_key,capacity:'parent'}}));
  }catch(error){if(key===identity())await responseError(error,id,token);}
  finally{if(key===identity()){busy.delete(token);redraw();}}
 }
 function adminAllowed(){return !!cloud()?.session?.user?.id&&cloud()?.canAdmin?.()===true&&!parentCapacity()&&(typeof isClubOverviewMode!=='function'||isClubOverviewMode());}
 function renderAdmin(){
  sync();const panel=document.getElementById('kickoff-admin-panel');if(!panel)return;
  if(!adminAllowed()){resetAdmin();return;}
  panel.hidden=false;
  const status=panel.querySelector('[data-kickoff-admin-status]'),list=panel.querySelector('[data-kickoff-admin-list]'),button=panel.querySelector('[data-kickoff-admin-refresh]');
  const message=admin.loading?'Loading latest responses…':admin.error||(!admin.stamp?'Loading latest responses…':'Responses are for these exact fixture details. Opening an email does not acknowledge them.');
  if(status)status.textContent=message;if(button)button.disabled=admin.loading;panel.setAttribute('aria-busy',String(admin.loading));
  if(!list)return;
  const html=admin.error?'<div class="notification-empty"><strong>Could not load latest responses</strong><p>Refresh responses to try again.</p></div>':admin.rows.length?admin.rows.map(row=>{
   const coaches=Array.isArray(row.coaches)?row.coaches:[],seen=coaches.filter(coach=>coach.revision_current===true&&coach.acknowledged_at).length,parents=row.parents||{};
   return `<article class="kickoff-admin-card" data-kickoff-admin-update="${esc(row.update_id)}"><strong>${esc(row.details?.opponent||'Upcoming fixture')}</strong>${actionContext(row)}<div class="kickoff-admin-coaches"><strong>Coaches · ${seen} of ${coaches.length} acknowledged</strong>${coaches.map(coach=>`<p><span>${esc(coach.name||'Coach')}</span><span>${coach.revision_current===true&&coach.acknowledged_at?'Seen and acknowledged · '+esc(stamp(coach.acknowledged_at)):'Awaiting acknowledgement'}</span></p>`).join('')||'<p>No assigned coaches</p>'}</div><div class="kickoff-admin-parents"><strong>Parent availability</strong><p>${Number(parents.available)||0} available · ${Number(parents.unavailable)||0} unavailable · ${Number(parents.pending)||0} no response${Number(parents.changed)?` · ${Number(parents.changed)} need a new response`:''}</p></div></article>`;
  }).join(''):admin.stamp?'<div class="notification-empty"><strong>No upcoming kick-off updates yet</strong><p>Coach acknowledgements appear here after times are released.</p></div>':'';
  if(list.innerHTML!==html)list.innerHTML=html;
 }
 async function refreshAdmin(quiet=true){
  sync();const panel=document.getElementById('kickoff-admin-panel');if(!panel||!adminAllowed()){resetAdmin();return;}
  // Never fetch for a hidden screen or for a capacity that cannot inspect club responses.
  if(!panel.parentElement?.getClientRects?.().length)return;
  const key=identity();if(admin.scope!==key){resetAdmin();admin.scope=key;}
  if(admin.loading||quiet&&Date.now()-admin.stamp<30000){renderAdmin();return;}
  const version=++admin.version;admin.loading=true;admin.error='';admin.rows=[];renderAdmin();
  try{const result=await cloud().listKickoffUpdatesForAdmin(null);if(key!==identity()||version!==admin.version||!adminAllowed())return;admin.rows=Array.isArray(result)?result:[];admin.stamp=Date.now();}
  catch(_){if(key!==identity()||version!==admin.version)return;admin.rows=[];admin.stamp=0;admin.error='Could not load latest responses. Try again.';}
  finally{if(key===identity()&&version===admin.version){admin.loading=false;renderAdmin();}}
 }
 async function registration(){const r=await navigator.serviceWorker.getRegistration();if(!r?.active)throw Error('Push is not available on this device yet');return r;}
 function renderPush(){
  sync();for(const panel of document.querySelectorAll('[data-kickoff-push-panel]')){
   panel.hidden=!adult();if(!adult())continue;
   const blocked=supported()&&Notification.permission==='denied';
   const copy=!supported()?'Push is not available on this device.':blocked?'Blocked in your browser settings':push.loading?'Checking push settings…':push.on?'On for this device':push.available?'Get kick-off updates on this device':'Push is not available on this device yet';
   const html=`<strong>Push notifications</strong><p>${esc(copy)}</p>${supported()&&!blocked&&push.available?`<button type="button" class="secondary-button" data-kickoff-push-toggle ${push.busy||push.loading?'disabled aria-busy="true"':''}>${push.busy?'Updating…':push.on?'Turn off push':'Turn on push'}</button>`:''}<p class="kickoff-helper">Delivery is separate from a coach acknowledgement or parent availability response.</p>${push.error?`<p class="kickoff-error" role="alert">${esc(push.error)}</p>`:''}`;
   if(panel.innerHTML!==html)panel.innerHTML=html;
  }
  if(adult()&&supported()&&!push.loading&&!push.busy&&Date.now()-pushStamp>60000){pushStamp=Date.now();void refreshPush();}
 }
 async function refreshPush(){
  const key=identity(),version=++pushVersion;push.loading=true;renderPush();
  try{
   const r=await registration(),sub=await r.pushManager.getSubscription();const settings=await cloud().getKickoffPushSettings(sub?.endpoint||'');
   if(key!==identity()||version!==pushVersion)return;
   push.available=!!settings?.available;push.key=settings?.public_key||'';push.on=!!(sub&&settings?.subscribed);push.error='';
   if(push.on)await cloud().registerKickoffPush(sub.toJSON());
  }catch(_){if(key===identity()&&version===pushVersion){push.available=false;push.on=false;push.error='Could not check push settings. Use Refresh to try again.';}}
  finally{if(key===identity()&&version===pushVersion){push.loading=false;renderPush();}}
 }
 function decodeKey(value){const b=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0));}
 async function togglePush(){
  sync();if(!adult()||!supported()||push.busy||!push.available)return;
  const key=identity(),turnOff=push.on;
  // Request permission directly from the user gesture, before any await (Safari requirement).
  const permission=turnOff?Promise.resolve('granted'):Notification.requestPermission();
  push.busy=true;push.error='';renderPush();
  let created=null;
  try{
   if(await permission!=='granted')throw Error('permission');
   const r=await registration();let sub=await r.pushManager.getSubscription();
   if(key!==identity())return;
   if(turnOff){if(sub){await cloud().unregisterKickoffPush(sub.endpoint);await sub.unsubscribe();}if(key===identity())push.on=false;}
   else{if(!sub){sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(push.key)});created=sub;}if(key!==identity()){await created?.unsubscribe();return;}await cloud().registerKickoffPush(sub.toJSON());if(key===identity())push.on=true;}
  }catch(_){if(created)await created.unsubscribe().catch(()=>{});if(key===identity())push.error=Notification.permission==='denied'?'Blocked in your browser settings':'Could not update push settings. Try again.';}
  finally{if(key===identity()){push.busy=false;renderPush();}}
 }
 async function disableForLogout(){
  ++pushVersion;
  if(!supported())return;
  try{const r=await navigator.serviceWorker.getRegistration(),sub=await r?.pushManager?.getSubscription();if(sub){try{await cloud().unregisterKickoffPush(sub.endpoint);}finally{await sub.unsubscribe();}}}catch(_){/* Logout still completes offline. Generic lock-screen content never includes private data. */}
  reset();
 }
 document.addEventListener('click',event=>{
  const coach=event.target.closest?.('[data-kickoff-coach-confirm]');if(coach){void confirmCoach(coach.dataset.kickoffCoachConfirm);return;}
  const parent=event.target.closest?.('[data-kickoff-availability]');if(parent){void respondParent(parent.dataset.kickoffUpdate,parent.dataset.kickoffParentLink,parent.dataset.kickoffAvailability);return;}
  if(event.target.closest?.('[data-kickoff-admin-refresh]')){void refreshAdmin(false);return;}
  if(event.target.closest?.('[data-kickoff-refresh]')){void refreshLatest();return;}
  if(event.target.closest?.('[data-kickoff-push-toggle]'))void togglePush();
 });
 for(const name of ['clubhub-contacts-clear','clubhub-signed-out'])window.addEventListener(name,reset);
 window.ClubHubKickoffUpdates={renderAcknowledgement,renderPush,refreshPush,disableForLogout,reset,renderAdmin,refreshAdmin,resetAdmin};
})();
