/* Reviewed Figma 653:11523 · 12 November 2026.
   Staff-only per-fixture choice before sharing/copying a match. */
let matchKitShareDraft=null;
let matchKitShareBusy=false;

function matchKitShareData(manualMatch=null) {
  if(!canConfirmFixtureDetails()){toast('Coach access is required');return null;}
  const manual=!!manualMatch&&typeof manualMatch==='object';
  const source=manual?manualMatch:nextPublishedFixture();
  if(!source){toast('No fixture available');return null;}
  if(manual&&(!isCoach()||isPlayedMatch(source))){toast('This fixture cannot be shared');return null;}
  const selection=manual
    ?{fixture:source,group:null,confirmed:true,details:{...source,time:source.time||'Unconfirmed',groundName:source.groundName||'Unconfirmed',address:source.address||'Unconfirmed'}}
    :matchdayShareFixture(source);
  const {fixture,group,confirmed,details}=selection;
  if(!manual&&(!confirmed||!matchdayArrivalTime(details.time)||!details.groundName||!details.address)){
    toast(group?'Confirm group start time and venue before sharing':'Confirm kick-off and venue before sharing');
    document.getElementById('next-match-confirm-time')?.focus();
    return null;
  }
  return {source,fixture,group,details,manual,key:fixtureKitSelectionKey(fixture)};
}

function syncMatchKitShareOptions(){
  const dlg=document.getElementById('match-share-kit-dialog');
  if(!dlg)return;
  dlg.querySelectorAll('.match-share-kit-option').forEach(option=>{
    const input=option.querySelector('input');
    option.classList.toggle('is-selected',!!input?.checked);
    option.setAttribute('aria-disabled',input?.disabled?'true':'false');
  });
}
function openMatchKitSharePicker(manualMatch=null){
  if(matchKitShareBusy)return;
  const data=matchKitShareData(manualMatch);
  if(!data)return;
  const dlg=document.getElementById('match-share-kit-dialog');
  if(!dlg)return toast('Kit selection is not available. Please try again');
  const own=fixtureOverviewContext(data.details),profile=own.ownProfile||{},home=kitColourDisplayText(profile.home),away=kitColourDisplayText(profile.away),awayKnown=knownKit(profile.away);
  const names=homeFixtureTeamNames(data.fixture);
  document.getElementById('match-share-kit-fixture').textContent=names.home+' v '+names.away;
  document.getElementById('match-share-kit-when').textContent=shareDateText(data.fixture.date)+' · '+(data.details.time||'Time TBC')+' · '+(data.details.groundName||'Venue TBC');
  document.getElementById('match-share-kit-home-colours').textContent=home;
  document.getElementById('match-share-kit-away-colours').textContent=awayKnown?away:'Not recorded';
  document.getElementById('match-share-kit-home-visual').innerHTML=teamKitIconHtml(own.ownTeam,profile.home);
  document.getElementById('match-share-kit-away-visual').innerHTML=awayKnown?teamKitIconHtml(own.ownTeam,profile.away):'—';
  const h=document.getElementById('match-share-kit-home'),a=document.getElementById('match-share-kit-away');
  a.disabled=!awayKnown;
  document.getElementById('match-share-kit-missing').classList.toggle('hidden',awayKnown);
  const selected=fixtureKitChoice(data.fixture);
  h.checked=selected!=='away'||!awayKnown;a.checked=selected==='away'&&awayKnown;
  matchKitShareDraft=data;
  syncMatchKitShareOptions();
  if(!dlg.open)dlg.showModal();
  (a.checked?a:h).focus({preventScroll:true});
}

async function copyMatchKitShareCaption(caption){
  try{
    await navigator.clipboard.writeText(caption);
    toast('Match details copied for WhatsApp');
  }catch{
    const field=document.createElement('textarea');
    field.value=caption;field.style.position='fixed';field.style.opacity='0';
    document.body.appendChild(field);field.select();
    let copied=false;
    try{copied=document.execCommand('copy');}catch(_){}
    field.remove();
    toast(copied?'Match details copied for WhatsApp':'Could not copy match details');
  }
}

async function finishMatchKitShare(mode){
  if(matchKitShareBusy||!matchKitShareDraft)return;
  matchKitShareBusy=true;
  try{
    if(!canConfirmFixtureDetails()){toast('Coach access is required');return;}
    const draft=matchKitShareDraft;
    const source=draft.manual?(state.matches||[]).find(m=>m.id===draft.source.id):nextPublishedFixture();
    if(!source){toast('Fixture no longer available. Open match sharing again');return;}
    const latest=matchKitShareData(draft.manual?source:null);
    if(!latest||latest.key!==draft.key){
      toast('Match details have changed. Open sharing again');
      return;
    }
    // Read the specific control: other fixture dialogs can contain a home-kit input.
    const choice=document.getElementById('match-share-kit-away')?.checked===true?'away':'home';
    const own=fixtureOverviewContext(latest.details);
    if(choice==='away'&&!knownKit(own.ownProfile?.away)){
      toast('Add the away shirt colours in Club details first');return;
    }
    if(choice!==fixtureKitChoice(latest.fixture)){
      // Reuse the existing audited fixture-specific state write, not the team's kit profile.
      if(setFixtureKitChoice(latest.key,choice,{silent:true})!==true)return;
    }
    document.getElementById('match-share-kit-dialog')?.close();
    if(mode==='copy'){
      if(draft.manual){
        const caption=matchdayShareCaption(latest.fixture,latest.details,homeFixtureTeamNames(latest.fixture),fixtureOverviewContext(latest.details));
        await copyMatchKitShareCaption(caption);
      }else await copyNextMatchDetails();
    }else await shareNextMatchImage(draft.manual?source:null);
  }finally{matchKitShareBusy=false;}
}
document.getElementById('match-share-kit-options')?.addEventListener('change',syncMatchKitShareOptions);
document.getElementById('match-share-kit-image')?.addEventListener('click',()=>finishMatchKitShare('image'));
document.getElementById('match-share-kit-copy')?.addEventListener('click',()=>finishMatchKitShare('copy'));
document.getElementById('match-share-kit-cancel')?.addEventListener('click',()=>document.getElementById('match-share-kit-dialog')?.close());
document.getElementById('match-share-kit-dialog')?.addEventListener('close',()=>{matchKitShareDraft=null;});
