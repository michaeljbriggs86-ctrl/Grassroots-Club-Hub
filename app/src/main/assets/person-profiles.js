/* Individual screens. Private details stay in the active DOM only. */
(()=>{
  'use strict';
  let options,identity='',cloudIdentity=null,sequence=0,version=0,selected='',snapshot=null;
  const targets=new Map(),el=id=>document.getElementById(id);
  const clear=()=>{version++;snapshot=null;const body=el('person-profile-body');if(body)body.innerHTML='';const title=el('person-profile-name');if(title)title.textContent='Person details';const status=el('person-profile-status');if(status)status.textContent='';};
  function syncAccess(){const key=options?.contextKey()||'',cloud=options?.cloud();if(key!==identity||cloud!==cloudIdentity){identity=key;cloudIdentity=cloud;targets.clear();selected='';clear();options?.onLeave?.();}return key;}
  function reset(){identity='';cloudIdentity=null;targets.clear();selected='';clear();options?.onLeave?.();}
  function isActive(){return options?.currentView()==='person';}
  function same(v,key,target){return v===version&&key===options?.contextKey()&&key===identity&&options?.cloud()===cloudIdentity&&target===selected&&isActive();}
  async function enter(){
    const key=syncAccess();clear();const v=version,target=selected,entry=targets.get(target);
    if(!key||!entry){el('person-profile-status').textContent='Select a name from your team or club list to view their details.';return;}
    el('person-profile-status').textContent='Loading person details…';
    try{
      const result=await options.resolve(entry.target);
      if(!same(v,key,target))return;
      if(!result)throw Error('Profile unavailable');
      snapshot=result;el('person-profile-name').textContent=result.name||'Person details';
      el('person-profile-body').innerHTML=result.html;
      el('person-profile-status').textContent=result.notice||'';
      el('person-profile-name').focus({preventScroll:true});
    }catch(_){if(same(v,key,target))el('person-profile-status').textContent='These details are unavailable for your current access. Return to the list and try again.';}
  }
  function open(target){
    if(!syncAccess()||!target)return;
    const returnView=isActive()?(targets.get(selected)?.returnView||options.defaultView()):options.route();
    const focus=document.activeElement;
    selected='profile-'+(++sequence);targets.set(selected,{target,returnView,focus});
    options.navigate('person');
  }
  function restore(key){selected=targets.has(key)?key:'';}
  function back(){const entry=targets.get(selected),key=selected;clear();options.back(key,entry?.returnView||options.defaultView());}
  function leave(){clear();options?.onLeave?.();}
  function selectedSnapshot(){return isActive()&&syncAccess()&&snapshot?snapshot:null;}
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-person-profile]');
    if(target){open({kind:'member',id:target.dataset.personProfile,source:target.dataset.profileSource||'contact',teamId:target.dataset.profileTeam||''});return;}
    if(event.target.closest?.('#person-profile-self')){open(options?.ownTarget());return;}
    if(event.target.closest?.('#person-profile-back')){back();return;}
    const action=event.target.closest?.('[data-person-action]');
    if(action){const person=selectedSnapshot();if(person)options.action(action.dataset.personAction,person,action);}
  });
  window.addEventListener('clubhub-contacts-clear',reset);
  window.ClubHubPersonProfiles={configure:value=>{options=value;syncAccess();},open,enter,refresh:enter,leave,
    syncAccess,reset,restore,selectedSnapshot,isActive,historyKey:()=>selected,
    selectedTarget:()=>syncAccess()?targets.get(selected)?.target||null:null};
})();
