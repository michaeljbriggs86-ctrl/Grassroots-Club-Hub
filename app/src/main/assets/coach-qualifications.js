/* Coach qualification metadata. Private cloud RPCs only; no local storage or document uploads. */
(()=>{
  'use strict';
  const catalogue=[
    {kind:'dbs',label:'Enhanced DBS',dateLabel:'DBS disclosure issued',expiryLabel:'FA renewal due',years:3,courses:{fa_enhanced_dbs:'FA-accepted Enhanced DBS with Children’s Barred List'},help:'For eligible roles working with under-18s, age 16+. Check FA acceptance and the renewal date in Club Portal. This records the FA renewal date, not a legal expiry of the disclosure.',url:'https://www.thefa.com/football-rules-governance/safeguarding/section-3-safer-recruitment-and-dbs-checks'},
    {kind:'safeguarding',label:'Safeguarding Children',years:2,courses:{fa_safeguarding_children:'FA Safeguarding Children',fa_safeguarding_recertification:'FA Safeguarding Children recertification'},help:'The FA course is valid for two years. Record the completion and expiry dates shown on the qualification.',url:'https://learn.englandfootball.com/courses/safeguarding/safeguarding-children-course'},
    {kind:'first_aid',label:'First aid in football',years:3,courses:{fa_ifaif:'Introduction to First Aid in Football (IFAiF)',fa_efaif:'Emergency First Aid in Football (EFAiF)',other_first_aid:'Other first aid qualification'},help:'IFAiF is valid for three years. For any other course, use its recorded expiry and confirm acceptance with the County FA.',url:'https://learn.englandfootball.com/courses/medical/introduction-to-first-aid-in-football'},
  ];
  const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>['year','month','day'].includes(p.type)).sort((a,b)=>['year','month','day'].indexOf(a.type)-['year','month','day'].indexOf(b.type)).map(p=>p.value).join('-');
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
  function suggestedExpiry(completed,years){if(!validDate(completed)||!years)return '';const [y,m,d]=completed.split('-').map(Number),end=new Date(Date.UTC(y+years,m,0)).getUTCDate();return `${y+years}-${String(m).padStart(2,'0')}-${String(Math.min(d,end)).padStart(2,'0')}`;}
  function status(record,date=today()){
    if(!record)return{tone:'missing',label:'Not recorded'};
    if(record.expires_on){if(record.expires_on<date)return{tone:'expired',label:record.kind==='dbs'?'Renewal overdue':'Expired'};if(record.expires_on===date)return{tone:'due',label:'Due today'};const limit=new Date(date+'T00:00:00Z');limit.setUTCDate(limit.getUTCDate()+60);if(record.expires_on<=limit.toISOString().slice(0,10))return{tone:'due',label:'Due within 60 days'};}
    if(!record.club_checked)return{tone:'missing',label:'Needs club check'};
    return {tone:'current',label:'In date'};
  }
  function validate(record,date=today()){
    const invalid=(field,text)=>{throw Object.assign(Error(text),{qualificationField:field});};
    const item=catalogue.find(x=>x.kind===record.kind);if(!item||!Object.hasOwn(item.courses,record.course))invalid('course','Choose a qualification from the list.');
    if(!validDate(record.completed_on)||record.completed_on>date||record.completed_on<'1900-01-01')invalid('completed','Enter a valid issue or completion date, up to today.');
    if(!record.expires_on)invalid('expiry','Enter the recorded expiry or renewal date.');
    if(record.expires_on&&(!validDate(record.expires_on)||record.expires_on<=record.completed_on))invalid('expiry','Expiry or renewal must be after the issue or completion date.');
    return {kind:record.kind,course:record.course,completed_on:record.completed_on,expires_on:record.expires_on||null,club_checked:record.club_checked===true};
  }
  function response(data){
    if(!Array.isArray(data?.records)||data.records.length>catalogue.length||data.revision===null||!Number.isSafeInteger(Number(data.revision))||Number(data.revision)<0)throw Error('Invalid qualification response');
    const seen=new Set();for(const record of data.records){validate(record);if(seen.has(record.kind))throw Error('Duplicate qualification');seen.add(record.kind);}
    return {...data,revision:Number(data.revision)};
  }
  let state=null,loadVersion=0,busy=false;
  function context(){const cloud=window.ClubHubCloud,profile=cloud?.context?.profile,role=cloud?.role?.();if(!cloud?.session?.user?.id||!profile?.club_id||!['admin','coach','assistant_coach'].includes(role)||cloud?.actingAsParent?.())return null;return{cloud,user:cloud.session.user.id,club:profile.club_id,role,editable:role==='admin'&&typeof isClubOverviewMode==='function'&&isClubOverviewMode()};}
  function same(s=state){const c=context();return !!(s&&c&&c.cloud===s.cloud&&c.user===s.user&&c.club===s.club&&c.role===s.role&&c.editable===s.editable&&el('coach-qualification-dialog')?.open);}
  function message(text,error=false){const node=el('coach-qualification-status');if(node){node.textContent=text;node.classList.toggle('qualification-error',error);}}
  function clearEditorError(field){const input=el('coach-qualification-'+field),error=el('coach-qualification-'+field+'-error');input?.removeAttribute?.('aria-invalid');if(error){error.textContent='';error.hidden=true;}}
  function clearEditorErrors(){for(const field of ['course','completed','expiry','form'])clearEditorError(field);}
  function editorError(text,field){
    clearEditorErrors();message(text,true);
    const input=['course','completed','expiry'].includes(field)?el('coach-qualification-'+field):null;
    const error=el('coach-qualification-'+(input?field:'form')+'-error');if(error){error.textContent=text;error.hidden=false;}
    const focus=input||error;if(input)input.setAttribute('aria-invalid','true');focus?.focus();focus?.scrollIntoView?.({block:'center'});
  }
  function close(){const target=state?.target;loadVersion++;state=null;clearEditorErrors();el('coach-qualification-editor')?.classList.add('hidden');const list=el('coach-qualification-list');if(list)list.innerHTML='';const name=el('coach-qualification-name');if(name)name.textContent='Coach profile';const form=el('coach-qualification-form');form?.reset?.();const retry=el('coach-qualification-retry');if(retry){retry.hidden=true;retry.disabled=false;}message('');const dialog=el('coach-qualification-dialog');if(dialog?.open)dialog.close();if(target&&window.ClubHubPersonProfiles?.selectedSnapshot()?.userId===target)window.ClubHubPersonProfiles.refresh();}
  function syncAccess(){const c=context(),button=el('coach-profile-self');button?.classList.toggle('hidden',!c);if(state&&!same())close();if(matrix&&!matrixCurrent())clearMatrix();el('coach-document-matrix')?.classList.toggle('hidden',!c?.editable);el('coach-documents-summary')?.classList.toggle('hidden',!c?.editable);}
  function render(){
    if(!same()||!state.loaded)return;
    el('coach-qualification-list').innerHTML=catalogue.map(item=>{const record=state.records.find(r=>r.kind===item.kind),s=status(record);return `<article class="coach-qualification-row"><div><h4>${esc(item.label)}</h4><span class="qualification-state ${s.tone}">${esc(s.label)}</span>${record?`<p>${esc(item.courses[record.course]||'Qualification')}</p><p>${esc(item.dateLabel||'Completed')}: ${esc(record.completed_on)}<br>${esc(item.expiryLabel||'Expiry')}: ${record.expires_on?esc(record.expires_on):'No expiry recorded'}</p><p class="muted">${record.club_checked?'Club checked'+(record.checked_at?' · '+esc(String(record.checked_at).slice(0,10)):''):'Needs club check'}</p>`:''}</div>${state.editable?`<button type="button" class="secondary-button" data-edit-qualification="${item.kind}" aria-label="${record?'Edit':'Add'} ${esc(item.label)}">${record?'Edit':'Add'}</button>`:''}</article>`;}).join('');
    el('coach-qualification-readonly').hidden=state.editable;
  }
  function edit(kind){
    if(!same()||!state.loaded||!state.editable||busy)return;
    const item=catalogue.find(x=>x.kind===kind);if(!item)return;const record=state.records.find(r=>r.kind===kind);
    clearEditorErrors();state.editing=kind;el('coach-qualification-kind').value=kind;
    el('coach-qualification-course').innerHTML=Object.entries(item.courses).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('');
    el('coach-qualification-course').value=record?.course||Object.keys(item.courses)[0];
    el('coach-qualification-completed').value=record?.completed_on||'';el('coach-qualification-completed').max=today();
    el('coach-qualification-expiry').value=record?.expires_on||'';el('coach-qualification-expiry').required=true;
    el('coach-qualification-date-label').textContent=item.dateLabel||'Completed';el('coach-qualification-expiry-label').textContent=item.expiryLabel||'Expiry';
    el('coach-qualification-help').textContent=item.help;
    el('coach-qualification-source').href=item.url;
    el('coach-qualification-checked').checked=record?.club_checked===true;
    el('coach-qualification-check-label').textContent=kind==='dbs'?'FA acceptance and dates checked in Club Portal':'Club has checked this qualification and its dates';
    el('coach-qualification-remove').hidden=!record;el('coach-qualification-editor').classList.remove('hidden');el('coach-qualification-completed').focus();message('');
  }
  async function open(userId,name='Coach'){
    const c=context();if(!c||busy||(!c.editable&&userId!==c.user))return;
    clearEditorErrors();state={...c,target:userId,records:[],revision:0,loaded:false,editing:'',loading:false,retryable:false};
    el('coach-qualification-name').textContent=`Coach profile · ${name}`;el('coach-qualification-list').innerHTML='';el('coach-qualification-editor').classList.add('hidden');el('coach-qualification-readonly').hidden=true;
    const dialog=el('coach-qualification-dialog');if(!dialog.open)dialog.showModal();await readQualifications(state);
  }
  async function readQualifications(s,retrying=false){
    if(state!==s||!same(s)||s.loading||busy||(retrying&&!s.retryable))return;
    const version=++loadVersion;s.loading=true;s.retryable=false;
    const retry=el('coach-qualification-retry');if(retry){retry.hidden=!retrying;retry.disabled=true;}message('Loading qualifications…');
    try{const data=response(await s.cloud.getCoachQualifications(s.target));if(version!==loadVersion||state!==s||!same(s))return;
      s.records=data.records;s.revision=Number(data.revision);s.loaded=true;render();message('Recorded dates are checked by your club. FA Club Portal remains the source for acceptance.');if(retry)retry.hidden=true;
    }catch(_){if(version===loadVersion&&state===s&&same(s)){s.retryable=true;if(retry)retry.hidden=false;message('Qualifications could not be loaded. Retry qualifications to try again.',true);}}
    finally{if(version===loadVersion&&state===s){s.loading=false;if(!same(s)){close();return;}if(retry)retry.disabled=false;if(retrying)(s.loaded?el('coach-qualification-name'):retry)?.focus();}}
  }
  function setBusy(value){busy=value;const form=el('coach-qualification-form');for(const field of form?.querySelectorAll('input,select,button')||[])field.disabled=value;}
  function userError(error){return String(error?.code||error?.data?.code)==='40001'?'This profile changed elsewhere. Close and reopen it before saving.':'Could not save qualifications. Close and reopen the profile, then try again.';}
  async function write(records,s){
    if(!same(s)||state!==s||!s.editable)return;
    const version=loadVersion;
    try{const data=response(await s.cloud.saveCoachQualifications(s.target,records,s.revision));if(version!==loadVersion||state!==s||!same(s))return;
      s.records=data.records;s.revision=Number(data.revision);clearEditorErrors();render();el('coach-qualification-editor').classList.add('hidden');message('Qualifications saved.');refreshMatrix();
    }catch(error){if(version===loadVersion&&state===s&&same(s))editorError(userError(error));}
  }
  async function save(event){
    event.preventDefault();if(busy||!same()||!state.loaded||!state.editable)return;
    let record,records;try{record=validate({kind:state.editing,course:el('coach-qualification-course').value,completed_on:el('coach-qualification-completed').value,expires_on:el('coach-qualification-expiry').value,club_checked:el('coach-qualification-checked').checked});}catch(error){editorError(error.message,error.qualificationField);return;}
    try{records=state.records.filter(r=>r.kind!==record.kind).map(r=>validate(r));records.push(record);}catch(error){editorError(error.message);return;}
    const s=state;clearEditorErrors();setBusy(true);message('Saving…');try{await write(records,s);}finally{setBusy(false);}
  }
  async function remove(){
    if(busy||!same()||!state.editable||!state.loaded||!state.editing)return;
    const s=state,kind=s.editing;if(!s.records.some(r=>r.kind===kind))return;setBusy(true);
    try{if(typeof appConfirm!=='function'||!await appConfirm({title:'Remove qualification record',body:'Remove these recorded dates from this coach profile?',detail:'The qualification itself is unchanged.',confirmLabel:'Remove record'}))return;
      if(!same(s)||state!==s||s.editing!==kind)return;
      await write(s.records.filter(r=>r.kind!==kind).map(r=>validate(r)),s);
    }finally{setBusy(false);}
  }
  // Club-wide overview is admin-only and lives only in this module's current-session memory.
  let matrix=null,matrixVersion=0;
  const matrixScrollObserver=typeof window.ResizeObserver==='function'?new window.ResizeObserver(updateMatrixScrollHint):null;
  function matrixCurrent(s=matrix){const c=context();return !!(s&&c?.editable&&c.cloud===s.cloud&&c.user===s.user&&c.club===s.club&&c.role===s.role);}
  function updateMatrixScrollHint(){const region=el('coach-document-table'),hint=el('coach-document-scroll-hint'),show=!!(matrixCurrent()&&matrix.loaded&&region?.querySelector?.('table')&&region.scrollWidth>region.clientWidth+1);if(hint)hint.hidden=!show;if(show)region?.setAttribute?.('aria-describedby','coach-document-scroll-hint');else region?.removeAttribute?.('aria-describedby');}
  function resetMatrixScrollHint(){matrixScrollObserver?.disconnect();if(el('coach-document-scroll-hint'))el('coach-document-scroll-hint').hidden=true;el('coach-document-table')?.removeAttribute?.('aria-describedby');}
  function watchMatrixScroll(){matrixScrollObserver?.disconnect();const region=el('coach-document-table'),table=region?.querySelector?.('table');if(region)matrixScrollObserver?.observe(region);if(table)matrixScrollObserver?.observe(table);updateMatrixScrollHint();}
  function matrixReadPosition(old){
    const region=el('coach-document-table'),active=document.activeElement;
    if(!matrixCurrent(old)||!region?.getClientRects?.().length)return null;
    if(!old.loaded&&old.position&&(active===document.body||active===region))return old.position;
    const coach=region.contains(active)?active.closest?.('[data-matrix-coach]'):null;
    if(coach||active===region)return{coach:coach?.dataset.matrixCoach||null,left:region.scrollLeft,top:region.scrollTop,x:window.scrollX,y:window.scrollY};
    return null;
  }
  function restoreMatrixReadPosition(s){
    const position=s.position;s.position=null;
    const region=el('coach-document-table'),active=document.activeElement;
    if(!position||!matrixCurrent(s)||matrix!==s||!region?.getClientRects?.().length||(active!==document.body&&active!==region))return;
    const target=s.loaded&&region.querySelector('table')?(position.coach?[...region.querySelectorAll('[data-matrix-coach]')].find(n=>n.dataset.matrixCoach===position.coach):region):null;
    if(!target){el('coach-documents-title')?.focus();return;}
    region.scrollLeft=position.left;region.scrollTop=position.top;
    window.scrollTo?.({left:position.x,top:position.y,behavior:'instant'});target.focus({preventScroll:true});
    if(target!==region){const bounds=target.getBoundingClientRect();if(bounds.top<0||bounds.bottom>window.innerHeight)target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
  }
  function cancelMatrixReadPosition(){if(matrix)matrix.position=null;}
  function clearMatrix(){cancelMatrixReadPosition();matrixVersion++;matrix=null;resetMatrixScrollHint();el('coach-document-table')?.setAttribute?.('aria-busy','false');for(const id of ['coach-document-table','coach-document-notice'])if(el(id))el(id).innerHTML='';if(el('coach-document-status'))el('coach-document-status').textContent='';if(el('coach-document-notice'))el('coach-document-notice').hidden=true;if(el('coach-documents-summary-status'))el('coach-documents-summary-status').textContent='Coach documents unavailable. Open the matrix to refresh.';}
  function documentDate(value){return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(new Date(value+'T00:00:00Z'));}
  function matrixSummary(rows,date=today()){
    const due=[],overdue=[];let missing=0,unchecked=0;
    for(const person of rows)for(const item of catalogue){const record=person.records.find(r=>r.kind===item.kind);if(!record){missing++;continue;}if(!record.club_checked)unchecked++;const s=status(record,date);const entry={user_id:person.user_id,name:person.full_name||'Coach',item,record};if(s.tone==='expired')overdue.push(entry);else if(s.tone==='due')due.push(entry);}
    const order=(a,b)=>a.record.expires_on.localeCompare(b.record.expires_on)||a.name.localeCompare(b.name,'en-GB');due.sort(order);overdue.sort(order);
    return {due,overdue,missing,unchecked};
  }
  function renderMatrix(){
    if(!matrixCurrent()||!matrix.loaded)return;
    const date=today(),summary=matrixSummary(matrix.rows,date),notice=el('coach-document-notice'),count=(n,label,plural=label+'s')=>`${n} ${n===1?label:plural}`;
    const compact=el('coach-documents-summary-status');if(compact){compact.textContent=[count(summary.overdue.length,'overdue document'),`${summary.due.length} renewal${summary.due.length===1?'':'s'} due`,count(summary.missing,'missing record'),count(summary.unchecked,'unchecked record')].join(' · ');compact.classList.toggle('qualification-error',!!summary.overdue.length);}
    if(notice){notice.hidden=!summary.overdue.length&&!summary.due.length;notice.classList.toggle('expired',!!summary.overdue.length);notice.classList.toggle('due',!summary.overdue.length);notice.innerHTML=`<strong>${summary.overdue.length?count(summary.overdue.length,'document')+' overdue':count(summary.due.length,'renewal')+' due within 60 days'}</strong>${summary.overdue.length&&summary.due.length?`<p>${esc(count(summary.due.length,'renewal'))} also due within 60 days.</p>`:''}<ul>${[...summary.overdue,...summary.due].slice(0,3).map(e=>`<li>${esc(e.name)} · ${esc(e.item.label)} · ${esc(status(e.record,date).label)} (${esc(documentDate(e.record.expires_on))})</li>`).join('')}</ul>${summary.overdue.length+summary.due.length>3?'<p>Filter to Renewals due for the full list.</p>':''}`;}
    if(el('coach-document-status'))el('coach-document-status').textContent=`${count(matrix.rows.length,'coach','coaches')} · ${count(summary.missing,'missing record')} · ${count(summary.unchecked,'unchecked record')}. Data loaded ${new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(matrix.loadedAt))}.`;
    const mode=el('coach-document-filter')?.value||'all',rank=p=>Math.min(...catalogue.map(item=>{const s=status(p.records.find(r=>r.kind===item.kind),date);return s.tone==='expired'?0:s.tone==='due'?1:s.tone==='missing'?2:3;}));
    const rows=matrix.rows.filter(p=>mode==='due'?p.records.some(r=>['due','expired'].includes(status(r,date).tone)):mode==='missing'?catalogue.some(item=>{const r=p.records.find(x=>x.kind===item.kind);return !r||!r.club_checked;}):true).sort((a,b)=>rank(a)-rank(b)||(a.full_name||'').localeCompare(b.full_name||'','en-GB'));
    if(!el('coach-document-table'))return;
    el('coach-document-table').innerHTML=rows.length?`<table class="coach-document-grid"><caption class="helper">Coach document expiry and renewal matrix</caption><thead><tr><th scope="col">Coach</th>${catalogue.map(item=>`<th scope="col">${esc(item.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(p=>`<tr><th scope="row"><button type="button" class="text-button" data-matrix-coach="${esc(p.user_id)}">${esc(p.full_name||'Coach')}</button><small>${p.role==='assistant_coach'?'Assistant Coach':p.role==='club_admin'?'Club Admin · Coach':'Coach'}</small></th>${catalogue.map(item=>{const record=p.records.find(r=>r.kind===item.kind),s=status(record,date);return `<td><span class="qualification-state ${s.tone}">${esc(s.label)}</span><small>${record?`${item.kind==='dbs'?'Renewal':'Expiry'}: ${esc(documentDate(record.expires_on))}`:'Add a record'}</small>${record?`<small>${record.club_checked?'Club checked':'Needs club check'}</small>`:''}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`:`<p class="muted">${matrix.rows.length?'No coaches match this filter.':'No coaching accounts yet. Approved coaches and assistants will appear here.'}</p>`;
    watchMatrixScroll();
  }
  async function refreshMatrix(){
    const c=context();if(!c?.editable){clearMatrix();return;}
    const old=matrix;if(old&&!matrixCurrent(old))clearMatrix();
    const position=matrixReadPosition(old);if(old)old.position=null;
    const version=++matrixVersion,s=matrix={...c,rows:[],loaded:false,loadedAt:null,position};resetMatrixScrollHint();el('coach-document-table')?.setAttribute?.('aria-busy','true');if(el('coach-documents-summary-status'))el('coach-documents-summary-status').textContent='Loading coach documents…';
    el('coach-document-matrix')?.classList.remove('hidden');if(el('coach-document-table'))el('coach-document-table').innerHTML='';if(el('coach-document-notice')){el('coach-document-notice').innerHTML='';el('coach-document-notice').hidden=true;}if(el('coach-document-status'))el('coach-document-status').textContent='Loading coach documents…';
    try{const rows=await c.cloud.listCoachQualifications();if(version!==matrixVersion||!matrixCurrent())return;
      if(!Array.isArray(rows))throw Error('Invalid matrix');const seen=new Set();
      for(const p of rows){if(!p||typeof p.user_id!=='string'||!p.user_id||seen.has(p.user_id)||!['club_admin','coach','assistant_coach'].includes(p.role)||typeof p.full_name!=='string')throw Error('Invalid coach');response(p);seen.add(p.user_id);}
      matrix.rows=rows;matrix.loadedAt=Date.now();matrix.loaded=true;renderMatrix();
    }catch(_){if(version===matrixVersion&&matrixCurrent()){matrix.rows=[];matrix.loaded=false;if(el('coach-documents-summary-status'))el('coach-documents-summary-status').textContent='Coach documents unavailable. Open the matrix to refresh; no expiry status can be confirmed.';if(el('coach-document-status'))el('coach-document-status').textContent='Coach documents unavailable. Refresh to retry; no expiry status can be confirmed.';}}
    finally{if(version===matrixVersion&&matrix===s&&matrixCurrent(s)){el('coach-document-table')?.setAttribute?.('aria-busy','false');restoreMatrixReadPosition(s);}else s.position=null;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#coach-document-refresh')){refreshMatrix();return;}
    const matrixCoach=event.target.closest?.('[data-matrix-coach]');if(matrixCoach){if(!matrixCurrent()||!matrix.loaded)return;const person=matrix.rows.find(p=>p.user_id===matrixCoach.dataset.matrixCoach);if(person){if(window.ClubHubPersonProfiles)window.ClubHubPersonProfiles.open({kind:'member',id:person.user_id,source:'access'});else open(person.user_id,person.full_name||'Coach');}return;}
    const target=event.target.closest?.('[data-coach-profile]');if(target){const c=context(),id=target.dataset.coachProfile;if(!c?.editable)return;const rows=typeof __adminCoachRows!=='undefined'?__adminCoachRows:[],access=typeof __adminAccessRows!=='undefined'?__adminAccessRows:[];const person=[...rows,...access].find(r=>r.user_id===id&&['club_admin','coach','assistant_coach'].includes(r.role));if(person){if(window.ClubHubPersonProfiles)window.ClubHubPersonProfiles.open({kind:'member',id,source:rows.some(r=>r.user_id===id)?'club':'access'});else open(id,person.full_name||'Coach');}return;}
    const row=event.target.closest?.('[data-edit-qualification]');if(row)edit(row.dataset.editQualification);
    if(event.target.closest?.('#coach-profile-self')){const c=context();if(c){if(window.ClubHubPersonProfiles)window.ClubHubPersonProfiles.open({kind:'member',id:c.user,source:'self'});else open(c.user,c.cloud.context.profile.full_name||'My profile');}}
    if(event.target.closest?.('#coach-qualification-close'))close();
    if(event.target.closest?.('#coach-qualification-retry'))readQualifications(state,true);
  });
  el('coach-qualification-form')?.addEventListener('submit',save);el('coach-qualification-remove')?.addEventListener('click',remove);
  for(const id of ['coach-qualification-completed','coach-qualification-expiry','coach-qualification-course'])el(id)?.addEventListener('input',()=>{
    clearEditorError('form');clearEditorError(id.replace('coach-qualification-',''));if(id!=='coach-qualification-course'){clearEditorError('completed');clearEditorError('expiry');}
    el('coach-qualification-checked').checked=false;
    if(id==='coach-qualification-completed'&&!el('coach-qualification-expiry').value){const item=catalogue.find(x=>x.kind===state?.editing);const years=item?.kind==='first_aid'&&el('coach-qualification-course').value!=='fa_ifaif'?0:item?.years;el('coach-qualification-expiry').value=suggestedExpiry(el('coach-qualification-completed').value,years);}
  });
  el('coach-qualification-checked')?.addEventListener('input',()=>clearEditorError('form'));
  el('coach-qualification-dialog')?.addEventListener('close',()=>{if(!el('coach-qualification-dialog')?.open)close();});
  el('coach-document-filter')?.addEventListener('change',renderMatrix);
  for(const type of ['pointerdown','wheel','touchmove','keydown'])document.addEventListener(type,cancelMatrixReadPosition,{capture:true,passive:true});
  document.addEventListener('focusin',event=>{if(event.target!==document.body)cancelMatrixReadPosition();});
  window.addEventListener?.('resize',updateMatrixScrollHint);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&matrixCurrent())refreshMatrix();});
  window.ClubHubCoachQualifications={syncAccess,open,close,refreshMatrix,matrixSummary,catalogue,today,validDate,suggestedExpiry,status,validate};
  syncAccess();
})();
