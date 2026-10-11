/* Coach qualification metadata. Private cloud RPCs only; no local storage or document uploads. */
(()=>{
  'use strict';
  const catalogue=[
    {kind:'dbs',label:'Enhanced DBS',dateLabel:'DBS disclosure issued',expiryLabel:'FA renewal due',years:3,courses:{fa_enhanced_dbs:'FA-accepted Enhanced DBS with Children’s Barred List'},help:'For eligible roles working with under-18s, age 16+. Check FA acceptance and the renewal date in Club Portal. This records the FA renewal date, not a legal expiry of the disclosure.',url:'https://www.thefa.com/football-rules-governance/safeguarding/section-3-safer-recruitment-and-dbs-checks'},
    {kind:'safeguarding',label:'Safeguarding Children',years:2,courses:{fa_safeguarding_children:'FA Safeguarding Children',fa_safeguarding_recertification:'FA Safeguarding Children recertification'},help:'The FA course is valid for two years. Record the completion and expiry dates shown on the qualification.',url:'https://learn.englandfootball.com/courses/safeguarding/safeguarding-children-course'},
    {kind:'first_aid',label:'First aid in football',years:3,courses:{fa_ifaif:'Introduction to First Aid in Football (IFAiF)',fa_efaif:'Emergency First Aid in Football (EFAiF)',other_first_aid:'Other first aid qualification'},help:'IFAiF is valid for three years. For any other course, use its recorded expiry and confirm acceptance with the County FA.',url:'https://learn.englandfootball.com/courses/medical/introduction-to-first-aid-in-football'},
    {kind:'coaching',label:'Coaching qualification',years:0,courses:{fa_i2cf:'Introduction to Coaching Football (I2CF)',fa_level_1:'FA Level 1 in Coaching Football',fa_level_2:'FA Level 2 in Coaching Football',uefa_c_diploma:'UEFA C diploma',uefa_b_diploma:'UEFA B diploma',uefa_a_diploma:'UEFA A diploma',uefa_pro_diploma:'UEFA Pro diploma'},help:'Record the coaching award separately from any UEFA licence. Leave expiry blank unless the award record states one.',url:'https://learn.englandfootball.com/courses/football/introduction-to-coaching-football'},
    {kind:'uefa_licence',label:'UEFA coaching licence',dateLabel:'Licence issued or renewed',years:3,optional:true,courses:{uefa_c:'UEFA C licence',uefa_b:'UEFA B licence',uefa_a:'UEFA A licence',uefa_pro:'UEFA Pro licence',uefa_youth_b:'UEFA Youth B licence',uefa_elite_youth_a:'UEFA Elite Youth A licence',uefa_goalkeeper_b:'UEFA Goalkeeper B licence',uefa_goalkeeper_a:'UEFA Goalkeeper A licence',uefa_futsal_b:'UEFA Futsal B licence'},help:'Add this if held. UEFA licences renew every three years; the diploma and current licence are separate records.',url:'https://www.uefa.com/development/coaches/uefa-coaching-licences/'}
  ];
  const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>['year','month','day'].includes(p.type)).sort((a,b)=>['year','month','day'].indexOf(a.type)-['year','month','day'].indexOf(b.type)).map(p=>p.value).join('-');
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
  function suggestedExpiry(completed,years){if(!validDate(completed)||!years)return '';const [y,m,d]=completed.split('-').map(Number),end=new Date(Date.UTC(y+years,m,0)).getUTCDate();return `${y+years}-${String(m).padStart(2,'0')}-${String(Math.min(d,end)).padStart(2,'0')}`;}
  function status(record,date=today()){
    if(!record)return{tone:'missing',label:'Not recorded'};
    if(record.expires_on){if(record.expires_on<date)return{tone:'expired',label:record.kind==='dbs'?'Renewal overdue':'Expired'};if(record.expires_on===date)return{tone:'due',label:'Due today'};const limit=new Date(date+'T00:00:00Z');limit.setUTCDate(limit.getUTCDate()+60);if(record.expires_on<=limit.toISOString().slice(0,10))return{tone:'due',label:'Due within 60 days'};}
    if(!record.club_checked)return{tone:'missing',label:'Needs club check'};
    return {tone:'current',label:record.expires_on?'In date':'Award recorded'};
  }
  function validate(record,date=today()){
    const item=catalogue.find(x=>x.kind===record.kind);if(!item||!Object.hasOwn(item.courses,record.course))throw Error('Choose a qualification from the list.');
    if(!validDate(record.completed_on)||record.completed_on>date||record.completed_on<'1900-01-01')throw Error('Enter a valid issue or completion date, up to today.');
    if(record.kind!=='coaching'&&!record.expires_on)throw Error('Enter the recorded expiry or renewal date.');
    if(record.expires_on&&(!validDate(record.expires_on)||record.expires_on<=record.completed_on))throw Error('Expiry or renewal must be after the issue or completion date.');
    return {kind:record.kind,course:record.course,completed_on:record.completed_on,expires_on:record.expires_on||null,club_checked:record.club_checked===true};
  }
  function response(data){
    if(!Array.isArray(data?.records)||data.records.length>5||data.revision===null||!Number.isSafeInteger(Number(data.revision))||Number(data.revision)<0)throw Error('Invalid qualification response');
    const seen=new Set();for(const record of data.records){validate(record);if(seen.has(record.kind))throw Error('Duplicate qualification');seen.add(record.kind);}
    return {...data,revision:Number(data.revision)};
  }
  let state=null,loadVersion=0,busy=false;
  function context(){const cloud=window.ClubHubCloud,profile=cloud?.context?.profile,role=cloud?.role?.();if(!cloud?.session?.user?.id||!profile?.club_id||!['admin','coach','assistant_coach'].includes(role)||cloud?.actingAsParent?.())return null;return{cloud,user:cloud.session.user.id,club:profile.club_id,role,editable:role==='admin'&&typeof isClubOverviewMode==='function'&&isClubOverviewMode()};}
  function same(s=state){const c=context();return !!(s&&c&&c.cloud===s.cloud&&c.user===s.user&&c.club===s.club&&c.role===s.role&&c.editable===s.editable&&el('coach-qualification-dialog')?.open);}
  function message(text,error=false){const node=el('coach-qualification-status');if(node){node.textContent=text;node.classList.toggle('qualification-error',error);}}
  function close(){loadVersion++;state=null;el('coach-qualification-editor')?.classList.add('hidden');const dialog=el('coach-qualification-dialog');if(dialog?.open)dialog.close();}
  function syncAccess(){const c=context(),button=el('coach-profile-self');button?.classList.toggle('hidden',!c);if(state&&!same())close();}
  function render(){
    if(!same()||!state.loaded)return;
    el('coach-qualification-list').innerHTML=catalogue.map(item=>{const record=state.records.find(r=>r.kind===item.kind),s=status(record);return `<article class="coach-qualification-row"><div><h4>${esc(item.label)}</h4><span class="qualification-state ${s.tone}">${esc(!record&&item.optional?'Not added (if held)':s.label)}</span>${record?`<p>${esc(item.courses[record.course]||'Qualification')}</p><p>${esc(item.dateLabel||'Completed')}: ${esc(record.completed_on)}<br>${esc(item.expiryLabel||'Expiry')}: ${record.expires_on?esc(record.expires_on):'No expiry recorded'}</p><p class="muted">${record.club_checked?'Club checked'+(record.checked_at?' · '+esc(String(record.checked_at).slice(0,10)):''):'Needs club check'}</p>`:''}</div>${state.editable?`<button type="button" class="secondary-button" data-edit-qualification="${item.kind}">${record?'Edit':'Add'}</button>`:''}</article>`;}).join('');
    el('coach-qualification-readonly').hidden=state.editable;
  }
  function edit(kind){
    if(!same()||!state.loaded||!state.editable||busy)return;
    const item=catalogue.find(x=>x.kind===kind);if(!item)return;const record=state.records.find(r=>r.kind===kind);
    state.editing=kind;el('coach-qualification-kind').value=kind;
    el('coach-qualification-course').innerHTML=Object.entries(item.courses).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('');
    el('coach-qualification-course').value=record?.course||Object.keys(item.courses)[0];
    el('coach-qualification-completed').value=record?.completed_on||'';el('coach-qualification-completed').max=today();
    el('coach-qualification-expiry').value=record?.expires_on||'';el('coach-qualification-expiry').required=kind!=='coaching';
    el('coach-qualification-date-label').textContent=item.dateLabel||'Completed';el('coach-qualification-expiry-label').textContent=(item.expiryLabel||'Expiry')+(kind==='coaching'?' (if stated)':'');
    el('coach-qualification-help').textContent=item.help;
    el('coach-qualification-source').href=item.url;
    el('coach-qualification-checked').checked=record?.club_checked===true;
    el('coach-qualification-check-label').textContent=kind==='dbs'?'FA acceptance and dates checked in Club Portal':'Club has checked this qualification and its dates';
    el('coach-qualification-remove').hidden=!record;el('coach-qualification-editor').classList.remove('hidden');el('coach-qualification-completed').focus();message('');
  }
  async function open(userId,name='Coach'){
    const c=context();if(!c||busy||(!c.editable&&userId!==c.user))return;
    const version=++loadVersion;state={...c,target:userId,records:[],revision:0,loaded:false,editing:''};
    el('coach-qualification-name').textContent=`Coach profile · ${name}`;el('coach-qualification-list').innerHTML='';el('coach-qualification-editor').classList.add('hidden');el('coach-qualification-readonly').hidden=true;
    const dialog=el('coach-qualification-dialog');if(!dialog.open)dialog.showModal();message('Loading qualifications…');
    try{const data=response(await c.cloud.getCoachQualifications(userId));if(version!==loadVersion||!same())return;
      state.records=data.records;state.revision=Number(data.revision);state.loaded=true;render();message('Recorded dates are checked by your club. FA Club Portal remains the source for acceptance.');
    }catch(_){if(version===loadVersion&&same())message('Qualifications are unavailable. Try again later or contact your Club Admin.',true);}
  }
  function setBusy(value){busy=value;const form=el('coach-qualification-form');for(const field of form?.querySelectorAll('input,select,button')||[])field.disabled=value;}
  function userError(error){return String(error?.code)==='40001'?'This profile changed elsewhere. Close and reopen it before saving.':'Could not save qualifications. Close and reopen the profile, then try again.';}
  async function write(records,s){
    if(!same(s)||state!==s||!s.editable)return;
    const version=loadVersion;
    try{const data=response(await s.cloud.saveCoachQualifications(s.target,records,s.revision));if(version!==loadVersion||state!==s||!same(s))return;
      s.records=data.records;s.revision=Number(data.revision);render();el('coach-qualification-editor').classList.add('hidden');message('Qualifications saved.');
    }catch(error){if(version===loadVersion&&state===s&&same(s))message(userError(error),true);}
  }
  async function save(event){
    event.preventDefault();if(busy||!same()||!state.loaded||!state.editable)return;
    let record,records;try{record=validate({kind:state.editing,course:el('coach-qualification-course').value,completed_on:el('coach-qualification-completed').value,expires_on:el('coach-qualification-expiry').value,club_checked:el('coach-qualification-checked').checked});records=state.records.filter(r=>r.kind!==record.kind).map(r=>validate(r));records.push(record);}catch(error){message(error.message,true);return;}
    const s=state;setBusy(true);message('Saving…');try{await write(records,s);}finally{setBusy(false);}
  }
  async function remove(){
    if(busy||!same()||!state.editable||!state.loaded||!state.editing)return;
    const s=state,kind=s.editing;if(!s.records.some(r=>r.kind===kind))return;setBusy(true);
    try{if(typeof appConfirm!=='function'||!await appConfirm({title:'Remove qualification record',body:'Remove these recorded dates from this coach profile?',detail:'The qualification itself is unchanged.',confirmLabel:'Remove record'}))return;
      if(!same(s)||state!==s||s.editing!==kind)return;
      await write(s.records.filter(r=>r.kind!==kind).map(r=>validate(r)),s);
    }finally{setBusy(false);}
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-coach-profile]');if(target){const c=context(),id=target.dataset.coachProfile;if(!c?.editable)return;const rows=typeof __adminCoachRows!=='undefined'?__adminCoachRows:[],access=typeof __adminAccessRows!=='undefined'?__adminAccessRows:[];const person=[...rows,...access].find(r=>r.user_id===id&&['club_admin','coach','assistant_coach'].includes(r.role));if(person)open(id,person.full_name||'Coach');return;}
    const row=event.target.closest?.('[data-edit-qualification]');if(row)edit(row.dataset.editQualification);
    if(event.target.closest?.('#coach-profile-self')){const c=context();if(c)open(c.user,c.cloud.context.profile.full_name||'My profile');}
    if(event.target.closest?.('#coach-qualification-close'))close();
  });
  el('coach-qualification-form')?.addEventListener('submit',save);el('coach-qualification-remove')?.addEventListener('click',remove);
  for(const id of ['coach-qualification-completed','coach-qualification-expiry','coach-qualification-course'])el(id)?.addEventListener('input',()=>{
    el('coach-qualification-checked').checked=false;
    if(id==='coach-qualification-completed'&&!el('coach-qualification-expiry').value){const item=catalogue.find(x=>x.kind===state?.editing);const years=item?.kind==='first_aid'&&el('coach-qualification-course').value!=='fa_ifaif'?0:item?.years;el('coach-qualification-expiry').value=suggestedExpiry(el('coach-qualification-completed').value,years);}
  });
  el('coach-qualification-dialog')?.addEventListener('close',()=>{loadVersion++;state=null;});
  window.ClubHubCoachQualifications={syncAccess,open,catalogue,today,validDate,suggestedExpiry,status,validate};
  syncAccess();
})();
