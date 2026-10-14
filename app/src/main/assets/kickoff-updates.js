/* Team-scoped kick-off receipts. Never infer seen from read, delivery or navigation. */
(function(){
 'use strict';
 const cloud=()=>window.ClubHubCloud;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selected=new Set(),busy=new Set(),errors=new Map();
 let scope='',push={loading:false,busy:false,available:false,on:false,key:'',error:''},pushVersion=0,pushStamp=0;
 const identity=()=>[cloud()?.session?.user?.id||'',cloud()?.context?.profile?.club_id||'',cloud()?.role?.()||'',cloud()?.actingAsParent?.()?'parent':'staff',cloud()?.currentTeam?.()?.id||''].join('|');
 const adult=()=>!!cloud()?.session?.user?.id&&['club_admin','admin','coach','assistant_coach','parent'].includes(cloud()?.context?.profile?.role||cloud()?.role?.());
 const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 function reset(){scope=identity();selected.clear();busy.clear();errors.clear();++pushVersion;pushStamp=0;push={loading:false,busy:false,available:false,on:false,key:'',error:''};}
 function sync(){if(scope!==identity())reset();}
 function redraw(){if(typeof renderNotificationCenter==='function')renderNotificationCenter();}
 function renderAcknowledgement(row){
  sync();if(row.type!=='kickoff_update'||!row.update_id)return '';
  const id=String(row.update_id),pending=busy.has(id),message=errors.get(id),totals=row.confirmation_totals;
  const stamp=row.seen_at?new Date(row.seen_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const previous=row.previous_details?.time,changed=previous&&previous!==row.details?.time;
  const counts=totals?`<div class="kickoff-totals"><strong>Who has seen this update?</strong><p>Coaches: ${Number(totals.coaches_seen)||0} of ${Number(totals.coaches)||0} · Parents: ${Number(totals.parents_seen)||0} of ${Number(totals.parents)||0}</p>${row.delivery_totals?`<p class="kickoff-helper">Delivery: ${Object.entries(row.delivery_totals).map(([key,n])=>`${Number(n)||0} ${esc(key)}`).join(' · ')}. Delivery is separate from confirming seen.</p>`:''}</div>`:'';
  return `<div class="kickoff-confirmation" data-kickoff-card="${esc(id)}">${changed?`<p class="kickoff-helper">Previously ${esc(previous)}. These details have changed. Please confirm again.</p>`:''}${row.seen_at?`<p class="kickoff-seen">✓ Seen by you · ${esc(stamp)}</p>`:`<label class="kickoff-checkbox"><input type="checkbox" data-kickoff-check="${esc(id)}" ${selected.has(id)?'checked':''} ${pending?'disabled':''}><span>I’ve seen these details</span></label><button type="button" class="primary-button" data-kickoff-confirm="${esc(id)}" ${!selected.has(id)||pending?'disabled':''} ${pending?'aria-busy="true"':''}>${pending?'Saving…':'Confirm seen'}</button>`}${message?`<p class="kickoff-error" role="alert">${esc(message)}</p>`:''}${counts}</div>`;
 }
 async function confirm(id){
  sync();if(!adult()||!selected.has(id)||busy.has(id))return;
  const key=identity();busy.add(id);errors.delete(id);redraw();
  try{
   const stamp=await cloud().acknowledgeKickoffUpdate(id);
   if(key!==identity())return;
   if(!stamp)throw Error('No confirmation returned');
   // Display success only after the server confirms; a failed refresh can never undo this write.
   if(typeof __appNotifications!=='undefined')__appNotifications=__appNotifications.map(r=>r.update_id===id?{...r,seen_at:stamp}:r);
   selected.delete(id);pushStamp=0;
   if(typeof refreshNotifications==='function'){__notificationStamp=0;await refreshNotifications(false);}
  }catch(err){
   if(key!==identity())return;
   if(/KICKOFF_DETAILS_CHANGED/.test(String(err.message||err))){selected.delete(id);if(typeof __notificationActionError!=='undefined')__notificationActionError='These details changed while you were confirming. Review the latest update and confirm again.';errors.set(id,'These details changed while you were confirming. Review the latest update and confirm again.');if(typeof refreshNotifications==='function'){__notificationStamp=0;await refreshNotifications(false);}}
   else errors.set(id,'Could not save your confirmation. Try again.');
  }finally{if(key===identity()){busy.delete(id);redraw();}}
 }
 async function registration(){const r=await navigator.serviceWorker.getRegistration();if(!r?.active)throw Error('Push is not available on this device yet');return r;}
 function renderPush(){
  sync();for(const panel of document.querySelectorAll('[data-kickoff-push-panel]')){
   panel.hidden=!adult();if(!adult())continue;
   const blocked=supported()&&Notification.permission==='denied';
   const copy=!supported()?'Push is not available on this device.':blocked?'Blocked in your browser settings':push.loading?'Checking push settings…':push.on?'On for this device':push.available?'Get kick-off updates on this device':'Push is not available on this device yet';
   const html=`<strong>Push notifications</strong><p>${esc(copy)}</p>${supported()&&!blocked&&push.available?`<button type="button" class="secondary-button" data-kickoff-push-toggle ${push.busy||push.loading?'disabled aria-busy="true"':''}>${push.busy?'Updating…':push.on?'Turn off push':'Turn on push'}</button>`:''}<p class="kickoff-helper">Email updates are sent separately. Confirm seen inside the app.</p>${push.error?`<p class="kickoff-error" role="alert">${esc(push.error)}</p>`:''}`;
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
 document.addEventListener('change',event=>{const n=event.target.closest?.('[data-kickoff-check]');if(!n)return;sync();n.checked?selected.add(n.dataset.kickoffCheck):selected.delete(n.dataset.kickoffCheck);for(const card of document.querySelectorAll('[data-kickoff-card]'))if(card.dataset.kickoffCard===n.dataset.kickoffCheck){card.querySelector('input').checked=n.checked;card.querySelector('button').disabled=!n.checked;}});
 document.addEventListener('click',event=>{const c=event.target.closest?.('[data-kickoff-confirm]');if(c){void confirm(c.dataset.kickoffConfirm);return;}if(event.target.closest?.('[data-kickoff-push-toggle]'))void togglePush();});
 for(const name of ['clubhub-contacts-clear','clubhub-signed-out'])window.addEventListener(name,reset);
 window.ClubHubKickoffUpdates={renderAcknowledgement,renderPush,refreshPush,disableForLogout,reset};
})();
