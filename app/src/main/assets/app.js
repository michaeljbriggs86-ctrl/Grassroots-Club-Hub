const STORAGE_KEY = 'grassrootsHub_team_state_v1';
const ROLE_KEY = 'grassrootsHub_role_v1';
const ACCOUNT_KEY = 'grassrootsHub_account_v1';
const ADMIN_UI_MODE_KEY = 'grassrootsHub_admin_ui_mode_v1';
const SELKENT_PUBLISHED_AGES_KEY = 'grassrootsHub_published_league_ages_v1';
const SELKENT_RESULTS_AGES_FALLBACK = ['U12X','U12','U13','U14X','U14','U15','U16','U17','Senior'];
const DEFAULT_AWARD_TYPE = 'Player of the Match';
const FIXTURE_SCAN_INTERVAL_MS = 5*60*1000;
const BUILD_MODE = new URLSearchParams(location.search).get('build') || 'standard';
const IS_ADMIN_BUILD = BUILD_MODE === 'admin';
const IS_PARENT_BUILD = BUILD_MODE === 'parent';
const IS_COACH_BUILD = BUILD_MODE === 'coach';
const THEME_KEY = 'grassrootsHub_theme_v1';
function themePreference(){return localStorage.getItem(THEME_KEY)||'dark';}
function resolvedTheme(pref=themePreference()){return pref==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):pref;}
function applyTheme(pref=themePreference()){const clean=['light','dark','system'].includes(pref)?pref:'system';localStorage.setItem(THEME_KEY,clean);document.documentElement.dataset.theme=resolvedTheme(clean);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',document.documentElement.dataset.theme==='dark'?'#0f1712':'#0B5D35');const sel=document.getElementById('appearance-theme');if(sel)sel.value=clean;}
applyTheme(themePreference());
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(themePreference()==='system')applyTheme('system');});}catch{}

let CLUB_CONFIGURATION=null;
const UNIVERSAL_FALLBACK_SETTINGS={slug:'club',display_name:'Your Club',short_name:'Club',primary_color:'#0B5D35',secondary_color:'#ffffff',accent_color:'#168848',logo_asset:'',current_season:'2026/27',default_provider_key:'manual',results_publish_from_age:null,player_account_age_groups:[]};
function clubSettings(){return CLUB_CONFIGURATION?.settings||UNIVERSAL_FALLBACK_SETTINGS;}
function clubRules(){return Array.isArray(CLUB_CONFIGURATION?.rules)?CLUB_CONFIGURATION.rules:[];}
function competitionRuleForAge(age=ageGroupNumber()){return clubRules().find(r=>Number(r.age_group)===Number(age))||null;}
function clubProviders(){return Array.isArray(CLUB_CONFIGURATION?.providers)?CLUB_CONFIGURATION.providers:[];}
function primaryProvider(){return clubProviders().find(p=>p.is_primary)||clubProviders()[0]||{provider_key:'manual',provider_type:'manual',enabled:true,config:{}};}
function providerType(){return String(primaryProvider()?.provider_type||clubSettings().default_provider_key||'manual').toLowerCase();}
function playerAccountsAllowedForAge(age=ageGroupNumber()){const rule=competitionRuleForAge(age);if(rule)return !!rule.player_accounts_allowed;return (clubSettings().player_account_age_groups||[]).map(Number).includes(Number(age));}
function configuredClubTeams(){return (CLUB_CONFIGURATION?.teams||[]).map(t=>({id:t.id,selkentName:t.selkent_label||`Under ${t.age_group}s ${t.name}`,ageGroup:`U${t.age_group}`,teamName:t.name,leagueName:t.league_name||`${clubSettings().display_name} ${t.name}`,division:t.division||'',season:t.season||clubSettings().current_season||'2026/27'}));}
function hexMix(hex,other='#ffffff',weight=.84){try{const a=hex.replace('#',''),b=other.replace('#','');const n=i=>parseInt(i,16);const ar=n(a.slice(0,2)),ag=n(a.slice(2,4)),ab=n(a.slice(4,6)),br=n(b.slice(0,2)),bg=n(b.slice(2,4)),bb=n(b.slice(4,6));const mix=(x,y)=>Math.round(x*(1-weight)+y*weight).toString(16).padStart(2,'0');return '#'+mix(ar,br)+mix(ag,bg)+mix(ab,bb);}catch{return '#e8f5e8';}}
function applyClubConfiguration(config){
  if(!config?.settings)return;CLUB_CONFIGURATION=config;window.__CLUB_CONFIGURATION=config;
  const s=clubSettings(),root=document.documentElement;root.style.setProperty('--green',s.primary_color||'#218a21');root.style.setProperty('--green-2',s.accent_color||s.primary_color||'#145f19');root.style.setProperty('--green-3',hexMix(s.primary_color||'#218a21','#ffffff',.88));
  root.style.setProperty('--club-secondary',s.secondary_color||'#ffffff');
  const meta=document.querySelector('meta[name="theme-color"]');if(meta&&resolvedTheme()!=='dark')meta.content=s.primary_color||'#218a21';document.title=`${s.display_name||'Club'} Team Hub`;
  const desc=document.querySelector('meta[name="description"]');if(desc)desc.content=`Team management hub for ${s.display_name||'your club'}.`;
  const clubEl=document.getElementById('hero-club-name');if(clubEl)clubEl.textContent=(s.display_name||'Club').toUpperCase();
  const logo=s.logo_url||s.logo_asset||'';document.querySelectorAll('.club-logo').forEach(img=>{img.src=logo||'pitchkind-wt_mark.svg';img.alt=logo?`${s.display_name||'Club'} logo`:'PitchKind placeholder';img.style.display='';});
  const wrap=document.querySelector('.club-logo-wrap');if(wrap){wrap.classList.toggle('platform-club-placeholder',!logo);wrap.classList.remove('generic-club-mark');delete wrap.dataset.short;wrap.setAttribute('aria-label',logo?((s.display_name||'Club')+' logo'):'Club logo unavailable — PitchKind placeholder');}
  configureOpponentEditorForProvider();
  if(typeof state!=='undefined'&&state){state.meta=state.meta||{};state.meta.clubName=s.display_name||state.meta.clubName;state.meta.season=s.current_season||state.meta.season;const p=primaryProvider(),pc=p?.config||{};state.selkent=state.selkent||{};state.selkent.enabled=providerType()==='selkent';if(providerType()==='selkent'){state.selkent.clubUrl=pc.club_url||state.selkent.clubUrl;state.selkent.divisionsUrl=pc.divisions_url||state.selkent.divisionsUrl;state.selkent.fixturesUrl=pc.fixtures_url||state.selkent.fixturesUrl;state.selkent.resultsUrl=pc.results_url||state.selkent.resultsUrl;}else{state.selkent.status='Manual competition provider';state.selkent.fixtures=state.selkent.fixtures||[];state.selkent.results=[];state.selkent.table=[];}}
}

const FOOTBALL_FORMATS = {
  8:{format:'5v5',onPitch:5,registered:10,matchday:10},
  9:{format:'5v5',onPitch:5,registered:10,matchday:10},
  10:{format:'7v7',onPitch:7,registered:14,matchday:14},
  11:{format:'7v7',onPitch:7,registered:14,matchday:14},
  12:{format:'9v9',onPitch:9,registered:16,matchday:14},
  13:{format:'9v9',onPitch:9,registered:16,matchday:14},
  14:{format:'11v11',onPitch:11,registered:18,matchday:16},
  15:{format:'11v11',onPitch:11,registered:18,matchday:16},
  16:{format:'11v11',onPitch:11,registered:18,matchday:16},
  17:{format:'11v11',onPitch:11,registered:18,matchday:16}
};
const SELKENT_DIRECTORY_API='https://obntycksmkcnkprrcutg.supabase.co/functions/v1/selkent-directory';
function footballFormat(){const r=competitionRuleForAge(ageGroupNumber());if(r)return{format:r.format,onPitch:Number(r.players_on_pitch),registered:Number(r.max_registered),matchday:Number(r.matchday_max),rollingSubstitutions:!!r.rolling_substitutions};return FOOTBALL_FORMATS[ageGroupNumber()]||FOOTBALL_FORMATS[14];}

function dismissOpeningSplash(){
  const splash=document.getElementById('app-splash');
  if(!splash)return;
  splash.classList.add('splash-hide');document.body.classList.remove('splash-active');
  setTimeout(()=>splash.remove(),520);
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(dismissOpeningSplash,1150));


const GENERIC_STARTER_TEAMS = [];

const STARTER_DATA = {
  meta: { clubName: 'Your Club', teamName: 'Team', ageGroup: 'U9', season: '2026/27' },
  division: { name: '', teamName: 'Team', meetingsPerOpponent: 2, teams: ['Team'] },
  squad: [],
  tournaments: [],
  matches: [],
  goals: [],
  assists: [],
  bookings: [],
  features: { goals:true, assists:true, awards:true, bookings:true },
  leagueResults: [],
  selkent: {
    enabled: false,
    divisionsUrl: '',
    fixturesUrl: '',
    resultsUrl: '',
    clubUrl: '',
    clubTeams: GENERIC_STARTER_TEAMS,
    lastClubSync: '', lastDivisionSync: '', lastTableSync: '', lastSync: '',
    status: 'Choose or configure a competition provider.',
    publishedLeagueAges: SELKENT_RESULTS_AGES_FALLBACK,
    competitionMode: 'auto', lastCompetitionCheck: '', lastFixtureScan: '',
    fixtureTracking: {}, fixtureAcknowledgement: {}, kitColours: {}, kitProfiles: {}, directoryDetails: {},
    fixtures: [], results: [], table: []
  },
  awardTypes: [DEFAULT_AWARD_TYPE],
  tactics: {lineup:[],positions:{},formation:'',formationByFixture:{},activeFixtureKey:'',matchdaySelections:{},matchdayAutoPrepared:{}},
  awards: []
};

function repairStateIdentity(input){
  const s=input||{};
  const a=String(s.meta?.ageGroup||'').match(/\d{1,2}/), d=String(s.division?.name||'').match(/(?:Under\s*|U\s*)(\d{1,2})/i);
  if(a&&d&&Number(a[0])!==Number(d[1])){
    s.division.name='';s.division.teams=[s.division.teamName].filter(Boolean);
    s.selkent=s.selkent||{};s.selkent.lastSync='';s.selkent.lastDivisionSync='';s.selkent.lastTableSync='';s.selkent.table=[];s.selkent.results=[];s.selkent.fixtures=[];s.selkent.status='Team age changed — Selkent Divisions will identify the correct division.';
  }
  const rawTeams=Array.isArray(s.division?.teams)?s.division.teams:[];
  const rawTable=Array.isArray(s.selkent?.table)?s.selkent.table:[];
  const suspicious=rawTeams.length>24||rawTable.length>24||rawTeams.some(v=>/[{}<>;=]|\b(function|document|window|queryselector|addeventlistener|javascript)\b/i.test(String(v||'')))||rawTable.some(r=>/[{}<>;=]|\b(function|document|window|queryselector|addeventlistener|javascript)\b/i.test(String(r?.team||'')));
  if(suspicious){
    s.division=s.division||{};s.division.teams=[s.division.teamName].filter(Boolean);
    s.selkent=s.selkent||{};s.selkent.table=[];s.selkent.results=[];s.selkent.lastTableSync='';s.selkent.lastDivisionSync='';s.selkent.lastSync='';s.selkent.status='Invalid Selkent page data was removed. Run Selkent sync again.';
  }
  s.tournaments=Array.isArray(s.tournaments)?s.tournaments:[];
  const legacyTournamentGroups=new Map();
  (s.matches||[]).filter(m=>/tournament/i.test(String(m?.competition||m?.type||''))&&!m.tournamentId).forEach(m=>{const key=`${m.date||''}|${String(m.competition||'Tournament').toLowerCase()}`;if(!legacyTournamentGroups.has(key))legacyTournamentGroups.set(key,[]);legacyTournamentGroups.get(key).push(m);});
  legacyTournamentGroups.forEach((games,key)=>{const existing=s.tournaments.find(t=>t.date===(games[0]?.date||'')&&String(t.name||'').toLowerCase()===String(games[0]?.competition||'Tournament').toLowerCase());const id=existing?.id||`tlegacy_${String(key).replace(/[^a-z0-9]+/gi,'_')}`;if(!existing)s.tournaments.push({id,name:games[0]?.competition||'Tournament',date:games[0]?.date||'',location:'',format:'group_knockout',playerNames:[]});games.forEach(m=>m.tournamentId=id);});
  return s;
}
let state = repairStateIdentity(loadState());
let account = loadAccount();
let currentView = 'home';
let currentRole = IS_ADMIN_BUILD || BUILD_MODE === 'standard' || BUILD_MODE === 'cloud' ? 'admin' : IS_PARENT_BUILD ? 'parent' : 'coach';
const CLOUD_MODE = !!window.ClubHubCloud?.configured?.();
let cloudBootContext = null;
const __savedAdminMode=localStorage.getItem(ADMIN_UI_MODE_KEY);
let adminUiMode=__savedAdminMode==='coach'?'coach':'club';

function isAdminCoachMode(){ return CLOUD_MODE && isAdmin() && adminUiMode==='coach'; }
function isAdminTeamPreviewMode(){ return CLOUD_MODE && isAdmin() && adminUiMode==='view'; }
function isClubOverviewMode(){ return CLOUD_MODE && isAdmin() && adminUiMode==='club'; }
function dualCoachTeam(){ return CLOUD_MODE ? (window.ClubHubCloud?.coachTeam?.()||null) : null; }
function hasDualAdminCoach(){ return CLOUD_MODE && isAdmin() && !!dualCoachTeam(); }
async function setAdminUiMode(mode){
  if(!isAdmin())return;
  const next=mode==='coach'?'coach':mode==='view'?'view':'club';
  const previous=adminUiMode;
  adminUiMode=next;
  localStorage.setItem(ADMIN_UI_MODE_KEY,adminUiMode);
  try{
    if(next==='coach'){
      const own=dualCoachTeam();
      if(!own)throw new Error('This Club Admin account does not also have Coach access.');
      if(window.ClubHubCloud?.currentTeam?.()?.id!==own.id)await switchAdminTeamAndLoad(own);
    }
    renderAll();
    navigate(next==='club'?'club':'home',false);
    toast(next==='coach'?'Coach profile enabled':next==='view'?'Team preview opened':'Club overview enabled');
  }catch(err){
    adminUiMode=previous;
    localStorage.setItem(ADMIN_UI_MODE_KEY,adminUiMode);
    renderAll();
    toast(err?.message||'Could not switch view');
  }
}

function loadAccount(){
  try{
    const raw=localStorage.getItem(ACCOUNT_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed&&parsed.team&&parsed.role?parsed:null;
  }catch{return null;}
}
function saveAccount(value){ account=value||null; if(account)localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account)); else localStorage.removeItem(ACCOUNT_KEY); }
function isAdmin(){ return CLOUD_MODE ? currentRole==='admin' : (IS_ADMIN_BUILD || BUILD_MODE === 'standard' || currentRole === 'admin'); }
function assignmentRequired(){ return CLOUD_MODE ? false : (IS_COACH_BUILD || IS_PARENT_BUILD); }
function assignedTeam(){
  if(CLOUD_MODE&&isAdminCoachMode())return dualCoachTeam();
  if(CLOUD_MODE&&isAdminTeamPreviewMode())return window.ClubHubCloud?.currentTeam?.()||null;
  return CLOUD_MODE ? (window.ClubHubCloud?.assignedTeam?.()||null) : (account?.team||null);
}
function isTeamLocked(){
  if(CLOUD_MODE&&(isAdminCoachMode()||isAdminTeamPreviewMode()))return !!assignedTeam();
  return CLOUD_MODE ? (!isAdmin() && !!assignedTeam()) : (!isAdmin() && !!assignedTeam());
}
function roleLabel(){ return currentRole==='admin'?'Club Admin':currentRole==='assistant_coach'?'Assistant Coach':currentRole==='parent'?'Parent':currentRole==='player'?'Player':currentRole==='pending_parent'?'Parent awaiting approval':'Coach'; }
function b64urlEncodeText(text=''){
  const bytes=new TextEncoder().encode(text);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecodeText(input=''){
  let s=String(input).replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);
}
function nativeSignAssignment(payloadB64){
  try{ return window.ClubHubNative?.signAssignment ? String(window.ClubHubNative.signAssignment(payloadB64)||'') : ''; }catch{return '';}
}
function nativeVerifyAssignment(payloadB64,signature){
  try{ return !!(window.ClubHubNative?.verifyAssignment && window.ClubHubNative.verifyAssignment(payloadB64,signature)); }catch{return false;}
}
function teamIdentityMatches(team){
  if(!team)return false;
  return selkentNorm(state.division?.teamName||'')===selkentNorm(team.leagueName||'') && String(state.meta?.ageGroup||'')===String(team.ageGroup||'');
}
function blankStateForTeam(team){
  const starter=cloneStarter();
  return normalizeState({
    meta:{clubName:clubSettings().display_name||starter.meta.clubName,teamName:team.teamName,ageGroup:team.ageGroup,season:team.season||clubSettings().current_season||starter.meta.season},
    division:{name:team.division||'',teamName:team.leagueName,meetingsPerOpponent:2,teams:[team.leagueName]},
    squad:[],matches:[],goals:[],assists:[],bookings:[],features:{goals:competitionRuleForAge(Number(String(team.ageGroup||'').replace(/\D/g,'')))?.stats_config?.goals!==false,assists:competitionRuleForAge(Number(String(team.ageGroup||'').replace(/\D/g,'')))?.stats_config?.assists!==false,awards:competitionRuleForAge(Number(String(team.ageGroup||'').replace(/\D/g,'')))?.stats_config?.awards!==false,bookings:competitionRuleForAge(Number(String(team.ageGroup||'').replace(/\D/g,'')))?.stats_config?.bookings!==false},leagueResults:[],awardTypes:[DEFAULT_AWARD_TYPE],awards:[],
    selkent:{...starter.selkent,clubTeams:Array.isArray(state?.selkent?.clubTeams)&&state.selkent.clubTeams.length?state.selkent.clubTeams:starter.selkent.clubTeams,status:'Team ready. League information updates automatically.'}
  });
}
function enforceAssignedTeam(persist=false){
  const team=assignedTeam();if(!team)return;
  const oldSelf=state.division?.teamName||'';
  state.meta.teamName=team.teamName;
  state.meta.ageGroup=team.ageGroup;
  state.division.teamName=team.leagueName;
  if(!Array.isArray(state.division.teams))state.division.teams=[];
  const idx=state.division.teams.findIndex(t=>selkentNorm(t)===selkentNorm(oldSelf));
  if(idx>=0)state.division.teams[idx]=team.leagueName;
  if(!state.division.teams.some(t=>selkentNorm(t)===selkentNorm(team.leagueName)))state.division.teams.push(team.leagueName);
  if(persist)persistLocalState();
}
function updateActivationGate(){
  // Cloud authentication owns the opening screen. Do not let the legacy
  // device-activation logic reveal the dashboard underneath it.
  if(CLOUD_MODE)return;
  const gate=document.getElementById('activation-gate');
  const shell=document.querySelector('.app-shell');
  const needed=assignmentRequired()&&!account;
  if(gate)gate.classList.toggle('hidden',!needed);
  if(shell)shell.classList.toggle('account-locked',needed);
  const title=document.getElementById('activation-role-title');
  const copy=document.getElementById('activation-role-copy');
  if(title)title.textContent=IS_PARENT_BUILD?'Activate parent access':'Activate coach access';
  if(copy)copy.textContent=IS_PARENT_BUILD?'Paste the Parent access code supplied by your club administrator.':'Paste the Coach access code supplied by your club administrator.';
}
function decodeAssignmentToken(token=''){
  const parts=String(token).trim().split('.');
  if(parts.length!==3||parts[0]!=='CH1')throw new Error('That is not a valid club access code.');
  const payloadB64=parts[1],signature=parts[2];
  const payload=JSON.parse(b64urlDecodeText(payloadB64));
  if(!payload?.team?.selkentName||!payload?.team?.ageGroup||!payload?.team?.teamName||!payload?.team?.leagueName)throw new Error('The access code is missing its team assignment.');
  if(!['coach','assistant_coach','parent'].includes(payload.role))throw new Error('The access code has an invalid role.');
  return{payload,payloadB64,signature};
}
function activateAssignment(){
  const input=document.getElementById('activation-code');const feedback=document.getElementById('activation-error');
  try{
    const decoded=decodeAssignmentToken(input?.value||'');
    const expected=IS_PARENT_BUILD?'parent':IS_COACH_BUILD?'coach':decoded.payload.role;
    if(decoded.payload.role!==expected)throw new Error(`This code is for ${decoded.payload.role} access, not ${expected} access.`);
    const verified=nativeVerifyAssignment(decoded.payloadB64,decoded.signature);
    if(!verified)throw new Error('This access code could not be verified. Ask your club administrator for a new code.');
    const previousMatches=teamIdentityMatches(decoded.payload.team);
    saveAccount({...decoded.payload,token:String(input.value).trim()});
    currentRole=decoded.payload.role;
    if(!previousMatches)state=blankStateForTeam(decoded.payload.team);
    enforceAssignedTeam(true);
    if(feedback){feedback.textContent='';feedback.classList.add('hidden');}
    updateActivationGate();renderAll();navigate('home',false);toast(`${roleLabel()} access activated`);
    setTimeout(()=>syncSelkent(true),600);
  }catch(err){if(feedback){feedback.textContent=err.message||String(err);feedback.classList.remove('hidden');}}
}
function adminAssignmentTeam(){
  const select=document.getElementById('assignment-team');
  const id=select?.value||'';
  if(!id)return null;
  return (window.ClubHubCloud?.visibleTeamList?.()||[]).find(t=>t.id===id)||null;
}
function updateAssignmentRoleUi(){
  const role=document.getElementById('assignment-role')?.value||'coach';
  const teamLabel=document.getElementById('assignment-team-label');
  if(teamLabel)teamLabel.classList.toggle('hidden',role==='club_admin');
}
function renderAssignmentTeamOptions(){
  const select=document.getElementById('assignment-team');if(!select)return;
  const list=window.ClubHubCloud?.visibleTeamList?.()||[];
  const prev=select.value;
  select.innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc(t.ageGroup+' '+t.teamName)}</option>`).join('');
  if(list.some(t=>t.id===prev))select.value=prev;
  else{
    const activeId=window.ClubHubCloud?.currentTeam?.()?.id||'';
    const cur=list.find(t=>t.id===activeId) || list.find(t=>t.ageGroup===state.meta.ageGroup&&selkentNorm(t.leagueName)===selkentNorm(state.division.teamName));
    if(cur)select.value=cur.id;
  }
  updateAssignmentRoleUi();
}
async function generateAssignmentCode(){
  if(!isAdmin()){toast('Club Admin access is required.');return;}
  if(!CLOUD_MODE){toast('Cloud access is required to create invites.');return;}
  const role=document.getElementById('assignment-role')?.value||'coach';
  const team=role==='club_admin'?null:adminAssignmentTeam();
  if(role!=='club_admin'&&!team){alert('Choose a team.');return;}
  try{
    const invite=await window.ClubHubCloud.createInvite({teamId:team?.id||null,role,label:'',expiresHours:168});
    const out=document.getElementById('assignment-code-output');if(out)out.value=invite?.code||invite?.invite_code||'';
    const meta=document.getElementById('assignment-code-meta');
    if(meta)meta.textContent=role==='club_admin'
      ? 'Club Admin · club-wide access · expires in 7 days'
      : `${role==='assistant_coach'?'Assistant Coach':role==='coach'?'Coach':'Parent'} · ${team.ageGroup} ${team.teamName} · expires in 7 days`;
    toast('Invite code created');
  }catch(err){alert('Could not create invite: '+(err.message||err));}
}
async function copyAssignmentCode(){
  const out=document.getElementById('assignment-code-output');if(!out?.value)return;
  try{await navigator.clipboard.writeText(out.value);toast('Access code copied');}catch{out.select();document.execCommand('copy');toast('Access code copied');}
}

function cloneStarter(){ return JSON.parse(JSON.stringify(STARTER_DATA)); }
function normalizeState(data={}){
  const starter = cloneStarter();
  const oldMeta = data.meta || {};
  const rawSquad = Array.isArray(data.squad) ? data.squad : starter.squad;
  const squad = rawSquad
    .filter(p => p && String(p.name || '').trim())
    .map(p => ({
      number: Number(p.number) || 0,
      name: String(p.name || '').trim(),
      status: p.status === 'inactive' ? 'inactive' : 'active',
      role: p.role === 'goalkeeper' ? 'goalkeeper' : 'outfield'
    }))
    .filter(p => p.number > 0);

  let legacyTeamName = oldMeta.teamName;
  if(!legacyTeamName && oldMeta.club){
    legacyTeamName = oldMeta.club;
  }

  const d = data.division || {};
  return {
    meta: {
      clubName: clubSettings().display_name || oldMeta.clubName || starter.meta.clubName,
      teamName: legacyTeamName || starter.meta.teamName,
      ageGroup: oldMeta.ageGroup || oldMeta.age || starter.meta.ageGroup,
      season: oldMeta.season || clubSettings().current_season || starter.meta.season
    },
    division: {
      name: Object.prototype.hasOwnProperty.call(d,'name') ? String(d.name||'') : starter.division.name,
      teamName: Object.prototype.hasOwnProperty.call(d,'teamName') ? String(d.teamName||'') : starter.division.teamName,
      meetingsPerOpponent: Number(d.meetingsPerOpponent || starter.division.meetingsPerOpponent) || 2,
      teams: Array.isArray(d.teams) ? d.teams : starter.division.teams
    },
    squad: Array.isArray(data.squad) ? squad : starter.squad,
    tournaments: (Array.isArray(data.tournaments)?data.tournaments:[]).map(t=>({
      id:String(t?.id||uid('t')),name:String(t?.name||'Tournament').trim(),date:String(t?.date||''),location:String(t?.location||'').trim(),format:String(t?.format||'group_knockout'),playerNames:Array.isArray(t?.playerNames)?t.playerNames.map(String):[]
    })),
    matches: (Array.isArray(data.matches) ? data.matches : starter.matches).map(m=>({
      ...m,
      status: ['scheduled','postponed','abandoned','played'].includes(String(m?.status||'').toLowerCase()) ? String(m.status).toLowerCase() : 'played'
    })),
    goals: resolveMiniPerformanceDisplay(Array.isArray(data.goals) ? data.goals : starter.goals,squad),
    assists: resolveMiniPerformanceDisplay(Array.isArray(data.assists) ? data.assists : [],squad),
    bookings: Array.isArray(data.bookings) ? data.bookings : [],
    features: {
      goals: data.features?.goals !== false,
      assists: data.features?.assists !== false,
      awards: data.features?.awards !== false,
      bookings: data.features?.bookings !== false
    },
    leagueResults: Array.isArray(data.leagueResults) ? data.leagueResults.map(r=>({
      id:r.id||uid('lr'), date:r.date||'', home:String(r.home||'').trim(), away:String(r.away||'').trim(),
      homeGoals:Number(r.homeGoals||0), awayGoals:Number(r.awayGoals||0), source:r.source||'paste', raw:r.raw||''
    })).filter(r=>r.home&&r.away) : [],
    selkent: {
      enabled: data.selkent?.enabled !== false,
      divisionsUrl: data.selkent?.divisionsUrl || starter.selkent.divisionsUrl,
      fixturesUrl: data.selkent?.fixturesUrl || starter.selkent.fixturesUrl,
      resultsUrl: data.selkent?.resultsUrl || starter.selkent.resultsUrl,
      clubUrl: data.selkent?.clubUrl || starter.selkent.clubUrl,
      clubTeams: Array.isArray(data.selkent?.clubTeams) && data.selkent.clubTeams.length ? data.selkent.clubTeams : starter.selkent.clubTeams,
      lastClubSync: data.selkent?.lastClubSync || '',
      lastDivisionSync: data.selkent?.lastDivisionSync || '',
      lastTableSync: data.selkent?.lastTableSync || '',
      lastSync: data.selkent?.lastSync || '',
      status: data.selkent?.status || '',
      publishedLeagueAges: Array.isArray(data.selkent?.publishedLeagueAges) && data.selkent.publishedLeagueAges.length ? data.selkent.publishedLeagueAges : starter.selkent.publishedLeagueAges,
      competitionMode: data.selkent?.competitionMode || 'auto',
      lastCompetitionCheck: data.selkent?.lastCompetitionCheck || '',
      lastFixtureScan: data.selkent?.lastFixtureScan || '',
      fixtureTracking: data.selkent?.fixtureTracking && typeof data.selkent.fixtureTracking==='object' ? data.selkent.fixtureTracking : {},
      fixtureAcknowledgement: data.selkent?.fixtureAcknowledgement && typeof data.selkent.fixtureAcknowledgement==='object' ? data.selkent.fixtureAcknowledgement : {},
      kitColours: data.selkent?.kitColours && typeof data.selkent.kitColours==='object' ? data.selkent.kitColours : {},
      kitProfiles: data.selkent?.kitProfiles && typeof data.selkent.kitProfiles==='object' ? data.selkent.kitProfiles : {},
      directoryDetails: data.selkent?.directoryDetails && typeof data.selkent.directoryDetails==='object' ? data.selkent.directoryDetails : {},
      fixtures: Array.isArray(data.selkent?.fixtures) ? data.selkent.fixtures : [],
      results: Array.isArray(data.selkent?.results) ? data.selkent.results : [],
      table: Array.isArray(data.selkent?.table) ? data.selkent.table : []
    },
    tactics: {
      lineup: Array.isArray(data.tactics?.lineup) ? data.tactics.lineup.map(String) : [],
      positions: data.tactics?.positions && typeof data.tactics.positions==='object' ? data.tactics.positions : {},
      formation: String(data.tactics?.formation||''),
      formationByFixture: data.tactics?.formationByFixture && typeof data.tactics.formationByFixture==='object' ? data.tactics.formationByFixture : {},
      activeFixtureKey: String(data.tactics?.activeFixtureKey||''),
      matchdaySelections: data.tactics?.matchdaySelections && typeof data.tactics.matchdaySelections==='object' ? data.tactics.matchdaySelections : {},
      matchdayAutoPrepared: data.tactics?.matchdayAutoPrepared && typeof data.tactics.matchdayAutoPrepared==='object' ? data.tactics.matchdayAutoPrepared : {}
    },
    awardTypes: normalizeAwardTypes(data.awardTypes),
    awards: resolveMiniPerformanceDisplay(Array.isArray(data.awards) ? data.awards : starter.awards,squad)
  };
}
function normalizeAwardTypes(raw){
  let list=Array.isArray(raw)?raw.map(x=>String(x||'').replace(/\s+/g,' ').trim()).filter(Boolean):[];
  const legacy=['potm','manager potm','parent potm'];
  if(list.length===3 && list.every(x=>legacy.includes(x.toLowerCase()))) list=[];
  list=list.map(x=>x.toLowerCase()==='potm'?DEFAULT_AWARD_TYPE:x);
  const out=[];const seen=new Set();
  [DEFAULT_AWARD_TYPE,...list].forEach(x=>{const k=x.toLowerCase();if(!seen.has(k)){seen.add(k);out.push(x);}});
  return out.slice(0,20);
}
function miniResultsRestrictedView(){return CLOUD_MODE&&['parent','player'].includes(currentRole)&&ageGroupNumber()>=7&&ageGroupNumber()<=11;}
function localPersistableState(){
  const copy=JSON.parse(JSON.stringify(state));
  if(CLOUD_MODE&&ageGroupNumber()>=7&&ageGroupNumber()<=11){
    copy.squad=(copy.squad||[]).map(p=>{const x={...p};delete x.number;return x;});
    ['goals','assists','awards'].forEach(k=>{copy[k]=(copy[k]||[]).map(r=>{const x={...r};delete x.player;return x;});});
  }
  return copy;
}
function persistLocalState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(localPersistableState()));}catch{}}
function resolveMiniPerformanceDisplay(rows=[],squadRows=[]){
  const byNo=new Map((squadRows||[]).filter(p=>p.number!=null).map(p=>[Number(p.number),p.name]));
  return (rows||[]).map(r=>{if(r.player)return r;const n=Number(r.shirtNumber);return Number.isFinite(n)?{...r,player:byNo.get(n)||('#'+n)}:r;});
}
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : cloneStarter();
  } catch { return cloneStarter(); }
}
function saveState(){ persistLocalState(); renderAll(); if(CLOUD_MODE)window.ClubHubCloud?.queueStateSave?.(state); }
function auditEvent(action,entityType,entityId,summary,before=null,after=null){if(!CLOUD_MODE||!['admin','coach','assistant_coach'].includes(currentRole)||window.ClubHubCloud?.testMode)return;window.ClubHubCloud?.recordAuditEvent?.({action,entityType,entityId,summary,before,after}).catch(()=>{});}
function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function matchStatus(m){const s=String(m?.status||'played').toLowerCase();return ['scheduled','postponed','abandoned','played'].includes(s)?s:'played';}
function isPlayedMatch(m){return matchStatus(m)==='played';}
function resultOf(m){
  const status=matchStatus(m);
  if(miniResultsRestrictedView()&&status==='played')return '';
  if(status==='scheduled')return'SCH';
  if(status==='postponed')return'PST';
  if(status==='abandoned')return'ABD';
  return Number(m.gf) > Number(m.ga) ? 'W' : Number(m.gf) < Number(m.ga) ? 'L' : 'D';
}
function resultClass(r){return r==='W'?'result-W':r==='D'?'result-D':r==='L'?'result-L':r==='PST'?'status-postponed':r==='ABD'?'status-abandoned':r==='SCH'?'status-scheduled':'';}
function statusLabel(m){const s=matchStatus(m);return s==='postponed'?'Postponed':s==='abandoned'?'Abandoned':s==='scheduled'?'Scheduled':'Played';}
function matchScoreText(m){const s=matchStatus(m);if(miniResultsRestrictedView()&&['played','abandoned'].includes(s))return'Played';if(s==='postponed'||s==='scheduled')return'—';if(s==='abandoned')return `${Number(m.gf||0)}–${Number(m.ga||0)} ABD`;return `${Number(m.gf||0)}–${Number(m.ga||0)}`;}
function resultForNamedTeam(home,away,hg,ag,teamName){const own=normalizeTeamKey(teamName||'');const h=normalizeTeamKey(home||''),a=normalizeTeamKey(away||'');const same=(side)=>!!own&&(side===own||(own.length>=4&&(side.endsWith(' '+own)||side.includes(own)))||(side.length>=4&&own.includes(side)));hg=Number(hg||0);ag=Number(ag||0);if(same(h))return hg>ag?'W':hg<ag?'L':'D';if(same(a))return ag>hg?'W':ag<hg?'L':'D';return hg===ag?'D':'';}
function formatDate(iso){ if(!iso) return ''; return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(iso+'T12:00:00')); }
function esc(str=''){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function activePlayers(){ return state.squad.filter(p=>p.status==='active' && p.name).sort((a,b)=>a.number-b.number); }
function rosterPlayers(){ return state.squad.filter(p=>p.name).sort((a,b)=>a.number-b.number); }
function shirtFor(name){ return state.squad.find(p=>p.name===name)?.number ?? ''; }
function playerForName(name){return state.squad.find(p=>p.name===name)||null;}
function miniJerseyHTML(number,role='outfield',extraClass=''){
  const n=Number(number)||'';const cls=role==='goalkeeper'?'goalkeeper':'outfield';
  return `<span class="mini-jersey ${cls} ${extraClass}" aria-label="Shirt number ${esc(n)}"><svg viewBox="0 0 64 58" aria-hidden="true"><path d="M22 6 28 2h8l6 4 14 8-7 12-7-4v32H22V22l-7 4-7-12 14-8Z"/></svg><b>${esc(n)}</b></span>`;
}
function playerJerseyHTML(name,fallback='') {const p=playerForName(name);return miniJerseyHTML(p?.number||fallback,p?.role||'outfield');}
function isLeagueMatch(m){ return String(m.competition||'').trim().toLowerCase()==='league'; }
function isFriendlyMatch(m){ return String(m.competition||'').trim().toLowerCase()==='friendly'; }
function competitionBucket(m){const s=String(m?.competition||m?.type||'').toLowerCase();if(s.includes('vase'))return'vase';if(s.includes('shield'))return'shield';if(s.includes('cup'))return'cup';return'';}
function isCupMatch(m){return competitionBucket(m)==='cup';}
function isVaseMatch(m){return competitionBucket(m)==='vase';}
function isShieldMatch(m){return competitionBucket(m)==='shield';}
function disciplineApplies(){return ageGroupNumber()>=11;}
function featureEnabled(name){ if(name==='bookings'&&!disciplineApplies())return false; return state.features?.[name] !== false; }
function isSyncedMatch(m){ return String(m.source||'')==='selkent'; }
function otherMatches(){ return state.matches.filter(m=>!isLeagueMatch(m)&&!isFriendlyMatch(m)&&!isDivisionMatch(m)&&!competitionBucket(m)); }
function ageGroupNumber(){
  const source=`${state.meta.ageGroup||''} ${state.division.name||''}`;
  const m=source.match(/(?:\bU\s*|\bUnder\s*)(\d{1,2})\b/i);
  return m?Number(m[1]):0;
}
function currentAgeCode(){
  const raw=String(state.meta?.ageGroup||'').trim().toUpperCase().replace(/\s+/g,'');
  if(/^U\d{1,2}X?$/.test(raw))return raw;
  const n=ageGroupNumber();return n?`U${n}`:'';
}
function publishedLeagueAges(){
  const rules=clubRules().filter(r=>r.results_published&&Number(r.age_group)>=12).map(r=>'U'+r.age_group);if(rules.length)return rules;
  const fromState=Array.isArray(state.selkent?.publishedLeagueAges)?state.selkent.publishedLeagueAges:[];
  if(fromState.length)return fromState;
  try{const saved=JSON.parse(localStorage.getItem(SELKENT_PUBLISHED_AGES_KEY)||'[]');if(Array.isArray(saved)&&saved.length)return saved;}catch{}
  const fromAge=Number(clubSettings().results_publish_from_age||0);if(fromAge)return Array.from({length:18-fromAge},(_,i)=>'U'+(fromAge+i));
  return SELKENT_RESULTS_AGES_FALLBACK;
}
function isPublishedLeagueTeam(){
  if(ageGroupNumber()<=11)return false;
  const rule=competitionRuleForAge(ageGroupNumber());if(rule)return Number(rule.age_group)>=12&&!!rule.results_published;
  const age=currentAgeCode();return !!age&&publishedLeagueAges().map(x=>String(x).toUpperCase()).includes(age);
}
function competitionMode(){return isPublishedLeagueTeam()?'league':'no-league';}
function leagueTableEnabled(){ return isPublishedLeagueTeam(); }
function isDivisionMatch(m){ return ['division','division match'].includes(String(m?.competition||'').trim().toLowerCase()); }
function parsePublishedLeagueAges(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html'),out=[],seen=new Set();
  const add=v=>{let t=String(v||'').replace(/\s+/g,'').toUpperCase();if(/^U\d{1,2}X?$/.test(t)||t==='SENIOR'){t=t==='SENIOR'?'Senior':t;if(!seen.has(t)){seen.add(t);out.push(t);}}};
  doc.querySelectorAll('a,button,option,[role=tab]').forEach(el=>add(el.textContent||el.value));
  return out;
}
async function refreshPublishedLeagueAges(silent=true){
  state.selkent=state.selkent||cloneStarter().selkent;
  if(providerType()!=='selkent'){const ages=publishedLeagueAges();state.selkent.publishedLeagueAges=ages;state.selkent.competitionMode=isPublishedLeagueTeam()?'league':'no-league';return ages;}
  try{
    let ages=[];
    const cfg=window.CLUB_HUB_CLOUD||{};
    if(cfg.url){
      try{
        const endpoint=String(cfg.url).replace(/\/$/,'')+'/functions/v1/selkent-directory';
        const r=await fetch(endpoint,{cache:'no-store',headers:cfg.anonKey?{'apikey':cfg.anonKey}: {}});
        if(r.ok){const data=await r.json();ages=Array.isArray(data?.published_league_age_groups)?data.published_league_age_groups:[];}
      }catch(_){/* device can fall back to the public Selkent page directly */}
    }
    if(ages.length<2){
      const response=await nativeHttp(state.selkent.resultsUrl||STARTER_DATA.selkent.resultsUrl);
      ages=parsePublishedLeagueAges(response.body);
    }
    if(ages.length<2)throw new Error('Published age list not recognised');
    state.selkent.publishedLeagueAges=ages;
    state.selkent.competitionMode=ages.map(x=>String(x).toUpperCase()).includes(currentAgeCode())?'league':'no-league';
    state.selkent.lastCompetitionCheck=new Date().toISOString();
    localStorage.setItem(SELKENT_PUBLISHED_AGES_KEY,JSON.stringify(ages));
    if(!silent)toast(state.selkent.competitionMode==='league'?'Selkent league team confirmed':'Selkent no-league team confirmed');
    return ages;
  }catch(err){
    const ages=publishedLeagueAges();
    state.selkent.publishedLeagueAges=ages;
    state.selkent.competitionMode=ages.map(x=>String(x).toUpperCase()).includes(currentAgeCode())?'league':'no-league';
    return ages;
  }
}
function normalizeTeamKey(s=''){ return String(s).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
function mapQuery(...parts){return parts.map(x=>String(x||'').trim()).filter(x=>x&&!/^TBC$/i.test(x)&&!/^Address TBC$/i.test(x)&&!/^Ground TBC$/i.test(x)).join(', ');}
function mapsHref(...parts){const q=mapQuery(...parts);return q?`geo:0,0?q=${encodeURIComponent(q)}`:'';}
function mapsEmbedHref(...parts){const q=mapQuery(...parts);return q?`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`:'';}
function allDivisionTeams(){
  const d=state.division||{};
  const raw=[...(Array.isArray(d.teams)?d.teams:[]),d.teamName].filter(Boolean);
  const out=[],seen=new Set();
  raw.forEach(t=>{ const name=String(t).trim(), key=normalizeTeamKey(name); if(name&&!seen.has(key)){seen.add(key);out.push(name);} });
  return out;
}
function canonicalTeam(candidate=''){
  const key=normalizeTeamKey(candidate);
  if(!key) return null;
  const teams=allDivisionTeams();
  let exact=teams.find(t=>normalizeTeamKey(t)===key); if(exact) return exact;
  if(key.length>=5){
    const fuzzy=teams.filter(t=>{const tk=normalizeTeamKey(t);return tk.includes(key)||key.includes(tk);});
    if(fuzzy.length===1) return fuzzy[0];
  }
  return null;
}
function ownLeagueResults(){
  const self=state.division.teamName||state.meta.teamName||'Our team';
  return state.matches.filter(m=>isLeagueMatch(m)&&isPlayedMatch(m)).map(m=>{
    const away=String(m.venue||'').toUpperCase()==='A';
    return {id:'match:'+m.id,date:m.date||'',home:away?m.opponent:self,away:away?self:m.opponent,homeGoals:away?Number(m.ga||0):Number(m.gf||0),awayGoals:away?Number(m.gf||0):Number(m.ga||0),source:'match'};
  });
}
function leagueResultSignature(r){
  const a=normalizeTeamKey(r.home),b=normalizeTeamKey(r.away),hg=Number(r.homeGoals||0),ag=Number(r.awayGoals||0);
  // Direction matters so home/away return fixtures remain distinct.
  return `${a}|${hg}|${ag}|${b}`;
}
function combinedLeagueResults(){
  const own=ownLeagueResults();
  const seen=new Set(own.map(leagueResultSignature));
  const out=[...own];
  [...(state.leagueResults||[]),...(state.selkent?.results||[])].forEach(r=>{
    const sig=leagueResultSignature(r);
    if(!seen.has(sig)){ seen.add(sig); out.push(r); }
  });
  return out;
}
function calculateLeagueTable(){
  const rows=new Map();
  allDivisionTeams().forEach(name=>rows.set(normalizeTeamKey(name),{team:name,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}));
  combinedLeagueResults().forEach(r=>{
    const home=canonicalTeam(r.home),away=canonicalTeam(r.away);
    if(!home||!away||normalizeTeamKey(home)===normalizeTeamKey(away)) return;
    const h=rows.get(normalizeTeamKey(home)),a=rows.get(normalizeTeamKey(away));
    if(!h||!a) return;
    const hg=Number(r.homeGoals||0),ag=Number(r.awayGoals||0);
    h.p++;a.p++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;
    if(hg>ag){h.w++;a.l++;h.pts+=3;} else if(hg<ag){a.w++;h.l++;a.pts+=3;} else {h.d++;a.d++;h.pts++;a.pts++;}
  });
  const table=[...rows.values()];
  table.forEach(r=>r.gd=r.gf-r.ga);
  table.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team));
  return table;
}
function parseResultDate(text){
  let m=String(text).match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=String(text).match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;}
  return '';
}
function parseLeagueResultLine(raw){
  const original=String(raw||'').trim(); if(!original) return null;
  let text=original.replace(/^[•·*\-]+\s*/,'').replace(/\s+/g,' ').trim();
  const date=parseResultDate(text);
  const scoreText=text
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,' ')
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g,' ');
  const teams=allDivisionTeams().sort((a,b)=>b.length-a.length);
  const hits=[];
  teams.forEach(team=>{const idx=text.toLowerCase().indexOf(team.toLowerCase());if(idx>=0)hits.push({team,idx});});
  hits.sort((a,b)=>a.idx-b.idx);
  const score=scoreText.match(/\b(\d{1,2})\s*[-–—:]\s*(\d{1,2})\b/);
  if(hits.length>=2&&score){
    return {date,home:hits[0].team,away:hits[1].team,homeGoals:Number(score[1]),awayGoals:Number(score[2]),raw:original};
  }
  // Supports copied table rows such as Team A<TAB>3<TAB>1<TAB>Team B or Team A 3 1 Team B.
  const cells=original.split(/\t+/).map(x=>x.trim()).filter(Boolean);
  if(cells.length>=4){
    const nums=cells.map((c,i)=>/^\d{1,2}$/.test(c)?i:-1).filter(i=>i>=0);
    if(nums.length>=2){
      const h=canonicalTeam(cells.slice(0,nums[0]).join(' '));
      const a=canonicalTeam(cells.slice(nums[1]+1).join(' '));
      if(h&&a) return {date,home:h,away:a,homeGoals:Number(cells[nums[0]]),awayGoals:Number(cells[nums[1]]),raw:original};
    }
  }
  const loose=text.match(/^(.+?)\s+(\d{1,2})\s+(\d{1,2})\s+(.+?)$/);
  if(loose){
    const h=canonicalTeam(loose[1]),a=canonicalTeam(loose[4]);
    if(h&&a) return {date,home:h,away:a,homeGoals:Number(loose[2]),awayGoals:Number(loose[3]),raw:original};
  }
  return null;
}
function aggregateStats(a,b){
  const played=Number(a.played||0)+Number(b.played||0), wins=Number(a.wins||0)+Number(b.wins||0), draws=Number(a.draws||0)+Number(b.draws||0), losses=Number(a.losses||0)+Number(b.losses||0), gf=Number(a.gf||0)+Number(b.gf||0), ga=Number(a.ga||0)+Number(b.ga||0);
  return {played,wins,draws,losses,gf,ga,gd:gf-ga,winrate:played?Math.round(wins/played*100):0};
}
function remoteLeagueRow(){
  const self=normalizeTeamKey(state.division.teamName||state.meta.teamName||'');
  return (state.selkent?.table||[]).find(r=>normalizeTeamKey(r.team)===self)||null;
}
function remoteLeagueStats(){
  const r=remoteLeagueRow(); if(!r) return null;
  const played=Number(r.p||0),wins=Number(r.w||0),draws=Number(r.d||0),losses=Number(r.l||0),gf=Number(r.gf||0),ga=Number(r.ga||0);
  return {played,wins,draws,losses,gf,ga,gd:gf-ga,winrate:played?Math.round(wins/played*100):0};
}

const __nativePending=new Map();
const __nativeRenderedPending=new Map();
window.__nativeFetchResolve=function(id,status,body,error){
  const pending=__nativePending.get(id); if(!pending) return;
  __nativePending.delete(id);
  if(status>=200&&status<400) pending.resolve({status,body}); else pending.reject(new Error(error||`HTTP ${status||0}`));
};
window.__nativeRenderResolve=function(id,status,body,error,finalUrl){
  const pending=__nativeRenderedPending.get(id); if(!pending) return;
  __nativeRenderedPending.delete(id);
  if(status>=200&&status<400) pending.resolve({status,body,url:finalUrl||pending.url}); else pending.reject(new Error(error||`Rendered HTTP ${status||0}`));
};
function nativeRenderedPage(url,choices=[]){
  if(window.ClubHubNative&&typeof window.ClubHubNative.renderPage==='function'){
    return new Promise((resolve,reject)=>{
      const id='render_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      __nativeRenderedPending.set(id,{resolve,reject,url});
      window.ClubHubNative.renderPage(id,url,JSON.stringify((choices||[]).filter(Boolean)));
      setTimeout(()=>{if(__nativeRenderedPending.has(id)){__nativeRenderedPending.delete(id);reject(new Error('Selkent rendered page timed out'));}},45000);
    });
  }
  return null;
}
function nativeHttp(url,method='GET',body=''){
  if(window.ClubHubNative&&typeof window.ClubHubNative.request==='function'){
    return new Promise((resolve,reject)=>{
      const id='req_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      __nativePending.set(id,{resolve,reject});
      window.ClubHubNative.request(id,url,method,body||'');
      setTimeout(()=>{if(__nativePending.has(id)){__nativePending.delete(id);reject(new Error('Selkent request timed out'));}},25000);
    });
  }
  const opts={method,cache:'no-store',headers:{'Accept':'text/html,application/xhtml+xml'}};
  if(method!=='GET'&&body){opts.body=body;opts.headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';}
  return fetch(url,opts).then(async r=>{const text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}`);return{status:r.status,body:text};});
}
function selkentNorm(s=''){return String(s).toLowerCase().replace(/&amp;/g,'and').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function resolveWebUrl(base,rel){try{return new URL(rel,base).href;}catch{return base;}}
function formPayload(form,chosenSelect,chosenOption,chosenButton){
  const params=new URLSearchParams();
  form.querySelectorAll('input,select,textarea').forEach(el=>{
    if(!el.name||el.disabled)return;
    if((el.type==='checkbox'||el.type==='radio')&&!el.checked)return;
    if(el.tagName==='SELECT'){
      const opt=el===chosenSelect?chosenOption:el.selectedOptions?.[0];
      if(opt) params.set(el.name,opt.value);
    } else if(el.type!=='submit'&&el.type!=='button') params.set(el.name,el.value||'');
  });
  if(chosenButton?.name) params.set(chosenButton.name,chosenButton.value||chosenButton.textContent.trim());
  return params.toString();
}
function navigationForChoice(html,currentUrl,choice){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const target=selkentNorm(choice);
  const links=[...doc.querySelectorAll('a[href]')];
  const link=links.find(a=>{const t=selkentNorm(a.textContent);return t===target||(target.length>3&&t.includes(target));});
  if(link){const href=link.getAttribute('href')||'';if(href&&href!=='#'&&!href.toLowerCase().startsWith('javascript:'))return{url:resolveWebUrl(currentUrl,href),method:'GET',body:''};}
  for(const sel of doc.querySelectorAll('select')){
    const opts=[...sel.options];
    const opt=opts.find(o=>{const t=selkentNorm(o.textContent);return t===target||(target.length>3&&t.includes(target));});
    if(!opt)continue;
    if(opt.selected||sel.value===opt.value) return null;
    const form=sel.closest('form'); if(!form)continue;
    const method=(form.getAttribute('method')||'GET').toUpperCase();
    const action=resolveWebUrl(currentUrl,form.getAttribute('action')||currentUrl);
    const payload=formPayload(form,sel,opt,null);
    return method==='GET'?{url:action+(action.includes('?')?'&':'?')+payload,method:'GET',body:''}:{url:action,method,body:payload};
  }
  for(const btn of doc.querySelectorAll('button,input[type=submit]')){
    const text=selkentNorm(btn.textContent||btn.value||'');
    if(!(text===target||(target.length>3&&text.includes(target))))continue;
    const form=btn.closest('form');if(!form)continue;
    const method=(form.getAttribute('method')||'GET').toUpperCase(),action=resolveWebUrl(currentUrl,form.getAttribute('action')||currentUrl),payload=formPayload(form,null,null,btn);
    return method==='GET'?{url:action+(action.includes('?')?'&':'?')+payload,method:'GET',body:''}:{url:action,method,body:payload};
  }
  return null;
}
async function fetchSelkentSelected(baseUrl,choices=[]){
  const wanted=(choices||[]).filter(Boolean);
  // Selkent's public pages now use age/division controls that can populate
  // content after page load. On Android we let a hidden native WebView render
  // the page and click those controls, then parse the final DOM. This is more
  // reliable than assuming every division is present in the first HTTP body.
  try{
    const rendered=nativeRenderedPage(baseUrl,wanted);
    if(rendered){
      const page=await rendered;
      if(page?.body && page.body.length>300) return{html:page.body,url:page.url||baseUrl,rendered:true};
    }
  }catch(_){/* fall back to direct HTML navigation below */}
  let current=baseUrl;
  let response=await nativeHttp(current);
  let html=response.body;
  for(const choice of wanted){
    const nav=navigationForChoice(html,current,choice);
    if(nav){response=await nativeHttp(nav.url,nav.method,nav.body);html=response.body;current=nav.url;}
  }
  return{html,url:current,rendered:false};
}

function parseProviderClubTeams(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const found=[];
  const seen=new Set();
  const addText=(txt='')=>{
    const t=String(txt).replace(/\s+/g,' ').trim();
    const m=t.match(/^Under\s+(\d{1,2})s?\s+(.+?)$/i);
    if(!m)return;
    const n=Number(m[1]),name=m[2].trim();
    if(!n||!name||name.length>40)return;
    const key=`${n}|${selkentNorm(name)}`;
    if(seen.has(key))return;
    seen.add(key);
    found.push({selkentName:`Under ${n}s ${name}`,ageGroup:`U${n}`,teamName:name,leagueName:`${clubSettings().display_name||'Club'} ${name}`});
  };
  doc.querySelectorAll('a,li,td,p').forEach(el=>addText(el.textContent));
  if(found.length<3){
    const raw=doc.body?.innerText||doc.body?.textContent||'';
    raw.split(/\n+/).forEach(addText);
  }
  return found.sort((a,b)=>Number(a.ageGroup.slice(1))-Number(b.ageGroup.slice(1))||a.teamName.localeCompare(b.teamName));
}
function clubTeams(){
  const configured=configuredClubTeams();
  const list=configured.length?configured:(Array.isArray(state.selkent?.clubTeams)&&state.selkent.clubTeams.length?state.selkent.clubTeams:GENERIC_STARTER_TEAMS);
  return [...list].sort((a,b)=>Number(String(a.ageGroup).replace(/\D/g,''))-Number(String(b.ageGroup).replace(/\D/g,''))||String(a.teamName).localeCompare(String(b.teamName)));
}
function selectedClubTeam(){
  const select=document.getElementById('settings-team-name');
  const key=select?.value||'';
  return clubTeams().find(t=>t.selkentName===key)||null;
}
function renderClubTeamOptions(){
  const select=document.getElementById('settings-team-name');
  if(!select)return;
  const list=clubTeams();
  if(isTeamLocked()){
    const team=assignedTeam();
    select.innerHTML=`<option value="${esc(team.selkentName)}">${esc(team.ageGroup+' '+team.teamName)}</option>`;
    select.value=team.selkentName;select.disabled=true;
  }else{
    select.disabled=false;
    const current=list.find(t=>t.ageGroup===state.meta.ageGroup&&(selkentNorm(t.leagueName)===selkentNorm(state.division.teamName)||selkentNorm(t.teamName)===selkentNorm(state.meta.teamName)));
    select.innerHTML=list.map(t=>`<option value="${esc(t.selkentName)}">${esc(t.ageGroup+' '+t.teamName)}</option>`).join('');
    if(current) select.value=current.selkentName;
    else if(state.meta.teamName){
      const fallback=`${state.meta.ageGroup||''} ${state.meta.teamName}`.trim();
      const opt=document.createElement('option');opt.value='__current__';opt.textContent=fallback;select.prepend(opt);select.value='__current__';
    }
  }
  const count=document.getElementById('selkent-club-team-count');
  if(count)count.textContent=`${list.length} ${(clubSettings().short_name||clubSettings().display_name||'club')} team${list.length===1?'':'s'} available`;
  renderAssignmentTeamOptions();
}
function applySelectedClubTeamToForm(){
  const team=selectedClubTeam();
  if(!team)return;
  const age=document.getElementById('settings-auto-age');
  const division=document.getElementById('settings-auto-division');
  if(age)age.textContent=team.ageGroup||'—';
  if(division)division.textContent=team.division||((team.ageGroup===state.meta.ageGroup)?(state.division.name||'TBC'):'TBC');
}
async function syncProviderClubTeams(silent=true){
  state.selkent=state.selkent||cloneStarter().selkent;
  if(providerType()!=='selkent'){const teams=clubTeams();state.selkent.clubTeams=teams;renderClubTeamOptions();if(!silent)toast(`${teams.length} club teams loaded`);return teams;}
  const url=state.selkent.clubUrl||STARTER_DATA.selkent.clubUrl;
  try{
    const response=await nativeHttp(url);
    const teams=parseProviderClubTeams(response.body);
    if(teams.length<1)throw new Error('No club team list recognised');
    state.selkent.clubTeams=teams;
    state.selkent.lastClubSync=new Date().toISOString();
    persistLocalState();
    if(CLOUD_MODE&&isAdmin())window.ClubHubCloud?.syncTeamDirectory?.(teams).catch(()=>{});
    renderClubTeamOptions();
    if(!silent)toast(`${teams.length} club teams synced`);
    return teams;
  }catch(err){
    if(!Array.isArray(state.selkent.clubTeams)||!state.selkent.clubTeams.length)state.selkent.clubTeams=GENERIC_STARTER_TEAMS;
    renderClubTeamOptions();
    if(!silent)toast('Using saved club team list');
    return state.selkent.clubTeams;
  }
}
function selkentScope(doc){
  const needle=selkentNorm(state.division.name||'');
  if(!needle)return doc.body;
  const selectors='h1,h2,h3,h4,h5,h6,legend,summary,.card-header,.panel-heading,.accordion-header,strong';
  const hit=[...doc.querySelectorAll(selectors)].find(el=>selkentNorm(el.textContent).includes(needle));
  if(!hit)return doc.body;
  const container=hit.closest('section,article,.card,.panel,.accordion-item,fieldset,.tab-pane')||hit.parentElement;
  return container&&container.textContent.trim().length>needle.length+20?container:doc.body;
}
function parseNumberCell(v){const n=String(v).replace(/[^0-9-]/g,'');return /^-?\d+$/.test(n)?Number(n):null;}
function plausibleTeamName(v=''){
  const t=String(v).replace(/\s+/g,' ').trim();
  if(t.length<3||t.length>80)return false;
  if(/^\d+$/.test(t)||/^\d{1,2}[:.]\d{2}$/.test(t)||/^\d{1,2}[\s\/-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t))return false;
  if(/^(home|away|venue|date|time|fixture|fixtures|result|results|details|postponed|cancelled|league|division|played|points|pts)$/i.test(t))return false;
  return /[a-z]/i.test(t);
}
function plausibleDivisionTeamName(v=''){
  const t=String(v).replace(/\s+/g,' ').trim();
  if(!plausibleTeamName(t)||t.length>64)return false;
  if(!/^[A-Za-z0-9][A-Za-z0-9 &'().,+\-]{1,63}$/.test(t))return false;
  if(/\b(function|return|const|let|var|document|window|querySelector|addEventListener|undefined|null|javascript|stylesheet|viewport|cookie|privacy|terms|contact|login|logout|download|click|button|select|option|script|style)\b/i.test(t))return false;
  if(/^(?:U|Under\s*)\d{1,2}X?\b/i.test(t))return false;
  if(/^\d{1,2}\s+teams?$/i.test(t))return false;
  if(/^(?:team|p|w|d|l|gf|ga|gd|pts|points|played|won|drawn|lost)$/i.test(t))return false;
  return true;
}
function sanitizeDivisionTeamList(list=[]){
  const self=String(state?.division?.teamName||state?.meta?.teamName||'').trim();
  const out=[],seen=new Set();
  [self,...(Array.isArray(list)?list:[])].forEach(v=>{
    const name=String(v||'').replace(/\s+/g,' ').trim();
    if(!name||(!selkentTeamMatch(name,self)&&!plausibleDivisionTeamName(name)))return;
    const key=selkentNorm(name);if(!key||seen.has(key))return;seen.add(key);out.push(selkentTeamMatch(name,self)&&self?self:name);
  });
  return out.slice(0,24);
}
function sanitizeRemoteStandings(rows=[]){
  const known=sanitizeDivisionTeamList(allDivisionTeams());
  if(known.length<2)return [];
  const out=[],seen=new Set();
  (Array.isArray(rows)?rows:[]).forEach(r=>{
    if(!r||!plausibleDivisionTeamName(r.team))return;
    const canonical=known.find(t=>selkentTeamMatch(t,r.team));
    if(!canonical)return;
    const vals=['p','w','d','l','gf','ga','gd','pts'].map(k=>Number(r[k]));
    if(vals.some(n=>!Number.isFinite(n)))return;
    const [p,w,d,l,gf,ga,gd,pts]=vals;
    if(p<0||p>60||w<0||d<0||l<0||gf<0||ga<0||pts<0||w+d+l!==p||Math.abs(gd-(gf-ga))>1)return;
    const key=selkentNorm(canonical);if(seen.has(key))return;seen.add(key);
    out.push({team:canonical,p,w,d,l,gf,ga,gd:gf-ga,pts});
  });
  return out;
}
function parseSelkentDate(text=''){
  const direct=parseResultDate(text);if(direct)return direct;
  const m=String(text).match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\w*)\s*(20\d{2})?\b/i);
  if(!m)return'';
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  const mon=months[m[2].toLowerCase()],day=Number(m[1]);
  let year=m[3]?Number(m[3]):Number(String(state.meta.season||'').match(/20\d{2}/)?.[0]||new Date().getFullYear());
  if(!m[3]&&mon<=6&&String(state.meta.season||'').includes('/'))year+=1;
  return`${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function standingFromCells(cells){
  const vals=cells.map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean);
  if(vals.length<7)return null;
  let teamIndex=-1;
  if(vals.length>=10&&parseNumberCell(vals[0])!==null&&plausibleTeamName(vals[1]))teamIndex=1;
  else teamIndex=vals.findIndex((v,i)=>plausibleTeamName(v)&&vals.slice(i+1).filter(x=>parseNumberCell(x)!==null).length>=6);
  if(teamIndex<0)return null;
  const nums=vals.slice(teamIndex+1).map(parseNumberCell).filter(n=>n!==null);
  if(nums.length<6)return null;
  const p=nums[0],w=nums[1]??0,d=nums[2]??0,l=nums[3]??0,gf=nums[4]??0,ga=nums[5]??0;
  const gd=nums.length>=8?nums[6]:gf-ga,pts=nums.length>=8?nums[7]:(nums[6]??0);
  if(p<0||p>100||w<0||d<0||l<0)return null;
  return{team:vals[teamIndex],p,w,d,l,gf,ga,gd,pts};
}
function teamPairFromCells(cells,known=[]){
  const vals=cells.map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean);
  const joined=vals.join(' | '),hits=[];
  known.forEach(team=>{if(joined.toLowerCase().includes(String(team).toLowerCase()))hits.push(team);});
  if(hits.length>=2)return[hits[0],hits[1]];
  const candidates=vals.filter(plausibleTeamName).filter(v=>!selkentNorm(v).includes(selkentNorm(state.division.name||''))&&!/^under\s*\d/i.test(v));
  const self=state.division.teamName||state.meta.teamName||'';
  const selfCell=candidates.find(v=>selkentNorm(v).includes(selkentNorm(self))||selkentNorm(self).includes(selkentNorm(v)));
  if(selfCell){const other=candidates.find(v=>v!==selfCell&&selkentNorm(v)!==selkentNorm(selfCell));if(other)return[selfCell,other];}
  if(candidates.length>=2)return[candidates[0],candidates[candidates.length-1]];
  return null;
}
function detectSelkentDivision(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const self=selkentNorm(state.division?.teamName||state.meta.teamName||'');
  if(!self)return'';
  const all=[...doc.querySelectorAll('a,td,li,p,span,strong')];
  const hit=all.find(el=>{const raw=String(el.textContent||'').replace(/\s+/g,' ').trim();const t=selkentNorm(raw);return raw.length<160&&(t===self||t.includes(self)||(self.includes(t)&&t.length>8));});
  const looksDivision=(txt='')=>{
    const t=String(txt).replace(/\s+/g,' ').trim();
    if(!t||t.length>80)return'';
    const age=ageGroupNumber();
    if(new RegExp(`^(Under\\s*${age}|U\\s*${age})`, 'i').test(t))return t;
    if(/division|league/i.test(t) && new RegExp(`${age}`).test(t))return t;
    return'';
  };
  if(hit){
    let node=hit;
    for(let depth=0;node&&depth<7;depth++,node=node.parentElement){
      const heads=[...node.querySelectorAll(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > legend,:scope > summary,:scope > .card-header,:scope > .panel-heading')];
      for(const h of heads){const found=looksDivision(h.textContent);if(found)return found;}
      let prev=node.previousElementSibling;
      for(let i=0;prev&&i<4;i++,prev=prev.previousElementSibling){const found=looksDivision(prev.textContent);if(found)return found;}
    }
  }
  const raw=doc.body?.innerText||doc.body?.textContent||'';
  const age=ageGroupNumber();
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const selfIndex=lines.findIndex(x=>{const k=selkentNorm(x);return k.includes(self)||self.includes(k);});
  if(selfIndex>=0){
    for(let i=selfIndex-1;i>=0&&i>=selfIndex-12;i--){const found=looksDivision(lines[i]);if(found)return found;}
  }
  return'';
}

function selkentTeamMatch(a='',b=''){
  const clean=v=>selkentNorm(v).replace(/\bfootball club\b/g,'').replace(/\bfc\b/g,'').replace(/\bafc\b/g,'').replace(/\s+/g,' ').trim();
  const x=clean(a),y=clean(b);if(!x||!y)return false;
  return x===y||(x.length>8&&y.includes(x))||(y.length>8&&x.includes(y));
}
function divisionHeadingForAge(text=''){
  const t=String(text).replace(/\s+/g,' ').trim();
  const age=ageGroupNumber();if(!age||!t||t.length>90)return'';
  const prefix=new RegExp(`^(?:Under\\s*${age}|U\\s*${age})(?:s)?(?=\\s|[A-D]|$)`,'i');
  if(!prefix.test(t))return'';
  const rest=t.replace(prefix,'').trim().replace(/^[-–—:]\s*/,'');
  if(!rest||/^fixtures?|results?|teams?|division(?:s)?$/i.test(rest))return'';
  // Team labels on club pages often look like "Under 12s Lions". A division
  // normally starts with a grading letter/number or a recognised division word.
  if(!/^(?:[A-D](?:\b|\s)|Div(?:ision)?\b|Prem(?:ier)?\b|Champ(?:ionship)?\b|One\b|Two\b|Three\b|Four\b|Navy\b|Silver\b|Red\b|Blue\b|Green\b|Orange\b|Indigo\b|Olive\b|Sage\b|Aqua\b|Brown\b|Purple\b|Maroon\b|Pink\b|Mauve\b|Lime\b|Salmon\b)/i.test(rest))return'';
  return t;
}
function parseSelkentDivisionDirectory(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const self=state.division?.teamName||state.meta?.teamName||'';
  if(!self)return{division:'',teams:[]};
  const raw=doc.body?.innerText||doc.body?.textContent||'';
  const lines=raw.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const headings=[];
  lines.forEach((line,i)=>{const h=divisionHeadingForAge(line);if(h)headings.push({i,name:h});});
  for(let h=0;h<headings.length;h++){
    const start=headings[h].i+1,end=h+1<headings.length?headings[h+1].i:Math.min(lines.length,start+120);
    let block=lines.slice(start,end);
    const countAt=block.findIndex(line=>/^\d{1,2}\s+teams?$/i.test(line));
    const expected=countAt>=0?Number(block[countAt].match(/^\d{1,2}/)?.[0]||0):0;
    if(countAt>=0)block=block.slice(0,countAt);
    let teams=block.filter(line=>plausibleDivisionTeamName(line));
    if(expected>0&&teams.length>expected){
      const idx=teams.findIndex(line=>selkentTeamMatch(line,self));
      if(idx>=0){const a=Math.max(0,Math.min(idx-Math.floor(expected/2),teams.length-expected));teams=teams.slice(a,a+expected);}else teams=teams.slice(-expected);
    }
    const selfIndex=teams.findIndex(line=>selkentTeamMatch(line,self));
    if(selfIndex<0)continue;
    if(expected>0&&teams.length!==expected)continue;
    if(teams.length<2||teams.length>24)continue;
    const cleaned=sanitizeDivisionTeamList(teams);
    if(cleaned.length<2||cleaned.length>24)continue;
    return{division:headings[h].name,teams:cleaned};
  }
  const division=detectSelkentDivision(html);
  return{division,teams:[]};
}

function updateCurrentClubTeamDivision(division=''){
  if(!division||!Array.isArray(state.selkent?.clubTeams))return;
  const current=state.selkent.clubTeams.find(t=>String(t.ageGroup)===String(state.meta.ageGroup)&&selkentTeamMatch(t.leagueName,state.division.teamName));
  if(current)current.division=division;
}
async function syncSelkentDivision(silent=false){
  state.selkent=state.selkent||cloneStarter().selkent;
  const sk=state.selkent;
  if(!silent)toast('Checking Selkent division…');
  const page=await fetchSelkentSelected(sk.divisionsUrl||STARTER_DATA.selkent.divisionsUrl,[state.meta.ageGroup].filter(Boolean));
  const info=parseSelkentDivisionDirectory(page.html);
  if(!info.division)throw new Error(`No ${state.meta.ageGroup||''} division found for ${state.division.teamName||state.meta.teamName}`.trim());
  const cleanTeams=sanitizeDivisionTeamList(info.teams);
  if(cleanTeams.length<2)throw new Error(`${info.division} was found, but its team list could not be read safely`);
  state.division.name=info.division;
  state.division.teams=cleanTeams;
  updateCurrentClubTeamDivision(info.division);
  state.selkent.lastDivisionSync=new Date().toISOString();
  if(CLOUD_MODE&&isAdmin())window.ClubHubCloud?.syncTeamDirectory?.(state.selkent.clubTeams).catch(()=>{});
  if(!silent)toast(`${info.division} confirmed`);
  return info;
}
async function syncSelkentLeagueTable(silent=false){
  await refreshPublishedLeagueAges(true);
  if(!leagueTableEnabled()){
    if(!silent)toast('Selkent does not publish a league table for this age group.');
    return false;
  }
  const sk=state.selkent||cloneStarter().selkent;
  const btn=document.getElementById('sync-league-table');if(btn)btn.disabled=true;
  if(!silent)toast('Syncing league table…');
  try{
    await syncSelkentDivision(true);
    const resultPage=await fetchSelkentSelected(sk.resultsUrl||STARTER_DATA.selkent.resultsUrl,[state.meta.ageGroup,state.division.name].filter(Boolean));
    const resultData=parseSelkentHtml(resultPage.html,resultPage.url);
    if(!resultData.table.length)throw new Error('No league table recognised on the selected Selkent division');
    state.selkent.table=resultData.table||[];
    state.selkent.results=resultData.results||[];
    applySelkentTeamDiscovery(resultData.teams||[]);
    syncOwnLeagueMatchesFromSelkent(state.selkent.results);
    state.selkent.lastTableSync=new Date().toISOString();
    state.selkent.lastSync=new Date().toISOString();
    state.selkent.status='League data updated automatically'; 
    saveState();
    if(CLOUD_MODE&&isAdmin())refreshAdminClubOverview(true);
  if(CLOUD_MODE&&['admin','coach','assistant_coach'].includes(currentRole)&&currentView==='club')refreshClubResults(true);
    if(!silent)toast('League table synced');
    return true;
  }catch(err){
    state.selkent.status='League data will retry automatically';persistLocalState();renderSelkentSettings();if(!silent)toast('League table sync failed');return false;
  }finally{if(btn)btn.disabled=false;}
}

function stableSyncedMatchId(r){
  const raw=`${r.date||''}|${normalizeTeamKey(r.home||'')}|${normalizeTeamKey(r.away||'')}`;
  let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return 'sk'+(h>>>0).toString(36);
}
function syncOwnLeagueMatchesFromSelkent(results=[],source='selkent'){
  const self=normalizeTeamKey(state.division.teamName||state.meta.teamName||'');
  if(!self)return;
  results.forEach(r=>{
    const home=normalizeTeamKey(r.home),away=normalizeTeamKey(r.away);
    const ownHome=home===self||home.includes(self)||self.includes(home);
    const ownAway=away===self||away.includes(self)||self.includes(away);
    if(!ownHome&&!ownAway)return;
    const id=stableSyncedMatchId(r);
    const opponent=ownHome?r.away:r.home;
    const match={id,date:r.date||'',competition:'League',type:'League',opponent,venue:ownHome?'H':'A',duration:null,gf:ownHome?Number(r.homeGoals||0):Number(r.awayGoals||0),ga:ownHome?Number(r.awayGoals||0):Number(r.homeGoals||0),stage:'',notes:'',source};
    const idx=state.matches.findIndex(m=>m.id===id||(isLeagueMatch(m)&&m.date===match.date&&normalizeTeamKey(m.opponent)===normalizeTeamKey(opponent)&&String(m.venue||'').toUpperCase()===match.venue));
    if(idx>=0){const keepId=state.matches[idx].id;state.matches[idx]={...state.matches[idx],...match,id:keepId};}else state.matches.push(match);
  });
}
function parseFixtureTime(text=''){
  const m=String(text).match(/(?:^|\s)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s|$)/);
  return m?`${String(m[1]).padStart(2,'0')}:${m[2]}`:'';
}
function clubUrlForTeam(doc,team,baseUrl=''){
  const target=selkentNorm(team);if(!target)return'';
  const links=[...doc.querySelectorAll('a[href*="/public/clubs/"]')];
  let hit=links.find(a=>{const t=selkentNorm(a.textContent);return t===target||(target.length>4&&(t.includes(target)||target.includes(t)));});
  if(!hit){const row=[...doc.querySelectorAll('tr,li,article,.fixture,.match')].find(el=>selkentNorm(el.textContent).includes(target));if(row){const candidates=[...row.querySelectorAll('a[href*="/public/clubs/"]')];hit=candidates.find(a=>selkentNorm(a.textContent).includes(target))||candidates[0];}}
  return hit?resolveWebUrl(baseUrl,hit.getAttribute('href')||''):'';
}
function parseClubColours(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const text=(doc.body?.innerText||doc.body?.textContent||'').replace(/\s+/g,' ').trim();
  const m=text.match(/Club Colours\s+(.+?)(?=\s+(?:Website|Map|Committee|Teams|Players Wanted|Home Ground|Other Grounds)\b)/i);
  return m?m[1].trim().replace(/\s+/g,' '):'';
}

async function fetchClubDirectoryDetails(teamName){
  const key=selkentNorm(teamName);if(!key)return null;
  state.selkent=state.selkent||{};state.selkent.directoryDetails=state.selkent.directoryDetails||{};
  if(state.selkent.directoryDetails[key])return state.selkent.directoryDetails[key];
  try{
    const r=await fetch(`${SELKENT_DIRECTORY_API}?team=${encodeURIComponent(teamName)}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    const detail={clubName:d.club_name||teamName,colours:d.club_colours||'TBC',groundName:d.home_ground?.name||'TBC',address:d.home_ground?.address||'TBC',sourceUrl:d.source_url||''};
    state.selkent.directoryDetails[key]=detail;
    if(detail.colours&&detail.colours!=='TBC')state.selkent.kitColours[key]=detail.colours;
    return detail;
  }catch(_){return null;}
}

function parseSelkentHtml(html,url=''){
  const doc=new DOMParser().parseFromString(html,'text/html'),scope=selkentScope(doc),rows=[...scope.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.textContent.trim())).filter(r=>r.length);
  const parsedStandings=[];
  rows.forEach(c=>{const row=standingFromCells(c);if(row)parsedStandings.push(row);});
  const table=sanitizeRemoteStandings(parsedStandings);
  const known=[...allDivisionTeams(),...table.map(r=>r.team)].filter(plausibleDivisionTeamName);
  const fixtures=[],results=[],teams=new Set(table.map(r=>r.team));
  const self=state.division.teamName||state.meta.teamName||'';
  rows.forEach(cells=>{
    const text=cells.join(' '),pair=teamPairFromCells(cells,known);if(!pair)return;
    pair.forEach(t=>teams.add(t));
    const scoreCell=cells.find(c=>/^\s*\d{1,2}\s*[-–—:]\s*\d{1,2}\s*$/.test(String(c)));
    const score=scoreCell?String(scoreCell).match(/(\d{1,2})\s*[-–—:]\s*(\d{1,2})/):null;
    const date=parseSelkentDate(text);
    if(score){results.push({id:uid('sr'),date,home:pair[0],away:pair[1],homeGoals:Number(score[1]),awayGoals:Number(score[2]),source:'selkent',raw:text});return;}
    const includesSelf=pair.some(t=>selkentNorm(t)===selkentNorm(self)||selkentNorm(t).includes(selkentNorm(self))||selkentNorm(self).includes(selkentNorm(t)));
    if(includesSelf){
      const ownIndex=pair.findIndex(t=>selkentNorm(t)===selkentNorm(self)||selkentNorm(t).includes(selkentNorm(self))||selkentNorm(self).includes(selkentNorm(t)));
      const opponent=pair[ownIndex===0?1:0];
      fixtures.push({date,time:parseFixtureTime(text),opponent,venue:ownIndex===0?'H':'A',opponentClubUrl:clubUrlForTeam(doc,opponent,url),raw:text});
    }
  });
  // Verified live Selkent fixture shape (captured 2026-09-21):
  // #fixtureContainer > h2.subHead date headings, .panel-title divisions,
  // and .fixtureRow rows with data-team-ids. .nonFixture rows are statuses.
  const fixtureContainer=doc.querySelector('#fixtureContainer');
  if(fixtureContainer){
    let fixtureDate='',fixtureDivision='';
    fixtureContainer.querySelectorAll('h2.subHead,.panel-title,.fixtureRow').forEach(el=>{
      if(el.matches('h2.subHead')){fixtureDate=parseSelkentDate(el.textContent||'')||fixtureDate;return;}
      if(el.matches('.panel-title')){fixtureDivision=String(el.textContent||'').replace(/\s+/g,' ').trim();return;}
      if(!el.matches('.fixtureRow')||el.classList.contains('nonFixture'))return;
      if(state.division?.name&&(!fixtureDivision||selkentNorm(fixtureDivision)!==selkentNorm(state.division.name)))return;
      const cols=[...el.children].filter(child=>child.classList?.contains('col-xs-5')).map(child=>String(child.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
      if(cols.length<2||!fixtureDate)return;
      const pair=[cols[0],cols[cols.length-1]];
      pair.forEach(t=>teams.add(t));
      const ownIndex=pair.findIndex(t=>selkentNorm(t)===selkentNorm(self)||selkentNorm(t).includes(selkentNorm(self))||selkentNorm(self).includes(selkentNorm(t)));
      if(ownIndex<0)return;
      const opponent=pair[ownIndex===0?1:0];
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      fixtures.push({date:fixtureDate,time:'',opponent,venue:ownIndex===0?'H':'A',opponentClubUrl:clubUrlForTeam(doc,opponent,url),providerTeamIds:String(el.getAttribute('data-team-ids')||'').split(';').filter(Boolean),raw:text});
    });
  }
  const uniqTable=[];const seenT=new Set();table.forEach(r=>{const k=selkentNorm(r.team);if(!seenT.has(k)){seenT.add(k);uniqTable.push(r);}});
  const uniqFixtures=[];const seenF=new Set();fixtures.forEach(f=>{const k=`${f.date}|${selkentNorm(f.opponent)}|${f.venue}`;if(!seenF.has(k)){seenF.add(k);uniqFixtures.push(f);}});
  const uniqResults=[];const seenR=new Set();results.forEach(r=>{const k=leagueResultSignature(r);if(!seenR.has(k)){seenR.add(k);uniqResults.push(r);}});
  return{table:uniqTable,fixtures:uniqFixtures,results:uniqResults,teams:[...teams].filter(plausibleTeamName),url};
}
function applySelkentTeamDiscovery(discovered=[]){
  const self=state.division.teamName||state.meta.teamName||'';
  const clean=[];const seen=new Set();
  [self,...discovered].forEach(t=>{const name=String(t||'').trim(),k=selkentNorm(name);if(name&&k&&!seen.has(k)&&plausibleTeamName(name)){seen.add(k);clean.push(name);}});
  if(clean.length>=2){
    const existing=allDivisionTeams();
    const merged=[];const mseen=new Set();
    [...clean,...existing].forEach(t=>{const k=selkentNorm(t);if(k&&!mseen.has(k)){mseen.add(k);merged.push(t);}});
    state.division.teams=merged;
  }
}
function renderSelkentSettings(){
  const sk=state.selkent||STARTER_DATA.selkent;const provider=providerType();
  const auto=document.getElementById('selkent-auto-sync');if(auto)auto.checked=sk.enabled!==false;
  const tc=document.getElementById('selkent-club-team-count');
  if(tc)tc.textContent=`${clubTeams().length} ${(clubSettings().short_name||clubSettings().display_name||'club')} team${clubTeams().length===1?'':'s'} available`;
  const status=document.getElementById('selkent-sync-status'),dot=document.getElementById('selkent-sync-dot');
  if(status){const when=sk.lastSync?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(sk.lastSync)):'';status.textContent=provider==='selkent'?(sk.status||'Automatic Selkent updates enabled'):'Manual provider · fixtures and results are entered in the app';}
  if(dot){dot.className='sync-dot '+(sk.status?.toLowerCase().includes('failed')?'bad':sk.lastSync?'good':'');}
  const source=document.getElementById('selkent-division-source');if(source){if(provider==='selkent')source.textContent=state.division.name?`Confirmed from Selkent Divisions: ${state.division.name} · ${divisionOpponents().length} opponents`:'Division not confirmed yet';else source.textContent='Manual league setup';}
  const tableBtn=document.getElementById('sync-league-table');if(tableBtn){tableBtn.classList.toggle('hidden',provider!=='selkent'||!leagueTableEnabled());tableBtn.disabled=false;}
  const tableHint=document.getElementById('league-table-sync-hint');if(tableHint)tableHint.textContent=leagueTableEnabled()?(sk.lastTableSync?`League table last synced ${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(sk.lastTableSync))}.`:'This age group appears on Selkent Results, so its published league table will sync automatically.'):'This age group does not appear as a published league table on Selkent Results. Coaches enter division results directly in the app.';
}
function saveSelkentSettings(){
  if(!requireCoach())return;
  state.selkent=state.selkent||cloneStarter().selkent;
  state.selkent.enabled=document.getElementById('selkent-auto-sync').checked;
  saveState();toast('League sync setting saved');
}
function furtherFixtureCardHtml(f,index){
  const ctx=fixtureOverviewContext(f),warning=kitWarningHtml(ctx),mapFrame=ctx.mapEmbedHref?`<div class="fixture-map-preview further-fixture-map"><iframe title="${esc(f.opponent||'Fixture')} venue map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(ctx.mapEmbedHref)}"></iframe></div>`:'';
  const reportAction=isCoach()?`<button type="button" class="primary-button compact match-played-action" data-further-match-played="${index}">Match played</button>`:'';
  return `<article class="further-fixture-card"><div class="further-fixture-head"><div><span class="synced-fixture-date">${f.date?formatDate(f.date):'Date TBC'}${f.time?' · '+esc(f.time):' · Kick-off TBC'}</span><strong>${esc(fixtureCompetitionLabel(f))}</strong></div>${reportAction}</div><div class="match-versus"><div class="match-team-side"><span class="match-side-label">Home</span>${kitIconHtml(ctx.homeKit)}${clubTeamLink(ctx.homeTeam)}<small>${esc(ctx.homeKitType)} · ${esc(ctx.homeKit)}</small></div><div class="match-versus-mark">V</div><div class="match-team-side"><span class="match-side-label">Away</span>${kitIconHtml(ctx.awayKit)}${clubTeamLink(ctx.awayTeam)}<small>${esc(ctx.awayKitType)} · ${esc(ctx.awayKit)}</small></div></div><div class="match-venue-card"><div><span>Venue</span><strong>${esc(ctx.ground)}</strong><small>${esc(ctx.address)}</small></div>${ctx.mapHref?`<a class="map-link" href="${esc(ctx.mapHref)}">Open in Maps</a>`:''}</div>${mapFrame}${warning}</article>`;
}
function renderSelkentFixtures(){
  const list=document.getElementById('selkent-fixtures-list'),count=document.getElementById('selkent-fixtures-count'),meta=document.getElementById('selkent-fixtures-meta');if(!list)return;
  const fixtures=upcomingFixtures(),further=fixtures.slice(1);
  if(count)count.textContent=String(further.length);
  list.innerHTML=further.map(furtherFixtureCardHtml).join('')||'<div class="empty-state compact-empty">No additional fixtures released yet.</div>';
  if(meta)meta.textContent='';
}
async function syncSelkent(silent=false){
  const sk=state.selkent||cloneStarter().selkent;
  if(providerType()!=='selkent'){state.selkent.enabled=false;state.selkent.status='Manual provider';renderSelkentSettings();if(!silent)toast('This club uses manual fixtures and results');return;}
  const dot=document.getElementById('selkent-sync-dot'),status=document.getElementById('selkent-sync-status');
  if(dot)dot.className='sync-dot busy';if(status)status.textContent='Checking division, fixtures and results with Selkent…';
  if(!silent)toast('Syncing with Selkent…');
  try{
    await syncProviderClubTeams(true);
    // Selkent Results determines whether this age group has a published league table.
    // The Divisions page is still authoritative for the team's actual division and opponents.
    await refreshPublishedLeagueAges(true);
    // The Divisions tab is authoritative for age/division membership. Resolve it
    // before visiting fixtures or results so a team can never inherit a division
    // from the previously selected team.
    await syncSelkentDivision(true);
    const fixturePage=await fetchSelkentSelected(sk.fixturesUrl||STARTER_DATA.selkent.fixturesUrl,[state.meta.ageGroup,state.division.name].filter(Boolean));
    const fixtureData=parseSelkentHtml(fixturePage.html,fixturePage.url);
    let resultData={table:[],fixtures:[],results:[],teams:[]};
    if(leagueTableEnabled()){
      const resultPage=await fetchSelkentSelected(sk.resultsUrl||STARTER_DATA.selkent.resultsUrl,[state.meta.ageGroup,state.division.name].filter(Boolean));
      resultData=parseSelkentHtml(resultPage.html,resultPage.url);
    }
    const previousNext=nextPublishedFixture();
    state.selkent=state.selkent||cloneStarter().selkent;
    state.selkent.fixtures=fixtureData.fixtures||[];
    state.selkent.lastFixtureScan=new Date().toISOString();
    await ensureFixtureKitColours(nextPublishedFixture());
    updateFixtureTracking(previousNext,nextPublishedFixture());
    if(leagueTableEnabled()){
      state.selkent.table=resultData.table||[];
      state.selkent.results=resultData.results||[];
      state.selkent.lastTableSync=new Date().toISOString();
      syncOwnLeagueMatchesFromSelkent(state.selkent.results);
    } else {state.selkent.table=[];state.selkent.results=[];state.selkent.lastTableSync='';}
    applySelkentTeamDiscovery([...(state.division.teams||[]),...(fixtureData.teams||[]),...(resultData.teams||[])]);
    state.selkent.lastSync=new Date().toISOString();
    const bits=[isPublishedLeagueTeam()?'League':'No-league'];if(state.division.name)bits.push(state.division.name);if(divisionOpponents().length)bits.push(`${divisionOpponents().length} opponents`);if(state.selkent.fixtures.length)bits.push(`${state.selkent.fixtures.length} fixture${state.selkent.fixtures.length===1?'':'s'}`);if(state.selkent.table.length)bits.push(`${state.selkent.table.length} table teams`);if(state.selkent.results.length)bits.push(`${state.selkent.results.length} results`);
    state.selkent.status='League data updated automatically';
    saveState();
    if(CLOUD_MODE&&isAdmin())refreshAdminClubOverview(true);
    if(!silent)toast(bits.length?'Selkent sync complete':'Selkent page loaded; check setup');
  }catch(err){
    state.selkent=state.selkent||cloneStarter().selkent;state.selkent.status='League data will retry automatically';persistLocalState();renderSelkentSettings();if(!silent)toast('Selkent sync failed');
  }
}
function shouldAutoSync(){
  if(providerType()!=='selkent')return false;
  if(state.selkent?.enabled===false)return false;
  if(!state.selkent?.lastSync)return true;
  return Date.now()-new Date(state.selkent.lastSync).getTime()>30*60*1000;
}

function shouldScanFixtures(){
  if(providerType()!=='selkent')return false;
  if(state.selkent?.enabled===false)return false;
  if(!state.selkent?.lastFixtureScan)return true;
  return Date.now()-new Date(state.selkent.lastFixtureScan).getTime()>FIXTURE_SCAN_INTERVAL_MS;
}
function fixtureLinkedMatch(f={}){
  const opponent=normalizeTeamKey(f.opponent||''),venue=String(f.venue||'').toUpperCase(),date=String(f.date||'');
  if(!opponent||!date)return null;
  return state.matches.find(m=>String(m.date||'')===date&&normalizeTeamKey(m.opponent||'')===opponent&&String(m.venue||'').toUpperCase()===venue)||null;
}
function fixtureIsReported(f={}){const m=fixtureLinkedMatch(f);return !!m&&['played','abandoned'].includes(matchStatus(m));}
function upcomingFixtures(){
  const today=new Date();today.setHours(0,0,0,0);
  return [...(state.selkent?.fixtures||[])].filter(f=>(!f.date||new Date(f.date+'T12:00:00')>=today)&&!fixtureIsReported(f)).sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||(a.time||'99:99').localeCompare(b.time||'99:99'));
}
function nextPublishedFixture(){return upcomingFixtures()[0]||null;}
function fixtureCompetitionLabel(f={}){
  const m=fixtureLinkedMatch(f),competition=String(m?.competition||f.competition||'').trim(),stage=String(m?.stage||f.stage||'').trim();
  if(/^(league|division)$/i.test(competition)||!competition)return [state.division?.name||(isPublishedLeagueTeam()?'League':'Division'),stage].filter(Boolean).join(' · ');
  return [competition,stage].filter(Boolean).join(' · ')||'Competition TBC';
}
function openFixtureMatchReport(f){
  if(!requireCoach())return;if(!f)return toast('No published fixture available');
  let m=fixtureLinkedMatch(f);
  if(!m){
    const competition=isPublishedLeagueTeam()?'League':'Division';
    m={id:uid('m'),date:f.date||new Date().toISOString().slice(0,10),opponent:f.opponent||'Opponent',competition,type:competition,tournamentId:null,venue:String(f.venue||'').toUpperCase(),duration:null,stage:'',gf:0,ga:0,status:'scheduled',notes:'',source:'selkent-fixture',providerTeamIds:Array.isArray(f.providerTeamIds)?[...f.providerTeamIds]:[]};
    state.matches.push(m);saveState();auditEvent('fixture_report_started','match',m.id,`Started match report vs ${m.opponent}`,null,m);
  }
  openMatchReport(m.id);
}
function openNextFixtureMatchReport(){return openFixtureMatchReport(nextPublishedFixture());}
function openFurtherFixtureMatchReport(index){const f=upcomingFixtures().slice(1)[Number(index)];return openFixtureMatchReport(f);}
function fixtureStableKey(f={}){
  return [selkentNorm(f.opponent||'tbc'),String(f.venue||'').toUpperCase(),selkentNorm(f.competition||'fixture')].join('|');
}
function fixtureFingerprint(f={}){
  return [fixtureStableKey(f),f.date||'',f.time||'',selkentNorm(f.groundName||''),selkentNorm(f.address||''),selkentNorm(f.kitColours||'')].join('|');
}
function fixtureSummary(f={}){
  return [f.opponent||'TBC',f.date?formatDate(f.date):'Date TBC',f.time||'Kick-off TBC',f.venue==='A'?'Away':f.venue==='H'?'Home':'Venue TBC',f.groundName||f.address||''].filter(Boolean).join(' · ');
}
function fixtureSnapshot(f={}){
  return {opponent:f.opponent||'',date:f.date||'',time:f.time||'',venue:f.venue||'',groundName:f.groundName||'',address:f.address||'',kitColours:f.kitColours||'',competition:f.competition||''};
}
function fixtureChangeList(before={},after={}){
  const fields=[['opponent','Opponent'],['date','Date'],['time','Kick-off'],['venue','Home / away'],['groundName','Ground'],['address','Address'],['kitColours','Opposition colours']];
  const fmt=(k,v)=>k==='date'&&v?formatDate(v):k==='venue'?(v==='A'?'Away':v==='H'?'Home':v||'TBC'):(v||'TBC');
  return fields.filter(([k])=>String(before?.[k]||'')!==String(after?.[k]||'')).map(([k,label])=>({field:k,label,before:fmt(k,before?.[k]),after:fmt(k,after?.[k])}));
}
function likelySameFixture(before={},after={}){
  if(!before||!after)return false;
  const sameComp=selkentNorm(before.competition||'fixture')===selkentNorm(after.competition||'fixture');
  const sameOpp=selkentNorm(before.opponent||'')&&selkentNorm(before.opponent||'')===selkentNorm(after.opponent||'');
  const sameDate=before.date&&after.date&&before.date===after.date;
  const sameGround=(selkentNorm(before.groundName||'')&&selkentNorm(before.groundName||'')===selkentNorm(after.groundName||''))||(selkentNorm(before.address||'')&&selkentNorm(before.address||'')===selkentNorm(after.address||''));
  return sameComp&&(sameOpp||sameDate||sameGround);
}
function updateFixtureTracking(previousFixture,nextFixture){
  state.selkent=state.selkent||{};
  const old=state.selkent.fixtureTracking||{};
  const key=nextFixture?fixtureStableKey(nextFixture):'';
  const fingerprint=nextFixture?fixtureFingerprint(nextFixture):'';
  const summary=nextFixture?fixtureSummary(nextFixture):'';
  const before=old.snapshot&&Object.keys(old.snapshot).length?old.snapshot:fixtureSnapshot(previousFixture||{});
  const after=fixtureSnapshot(nextFixture||{});
  const same=nextFixture&&previousFixture&&likelySameFixture(previousFixture,nextFixture);
  const changes=same?fixtureChangeList(before,after):[];
  if(same&&old.fingerprint&&old.fingerprint!==fingerprint&&changes.length){
    state.selkent.fixtureTracking={key,fingerprint,summary,snapshot:after,continuityKey:old.continuityKey||old.key||key,changedAt:new Date().toISOString(),previousSummary:old.summary||fixtureSummary(previousFixture||{}),changes,changed:true};
    if(CLOUD_MODE&&isCoach()&&window.ClubHubCloud?.notifyFixtureChange){setTimeout(()=>window.ClubHubCloud.notifyFixtureChange(key,fixtureChangeText(state.selkent.fixtureTracking)).then(()=>refreshNotifications(true)).catch(()=>{}),0);}
  }else{
    state.selkent.fixtureTracking={key,fingerprint,summary,snapshot:after,continuityKey:same?(old.continuityKey||old.key||key):key,changedAt:(same&&old.key===key)?old.changedAt||'':'',previousSummary:(same&&old.key===key)?old.previousSummary||'':'',changes:(same&&old.key===key)?(old.changes||[]):[],changed:(same&&old.key===key)?!!old.changed:false};
  }
  if(previousFixture&&nextFixture&&!same)state.selkent.fixtureAcknowledgement={};
  if(!nextFixture)state.selkent.fixtureAcknowledgement={};
}
function fixtureChangeText(track={}){
  const changes=Array.isArray(track.changes)?track.changes:[];
  if(!changes.length)return track.previousSummary?`Previously: ${track.previousSummary}`:'Selkent details changed after the previous confirmation.';
  return changes.map(c=>`${c.label}: ${c.before} → ${c.after}`).join(' · ');
}
function fixtureAckState(st=state,f=nextPublishedFixture()){
  if(!f)return {status:'none',label:'No fixture published',detail:'',note:'',changes:[]};
  const sk=st.selkent||{},ack=sk.fixtureAcknowledgement||{},track=sk.fixtureTracking||{};
  const fp=fixtureFingerprint(f),key=fixtureStableKey(f);
  if(track.changed&&ack.fingerprint!==fp)return {status:'changed',label:'Fixture changed — reconfirm',detail:fixtureChangeText(track),note:'',changes:track.changes||[]};
  if(ack.fingerprint===fp&&ack.status==='confirmed')return {status:'confirmed',label:'Fixture confirmed',detail:ack.at?`Confirmed ${new Date(ack.at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}`:'Confirmed',note:ack.note||'',changes:[]};
  if(ack.fingerprint===fp&&ack.status==='issue')return {status:'issue',label:'Issue reported',detail:ack.note||'The coaching staff flagged an issue with this fixture.',note:ack.note||'',changes:[]};
  return {status:'awaiting',label:'Awaiting confirmation',detail:'Confirm the fixture once the coach has checked the details.',note:'',changes:[]};
}
function setFixtureAcknowledgement(status){
  if(!requireCoach())return;
  const f=nextPublishedFixture();if(!f)return toast('No published fixture to confirm');
  let note='';if(status==='issue'){note=prompt('What needs checking with this fixture?','')||'';if(!note.trim())return;}
  state.selkent=state.selkent||{};state.selkent.fixtureAcknowledgement={status,fingerprint:fixtureFingerprint(f),key:fixtureStableKey(f),note:note.trim(),at:new Date().toISOString()};
  if(state.selkent.fixtureTracking){state.selkent.fixtureTracking.changed=false;state.selkent.fixtureTracking.previousSummary='';state.selkent.fixtureTracking.changes=[];}
  saveState();auditEvent(status==='issue'?'fixture_issue':'fixture_confirmed','fixture',fixtureStableKey(f),status==='issue'?`Fixture issue: ${note.trim()}`:`Confirmed fixture vs ${f.opponent}`,null,{status,note:note.trim()});renderNextMatch();renderMatchdayDashboard();toast(status==='confirmed'?'Fixture confirmed':'Issue reported to Club Admin');
}
async function ensureFixtureKitColours(fixture){
  if(!fixture)return false;
  state.selkent=state.selkent||{};state.selkent.kitColours=state.selkent.kitColours||{};state.selkent.directoryDetails=state.selkent.directoryDetails||{};
  let changed=false;
  const ownKey=selkentNorm(clubSettings().display_name||state.meta?.clubName||'club');
  if(!state.selkent.kitColours[ownKey]){
    try{const r=await nativeHttp(state.selkent.clubUrl||STARTER_DATA.selkent.clubUrl);const c=parseClubColours(r.body);if(c){state.selkent.kitColours[ownKey]=c;changed=true;}}catch(_){ }
  }
  const oppKey=selkentNorm(fixture.opponent);
  const before=JSON.stringify(state.selkent.directoryDetails[oppKey]||null);
  const detail=await fetchClubDirectoryDetails(fixture.opponent);
  if(detail){
    fixture.clubName=detail.clubName||fixture.clubName||fixture.opponent;
    fixture.kitColours=detail.colours||fixture.kitColours||'TBC';
    fixture.groundName=detail.groundName||fixture.groundName||'TBC';
    fixture.address=detail.address||fixture.address||'TBC';
    if(before!==JSON.stringify(detail))changed=true;
  }else if(oppKey&&!state.selkent.kitColours[oppKey]&&fixture.opponentClubUrl){
    try{const r=await nativeHttp(fixture.opponentClubUrl);const c=parseClubColours(r.body);if(c){state.selkent.kitColours[oppKey]=c;fixture.kitColours=c;changed=true;}}catch(_){ }
  }
  if(changed)persistLocalState();
  return changed;
}
async function scanUpcomingFixtures(silent=true){
  if(state.selkent?.enabled===false||!state.division?.name)return false;
  if(window.ClubHubStaticSelkent?.applyStaticFixtures){
    try{
      await window.ClubHubStaticSelkent.applyStaticFixtures(silent,true);
      renderNextMatch();renderMatchPageNextFixture();refreshMatchAvailability(true);renderSelkentFixtures();renderLeagueQuickView();renderMatchdayDashboard();
      return true;
    }catch(_){/* use the isolated live migration fallback below only if the static feed cannot be read */}
  }
  try{
    const page=await fetchSelkentSelected(state.selkent.fixturesUrl||STARTER_DATA.selkent.fixturesUrl,[state.meta.ageGroup,state.division.name].filter(Boolean));
    const parsed=parseSelkentHtml(page.html,page.url);
    const before=JSON.stringify(state.selkent.fixtures||[]);
    const previousNext=nextPublishedFixture();
    state.selkent.fixtures=parsed.fixtures||[];
    state.selkent.lastFixtureScan=new Date().toISOString();
    const next=nextPublishedFixture();
    const colourChanged=await ensureFixtureKitColours(next);
    updateFixtureTracking(previousNext,nextPublishedFixture());
    const changed=before!==JSON.stringify(state.selkent.fixtures||[])||colourChanged;
    persistLocalState();
    if(changed&&CLOUD_MODE&&isCoach())window.ClubHubCloud?.queueStateSave?.(state);
    renderNextMatch();refreshMatchAvailability(true);renderSelkentFixtures();renderLeagueQuickView();
    if(!silent&&changed)toast('Upcoming fixtures refreshed');
    return true;
  }catch(err){if(!silent)toast('Fixture check failed');return false;}
}
function renderNextMatch(){
  const card=document.getElementById('next-match-card');if(!card)return;
  const f=nextPublishedFixture(),status=document.getElementById('next-match-status'),ackPanel=document.getElementById('fixture-ack-panel');
  if(!f){
    card.classList.add('no-fixture');document.getElementById('next-match-opponent').textContent='TBC';document.getElementById('next-match-when').textContent='Date / kick-off TBC';document.getElementById('next-match-venue').textContent='Competition TBC';document.getElementById('next-match-kits').textContent='Kit colours and away details will appear when confirmed.';
    clearFixtureOverview('next-match');
    const cal=document.getElementById('next-match-calendar');if(cal)cal.classList.add('hidden');const played=document.getElementById('next-match-played');if(played)played.classList.add('hidden');if(status)status.textContent='';if(ackPanel)ackPanel.classList.add('hidden');return;
  }
  card.classList.remove('no-fixture');document.getElementById('next-match-opponent').textContent=f.opponent||'TBC';document.getElementById('next-match-when').textContent=[f.date?formatDate(f.date):'TBC',f.time||'Kick-off TBC'].filter(Boolean).join(' · ');document.getElementById('next-match-venue').textContent=fixtureCompetitionLabel(f);
  renderFixtureOverview('next-match',f);
  document.getElementById('next-match-kits').textContent='Home and away kit details shown above.';
  const cal=document.getElementById('next-match-calendar');if(cal)cal.classList.toggle('hidden',!f.date);
  const played=document.getElementById('next-match-played');if(played)played.classList.toggle('hidden',!isCoach());
  const ack=fixtureAckState();
  if(status){status.textContent=ack.status==='confirmed'?'Confirmed':ack.status==='issue'?'Issue':ack.status==='changed'?'Changed':'';status.classList.toggle('hidden',!status.textContent);}
  if(ackPanel){ackPanel.className=`fixture-ack ${ack.status}`;ackPanel.classList.toggle('hidden',!(isCoach()||isAdminTeamPreviewMode()||['parent','player'].includes(currentRole)));const label=document.getElementById('fixture-ack-label'),detailEl=document.getElementById('fixture-ack-detail'),actions=ackPanel.querySelector('.fixture-ack-actions');if(label)label.textContent=ack.label;if(detailEl)detailEl.textContent=ack.note||ack.detail;if(actions)actions.classList.toggle('hidden',!isCoach());}
  refreshFixtureOverviewDirectory(f);
}

function renderMatchPageNextFixture(){
  const card=document.getElementById('matches-next-fixture');if(!card)return;
  const f=nextPublishedFixture();
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  if(!f){
    card.classList.add('no-fixture');set('matches-next-opponent','TBC');set('matches-next-when','Date / kick-off TBC');set('matches-next-venue','Competition TBC');set('matches-next-kits','Kit colours and away details will appear when confirmed.');
    clearFixtureOverview('matches-next');
    const cal=document.getElementById('matches-next-calendar');if(cal)cal.classList.add('hidden');const played=document.getElementById('matches-next-played');if(played)played.classList.add('hidden');
    return;
  }
  card.classList.remove('no-fixture');
  set('matches-next-opponent',f.opponent||'TBC');
  set('matches-next-when',[f.date?formatDate(f.date):'Date TBC',f.time||'Kick-off TBC'].join(' · '));
  set('matches-next-venue',fixtureCompetitionLabel(f));
  renderFixtureOverview('matches-next',f);
  set('matches-next-kits','Home and away kit details shown above.');
  const cal=document.getElementById('matches-next-calendar');if(cal)cal.classList.toggle('hidden',!f.date);
  const played=document.getElementById('matches-next-played');if(played)played.classList.toggle('hidden',!isCoach());
}

function divisionOpponents(){
  const d = state.division || STARTER_DATA.division;
  const self = String(d.teamName || '').trim().toLowerCase();
  return sanitizeDivisionTeamList(d.teams||[]).filter(t=>String(t).trim().toLowerCase()!==self);
}
function leagueMatchesFor(team){ const pred=isPublishedLeagueTeam()?isLeagueMatch:isDivisionMatch;return state.matches.filter(m=>pred(m)&&m.opponent===team).sort((a,b)=>a.date.localeCompare(b.date)); }
function statsFor(matches){
  const ms = (matches || []).filter(isPlayedMatch);
  const wins = ms.filter(m=>resultOf(m)==='W').length;
  const draws = ms.filter(m=>resultOf(m)==='D').length;
  const losses = ms.filter(m=>resultOf(m)==='L').length;
  const gf = ms.reduce((s,m)=>s+Number(m.gf||0),0);
  const ga = ms.reduce((s,m)=>s+Number(m.ga||0),0);
  return { played:ms.length,wins,draws,losses,gf,ga,gd:gf-ga,winrate:ms.length?Math.round(wins/ms.length*100):0 };
}
function isCoach(){ return CLOUD_MODE ? (['coach','assistant_coach'].includes(currentRole)||(currentRole==='admin'&&isAdminCoachMode()&&hasDualAdminCoach())) : (isAdmin() || (!IS_PARENT_BUILD && (IS_COACH_BUILD || ['coach','assistant_coach'].includes(account?.role)))); }
function requireCoach(message='Coach access is required to edit team data.'){
  if(isCoach()) return true;
  toast(message);
  return false;
}
function safeFileName(){ return (state.meta.teamName || 'Team').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'') || 'Team'; }
function applyAccessMode(){
  if(isTeamLocked())enforceAssignedTeam(false);
  const preview=isAdminTeamPreviewMode();
  const coaching=['coach','assistant_coach'].includes(currentRole)||isAdminCoachMode();
  const readonly=!isCoach();
  document.body.classList.toggle('role-parent',currentRole==='parent'||currentRole==='pending_parent');
  document.body.classList.toggle('role-player',currentRole==='player');
  document.body.classList.toggle('role-admin',isAdmin());
  document.body.classList.toggle('role-coach',coaching||isAdminCoachMode());
  document.body.classList.toggle('role-assistant-coach',currentRole==='assistant_coach');
  document.body.classList.toggle('admin-coach-mode',isAdminCoachMode());
  document.body.classList.toggle('admin-preview-mode',preview);
  document.body.classList.toggle('admin-club-mode',isClubOverviewMode());
  const adminClub=isClubOverviewMode();
  const teamNavVisible=!adminClub;
  document.querySelectorAll('[data-team-nav]').forEach(el=>el.classList.toggle('hidden',!teamNavVisible));
  document.querySelectorAll('[data-coach-ui-only]').forEach(el=>el.classList.toggle('hidden',adminClub||preview||!isCoach()));
  document.querySelectorAll('[data-admin-global-nav]').forEach(el=>el.classList.toggle('hidden',!adminClub));
  document.querySelectorAll('[data-admin-club-root]').forEach(el=>el.classList.toggle('hidden',!adminClub));
  document.querySelectorAll('[data-results-global-nav]').forEach(el=>el.classList.toggle('hidden',!(adminClub||coaching)));
  document.querySelectorAll('[data-admin-settings-only]').forEach(el=>el.classList.toggle('hidden',!adminClub));
  document.querySelectorAll('[data-staff-history]').forEach(el=>el.classList.toggle('hidden',!['admin','coach','assistant_coach'].includes(currentRole)));
  document.querySelectorAll('[data-admin-season-panel]').forEach(el=>el.classList.toggle('hidden',!adminClub));
  const topNav=document.getElementById('top-nav-tabs');
  if(topNav)topNav.classList.remove('hidden');
  const inboxAllowed=['admin','coach','assistant_coach','parent'].includes(currentRole);document.querySelector('[data-nav="inbox"]')?.classList.toggle('hidden',!inboxAllowed);if(currentRole==='player'&&currentView==='inbox')navigate('home',false);
  document.body.classList.toggle('mini-results-restricted',miniResultsRestrictedView());

  const clubModeBtn=document.getElementById('admin-mode-club'),coachModeBtn=document.getElementById('admin-mode-coach');
  if(clubModeBtn)clubModeBtn.classList.toggle('active',isClubOverviewMode());
  if(coachModeBtn)coachModeBtn.classList.toggle('active',isAdminCoachMode());
  const modeCopy=document.getElementById('admin-ui-mode-copy');if(modeCopy)modeCopy.textContent=isAdminCoachMode()?'Coach profile':preview?'Club Admin team preview':'Club Admin overview';
  const accountMode=document.getElementById('admin-account-mode-switch');if(accountMode){const show=hasDualAdminCoach()&&!preview;accountMode.classList.toggle('hidden',!show);if(show){const own=dualCoachTeam();accountMode.textContent=isAdminCoachMode()?'Return to Club Admin':`Open ${own?.ageGroup||''} ${own?.teamName||'team'} Coach View`.trim();}}
  const profileSwitch=document.getElementById('hero-profile-switch');
  if(profileSwitch){
    const show=hasDualAdminCoach()&&!preview;
    profileSwitch.classList.toggle('hidden',!show);
    if(show){const own=dualCoachTeam();profileSwitch.textContent=isAdminCoachMode()?'Club Admin':`Coach · ${own?.ageGroup||''} ${own?.teamName||''}`.trim();}
  }
  const previewBack=document.getElementById('hero-admin-preview-back');if(previewBack)previewBack.classList.toggle('hidden',!preview);
  document.body.classList.toggle('team-locked',isTeamLocked());
  document.body.classList.toggle('team-has-league',isPublishedLeagueTeam());
  document.body.classList.toggle('build-parent',IS_PARENT_BUILD);
  document.body.classList.toggle('build-coach',IS_COACH_BUILD);
  document.body.classList.toggle('build-admin',IS_ADMIN_BUILD||BUILD_MODE==='standard');

  const summary=document.getElementById('access-summary');
  if(summary){
    if(CLOUD_MODE){
      const ct=window.ClubHubCloud?.currentTeam?.();
      const who=window.ClubHubCloud?.context?.profile?.full_name||cloudBootContext?.email||roleLabel();
      const mode=isAdminCoachMode()?'Coach profile':preview?'Club Admin preview':roleLabel();
      summary.textContent=`${who} · ${mode}${ct?` · ${ct.ageGroup} ${ct.teamName}`:''}`;
    }else if(isAdmin())summary.textContent='Club Admin access.';
    else if(account)summary.textContent=`${account.user||roleLabel()} · ${roleLabel()} · ${account.team.ageGroup} ${account.team.teamName}`;
    else summary.textContent=`${roleLabel()} access requires activation by a Club Admin.`;
  }
  const badge=document.getElementById('account-role-badge');if(badge)badge.textContent=isAdminCoachMode()?'Coach':roleLabel();
  const readOnly=document.getElementById('read-only-card');
  if(readOnly){
    readOnly.classList.toggle('hidden',!readonly);
    readOnly.textContent=preview?'Club Admin team preview · read-only.':currentRole==='parent'?'Parent access · read-only.':currentRole==='player'?'Player profile · read-only apart from match availability.':'Read-only access.';
  }
  updateActivationGate();
  document.getElementById('admin-club-overview')?.classList.toggle('hidden',!(CLOUD_MODE&&isClubOverviewMode()&&currentView==='club'&&__clubTab==='overview'));
  const clubTitle=document.getElementById('club-view-title'),clubKick=document.getElementById('club-view-kicker');
  if(clubTitle)clubTitle.textContent=isAdmin()?'Club Overview':'Club Results';
  if(clubKick)clubKick.textContent=isAdmin()?'Club administration':roleLabel();
  if(coaching&&__clubTab!=='results')__clubTab='results';
  if(['parent','player'].includes(currentRole)&&currentView==='club'){currentView='home';document.body.classList.remove('view-club');document.body.classList.add('view-home');}
  if(currentView==='club')setClubTab(__clubTab);
  renderMatches();
  renderTournamentEvents();
  renderSquad();
}

function navigate(view,scroll=true){
  const requested=view;
  if(view==='more'){const h=document.querySelector('#view-more .section-title-row h2');const k=document.querySelector('#view-more .section-title-row .kicker');if(h)h.textContent=isClubOverviewMode()?'Club settings':'Settings';if(k)k.textContent=isClubOverviewMode()?'Club administration':'App controls';}
  if(view==='club'&&isAdmin()&&!isClubOverviewMode()){adminUiMode='club';localStorage.setItem(ADMIN_UI_MODE_KEY,'club');}
  if(view==='club'){__clubTab='overview';view='club';}
  else if(view==='club-fixtures'){__clubTab='fixtures';view='club';}
  else if(view==='club-results'){__clubTab='results';view='club';}
  else if(view==='club-coaches'){__clubTab='coaches';view='club';}
  else if(view==='inbox'&&!['admin','coach','assistant_coach','parent'].includes(currentRole)){view='home';}
  if(view==='league' && !isPublishedLeagueTeam()) view='matches';
  if(view==='add' && !isCoach()){ toast('This access level is read-only'); view='home'; }
  if(isClubOverviewMode()&&['home','matches','squad','add','league'].includes(view)){__clubTab='overview';view='club';}
  currentView=view;
  [...document.body.classList].filter(c=>c.startsWith('view-')).forEach(c=>document.body.classList.remove(c));
  document.body.classList.add(`view-${view}`);
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
  renderTeamIdentity();
  let activeKey=requested;
  if(view==='club') activeKey=__clubTab==='overview'?'club':__clubTab==='fixtures'?'club-fixtures':__clubTab==='results'?'club-results':'club-coaches';
  if(view==='more')activeKey='more';
  document.querySelectorAll('.top-nav-tabs .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===activeKey));
  document.getElementById('top-nav-tabs')?.classList.remove('hidden');
  if(view==='add' && !document.getElementById('match-id').value) setDefaultDate();
  if(view==='club'&&CLOUD_MODE){
    if(['parent','player'].includes(currentRole)){navigate('home',false);return;}
    else if(['coach','assistant_coach'].includes(currentRole)&&__clubTab!=='results')__clubTab='results';
    else if(isAdmin()&&!['overview','fixtures','results','coaches'].includes(__clubTab))__clubTab='overview';
    setClubTab(__clubTab);
  }
  applyAccessMode();
  applyMiniResultVisibility();
  if(view==='inbox')refreshInbox(false);
  if(scroll) window.scrollTo({top:0,behavior:'smooth'});
}

let __selkentAgeTeams=[];
let __selkentDirectoryAge=0;
let __selkentDirectoryLoading=false;
let __selkentDirectorySyncTried=false;
function configureOpponentEditorForProvider(){
  const current=document.getElementById('match-opponent'),wrap=document.getElementById('match-opponent-input-wrap'),help=document.getElementById('match-opponent-directory-help');if(!current||!wrap)return;
  if(providerType()!=='selkent'&&current.tagName==='SELECT'){
    const input=document.createElement('input');input.id='match-opponent';input.required=true;input.setAttribute('list','division-opponents-list');input.placeholder='Type opponent name';input.value=current.value||'';current.replaceWith(input);if(help)help.textContent='Manual provider · type the opponent or choose a saved division opponent.';
  }else if(providerType()==='selkent'&&current.tagName==='INPUT'){
    const select=document.createElement('select');select.id='match-opponent';select.required=true;select.innerHTML='<option value="">Select same-age provider team</option>';current.replaceWith(select);if(help)help.textContent='Teams are filtered to this age group from the competition provider directory.';
  }
}
function renderSelkentOpponentSelect(){
  const select=document.getElementById('match-opponent');if(!select||select.tagName!=='SELECT')return;
  const keep=select.value;
  const ownNames=[state.division?.teamName,state.meta?.teamName,`${state.meta?.clubName||clubSettings().display_name||'Club'} ${state.meta?.teamName||''}`].filter(Boolean).map(selkentNorm);
  const rows=__selkentAgeTeams.filter(r=>!ownNames.includes(selkentNorm(r.display_name))).slice().sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||'')));
  select.innerHTML='<option value="">Select same-age provider team</option>'+rows.map(r=>`<option value="${esc(r.display_name)}">${esc(r.club_name)} — ${esc(r.team_label.replace(/^Under\s+\d+(?:X)?s?\s*/i,'' )||r.team_label)}</option>`).join('');
  if(keep&&!rows.some(r=>r.display_name===keep))select.add(new Option(keep,keep));
  if(keep)select.value=keep;
  const help=document.getElementById('match-opponent-directory-help');if(help)help.textContent=rows.length?`${rows.length} U${ageGroupNumber()} provider teams available`:'Loading same-age provider teams…';
}
function ensureOpponentOption(name=''){const select=document.getElementById('match-opponent');const value=String(name||'').trim();if(!select||!value)return;if(select.tagName==='INPUT'){select.value=value;return;}if(![...select.options].some(o=>o.value===value))select.add(new Option(value,value));select.value=value;}
async function refreshSelkentOpponentDirectory(force=false){
  configureOpponentEditorForProvider();
  if(providerType()!=='selkent'){const help=document.getElementById('match-opponent-directory-help');if(help)help.textContent='Manual provider · type the opponent or use a saved opponent.';return;}
  if(!CLOUD_MODE||!window.ClubHubCloud?.listSelkentTeamDirectory)return;
  const age=ageGroupNumber();if(!age)return;
  if(__selkentDirectoryLoading)return;
  if(!force&&__selkentDirectoryAge===age&&__selkentAgeTeams.length){renderSelkentOpponentSelect();return;}
  __selkentDirectoryLoading=true;__selkentDirectoryAge=age;
  try{
    let rows=await window.ClubHubCloud.listSelkentTeamDirectory(age);
    if(!rows.length&&!__selkentDirectorySyncTried&&window.ClubHubCloud.syncSelkentTeamDirectory){
      __selkentDirectorySyncTried=true;
      try{await window.ClubHubCloud.syncSelkentTeamDirectory();rows=await window.ClubHubCloud.listSelkentTeamDirectory(age);}catch(_){}
    }
    __selkentAgeTeams=Array.isArray(rows)?rows:[];renderSelkentOpponentSelect();
  }catch(_){const help=document.getElementById('match-opponent-directory-help');if(help)help.textContent='Selkent opponent directory is temporarily unavailable.';}finally{__selkentDirectoryLoading=false;}
}

let __availabilityRows=[];
let __availabilityFixture='';
let __parentPlayerLinks=[];
let __availabilitySetting=null;
let __appearanceStats=[];
let __appearanceStamp=0;
function appearanceStatFor(name){return __appearanceStats.find(r=>selkentNorm(r.player_name)===selkentNorm(name))||{appearances:0,starts:0,substitutes:0,present:0,unavailable:0,no_shows:0,recorded:0};}
async function refreshAppearanceStats(quiet=true){
  if(!CLOUD_MODE||!['admin','coach','assistant_coach','parent','player'].includes(currentRole)||!window.ClubHubCloud?.listPlayerAppearanceStats)return;
  if(quiet&&Date.now()-__appearanceStamp<15000)return;__appearanceStamp=Date.now();
  try{__appearanceStats=await window.ClubHubCloud.listPlayerAppearanceStats();renderSeasonPlayerStats();const dlg=document.getElementById('player-profile-dialog');if(dlg?.open&&dlg.dataset.playerName)openPlayerProfile(dlg.dataset.playerName);}catch(_){if(!quiet)toast('Appearance statistics are temporarily unavailable');}
}
function attendancePercent(stat){const recorded=Number(stat?.recorded||0);return recorded?Math.round(Number(stat?.appearances||0)*100/recorded):0;}

function renderSeasonPlayerStats(){
  const body=document.getElementById('season-player-stats-body'),head=document.getElementById('season-player-stats-head'),helper=document.getElementById('season-player-stats-helper');
  if(!body)return;
  const showGoals=featureEnabled('goals'),showAssists=featureEnabled('assists'),showAwards=featureEnabled('awards');
  const showContribution=showGoals||showAssists,showStarts=ageGroupNumber()>=12;
  const columns=[
    {key:'player',label:'Player',show:true},
    {key:'apps',label:'App',show:true},
    {key:'starts',label:'Starts',show:showStarts},
    {key:'att',label:'Att%',show:true},
    {key:'g',label:'G',show:showGoals},
    {key:'a',label:'A',show:showAssists},
    {key:'ga',label:'G+A',show:showContribution},
    {key:'aw',label:'Awards',show:showAwards},
    {key:'picks',label:'Picks',show:true}
  ].filter(c=>c.show);
  if(head)head.innerHTML=columns.map(c=>`<th>${c.label}</th>`).join('');
  if(helper){
    const bits=['appearances'];if(showStarts)bits.push('starts');bits.push('attendance');if(showGoals)bits.push('goals');if(showAssists)bits.push('assists');if(showAwards)bits.push('awards');helper.textContent=bits.join(' · ');
  }
  const goalMap={},assistMap={},awardMap={},pickMap={};
  if(showGoals)(state.goals||[]).forEach(x=>goalMap[x.player]=(goalMap[x.player]||0)+Number(x.goals||0));
  if(showAssists)(state.assists||[]).forEach(x=>assistMap[x.player]=(assistMap[x.player]||0)+Number(x.assists||0));
  if(showAwards)(state.awards||[]).forEach(x=>awardMap[x.player]=(awardMap[x.player]||0)+1);
  Object.values(state.tactics?.matchdaySelections||{}).forEach(arr=>(Array.isArray(arr)?arr:[]).forEach(id=>pickMap[id]=(pickMap[id]||0)+1));
  const rows=activePlayers().map(p=>{const ap=appearanceStatFor(p.name);return {p,ap,g:goalMap[p.name]||0,a:assistMap[p.name]||0,aw:awardMap[p.name]||0,picks:pickMap[tacticsPlayerId(p)]||0};})
    .sort((x,y)=>Number(y.ap.appearances||0)-Number(x.ap.appearances||0)||(y.g+y.a)-(x.g+x.a)||y.aw-x.aw||x.p.number-y.p.number);
  body.innerHTML=rows.map(r=>`<tr>${columns.map(c=>{
    if(c.key==='player')return `<td><span class="season-player-name">${miniJerseyHTML(r.p.number,r.p.role,'compact')}<strong>${esc(r.p.name)}</strong></span></td>`;
    if(c.key==='apps')return `<td><b>${Number(r.ap.appearances||0)}</b></td>`;
    if(c.key==='starts')return `<td>${Number(r.ap.starts||0)}</td>`;
    if(c.key==='att')return `<td>${attendancePercent(r.ap)}%</td>`;
    if(c.key==='g')return `<td>${r.g}</td>`;
    if(c.key==='a')return `<td>${r.a}</td>`;
    if(c.key==='ga')return `<td><b>${r.g+r.a}</b></td>`;
    if(c.key==='aw')return `<td>${r.aw}</td>`;
    return `<td>${r.picks}</td>`;
  }).join('')}</tr>`).join('')||`<tr><td colspan="${columns.length}" class="table-empty">No active players yet.</td></tr>`;
}

function availabilityStatusForPlayer(name){
  const row=__availabilityRows.find(r=>selkentNorm(r.player_name)===selkentNorm(name));
  return row?.status||'no-response';
}
function availabilityCounts(){
  const out={available:0,unsure:0,unavailable:0,'no-response':0};
  activePlayers().forEach(p=>{const k=availabilityStatusForPlayer(p.name);out[k]=(out[k]||0)+1;});
  return out;
}
function maybeAutoPrepareMatchdayFromAvailability(){
  if(!isCoach()||!__availabilityFixture||__availabilityFixture!==currentTacticsFixtureKey())return;
  state.tactics=state.tactics||{};state.tactics.matchdaySelections=state.tactics.matchdaySelections||{};state.tactics.matchdayAutoPrepared=state.tactics.matchdayAutoPrepared||{};
  const key=currentTacticsFixtureKey();if(state.tactics.matchdayAutoPrepared[key])return;
  const available=activePlayers().filter(p=>availabilityStatusForPlayer(p.name)==='available').map(tacticsPlayerId);
  if(!available.length)return;
  const limit=footballFormat().matchday;state.tactics.matchdaySelections[key]=available.slice(0,limit);state.tactics.matchdayAutoPrepared[key]=true;
  state.tactics.lineup=[...state.tactics.matchdaySelections[key]];state.tactics.positions={};persistLocalState();if(CLOUD_MODE)window.ClubHubCloud?.queueStateSave?.(state);
}
async function refreshMatchAvailability(quiet=true){
  const panel=document.getElementById('match-availability-panel'),f=nextPublishedFixture();if(!panel)return;
  if(!CLOUD_MODE||!f||!['parent','player','coach','assistant_coach','admin'].includes(currentRole)){panel.classList.add('hidden');return;}
  const fixtureKey=fixtureStableKey(f);__availabilityFixture=fixtureKey;panel.classList.remove('hidden');
  const personalControls=document.getElementById('parent-availability-controls'),coachSummary=document.getElementById('coach-availability-summary');
  personalControls?.classList.toggle('hidden',!['parent','player'].includes(currentRole));coachSummary?.classList.toggle('hidden',!(isCoach()||isAdminTeamPreviewMode()));
  let links=[];
  try{
    const ownId=window.ClubHubCloud?.session?.user?.id||'';
    [__availabilityRows,links,__availabilitySetting]=await Promise.all([
      window.ClubHubCloud.listMatchAvailability(fixtureKey),
      currentRole==='player'?window.ClubHubCloud.listPlayerAccountLinks(ownId):window.ClubHubCloud.listParentPlayerLinks(currentRole==='parent'?ownId:null),
      window.ClubHubCloud.getAvailabilitySettings?window.ClubHubCloud.getAvailabilitySettings(fixtureKey):Promise.resolve(null)
    ]);
    __parentPlayerLinks=links||[];
  }catch{if(!quiet)toast('Availability could not be refreshed');return;}
  const count=document.getElementById('match-availability-count');if(count)count.textContent=`${__availabilityRows.length} repl${__availabilityRows.length===1?'y':'ies'}`;
  if(['parent','player'].includes(currentRole)){
    const select=document.getElementById('availability-player'),ownId=window.ClubHubCloud?.session?.user?.id||'';
    const mineLinks=currentRole==='player'?links:links.filter(x=>x.parent_user_id===ownId);
    if(select){const prev=select.value||mineLinks[0]?.player_name||'';select.innerHTML=mineLinks.length?mineLinks.map(l=>`<option value="${esc(l.player_name)}">${esc(l.player_name)}${l.shirt_number?' · #'+l.shirt_number:''}</option>`).join(''):'<option value="">No linked player</option>';select.value=mineLinks.some(l=>l.player_name===prev)?prev:(mineLinks[0]?.player_name||'');select.disabled=currentRole==='player'||mineLinks.length<=1;}
    const current=__availabilityRows.find(r=>selkentNorm(r.player_name)===selkentNorm(select?.value||''));
    document.querySelectorAll('[data-availability-status]').forEach(b=>{b.classList.toggle('selected',b.dataset.availabilityStatus===current?.status);b.disabled=!mineLinks.length;});
    const meta=document.getElementById('match-availability-meta');if(meta)meta.textContent=!mineLinks.length?(currentRole==='player'?'This player account is not linked correctly. Ask your coach for a new invite.':'Your coach needs to link your player before you can reply.'):current?`Saved: ${current.status} · ${current.player_name}`:(currentRole==='player'?`Respond for ${mineLinks[0].player_name}.`:mineLinks.length===1?`Respond for ${mineLinks[0].player_name}.`:'Choose which linked player you are responding for.');
  }
  if(isCoach()||isAdminTeamPreviewMode()){
    const byStatus={available:[],unsure:[],unavailable:[]};__availabilityRows.forEach(r=>(byStatus[r.status]||byStatus.unsure).push(r));
    const responded=new Set(__availabilityRows.map(r=>selkentNorm(r.player_name))),awaiting=activePlayers().filter(p=>!responded.has(selkentNorm(p.name)));
    const render=(label,key)=>`<div class="availability-summary-group ${key}"><strong>${label} · ${byStatus[key].length}</strong><div>${byStatus[key].map(r=>{const p=activePlayers().find(x=>x.name===r.player_name);return `<span>${p?miniJerseyHTML(p.number,p.role,'compact'):''}${esc(r.player_name||'Player')}</span>`;}).join('')||'<em>None</em>'}</div></div>`;
    const awaitingHtml=`<div class="availability-summary-group awaiting"><strong>Awaiting · ${awaiting.length}</strong><div>${awaiting.map(p=>`<span>${miniJerseyHTML(p.number,p.role,'compact')}${esc(p.name)}</span>`).join('')||'<em>None</em>'}</div></div>`;
    if(coachSummary)coachSummary.innerHTML=render('Available','available')+render('Unsure','unsure')+render('Unavailable','unavailable')+awaitingHtml;
    maybeAutoPrepareMatchdayFromAvailability();renderTacticsBoard();
  }
  renderAvailabilityDeadline();
  renderMatchdayDashboard();
}
async function saveParentAvailability(status){
  if(!['parent','player'].includes(currentRole)||!__availabilityFixture)return;const player=document.getElementById('availability-player')?.value||'';if(!player)return toast('No player is linked to this account');
  try{await window.ClubHubCloud.saveMatchAvailability({fixtureKey:__availabilityFixture,playerName:player,status});toast('Availability saved');await refreshMatchAvailability(false);}catch(err){alert(err.message||err);}
}

function deadlineLocalValue(iso=''){if(!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function renderAvailabilityDeadline(){
  const panel=document.getElementById('availability-deadline-panel'),text=document.getElementById('availability-deadline-text'),actions=document.getElementById('availability-deadline-actions'),input=document.getElementById('availability-deadline-input');if(!panel)return;
  const f=nextPublishedFixture();panel.classList.toggle('hidden',!f);if(!f)return;
  const deadline=__availabilitySetting?.deadline?new Date(__availabilitySetting.deadline):null;
  if(text){if(!deadline||Number.isNaN(deadline.getTime()))text.textContent='No deadline set';else{text.textContent=`${deadline.getTime()<Date.now()?'Deadline passed · ':'Respond by '}${deadline.toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}`;}}
  actions?.classList.toggle('hidden',!isCoach());if(input&&isCoach()&&document.activeElement!==input)input.value=deadlineLocalValue(__availabilitySetting?.deadline||'');
}
async function saveAvailabilityDeadline(){if(!requireCoach()||!__availabilityFixture)return;const raw=document.getElementById('availability-deadline-input')?.value||'';if(!raw)return toast('Choose a response deadline');const d=new Date(raw);if(Number.isNaN(d.getTime()))return toast('Choose a valid deadline');try{await window.ClubHubCloud.setAvailabilityDeadline(__availabilityFixture,d.toISOString());__availabilitySetting={fixture_key:__availabilityFixture,deadline:d.toISOString()};renderAvailabilityDeadline();toast('Availability deadline saved');await refreshNotifications(false);}catch(err){alert(err.message||err);}}
async function sendAvailabilityReminder(){if(!requireCoach()||!__availabilityFixture)return;try{const sent=await window.ClubHubCloud.sendAvailabilityReminder(__availabilityFixture);toast(sent?`Reminder sent to ${sent} account${sent===1?'':'s'}`:'Everyone linked has responded');await refreshNotifications(false);}catch(err){alert(err.message||err);}}

function matchdayFixtureNoteKey(){const f=nextPublishedFixture();return f?`fixture:${currentTacticsFixtureKey()}`:'';}
let __matchdayNoteStamp='';
function addFixtureToCalendar(f=nextPublishedFixture()){
  if(!f||!f.date)return toast('Fixture date is still TBC');const time=/^\d{1,2}:\d{2}$/.test(String(f.time||''))?f.time:'10:00';const start=new Date(`${f.date}T${time}:00`);if(Number.isNaN(start.getTime()))return toast('Fixture time is not available');const duration=ageGroupNumber()<=11?75:120;const end=new Date(start.getTime()+duration*60000);const venueLocation=[f.groundName,f.address].filter(Boolean).join(', ');const title=`${clubSettings().display_name||state.meta.clubName||'Club'} ${state.meta.teamName||'Team'} v ${f.opponent||'TBC'}`;const description=[f.competition||'Fixture',f.venue==='A'?'Away':f.venue==='H'?'Home':'',`Kit: ${f.kitColours||'TBC'}`].filter(Boolean).join(' · ');
  try{if(window.ClubHubNative?.addCalendarEvent){window.ClubHubNative.addCalendarEvent(title,description,venueLocation,start.toISOString(),end.toISOString());return toast('Opening calendar');}}catch{}
  const dates=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');const url=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates(start)}/${dates(end)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(venueLocation)}`;window.location.href=url;
}
async function notifySelectedSquad(){if(!requireCoach())return;const f=nextPublishedFixture();if(!f)return toast('No upcoming fixture');ensureTacticsState();const key=currentTacticsFixtureKey(),ids=state.tactics.matchdaySelections?.[key]||[],names=ids.map(id=>activePlayers().find(p=>tacticsPlayerId(p)===id)?.name).filter(Boolean);if(!names.length)return toast('Select the matchday squad first');try{const sent=await window.ClubHubCloud.notifySelectedSquad(key,names);toast(sent?`Squad notification sent to ${sent} account${sent===1?'':'s'}`:'No linked accounts to notify');await refreshNotifications(false);}catch(err){alert(err.message||err);}}

async function renderMatchdayDashboard(){
  const panel=document.getElementById('matchday-dashboard');if(!panel)return;
  const f=nextPublishedFixture();const visible=!!f&&(isCoach()||isAdminTeamPreviewMode());panel.classList.toggle('hidden',!visible);if(!visible)return;
  ensureTacticsState();const key=currentTacticsFixtureKey(),selection=state.tactics.matchdaySelections?.[key]||[],counts=availabilityCounts(),ack=fixtureAckState();
  const today=new Date().toISOString().slice(0,10),isToday=f.date===today;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('matchday-dashboard-kicker',isToday?'MATCHDAY':'NEXT FIXTURE PREP');set('matchday-dashboard-title',isToday?'Today’s match':'Matchday dashboard');set('matchday-dashboard-opponent',f.opponent||'TBC');set('matchday-dashboard-kickoff',[f.date?formatDate(f.date):'Date TBC',f.time||'Kick-off TBC'].join(' · '));set('matchday-dashboard-venue',f.venue==='A'?'Away':f.venue==='H'?'Home':'Venue TBC');set('matchday-dashboard-availability',`${counts.available||0} available · ${counts.unsure||0} unsure · ${counts.unavailable||0} unavailable · ${counts['no-response']||0} awaiting`);set('matchday-dashboard-squad',`${selection.length}/${footballFormat().matchday} selected`);set('matchday-dashboard-formation',state.tactics.formationByFixture?.[key]||state.tactics.formation||'TBC');
  const status=document.getElementById('matchday-dashboard-status');if(status){status.textContent=ack.status==='confirmed'?'Confirmed':ack.status==='changed'?'Reconfirm':ack.status==='issue'?'Issue':'Awaiting confirmation';status.className=`matchday-dashboard-status ${ack.status}`;}
  const alertEl=document.getElementById('matchday-dashboard-alert');if(alertEl){alertEl.classList.toggle('hidden',ack.status!=='changed'&&ack.status!=='issue');alertEl.textContent=ack.status==='changed'?ack.detail:(ack.note||ack.detail);}
  const detail=state.selkent?.directoryDetails?.[selkentNorm(f.opponent)]||{},ctx=fixtureOverviewContext(f);set('matchday-dashboard-kits',`Kits: ${ctx.homeTeam} ${ctx.homeKit} · ${ctx.awayTeam} ${ctx.awayKit}`);
  const kitWarn=document.getElementById('matchday-dashboard-kit-warning');if(kitWarn){kitWarn.innerHTML=kitWarningHtml(ctx);kitWarn.classList.toggle('hidden',!kitWarn.innerHTML);}
  const map=document.getElementById('matchday-dashboard-map'),href=f.venue==='A'?mapsHref(f.groundName||detail.groundName,f.address||detail.address):mapsHref(f.groundName,f.address);if(map){map.classList.toggle('hidden',!href);if(href)map.href=href;}
  const notifyBtn=document.getElementById('matchday-notify-squad');if(notifyBtn)notifyBtn.classList.toggle('hidden',!isCoach());
  const input=document.getElementById('matchday-dashboard-note-input'),read=document.getElementById('matchday-dashboard-note-readonly'),save=document.getElementById('save-matchday-dashboard-note');if(input)input.classList.toggle('hidden',!isCoach());if(save)save.classList.toggle('hidden',!isCoach());if(read)read.classList.toggle('hidden',isCoach());
  const noteKey=matchdayFixtureNoteKey();if(noteKey&&__matchdayNoteStamp!==noteKey){__matchdayNoteStamp=noteKey;try{const row=await window.ClubHubCloud.getCoachMatchNote(noteKey);const note=row?.note||'';if(input)input.value=note;if(read)read.textContent=note||'No private coaching note saved.';}catch{if(read)read.textContent='Coaching note unavailable.';}}
}
async function saveMatchdayDashboardNote(){if(!requireCoach())return;const key=matchdayFixtureNoteKey();if(!key)return toast('No fixture available');try{await window.ClubHubCloud.saveCoachMatchNote(key,document.getElementById('matchday-dashboard-note-input')?.value||'');toast('Matchday note saved');}catch(err){alert(err.message||err);}}

let __announcementRows=[],__announcementStamp=0;
function announcementAudienceLabel(a={}){
  if(a.audience==='coaches')return 'Coaching staff';if(a.audience==='parents')return 'Parents';if(a.audience==='age_group')return `U${a.age_group||''}`;if(a.audience==='team'){const t=(window.ClubHubCloud?.visibleTeamList?.()||[]).find(x=>x.id===a.team_id);return t?`${t.ageGroup} ${t.teamName}`:'Team';}return 'Whole club';
}
function populateAnnouncementTargets(){
  const age=document.getElementById('announcement-age'),team=document.getElementById('announcement-team');const teams=window.ClubHubCloud?.visibleTeamList?.()||[];
  if(age){const ages=[...new Set(teams.map(t=>Number(String(t.ageGroup||'').replace(/\D/g,''))).filter(Boolean))].sort((a,b)=>a-b);age.innerHTML=ages.map(a=>`<option value="${a}">Under ${a}s</option>`).join('');}
  if(team)team.innerHTML=teams.map(t=>`<option value="${esc(t.id)}">${esc(t.ageGroup)} ${esc(t.teamName)}</option>`).join('');
  const audience=document.getElementById('announcement-audience')?.value||'whole_club';document.getElementById('announcement-age-wrap')?.classList.toggle('hidden',audience!=='age_group');document.getElementById('announcement-team-wrap')?.classList.toggle('hidden',audience!=='team');
}
function renderAnnouncements(){
  const panel=document.getElementById('home-club-notices'),list=document.getElementById('home-club-notices-list'),badge=document.getElementById('home-notices-unread');
  const active=__announcementRows.filter(a=>!a.expires_at||new Date(a.expires_at).getTime()>Date.now());const unread=active.filter(a=>!a.read_at).length;
  if(panel)panel.classList.toggle('hidden',!active.length);if(badge){badge.textContent=`${unread} unread`;badge.classList.toggle('hidden',!unread);}
  if(list)list.innerHTML=active.slice(0,8).map(a=>`<article class="club-notice ${a.important?'important':''} ${a.pinned?'pinned':''} ${a.read_at?'read':'unread'}"><div class="club-notice-head"><div><strong>${esc(a.title)}</strong><span>${esc(announcementAudienceLabel(a))}${a.pinned?' · Pinned':''}${a.important?' · Important':''}</span></div>${!a.read_at?`<button type="button" class="text-button compact" data-read-announcement="${a.id}">Mark read</button>`:'<small>Read</small>'}</div><p>${esc(a.body).replace(/\n/g,'<br>')}</p><time>${new Date(a.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>`).join('');
  const adminList=document.getElementById('admin-announcements-list');if(adminList&&isAdmin())adminList.innerHTML=__announcementRows.map(a=>{const expired=a.expires_at&&new Date(a.expires_at).getTime()<=Date.now();return `<article class="admin-announcement-row ${expired?'expired':''}"><div><strong>${esc(a.title)}</strong><span>${esc(announcementAudienceLabel(a))} · ${Number(a.read_count||0)}/${Number(a.target_count||0)} read${a.pinned?' · Pinned':''}${a.important?' · Important':''}${expired?' · Expired':''}</span><p>${esc(a.body)}</p></div><button type="button" class="inline-action delete" data-delete-announcement="${a.id}">Remove</button></article>`;}).join('')||'<div class="empty-state compact-empty">No club announcements yet.</div>';
  renderNotificationCenter();
}
async function refreshAnnouncements(quiet=true){
  if(!CLOUD_MODE||!['admin','coach','assistant_coach','parent'].includes(currentRole))return;if(quiet&&Date.now()-__announcementStamp<15000){renderAnnouncements();return;}__announcementStamp=Date.now();
  try{__announcementRows=await window.ClubHubCloud.listAnnouncements();renderAnnouncements();populateAnnouncementTargets();}catch(err){if(!quiet){const list=document.getElementById('home-club-notices-list');if(list)list.innerHTML='<div class="empty-state compact-empty">Club notices are temporarily unavailable.</div>';}}
}
async function publishAnnouncement(){if(!isAdmin())return;const title=document.getElementById('announcement-title')?.value?.trim()||'',body=document.getElementById('announcement-body')?.value?.trim()||'',audience=document.getElementById('announcement-audience')?.value||'whole_club';if(!title||!body)return toast('Add a title and message');try{await window.ClubHubCloud.createAnnouncement({title,body,audience,ageGroup:audience==='age_group'?Number(document.getElementById('announcement-age')?.value||0):null,teamId:audience==='team'?(document.getElementById('announcement-team')?.value||null):null,pinned:!!document.getElementById('announcement-pinned')?.checked,important:!!document.getElementById('announcement-important')?.checked});document.getElementById('announcement-title').value='';document.getElementById('announcement-body').value='';document.getElementById('announcement-pinned').checked=false;document.getElementById('announcement-important').checked=false;toast('Club notice published');await refreshAnnouncements(false);}catch(err){alert(err.message||err);}}
async function markAnnouncementRead(id){try{await window.ClubHubCloud.markAnnouncementRead(id);const row=__announcementRows.find(a=>a.id===id);if(row)row.read_at=new Date().toISOString();renderAnnouncements();}catch(err){toast('Could not update notice');}}
async function deleteAnnouncement(id){if(!isAdmin()||!confirm('Remove this club announcement?'))return;try{await window.ClubHubCloud.deleteAnnouncement(id);toast('Announcement removed');await refreshAnnouncements(false);}catch(err){alert(err.message||err);}}

let __appNotifications=[],__notificationStamp=0;
function notificationDate(v){try{return new Date(v).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';} }
function renderNotificationCenter(){
  const bell=document.getElementById('notification-bell'),badge=document.getElementById('notification-badge'),list=document.getElementById('notification-list');const allowed=CLOUD_MODE&&['admin','coach','assistant_coach','parent','player'].includes(currentRole);bell?.classList.toggle('hidden',!allowed);if(!allowed)return;
  const noticeRows=__announcementRows.filter(a=>(!a.expires_at||new Date(a.expires_at).getTime()>Date.now())).map(a=>({source:'announcement',id:a.id,title:a.title,body:a.body,created_at:a.created_at,read_at:a.read_at,important:a.important,type:'club_announcement'}));
  const appRows=__appNotifications.map(n=>({...n,source:'app'}));const rows=[...appRows,...noticeRows].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));const unread=rows.filter(r=>!r.read_at).length;
  if(badge){badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hidden',!unread);}
  if(!list)return;list.innerHTML=rows.length?rows.map(r=>`<article class="notification-item ${r.read_at?'read':'unread'} ${r.important?'important':''}"><div class="notification-item-head"><div><strong>${esc(r.title||'Notification')}</strong><small>${r.source==='announcement'?'Club notice':String(r.type||'update').replace(/_/g,' ')}</small></div><time>${notificationDate(r.created_at)}</time></div><p>${esc(r.body||'')}</p>${!r.read_at?`<div class="notification-item-actions"><button type="button" class="text-button compact" ${r.source==='announcement'?`data-read-announcement="${r.id}"`:`data-read-notification="${r.id}"`}>Mark read</button></div>`:''}</article>`).join(''):'<div class="empty-state compact-empty">No notifications yet.</div>';
}
async function refreshNotifications(quiet=true){if(!CLOUD_MODE||!['admin','coach','assistant_coach','parent','player'].includes(currentRole)||!window.ClubHubCloud?.listNotifications)return;if(quiet&&Date.now()-__notificationStamp<15000){renderNotificationCenter();return;}__notificationStamp=Date.now();try{__appNotifications=await window.ClubHubCloud.listNotifications();renderNotificationCenter();}catch(_){if(!quiet)toast('Notifications are temporarily unavailable');}}
function openNotifications(){renderNotificationCenter();document.getElementById('notification-dialog')?.showModal();}
async function markAppNotificationRead(id){try{await window.ClubHubCloud.markNotificationRead(id);const row=__appNotifications.find(n=>n.id===id);if(row)row.read_at=new Date().toISOString();renderNotificationCenter();}catch(_){toast('Could not update notification');}}
async function markAllNotificationsRead(){const app=__appNotifications.filter(n=>!n.read_at),ann=__announcementRows.filter(a=>!a.read_at);try{await Promise.all([...app.map(n=>window.ClubHubCloud.markNotificationRead(n.id)),...ann.map(a=>window.ClubHubCloud.markAnnouncementRead(a.id))]);const now=new Date().toISOString();app.forEach(n=>n.read_at=now);ann.forEach(a=>a.read_at=now);renderAnnouncements();renderNotificationCenter();toast('Notifications marked read');}catch(_){toast('Could not mark all notifications read');}}


function renderUniversalClubConfiguration(){
  const summary=document.getElementById('universal-config-summary'),rulesEl=document.getElementById('universal-config-rules');if(!summary||!rulesEl)return;
  const s=clubSettings(),p=primaryProvider(),teams=clubTeams(),r=competitionRuleForAge(ageGroupNumber());
  summary.innerHTML=`<div class="universal-config-brand"><span class="universal-swatch" style="background:${esc(s.primary_color||'#218a21')}"></span><div><strong>${esc(s.display_name||'Club')}</strong><small>${esc(s.short_name||'')} · ${esc(s.current_season||'')}</small></div></div><div class="universal-config-chips"><span>${esc(String(p.provider_type||s.default_provider_key||'manual').toUpperCase())} provider</span><span>${teams.length} teams</span><span>Results ${s.results_publish_from_age?'U'+s.results_publish_from_age+'+':'club rules'}</span></div>`;
  rulesEl.innerHTML=r?`<div class="universal-rule-grid"><span><b>${esc(r.format)}</b><small>Format</small></span><span><b>${Number(r.players_on_pitch)}</b><small>On pitch</small></span><span><b>${Number(r.max_registered)}</b><small>Registered max</small></span><span><b>${Number(r.matchday_max)}</b><small>Matchday max</small></span></div><p class="helper">Rolling subs: ${r.rolling_substitutions?'Yes':'No'} · Published results: ${r.results_published?'Yes':'No'} · Player accounts: ${r.player_accounts_allowed?'Yes':'No'}</p>`:'<p class="helper">No age-specific rule is configured for this team yet.</p>';
}

function applyMiniResultVisibility(){const restricted=miniResultsRestrictedView();document.querySelector('.record-card')?.classList.toggle('hidden',restricted);document.querySelector('.running-count-grid')?.classList.toggle('hidden',restricted);document.querySelector('#recent-form')?.closest('.panel')?.classList.toggle('hidden',restricted);document.getElementById('league-table-panel')?.classList.toggle('hidden',restricted||!isPublishedLeagueTeam());document.getElementById('league-summary-card')?.classList.toggle('hidden',restricted);document.getElementById('season-player-stats')?.classList.toggle('hidden',restricted);['export-json','export-matches','export-goals'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',ageGroupNumber()<=11));}

function renderAll(){
  renderTeamIdentity();
  renderUniversalClubConfiguration();
  if(CLOUD_MODE){refreshAnnouncements(true);refreshNotifications(true);refreshAppearanceStats(true);}
  renderDashboard();
  renderSeasonPlayerStats();
  renderNextMatch();
  renderMatchPageNextFixture();
  refreshMatchAvailability(true);
  renderMatchdayDashboard();
  renderLeagueProgramme();
  renderDivisionDatalist();
  refreshSelkentOpponentDirectory(false);
  renderMatches();
  renderTournamentEvents();
  renderSquad();
  renderPlayerSelects();
  renderScorerInputs();
  renderAwards();
  renderTeamSettings();
  renderAssignmentTeamOptions();
  renderLeagueSettings();
  renderSelkentSettings();
  renderSelkentFixtures();
  renderLeagueTable();
  renderLeagueResultsImport();
  renderCompetitionMode();
  renderLeagueQuickView();
  renderFeatureSettings();
  applyAccessMode();
  applyMiniResultVisibility();
  if(CLOUD_MODE&&(isCoach()||isAdminTeamPreviewMode()))refreshTeamMembers(true);
  if(CLOUD_MODE&&isAdmin()){refreshAdminClubOverview(true);refreshClubCoaches(true);loadComplianceAccountChoices();}
  if(CLOUD_MODE&&['admin','coach','assistant_coach','parent'].includes(currentRole))refreshCompliancePanel();
  renderU11SafeguardingControls();
  if(CLOUD_MODE&&['coach','assistant_coach'].includes(currentRole)&&currentView==='club'&&__clubTab==='results')refreshCoachClubResults(true);
  if(CLOUD_MODE&&['admin','coach','assistant_coach'].includes(currentRole)&&currentView==='more'){refreshSeasonHistory(true);refreshAuditHistory(true);}
  const roll=document.getElementById('rollover-season-name');if(roll&&!roll.value)roll.value=suggestedNextSeason();
}

function renderTeamIdentity(){
  const meta=state.meta;
  const adminClub=isClubOverviewMode();
  document.getElementById('hero-club-name').textContent=(meta.clubName||clubSettings().display_name||'Club').toUpperCase();
  const adminHero=currentView==='more'?'CLUB SETTINGS':currentView==='club'?'CLUB OVERVIEW':'CLUB ADMINISTRATION';
  document.getElementById('hero-team-name').textContent=adminClub?adminHero:(meta.teamName||'Team').toUpperCase();
  document.getElementById('hero-season-line').textContent=adminClub?[`${window.ClubHubCloud?.visibleTeamList?.().length||clubTeams().length} active teams`,meta.season].filter(Boolean).join(' · '):[meta.ageGroup,state.division.name,meta.season].filter(Boolean).join(' · ');
  document.getElementById('dashboard-season-kicker').textContent=(meta.season||'Season')+' season';
  const homeTitle=document.getElementById('home-screen-title');if(homeTitle)homeTitle.textContent='Dashboard';
  document.getElementById('squad-team-name').textContent=meta.teamName||'Team';
  document.getElementById('matches-division-kicker').textContent=state.division.name||'League';
  document.getElementById('league-summary-name').textContent=state.division.name||'League';
  document.getElementById('our-score-label').textContent='Home';
  document.title=adminClub?`${clubSettings().display_name||'Club'} Hub`:`${meta.teamName||'Team'} · ${clubSettings().display_name||'Club'}`;
}

function reflowDashboardFeaturePanels(){
  const grid=document.querySelector('.dashboard-grid');if(!grid)return;
  const panels=[...grid.querySelectorAll(':scope > .panel')].filter(p=>!p.classList.contains('hidden'));
  grid.querySelectorAll(':scope > .panel').forEach(p=>p.classList.remove('dashboard-fill-row'));
  if(panels.length&&panels.length%2===1)panels[panels.length-1].classList.add('dashboard-fill-row');
}
function setStats(prefix,s){
  const ids={played:'played',wins:'wins',draws:'draws',losses:'losses',gf:'gf',ga:'ga'};
  Object.entries(ids).forEach(([key,suffix])=>{
    const el=document.getElementById(`${prefix}-${suffix}`);
    if(el) el.textContent=s[key];
  });
}
function renderDashboard(){
  const sorted=[...state.matches].sort((a,b)=>a.date.localeCompare(b.date));
  const league=sorted.filter(isLeagueMatch);
  const divisionMatches=sorted.filter(isDivisionMatch);
  const friendlies=sorted.filter(isFriendlyMatch);
  const localLeagueStats=statsFor(league);
  const syncedLeagueStats=remoteLeagueStats();
  const leagueStats=(syncedLeagueStats&&syncedLeagueStats.played>=localLeagueStats.played)?syncedLeagueStats:localLeagueStats;
  const primaryStats=isPublishedLeagueTeam()?leagueStats:statsFor(divisionMatches);
  const primaryIds=new Set((isPublishedLeagueTeam()?league:divisionMatches).map(m=>m.id));
  const secondaryStats=statsFor(sorted.filter(m=>!primaryIds.has(m.id)));
  const overallStats=aggregateStats(primaryStats,secondaryStats);
  const friendlyStats=statsFor(friendlies);

  document.getElementById('stat-played').textContent=primaryStats.played;
  document.getElementById('stat-wins').textContent=primaryStats.wins;
  document.getElementById('stat-draws').textContent=primaryStats.draws;
  document.getElementById('stat-losses').textContent=primaryStats.losses;
  document.getElementById('stat-gf').textContent=primaryStats.gf;
  document.getElementById('stat-ga').textContent=primaryStats.ga;
  document.getElementById('stat-gd').textContent=(primaryStats.gd>0?'+':'')+primaryStats.gd;
  document.getElementById('stat-winrate').textContent=primaryStats.winrate+'%';

  setStats('overall',overallStats);
  setStats('friendly',friendlyStats);

  const expected=divisionOpponents().length*Number(state.division.meetingsPerOpponent||2);
  const localPrimaryPlayed=state.matches.filter(m=>(isPublishedLeagueTeam()?isLeagueMatch(m):isDivisionMatch(m))&&divisionOpponents().includes(m.opponent)&&isPlayedMatch(m)).length;
  const primaryPlayed=isPublishedLeagueTeam()?Math.max(localPrimaryPlayed,Number(remoteLeagueRow()?.p||0)):localPrimaryPlayed;
  document.getElementById('league-played-count').textContent=primaryPlayed;
  document.getElementById('league-total-count').textContent='/'+expected;
  document.getElementById('league-summary-text').textContent=isPublishedLeagueTeam()?`${divisionOpponents().length} opponents · ${expected} league matches`:`${divisionOpponents().length} opponents · results from Selkent`;

  const recent=[...sorted].reverse().slice(0,5);
  document.getElementById('recent-form').innerHTML=recent.length?recent.map(m=>`<span class="form-chip ${resultOf(m)}">${resultOf(m)}</span>`).join(''):'<span class="form-empty">No matches yet</span>';
  document.getElementById('recent-matches').innerHTML=recent.slice(0,3).map(m=>`<div class="mini-item"><div><div class="mini-team">${esc(m.opponent)}</div><div class="mini-meta">${formatDate(m.date)} · ${esc(m.competition)}</div></div><div class="scoreline">${matchScoreText(m)}</div></div>`).join('') || '<div class="empty-state">No match records yet.</div>';

  const scoring={};
  const officialMatchIds=new Set(state.matches.filter(isPlayedMatch).map(m=>m.id));
  state.goals.filter(g=>officialMatchIds.has(g.matchId)).forEach(g=>scoring[g.player]=(scoring[g.player]||0)+Number(g.goals||0));
  const scorerRows=Object.entries(scoring).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5);
  document.getElementById('top-scorers').innerHTML=scorerRows.map(([name,n],i)=>`<div class="rank-item"><div class="rank-left">${playerJerseyHTML(name,i+1)}<span class="rank-name">${esc(name)}</span></div><span class="rank-value">${n}</span></div>`).join('') || '<div class="empty-state">No goals logged.</div>';

  const assisting={};
  (state.assists||[]).filter(a=>officialMatchIds.has(a.matchId)).forEach(a=>assisting[a.player]=(assisting[a.player]||0)+Number(a.assists||0));
  const assistRows=Object.entries(assisting).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5);
  const assistBox=document.getElementById('top-assists');if(assistBox)assistBox.innerHTML=assistRows.map(([name,n],i)=>`<div class="rank-item"><div class="rank-left">${playerJerseyHTML(name,i+1)}<span class="rank-name">${esc(name)}</span></div><span class="rank-value">${n}</span></div>`).join('') || '<div class="empty-state">No assists logged.</div>';

  const discipline={};
  (state.bookings||[]).forEach(b=>{discipline[b.player]=discipline[b.player]||{yellow:0,red:0};discipline[b.player].yellow+=Number(b.yellow||0);discipline[b.player].red+=Number(b.red||0);});
  const bookingRows=Object.entries(discipline).sort((a,b)=>(b[1].red*3+b[1].yellow)-(a[1].red*3+a[1].yellow)||a[0].localeCompare(b[0])).slice(0,5);
  const bookingBox=document.getElementById('booking-leaders');if(bookingBox)bookingBox.innerHTML=bookingRows.map(([name,c],i)=>`<div class="rank-item"><div class="rank-left">${playerJerseyHTML(name,i+1)}<span class="rank-name">${esc(name)}</span></div><span class="rank-value">${c.yellow}Y${c.red?' · '+c.red+'R':''}</span></div>`).join('') || '<div class="empty-state">No bookings logged.</div>';

  const awards={};
  state.awards.forEach(a=>awards[a.player]=(awards[a.player]||0)+1);
  const awardRows=Object.entries(awards).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5);
  document.getElementById('award-leaders').innerHTML=awardRows.map(([name,n],i)=>`<div class="rank-item"><div class="rank-left">${playerJerseyHTML(name,i+1)}<span class="rank-name">${esc(name)}</span></div><span class="rank-value">${n}</span></div>`).join('') || '<div class="empty-state">No awards logged.</div>';
}

function renderLeagueTable(){
  const enabled=leagueTableEnabled();
  const panel=document.getElementById('league-table-panel');
  if(panel)panel.classList.toggle('hidden',!enabled);
  if(!enabled) return;
  const remote=sanitizeRemoteStandings(state.selkent?.table||[]);
  const table=remote.length?remote:calculateLeagueTable();
  const self=normalizeTeamKey(state.division.teamName||state.meta.teamName||'');
  const rows=table.map((r,i)=>`<tr class="${normalizeTeamKey(r.team)===self?'our-team-row':''}"><td class="pos">${i+1}</td><td class="team-cell">${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd>0?'+':''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`).join('');
  document.querySelectorAll('[data-league-table-body]').forEach(tb=>tb.innerHTML=rows||'<tr><td colspan="10" class="table-empty">No teams configured</td></tr>');
  document.querySelectorAll('[data-league-table-title]').forEach(el=>el.textContent=state.division.name||'League table');
  const count=combinedLeagueResults().length;
  document.querySelectorAll('[data-league-table-meta]').forEach(el=>el.textContent=remote.length?`Official league table · ${remote.length} teams`:`${count} result${count===1?'':'s'} included · calculated from available results`);
}
function renderLeagueResultsImport(){
  const wrap=document.getElementById('league-results-import');
  if(wrap) wrap.classList.toggle('hidden',!leagueTableEnabled());
  const list=document.getElementById('imported-league-results');
  const count=document.getElementById('imported-league-count');
  const imported=state.leagueResults||[];
  if(count) count.textContent=String(imported.length);
  if(list){
    list.innerHTML=imported.slice().reverse().map(r=>{const rr=resultForNamedTeam(r.home,r.away,r.homeGoals,r.awayGoals,state.division.teamName||state.meta.teamName);return `<div class="imported-result-row ${resultClass(rr)}"><div><strong>${esc(r.home)} ${r.homeGoals}–${r.awayGoals} ${esc(r.away)}</strong>${r.date?`<span>${formatDate(r.date)}</span>`:''}</div>${isCoach()?`<button class="inline-action delete" data-delete-league-result="${r.id}">Delete</button>`:''}</div>`;}).join('')||'<div class="empty-state compact-empty">No pasted league results yet.</div>';
  }
}
function importPastedLeagueResults(){
  if(!requireCoach()) return;
  if(!leagueTableEnabled()){toast('League tables are available for U12 and above.');return;}
  const box=document.getElementById('league-results-paste');
  const lines=(box?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length){toast('Paste some results first.');return;}
  const parsed=[],failed=[];
  lines.forEach(line=>{const r=parseLeagueResultLine(line);if(r)parsed.push(r);else failed.push(line);});
  const existing=new Set((state.leagueResults||[]).map(leagueResultSignature));
  let added=0,duplicates=0;
  parsed.forEach(r=>{const sig=leagueResultSignature(r);if(existing.has(sig)){duplicates++;return;}existing.add(sig);state.leagueResults.push({id:uid('lr'),...r,source:'paste'});added++;});
  saveState();
  if(box) box.value='';
  const feedback=document.getElementById('league-import-feedback');
  if(feedback){
    let msg=`Added ${added} result${added===1?'':'s'}.`;
    if(duplicates) msg+=` ${duplicates} duplicate${duplicates===1?'':'s'} skipped.`;
    if(failed.length) msg+=` ${failed.length} line${failed.length===1?'':'s'} could not be matched to teams in this division.`;
    feedback.textContent=msg;
    feedback.className='import-feedback '+(failed.length?'warn':'good');
  }
  toast(added?'League table updated':'No new results added');
}
function deleteLeagueResult(id){
  if(!requireCoach()) return;
  state.leagueResults=(state.leagueResults||[]).filter(r=>r.id!==id);saveState();toast('Imported result removed');
}
function clearImportedLeagueResults(){
  if(!requireCoach()) return;
  if(!(state.leagueResults||[]).length){toast('No imported results to clear');return;}
  if(!confirm('Clear all pasted league results? Your own match entries will not be deleted.')) return;
  state.leagueResults=[];saveState();toast('Imported league results cleared');
}
function renderDivisionDatalist(){
  const list=document.getElementById('division-opponents-list');
  if(!list) return;
  list.innerHTML=divisionOpponents().map(t=>`<option value="${esc(t)}"></option>`).join('');
}
function programmeParentView(){return CLOUD_MODE&&currentRole==='parent';}
function homeAwayScoreForMatch(match={}){const away=String(match.venue||'').toUpperCase()==='A';return {home:away?Number(match.ga||0):Number(match.gf||0),away:away?Number(match.gf||0):Number(match.ga||0)};}
function renderDivisionResultCell(match){
  const played=!!match&&['played','abandoned'].includes(matchStatus(match));
  if(programmeParentView())return `<span class="programme-status ${played?'played':'not-played'}">${played?'Played':'Not played'}</span>`;
  if(!match||matchStatus(match)==='scheduled')return '<span class="programme-status not-played">Not played</span>';
  if(matchStatus(match)==='postponed')return '<span class="programme-status postponed">Postponed</span>';
  if(matchStatus(match)==='abandoned')return `<button type="button" class="division-result-cell status-abandoned" data-match-report-review="${match.id}">Abandoned</button>`;
  const score=homeAwayScoreForMatch(match),r=resultOf(match);return `<button type="button" class="division-result-cell ${r} ${resultClass(r)}" data-match-report-review="${match.id}" title="Open match report">${score.home}–${score.away}</button>`;
}
function renderLeagueProgramme(){
  const opponents=divisionOpponents(),meetings=Number(state.division.meetingsPerOpponent||2),expected=opponents.length*meetings,primaryPred=isPublishedLeagueTeam()?isLeagueMatch:isDivisionMatch;
  const localPlayed=state.matches.filter(m=>primaryPred(m)&&opponents.includes(m.opponent)&&isPlayedMatch(m)).length,played=isPublishedLeagueTeam()?Math.max(localPlayed,Number(remoteLeagueRow()?.p||0)):localPlayed;
  document.getElementById('league-programme-title').textContent=`${opponents.length} opponents · Home / Away`;
  document.getElementById('league-programme-progress').textContent=miniResultsRestrictedView()?`${expected} fixtures`:`${played} / ${expected}`;
  const box=document.getElementById('division-opponents');if(!box)return;
  const parent=programmeParentView(),head=`<div class="division-matrix-head"><span>Opponent</span><span>${parent?'Home':'Home result'}</span><span>${parent?'Away':'Away result'}</span></div>`;
  const rows=opponents.map(team=>{const matches=leagueMatchesFor(team),home=matches.find(m=>String(m.venue||'').toUpperCase()==='H')||null,away=matches.find(m=>String(m.venue||'').toUpperCase()==='A')||null;return `<div class="division-matrix-row"><div class="division-team">${clubTeamLink(team,'division-team-link')}</div><div>${renderDivisionResultCell(home)}</div><div>${renderDivisionResultCell(away)}</div></div>`;}).join('');
  box.innerHTML=head+(rows||'<div class="empty-state">No division opponents configured.</div>');
}
function matchCardHTML(m){
  const r=resultOf(m);
  const venue=m.venue?` · ${esc(m.venue)}`:'';
  const stage=m.stage?` · ${esc(m.stage)}`:'';
  const status=matchStatus(m);const statusMeta=status==='played'?'':` · ${statusLabel(m)}`;
  const goalCount=state.goals.filter(g=>g.matchId===m.id).reduce((n,g)=>n+Number(g.goals||0),0);
  const assistCount=(state.assists||[]).filter(a=>a.matchId===m.id).reduce((n,a)=>n+Number(a.assists||0),0);
  const awardCount=state.awards.filter(a=>a.matchId===m.id).length;
  const bookingCount=(state.bookings||[]).filter(b=>b.matchId===m.id).reduce((n,b)=>n+Number(b.yellow||0)+Number(b.red||0),0);
  const detailBits=[];
  if(featureEnabled('goals')&&goalCount)detailBits.push(`⚽ ${goalCount}`);
  if(featureEnabled('assists')&&assistCount)detailBits.push(`A ${assistCount}`);
  if(featureEnabled('awards')&&awardCount)detailBits.push(`★ ${awardCount}`);
  if(featureEnabled('bookings')&&bookingCount)detailBits.push(`▣ ${bookingCount}`);
  const details=detailBits.length?`<div class="match-detail-badges">${detailBits.map(x=>`<span>${x}</span>`).join('')}</div>`:'';
  const editableNonLeague=isCoach()&&isPlayedMatch(m)&&!isLeagueMatch(m)&&!isDivisionMatch(m);
  const editableScheduled=isCoach()&&!isPlayedMatch(m);
  const editAction=editableScheduled?`<button class="inline-action" data-edit-match="${m.id}">Edit fixture</button>`:editableNonLeague?`<button class="inline-action" data-edit-match="${m.id}">Edit result</button>`:'';
  const playedAction=isCoach()&&status==='scheduled'?`<button class="primary-button compact match-played-action" type="button" data-match-played="${m.id}">Match played</button>`:'';
  const removeAction=isCoach()&&!isProviderOwnedMatch(m)?`<button class="inline-action delete" type="button" data-delete-match="${m.id}">Remove</button>`:'';
  const actions=`<div class="match-actions"><button class="inline-action" data-details-match="${m.id}">Details</button>${editAction}${playedAction}${removeAction}</div>`;
  return `<article class="match-card ${resultClass(r)}"><div class="result-badge ${r}">${r}</div><div><div class="match-opponent">${esc(m.opponent)}</div><div class="match-meta">${formatDate(m.date)}${venue}${stage}${statusMeta}</div>${details}</div><div class="match-score">${matchScoreText(m)}</div>${actions}</article>`;
}
function renderMatchGroup(listId,countId,rows,emptyText){
  const list=document.getElementById(listId);
  const count=document.getElementById(countId);
  if(count) count.textContent=rows.length;
  if(list) list.innerHTML=rows.map(matchCardHTML).join('') || `<div class="empty-state"><strong>${emptyText}</strong></div>`;
}
function renderMatches(){ applyMatchFilter(); }
function competitionGameRow(m){
  const r=resultOf(m),venue=String(m.venue||'').toUpperCase()==='H'?'H':String(m.venue||'').toUpperCase()==='A'?'A':String(m.venue||'').toUpperCase()==='N'?'N':'—';
  const resultText=miniResultsRestrictedView()&&isPlayedMatch(m)?'Result private':(isPlayedMatch(m)?`${r} ${Number(m.gf||0)}–${Number(m.ga||0)}`:(r==='ABD'?`ABD ${Number(m.gf||0)}–${Number(m.ga||0)}`:r));
  const action=`<button type="button" class="competition-game-link" data-details-match="${m.id}">${esc(m.opponent)}</button>`;
  return `<tr class="${resultClass(r)}"><td>${m.date?formatDate(m.date):'TBC'}</td><td>${esc(m.stage||'—')}</td><td>${action}</td><td>${venue}</td><td><span class="competition-result-pill ${r}">${resultText}</span></td></tr>`;
}
function renderCompetitionGameTable(kind,list){
  const body=document.getElementById(`${kind}-games-body`),count=document.getElementById(`${kind}-games-count`),wrap=document.getElementById(`${kind}-games-panel`);if(!body||!wrap)return;
  const rows=[...list].sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(count)count.textContent=String(rows.length);
  wrap.classList.toggle('empty-competition',rows.length===0);
  body.innerHTML=rows.map(competitionGameRow).join('')||'<tr><td colspan="5" class="table-empty">No games available yet</td></tr>';
}
function applyMatchFilter(){
  const q=(document.getElementById('match-search')?.value||'').trim().toLowerCase();
  const filterRows=rows=>rows.filter(m=>!q||String(m.opponent||'').toLowerCase().includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const primaryRows=state.matches.filter(isPublishedLeagueTeam()?isLeagueMatch:isDivisionMatch);
  renderMatchGroup('league-match-list','league-match-count',filterRows(primaryRows),isPublishedLeagueTeam()?'No league matches available':'No division results available yet');
  renderMatchGroup('friendly-match-list','friendly-match-count',filterRows(state.matches.filter(isFriendlyMatch)),'No friendlies recorded');
  renderCompetitionGameTable('cup',filterRows(state.matches.filter(isCupMatch)));
  renderCompetitionGameTable('vase',filterRows(state.matches.filter(isVaseMatch)));
  renderCompetitionGameTable('shield',filterRows(state.matches.filter(isShieldMatch)));
  renderTournamentEvents();renderMatchGroup('other-match-list','other-match-count',filterRows(state.matches.filter(m=>!m.tournamentId&&!isFriendlyMatch(m)&&!isLeagueMatch(m)&&!isDivisionMatch(m)&&!competitionBucket(m))),'No other matches recorded');
}


function ensureTournamentState(){if(!Array.isArray(state.tournaments))state.tournaments=[];}
function tournamentById(id){ensureTournamentState();return state.tournaments.find(t=>t.id===id)||null;}
function tournamentGames(id){return state.matches.filter(m=>m.tournamentId===id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));}
function tournamentStats(t){const games=tournamentGames(t.id).filter(isPlayedMatch),s=statsFor(games);return {...s,games};}
function tournamentFormatLabel(v){return v==='round_robin'?'Round robin':v==='knockout'?'Knockout':v==='festival'?'Festival / mini tournament':'Group + knockout';}
function renderTournamentEvents(){
  ensureTournamentState();const list=document.getElementById('tournament-event-list'),count=document.getElementById('tournament-event-count');if(!list)return;
  const rows=[...state.tournaments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(count)count.textContent=String(rows.length);
  list.innerHTML=rows.map(t=>{const st=tournamentStats(t),games=tournamentGames(t.id);const squad=t.playerNames||[];return `<article class="panel tournament-event-card"><div class="tournament-event-head"><div><p class="kicker">${t.date?formatDate(t.date):'Date TBC'} · ${esc(tournamentFormatLabel(t.format))}</p><h3>${esc(t.name)}</h3><p class="muted">${esc(t.location||'Location TBC')} · ${squad.length} player${squad.length===1?'':'s'} in squad</p></div><div class="tournament-event-actions">${isCoach()?`<button type="button" class="text-button compact" data-edit-tournament="${esc(t.id)}">Edit</button><button type="button" class="secondary-button compact" data-add-tournament-game="${esc(t.id)}">+ Game</button>`:''}</div></div><div class="tournament-summary-grid"><span><b>${games.length}</b> games</span><span><b>${st.wins}</b> W</span><span><b>${st.draws}</b> D</span><span><b>${st.losses}</b> L</span><span><b>${st.gf}</b> GF</span><span><b>${st.ga}</b> GA</span></div><div class="tournament-game-list">${games.map(matchCardHTML).join('')||'<div class="empty-state compact-empty">No games added yet.</div>'}</div>${isCoach()?`<button type="button" class="inline-action delete tournament-delete" data-delete-tournament="${esc(t.id)}">Delete tournament</button>`:''}</article>`;}).join('')||'<div class="empty-state"><strong>No tournament events yet.</strong><span>Create one event and keep all of its games together.</span></div>';
}
function renderTournamentSquadChoices(selected=[]){const box=document.getElementById('tournament-squad-list');if(!box)return;const chosen=new Set(selected||[]);box.innerHTML=activePlayers().map(p=>`<label class="parent-link-player"><input type="checkbox" value="${esc(p.name)}" ${chosen.has(p.name)?'checked':''}/><span>${miniJerseyHTML(p.number,p.role,'compact')}<strong>${esc(p.name)}</strong></span></label>`).join('')||'<div class="empty-state compact-empty">Add players to the squad first.</div>';}
function openTournamentDialog(id=''){
  if(!requireCoach())return;ensureTournamentState();const t=id?tournamentById(id):null;const dlg=document.getElementById('tournament-dialog');if(!dlg)return;document.getElementById('tournament-form').reset();document.getElementById('tournament-id').value=t?.id||'';document.getElementById('tournament-dialog-title').textContent=t?'Edit tournament':'Create tournament';document.getElementById('tournament-name').value=t?.name||'';document.getElementById('tournament-date').value=t?.date||new Date().toISOString().slice(0,10);document.getElementById('tournament-location').value=t?.location||'';document.getElementById('tournament-format').value=t?.format||'group_knockout';renderTournamentSquadChoices(t?.playerNames||[]);dlg.showModal();
}
function saveTournament(e){
  e.preventDefault();if(!requireCoach())return;ensureTournamentState();const id=document.getElementById('tournament-id').value||uid('t');const before=tournamentById(id)?JSON.parse(JSON.stringify(tournamentById(id))):null;const playerNames=[...document.querySelectorAll('#tournament-squad-list input:checked')].map(x=>x.value);const t={id,name:document.getElementById('tournament-name').value.trim(),date:document.getElementById('tournament-date').value,location:document.getElementById('tournament-location').value.trim(),format:document.getElementById('tournament-format').value,playerNames};if(!t.name||!t.date)return toast('Add the tournament name and date');const idx=state.tournaments.findIndex(x=>x.id===id);if(idx>=0)state.tournaments[idx]=t;else state.tournaments.push(t);saveState();auditEvent(before?'tournament_edited':'tournament_created','tournament',id,`${before?'Updated':'Created'} tournament ${t.name}`,before,t);document.getElementById('tournament-dialog')?.close();toast('Tournament saved');
}
function deleteTournament(id){if(!requireCoach())return;const t=tournamentById(id);if(!t)return;const games=tournamentGames(id);if(!confirm(`Delete “${t.name}” and ${games.length} linked game${games.length===1?'':'s'}? This also removes their goals, assists and awards.`))return;const gameIds=new Set(games.map(g=>g.id));state.tournaments=state.tournaments.filter(x=>x.id!==id);state.matches=state.matches.filter(m=>!gameIds.has(m.id));state.goals=state.goals.filter(x=>!gameIds.has(x.matchId));state.assists=(state.assists||[]).filter(x=>!gameIds.has(x.matchId));state.bookings=(state.bookings||[]).filter(x=>!gameIds.has(x.matchId));state.awards=state.awards.filter(x=>!gameIds.has(x.matchId));saveState();auditEvent('tournament_deleted','tournament',id,`Deleted tournament ${t.name}`,t,null);toast('Tournament deleted');}
function populateTournamentSelect(selected=''){ensureTournamentState();const sel=document.getElementById('match-tournament');if(!sel)return;sel.innerHTML='<option value="">Choose tournament</option>'+state.tournaments.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${t.date?formatDate(t.date):'TBC'}</option>`).join('');if(selected&&[...sel.options].some(o=>o.value===selected))sel.value=selected;}
function updateTournamentMatchUI(selected=''){const comp=document.getElementById('match-competition')?.value||'';const wrap=document.getElementById('match-tournament-wrap');const isT=/tournament/i.test(comp);wrap?.classList.toggle('hidden',!isT);if(isT)populateTournamentSelect(selected||document.getElementById('match-tournament')?.value||'');}
function addTournamentGame(id){const t=tournamentById(id);if(!t||!requireCoach())return;resetMatchForm();const comp=document.getElementById('match-competition');if(comp){comp.value='Tournament';if(!comp.value){comp.add(new Option('Tournament','Tournament',true,true));}}document.getElementById('match-date').value=t.date||new Date().toISOString().slice(0,10);document.getElementById('match-stage').value=t.format==='knockout'?'Quarter Final':'Group';updateTournamentMatchUI(id);document.getElementById('match-tournament').value=id;document.getElementById('form-title').textContent=`${t.name} · Add game`;document.getElementById('form-kicker').textContent='Tournament game';navigate('add');}

let __seasonArchives=[];
let __auditRows=[];
function archiveStatsFromState(st={}){const matches=(st.matches||[]).filter(isPlayedMatch);const s=statsFor(matches);const goals={};(st.goals||[]).forEach(g=>goals[g.player]=(goals[g.player]||0)+Number(g.goals||0));const top=Object.entries(goals).sort((a,b)=>b[1]-a[1])[0];return {...s,topScorer:top?`${top[0]} · ${top[1]}`:'—'};}
async function refreshSeasonHistory(silent=false){if(!CLOUD_MODE||!['admin','coach','assistant_coach'].includes(currentRole))return;try{const teamId=(isAdminTeamPreviewMode()||isAdminCoachMode())?window.ClubHubCloud?.currentTeam?.()?.id:null;__seasonArchives=await window.ClubHubCloud.listSeasonArchives(teamId||null);renderSeasonHistory();}catch(err){if(!silent)toast(err.message||'Could not load season history');}}
function renderSeasonHistory(){const sel=document.getElementById('season-history-select'),sum=document.getElementById('season-history-summary');if(!sel)return;const keep=sel.value;sel.innerHTML=__seasonArchives.length?__seasonArchives.map(a=>`<option value="${esc(a.id)}">${esc(a.season)} · U${a.age_group} ${esc(a.team_name)}</option>`).join(''):'<option value="">No archived seasons yet</option>';if(keep&&__seasonArchives.some(a=>a.id===keep))sel.value=keep;if(sum)sum.innerHTML=__seasonArchives.length?`<strong>${__seasonArchives.length}</strong> archived season${__seasonArchives.length===1?'':'s'} available.`:'No season archives have been created yet.';}
async function openSeasonArchive(){const id=document.getElementById('season-history-select')?.value||'';if(!id)return toast('Choose an archived season');try{const a=await window.ClubHubCloud.getSeasonArchive(id);const st=a?.snapshot?.team_state||{},stats=archiveStatsFromState(st),matches=(st.matches||[]).slice().sort((x,y)=>(y.date||'').localeCompare(x.date||''));document.getElementById('season-archive-title').textContent=`${a.season} · U${a.age_group} ${a.team_name}`;document.getElementById('season-archive-body').innerHTML=`<div class="archive-stat-grid"><span><b>${stats.played}</b> Played</span><span><b>${stats.wins}</b> W</span><span><b>${stats.draws}</b> D</span><span><b>${stats.losses}</b> L</span><span><b>${stats.gf}</b> GF</span><span><b>${stats.ga}</b> GA</span></div><p class="muted">Top scorer: <strong>${esc(stats.topScorer)}</strong></p><div class="archive-match-list">${matches.map(m=>`<div class="archive-match-row"><span>${m.date?formatDate(m.date):'TBC'}</span><strong>${esc(m.opponent||'Opponent')}</strong><span>${esc(m.competition||'')}</span><b>${matchScoreText(m)}</b></div>`).join('')||'<div class="empty-state compact-empty">No matches in this archive.</div>'}</div>`;document.getElementById('season-archive-dialog')?.showModal();}catch(err){alert(err.message||err);}}
async function archiveCurrentSeason(){if(!CLOUD_MODE||!isAdmin())return toast('Club Admin access required');if(!confirm(`Archive the current ${state.meta.season} season for all active teams? Existing archive snapshots for the same season will be refreshed.`))return;try{const n=await window.ClubHubCloud.archiveCurrentSeason(null);toast(`${n} team season${n===1?'':'s'} archived`);await refreshSeasonHistory(false);}catch(err){alert(err.message||err);}}
function suggestedNextSeason(){const m=String(state.meta.season||'').match(/(20\d{2})\s*\/\s*(\d{2,4})/);if(!m)return'';const a=Number(m[1])+1;return `${a}/${String(a+1).slice(-2)}`;}
async function rolloverSeason(){if(!CLOUD_MODE||!isAdmin())return toast('Club Admin access required');const input=document.getElementById('rollover-season-name');const next=String(input?.value||suggestedNextSeason()).trim();if(!next)return toast('Enter the new season');if(!confirm(`START ${next}?\n\nThe current season will be archived first. Match results, awards, attendance and fixture preparation will then reset for every active team. Squad and account links are kept.`))return;if(!confirm('This is a club-wide season rollover. Continue?'))return;try{const res=await window.ClubHubCloud.rolloverClubSeason(next);alert(`${res?.teams||0} teams rolled into ${next}. The app will now reload.`);location.reload();}catch(err){alert(err.message||err);}}
async function refreshAuditHistory(silent=false){if(!CLOUD_MODE||!['admin','coach','assistant_coach'].includes(currentRole))return;try{const teamId=isAdminTeamPreviewMode()||isAdminCoachMode()?window.ClubHubCloud?.currentTeam?.()?.id:null;__auditRows=await window.ClubHubCloud.listAuditHistory(teamId||null,100);renderAuditHistory();}catch(err){if(!silent)toast(err.message||'Could not load audit history');}}
function auditValueSummary(v){if(v==null)return'';if(typeof v==='string'||typeof v==='number')return String(v);if(v.opponent)return `${v.opponent}${v.gf!=null?` ${v.gf}–${v.ga}`:''}`;if(v.name)return v.name;return'';}
function renderAuditHistory(){const box=document.getElementById('audit-history-list');if(!box)return;box.innerHTML=__auditRows.map(r=>`<article class="audit-row"><div><strong>${esc(r.summary||r.action)}</strong><span>${esc(r.user_name||'System')}${r.team_name?' · '+esc(r.team_name):''}</span></div><div class="audit-meta"><span>${new Date(r.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>${auditValueSummary(r.before_value)||auditValueSummary(r.after_value)?`<small>${esc(auditValueSummary(r.before_value))}${r.before_value&&r.after_value?' → ':''}${esc(auditValueSummary(r.after_value))}</small>`:''}</div></article>`).join('')||'<div class="empty-state compact-empty">No audit entries yet.</div>';}

function configuredAwardTypes(){
  const types=normalizeAwardTypes(state.awardTypes);
  state.awardTypes=types;
  return types;
}
function playerOptionsHtml(){return '<option value="">None</option>'+activePlayers().map(p=>`<option value="${esc(p.name)}">#${p.number} ${esc(p.name)}</option>`).join('');}
function renderAwardFields(containerId,matchId=null){
  const box=document.getElementById(containerId);if(!box)return;
  if(matchId&&!isCoach()){
    const rows=state.awards.filter(x=>x.matchId===matchId);box.innerHTML=rows.map(a=>`<div class="readonly-detail-row"><span>${esc(a.type||'Award')}</span><strong>${esc(a.player||'—')}</strong></div>`).join('')||'<div class="empty-state compact-empty">No player awards recorded.</div>';return;
  }
  const opts=playerOptionsHtml();
  box.innerHTML=configuredAwardTypes().map(type=>`<label>${esc(type)}<select data-award-type="${esc(type)}">${opts}</select></label>`).join('')||'<div class="empty-state compact-empty">Add an award type under More → Match details.</div>';
  if(matchId){box.querySelectorAll('select[data-award-type]').forEach(el=>{const a=state.awards.find(x=>x.matchId===matchId&&x.type===el.dataset.awardType);el.value=a?.player||'';});}
}
function saveAwardFields(containerId,match){
  const box=document.getElementById(containerId);if(!box)return;
  const types=configuredAwardTypes();
  state.awards=state.awards.filter(a=>a.matchId!==match.id||!types.includes(a.type));
  box.querySelectorAll('select[data-award-type]').forEach(el=>{const player=el.value,type=el.dataset.awardType;if(player&&type)state.awards.push({id:uid('a'),date:match.date,event:match.opponent,type,player,matchId:match.id,notes:''});});
}
function renderAwardTypeSettings(){
  const box=document.getElementById('award-types-list');if(!box)return;
  const types=configuredAwardTypes();
  box.innerHTML=types.map(type=>`<div class="award-type-row"><span>${esc(type)}${type===DEFAULT_AWARD_TYPE?' <small class="default-award-badge">Default</small>':''}</span>${type===DEFAULT_AWARD_TYPE?'':`<button type="button" class="inline-action delete" data-remove-award-type="${esc(type)}">Remove</button>`}</div>`).join('');
}
function addAwardType(){
  if(!requireCoach())return;
  const input=document.getElementById('new-award-type');const type=String(input?.value||'').replace(/\s+/g,' ').trim();
  if(type.length<2)return toast('Enter an award name');
  state.awardTypes=configuredAwardTypes();
  if(state.awardTypes.some(x=>x.toLowerCase()===type.toLowerCase()))return toast('That award already exists');
  state.awardTypes.push(type.slice(0,48));if(input)input.value='';saveState();renderAwardTypeSettings();renderPlayerSelects();toast('Award type added');
}
function removeAwardType(type){
  if(!requireCoach())return;
  if(String(type).toLowerCase()===DEFAULT_AWARD_TYPE.toLowerCase()){toast('Player of the Match is the default award and stays available.');return;}
  if(!confirm(`Remove “${type}” from the available award types? Existing awards already recorded will be kept.`))return;
  state.awardTypes=normalizeAwardTypes(configuredAwardTypes().filter(x=>x!==type));saveState();renderAwardTypeSettings();renderPlayerSelects();toast('Award type removed');
}

function detailPlayerInputs(containerId,matchId,type){
  const box=document.getElementById(containerId);if(!box)return;
  const source=type==='goals'?state.goals:(state.assists||[]);const key=type==='goals'?'goals':'assists';const rows=source.filter(x=>x.matchId===matchId&&Number(x[key]||0)>0);
  if(!isCoach()){box.innerHTML=rows.map(x=>`<div class="readonly-detail-row"><span>${esc(x.player)}</span><strong>${Number(x[key]||0)}</strong></div>`).join('')||`<div class="empty-state compact-empty">No ${type==='goals'?'goalscorers':'assists'} recorded.</div>`;return;}
  const map={};rows.forEach(x=>map[x.player]=Number(x[key]||0));
  box.innerHTML=activePlayers().map(p=>`<label class="detail-player-row"><span><b>#${p.number}</b> ${esc(p.name)}</span><input type="number" min="0" value="${map[p.name]||0}" data-player="${esc(p.name)}"></label>`).join('')||'<div class="empty-state compact-empty">Add players to the squad first.</div>';
}
function detailBookingInputs(matchId){
  const box=document.getElementById('detail-booking-inputs');if(!box)return;const rows=(state.bookings||[]).filter(x=>x.matchId===matchId);
  if(!isCoach()){box.innerHTML=rows.map(x=>`<div class="readonly-detail-row"><span>${esc(x.player)}</span><strong>${Number(x.yellow||0)?`🟨 ${Number(x.yellow||0)}`:''}${Number(x.red||0)?` 🟥 ${Number(x.red||0)}`:''}</strong></div>`).join('')||'<div class="empty-state compact-empty">No bookings recorded.</div>';return;}
  const map={};rows.forEach(x=>map[x.player]={yellow:Number(x.yellow||0),red:Number(x.red||0)});
  box.innerHTML=activePlayers().map(p=>`<div class="detail-booking-row"><span><b>#${p.number}</b> ${esc(p.name)}</span><label>Y<input type="number" min="0" max="2" value="${map[p.name]?.yellow||0}" data-player="${esc(p.name)}" data-card="yellow"></label><label>R<input type="number" min="0" max="1" value="${map[p.name]?.red||0}" data-player="${esc(p.name)}" data-card="red"></label></div>`).join('')||'<div class="empty-state compact-empty">Add players to the squad first.</div>';
}
let __matchAttendanceRows=[];
function defaultAttendanceForMatch(m,player){
  const key=fixtureStableKey({opponent:m?.opponent||'',venue:m?.venue||'',competition:m?.competition||''});const selected=state.tactics?.matchdaySelections?.[key]||[];return selected.includes(tacticsPlayerId(player))?'selected':'';
}
function isMiniSoccerTeam(){return ageGroupNumber()<=11;}
function attendanceStatusLabel(v=''){if(isMiniSoccerTeam())return v==='attended'?'Present':v==='unavailable'?'Not present':'Not recorded';return v==='started'?'Started':v==='substitute'?'Substitute':v==='attended'?'Appearance (legacy)':v==='selected'?'Selected (legacy)':v==='unavailable'?'Unavailable':v==='no_show'?'No-show':'Not recorded';}
function renderMatchAttendance(m){
  const sec=document.getElementById('match-attendance-section'),box=document.getElementById('match-attendance-list'),helper=document.getElementById('match-attendance-helper');if(!sec||!box)return;const allowed=CLOUD_MODE&&['admin','coach','assistant_coach'].includes(currentRole);sec.classList.toggle('hidden',!allowed);if(!allowed)return;
  if(helper)helper.textContent='Slide each player to Present or Not present';
  const map=new Map(__matchAttendanceRows.map(r=>[selkentNorm(r.player_name),r.status]));
  if(isCoach())box.innerHTML=activePlayers().map(p=>{
    const raw=map.get(selkentNorm(p.name))||defaultAttendanceForMatch(m,p);
    const present=raw?!['unavailable','no_show'].includes(raw):true;
    const value=present?'attended':'unavailable';
    return `<div class="attendance-player-row"><span>${miniJerseyHTML(p.number,p.role,'compact')}<strong>${esc(p.name)}</strong></span><button type="button" class="attendance-switch ${present?'is-present':''}" data-attendance-player="${esc(p.name)}" data-status="${value}" data-attendance-toggle aria-pressed="${present?'true':'false'}"><span class="attendance-switch-track" aria-hidden="true"><span class="attendance-switch-thumb"></span></span><span class="attendance-switch-label">${present?'Present':'Not present'}</span></button></div>`;
  }).join('')||'<div class="empty-state compact-empty">No players in the squad.</div>';
  else box.innerHTML=activePlayers().map(p=>{const value=map.get(selkentNorm(p.name))||'';return value?`<div class="attendance-player-row readonly"><span>${miniJerseyHTML(p.number,p.role,'compact')}<strong>${esc(p.name)}</strong></span><b>${attendanceStatusLabel(value)}</b></div>`:'';}).filter(Boolean).join('')||'<div class="empty-state compact-empty">No attendance recorded.</div>';
  if(__matchReportMode)applyMatchReportStep();
}
async function loadMatchAttendance(m){__matchAttendanceRows=[];renderMatchAttendance(m);if(!CLOUD_MODE||!m||!['admin','coach','assistant_coach'].includes(currentRole))return;try{__matchAttendanceRows=await window.ClubHubCloud.listMatchAttendance(m.id);renderMatchAttendance(m);}catch{const box=document.getElementById('match-attendance-list');if(box)box.innerHTML='<div class="empty-state compact-empty">Attendance is temporarily unavailable.</div>';}}
async function saveCurrentMatchAttendance(matchId){if(!CLOUD_MODE||!isCoach())return;const before=JSON.parse(JSON.stringify(__matchAttendanceRows||[]));const rows=[...document.querySelectorAll('#match-attendance-list [data-attendance-player]')].map(el=>({player_name:el.dataset.attendancePlayer,status:el.dataset.status||''})).filter(r=>r.status);await window.ClubHubCloud.saveMatchAttendance(matchId,rows);__matchAttendanceRows=rows;auditEvent('attendance_updated','attendance',matchId,'Updated match attendance',before,rows);await refreshAppearanceStats(false);}

let __matchReportMode=false;
let __matchReportStep=0;
let __matchReportSteps=[];

function matchReportStepDefinitions(){
  const staff=CLOUD_MODE&&['admin','coach','assistant_coach'].includes(currentRole);
  return [
    {key:'score',label:'Score',section:'match-report-score-section',enabled:true},
    {key:'attendance',label:'Attendance',section:'match-attendance-section',enabled:staff},
    {key:'goals',label:'Goals',section:'detail-goals-section',enabled:featureEnabled('goals')},
    {key:'assists',label:'Assists',section:'detail-assists-section',enabled:featureEnabled('assists')},
    {key:'awards',label:'Awards',section:'detail-awards-section',enabled:featureEnabled('awards')},
    {key:'notes',label:'Coach notes',section:'coach-note-section',enabled:staff}
  ].filter(step=>step.enabled);
}
function applyMatchReportStep(){
  if(!__matchReportMode)return;
  const current=__matchReportSteps[__matchReportStep]||__matchReportSteps[0];
  ['match-report-score-section','match-attendance-section','detail-goals-section','detail-assists-section','detail-awards-section','coach-note-section'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!==current?.section));
  const progress=document.getElementById('match-report-progress');
  if(progress){progress.classList.remove('hidden');progress.innerHTML=__matchReportSteps.map((step,i)=>`<span class="${i===__matchReportStep?'active':i<__matchReportStep?'complete':''}">${i+1}. ${esc(step.label)}</span>`).join('');}
  const back=document.getElementById('match-report-back'),next=document.getElementById('match-report-next'),save=document.getElementById('save-match-details');
  if(back){back.classList.remove('hidden');back.disabled=__matchReportStep===0;}
  if(next)next.classList.toggle('hidden',__matchReportStep>=__matchReportSteps.length-1);
  if(save){save.classList.toggle('hidden',__matchReportStep<__matchReportSteps.length-1);save.textContent='Save match report';}
}
function resetMatchReportMode(){
  __matchReportMode=false;__matchReportStep=0;__matchReportSteps=[];
  document.getElementById('match-detail-dialog')?.classList.remove('report-wizard-mode');
  document.getElementById('match-report-progress')?.classList.add('hidden');
  document.getElementById('match-report-score-section')?.classList.add('hidden');
  document.getElementById('match-report-back')?.classList.add('hidden');
  document.getElementById('match-report-next')?.classList.add('hidden');
  document.getElementById('undo-match-played')?.classList.add('hidden');
  const save=document.getElementById('save-match-details');if(save){save.classList.remove('hidden');save.textContent='Save details';}
}
function changeMatchReportStep(delta){
  if(!__matchReportMode)return;
  if(delta>0&&__matchReportSteps[__matchReportStep]?.key==='score'){
    const gf=Number(document.getElementById('match-report-gf')?.value),ga=Number(document.getElementById('match-report-ga')?.value);
    if(!Number.isFinite(gf)||!Number.isFinite(ga)||gf<0||ga<0){toast('Enter a valid scoreline');return;}
  }
  __matchReportStep=Math.max(0,Math.min(__matchReportSteps.length-1,__matchReportStep+delta));
  applyMatchReportStep();
  document.getElementById('match-detail-dialog')?.scrollTo({top:0,behavior:'smooth'});
}
function openMatchReport(matchId){
  if(!requireCoach())return;
  const m=state.matches.find(x=>x.id===matchId);if(!m)return;
  __matchReportMode=true;__matchReportStep=0;__matchReportSteps=matchReportStepDefinitions();
  document.getElementById('match-detail-id').value=m.id;
  document.getElementById('match-detail-title').textContent=`Match played · ${m.opponent}`;
  document.getElementById('match-detail-summary').innerHTML=`<strong>${formatDate(m.date)}</strong><span>${esc(m.competition||'Match')} · ${String(m.venue||'').toUpperCase()==='H'?'Home':String(m.venue||'').toUpperCase()==='A'?'Away':'Neutral'}</span>`;
  renderMatchOverview(m);
  refreshMatchOverviewDirectory(m);
  const reportAway=String(m.venue||'').toUpperCase()==='A';
  document.getElementById('match-report-gf').value=Number(reportAway?m.ga:m.gf||0);
  document.getElementById('match-report-ga').value=Number(reportAway?m.gf:m.ga||0);
  detailPlayerInputs('detail-goals-inputs',m.id,'goals');
  detailPlayerInputs('detail-assists-inputs',m.id,'assists');
  renderAwardFields('detail-award-fields',m.id);
  document.getElementById('empty-detail-options')?.classList.add('hidden');
  document.getElementById('match-kit-correction')?.classList.add('hidden');
  document.getElementById('undo-match-played')?.classList.add('hidden');
  document.getElementById('match-detail-dialog')?.classList.remove('readonly-dialog');
  document.getElementById('match-detail-dialog')?.classList.add('report-wizard-mode');
  document.getElementById('match-detail-dialog')?.showModal();
  loadCoachMatchNote(m.id).finally(()=>applyMatchReportStep());
  loadMatchAttendance(m).finally(()=>applyMatchReportStep());
  applyMatchReportStep();
}


function linkedFixtureForMatch(m={}){
  const opponent=normalizeTeamKey(m.opponent||''),venue=String(m.venue||'').toUpperCase(),date=String(m.date||'');
  return (state.selkent?.fixtures||[]).find(f=>String(f.date||'')===date&&normalizeTeamKey(f.opponent||'')===opponent&&String(f.venue||'').toUpperCase()===venue)||null;
}
function kitColourPair(text=''){
  const t=String(text||'').toLowerCase();
  const palette=[
    ['navy','#17365d'],['royal blue','#2457c5'],['sky blue','#77bce8'],['blue','#2d5fb8'],
    ['green','#168848'],['white','#ffffff'],['black','#111715'],['red','#c9473b'],['yellow','#f1cf49'],
    ['orange','#d7792b'],['purple','#7352a8'],['maroon','#7b2d3e'],['grey','#7b8580'],['gray','#7b8580'],
    ['pink','#d66b95'],['claret','#7c3045'],['gold','#c99a2e']
  ];
  const found=[];
  palette.forEach(([name,hex])=>{if(t.includes(name)&&!found.includes(hex))found.push(hex);});
  if(!found.length)return ['#66756d','#ffffff'];
  return [found[0],found[1]||found[0]];
}
function kitIconHtml(colours='TBC'){
  const [primary,secondary]=kitColourPair(colours);
  const stripe=secondary!==primary?`<path d="M31 11h10v43H31z" fill="${secondary}"/>`:'';
  return `<svg class="match-team-kit" viewBox="0 0 72 68" role="img" aria-label="${esc(colours||'Kit colours TBC')}"><path d="M22 8 31 4h10l9 4 15 9-8 14-8-5v36H23V26l-8 5-8-14z" fill="${primary}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>${stripe}<path d="M31 4c1 5 9 5 10 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function ownTeamDisplayName(){return state.division?.teamName||[clubSettings().display_name,state.meta?.teamName].filter(Boolean).join(' ')||'Our team';}
function isOwnTeamName(name=''){const own=selkentNorm(ownTeamDisplayName()),candidate=selkentNorm(name);return !!own&&!!candidate&&(own===candidate||own.includes(candidate)||candidate.includes(own));}
function kitProfileForTeam(teamName='',fallbackHome=''){
  state.selkent=state.selkent||{};state.selkent.kitProfiles=state.selkent.kitProfiles||{};
  const key=selkentNorm(teamName),stored=state.selkent.kitProfiles[key]||{},detail=state.selkent?.directoryDetails?.[key]||{};
  const ownConfigured=isOwnTeamName(teamName)?(clubSettings().kit_colours||clubSettings().config?.kit_colours||''):'';
  const home=stored.home||fallbackHome||state.selkent?.kitColours?.[key]||ownConfigured||detail.colours||'TBC';
  return {key,home:home||'TBC',away:stored.away||'TBC',homeOverride:stored.home||'',awayOverride:stored.away||''};
}
function knownKit(colours=''){const s=String(colours||'').trim();return !!s&&!/^(?:TBC|Kit TBC|Not recorded)$/i.test(s);}
function kitsClash(a='',b=''){if(!knownKit(a)||!knownKit(b))return false;const [a1]=kitColourPair(a),[b1]=kitColourPair(b);return a1===b1;}
function clubTeamLink(teamName='',extra=''){return `<button type="button" class="club-detail-link ${extra}" data-club-details-team="${esc(teamName)}">${esc(teamName)}</button>`;}
function kitWarningHtml(ctx){if(!ctx?.kitWarning||!(isCoach()||isAdmin()))return'';const review=isAdmin()?`<button type="button" class="text-button compact" data-club-details-team="${esc(ctx.awayTeam)}">Review kits</button>`:'';return `<div class="kit-clash-warning"><span>${esc(ctx.kitWarning)}</span>${review}</div>`;}

function matchOverviewContext(m={}){
  const fixture=linkedFixtureForMatch(m)||{};
  const ownTeam=ownTeamDisplayName(),opponent=m.opponent||'Opponent';
  const ownDetail=state.selkent?.directoryDetails?.[selkentNorm(ownTeam)]||{},oppDetail=state.selkent?.directoryDetails?.[selkentNorm(opponent)]||{};
  const ownKey=selkentNorm(clubSettings().display_name||state.meta?.clubName||ownTeam);
  const ownProviderKit=state.selkent?.kitColours?.[ownKey]||state.selkent?.kitColours?.[selkentNorm(ownTeam)]||clubSettings().kit_colours||clubSettings().config?.kit_colours||ownDetail.colours||'TBC';
  const oppProviderKit=fixture.kitColours||state.selkent?.kitColours?.[selkentNorm(opponent)]||oppDetail.colours||'TBC';
  const away=String(m.venue||'').toUpperCase()==='A';
  const homeTeam=away?opponent:ownTeam,awayTeam=away?ownTeam:opponent;
  const homeProfile=kitProfileForTeam(homeTeam,away?oppProviderKit:ownProviderKit),awayProfile=kitProfileForTeam(awayTeam,away?ownProviderKit:oppProviderKit);
  const explicitHome=String(m.homeKitColours||'').trim(),explicitAway=String(m.awayKitColours||'').trim();
  const homeKit=explicitHome||homeProfile.home;
  const awayHomeKit=explicitAway||awayProfile.home;
  const clash=kitsClash(homeKit,awayHomeKit);
  const alternateAvailable=!explicitAway&&knownKit(awayProfile.away);
  const alternateSafe=alternateAvailable&&!kitsClash(homeKit,awayProfile.away);
  const awayKit=alternateSafe?awayProfile.away:awayHomeKit;
  const homeKitType=explicitHome?'Match kit':'Home kit',awayKitType=explicitAway?'Match kit':alternateSafe?'Away kit':'Home kit';
  let kitWarning='';
  if(clash){
    if(alternateSafe)kitWarning=`⚠️ Kit clash likely. ${awayTeam} alternate kit is shown; confirm arrangements before kick-off.`;
    else if(alternateAvailable)kitWarning=`⚠️ Kit clash likely. The recorded away kit may also conflict; agree colours before the match.`;
    else kitWarning=`⚠️ Kit clash likely. ${awayTeam} away kit is not recorded; coaches should confirm alternate colours before the match.`;
  }
  const venueDetail=away?oppDetail:ownDetail;
  const ground=m.groundName||fixture.groundName||venueDetail.groundName||'Ground TBC';
  const address=m.address||fixture.address||venueDetail.address||'Address TBC';
  return {fixture,ownTeam,opponent,homeTeam,awayTeam,homeProfile,awayProfile,homeKit,awayKit,homeKitType,awayKitType,kitWarning,ground,address,mapHref:mapsHref(ground,address),mapEmbedHref:mapsEmbedHref(ground,address)};
}
function fixtureOverviewContext(f={}){
  const linked=fixtureLinkedMatch(f);
  const m=linked?{...linked}:{id:'',date:f.date||'',opponent:f.opponent||'',venue:f.venue||'',competition:f.competition||'Division',status:'scheduled'};
  m.date=f.date||m.date||'';m.opponent=f.opponent||m.opponent||'';m.venue=f.venue||m.venue||'';m.groundName=m.groundName||f.groundName||'';m.address=m.address||f.address||'';
  return matchOverviewContext(m);
}
function setMapPreview(wrapId,frameId,href){
  const wrap=document.getElementById(wrapId),frame=document.getElementById(frameId);if(!wrap||!frame)return;
  wrap.classList.toggle('hidden',!href);
  if(!href){frame.removeAttribute('src');delete frame.dataset.mapSrc;return;}
  if(frame.dataset.mapSrc!==href){frame.src=href;frame.dataset.mapSrc=href;}
}
function renderFixtureOverview(prefix,f){
  const ctx=fixtureOverviewContext(f);
  const versus=document.getElementById(`${prefix}-versus`);
  if(versus)versus.innerHTML=`<div class="match-team-side"><span class="match-side-label">Home</span>${kitIconHtml(ctx.homeKit)}${clubTeamLink(ctx.homeTeam)}<small>${esc(ctx.homeKitType)} · ${esc(ctx.homeKit||'Kit TBC')}</small></div><div class="match-versus-mark">V</div><div class="match-team-side"><span class="match-side-label">Away</span>${kitIconHtml(ctx.awayKit)}${clubTeamLink(ctx.awayTeam)}<small>${esc(ctx.awayKitType)} · ${esc(ctx.awayKit||'Kit TBC')}</small></div>`;
  const ground=document.getElementById(`${prefix}-ground`),address=document.getElementById(`${prefix}-address`),map=document.getElementById(`${prefix}-map`),warning=document.getElementById(`${prefix}-kit-warning`);
  if(ground)ground.textContent=ctx.ground;if(address)address.textContent=ctx.address;
  if(map){map.classList.toggle('hidden',!ctx.mapHref);if(ctx.mapHref)map.href=ctx.mapHref;else map.removeAttribute('href');}
  if(warning){warning.innerHTML=kitWarningHtml(ctx);warning.classList.toggle('hidden',!warning.innerHTML);}
  setMapPreview(`${prefix}-map-preview`,`${prefix}-map-frame`,ctx.mapEmbedHref);
}
function clearFixtureOverview(prefix){
  const versus=document.getElementById(`${prefix}-versus`);if(versus)versus.innerHTML='';
  const ground=document.getElementById(`${prefix}-ground`),address=document.getElementById(`${prefix}-address`),map=document.getElementById(`${prefix}-map`),warning=document.getElementById(`${prefix}-kit-warning`);
  if(ground)ground.textContent='Ground TBC';if(address)address.textContent='Address TBC';if(map){map.classList.add('hidden');map.removeAttribute('href');}if(warning){warning.innerHTML='';warning.classList.add('hidden');}
  setMapPreview(`${prefix}-map-preview`,`${prefix}-map-frame`,'');
}
let __fixtureOverviewDirectoryPending='';
function refreshFixtureOverviewDirectory(f={}){
  const ownTeam=state.division?.teamName||[clubSettings().display_name,state.meta?.teamName].filter(Boolean).join(' '),opponent=f.opponent||'';
  const ownKey=selkentNorm(ownTeam),oppKey=selkentNorm(opponent),cache=state.selkent?.directoryDetails||{};
  const needsOwn=!!ownTeam&&!cache[ownKey],needsOpp=!!opponent&&!cache[oppKey];if(!needsOwn&&!needsOpp)return;
  const key=`${ownKey}|${oppKey}`;if(__fixtureOverviewDirectoryPending===key)return;__fixtureOverviewDirectoryPending=key;
  Promise.all([needsOwn?fetchClubDirectoryDetails(ownTeam):Promise.resolve(cache[ownKey]),needsOpp?fetchClubDirectoryDetails(opponent):Promise.resolve(cache[oppKey])]).then(()=>{
    __fixtureOverviewDirectoryPending='';persistLocalState();const current=nextPublishedFixture();if(current&&fixtureFingerprint(current)===fixtureFingerprint(f)){renderNextMatch();renderMatchPageNextFixture();}
  }).catch(()=>{__fixtureOverviewDirectoryPending='';});
}
function renderMatchOverview(m){
  const ctx=matchOverviewContext(m);
  const versus=document.getElementById('match-detail-versus');
  if(versus)versus.innerHTML=`<div class="match-team-side"><span class="match-side-label">Home</span>${kitIconHtml(ctx.homeKit)}${clubTeamLink(ctx.homeTeam)}<small>${esc(ctx.homeKitType)} · ${esc(ctx.homeKit||'Kit TBC')}</small></div><div class="match-versus-mark">V</div><div class="match-team-side"><span class="match-side-label">Away</span>${kitIconHtml(ctx.awayKit)}${clubTeamLink(ctx.awayTeam)}<small>${esc(ctx.awayKitType)} · ${esc(ctx.awayKit||'Kit TBC')}</small></div>`;
  const ground=document.getElementById('match-detail-ground'),address=document.getElementById('match-detail-address'),map=document.getElementById('match-detail-map'),warning=document.getElementById('match-detail-kit-warning');
  if(ground)ground.textContent=ctx.ground;if(address)address.textContent=ctx.address;
  if(map){map.classList.toggle('hidden',!ctx.mapHref);if(ctx.mapHref)map.href=ctx.mapHref;else map.removeAttribute('href');}
  if(warning){warning.innerHTML=kitWarningHtml(ctx);warning.classList.toggle('hidden',!warning.innerHTML);}
  setMapPreview('match-detail-map-preview','match-detail-map-frame',ctx.mapEmbedHref);
  const homeInput=document.getElementById('match-home-kit-colours'),awayInput=document.getElementById('match-away-kit-colours');
  if(homeInput)homeInput.value=m.homeKitColours||'';if(awayInput)awayInput.value=m.awayKitColours||'';
}
function refreshMatchOverviewDirectory(m){
  const ownTeam=state.division?.teamName||[clubSettings().display_name,state.meta?.teamName].filter(Boolean).join(' ');
  Promise.all([ownTeam?fetchClubDirectoryDetails(ownTeam):Promise.resolve(null),m?.opponent?fetchClubDirectoryDetails(m.opponent):Promise.resolve(null)]).then(()=>{
    if(document.getElementById('match-detail-id')?.value===m.id){renderMatchOverview(m);persistLocalState();}
  }).catch(()=>{});
}
function clubDetailContext(teamName=''){
  const key=selkentNorm(teamName),detail=state.selkent?.directoryDetails?.[key]||{},profile=kitProfileForTeam(teamName,detail.colours||'');
  const ground=detail.groundName||'Ground TBC',address=detail.address||'Address TBC';
  return {teamName,clubName:detail.clubName||teamName,profile,ground,address,mapHref:mapsHref(ground,address),mapEmbedHref:mapsEmbedHref(ground,address),sourceUrl:detail.sourceUrl||''};
}
function renderClubDetails(teamName=''){
  const ctx=clubDetailContext(teamName),dlg=document.getElementById('club-detail-dialog');if(!dlg)return;dlg.dataset.teamName=teamName;
  const title=document.getElementById('club-detail-title'),club=document.getElementById('club-detail-club-name'),kits=document.getElementById('club-detail-kits'),ground=document.getElementById('club-detail-ground'),address=document.getElementById('club-detail-address'),map=document.getElementById('club-detail-map'),admin=document.getElementById('club-kit-admin');
  if(title)title.textContent=teamName||'Club details';if(club)club.textContent=ctx.clubName||teamName;
  if(kits)kits.innerHTML=`<article><span>Home kit</span>${kitIconHtml(ctx.profile.home)}<strong>${esc(ctx.profile.home||'TBC')}</strong></article><article><span>Away kit</span>${kitIconHtml(ctx.profile.away)}<strong>${esc(knownKit(ctx.profile.away)?ctx.profile.away:'Not recorded')}</strong></article>`;
  if(ground)ground.textContent=ctx.ground;if(address)address.textContent=ctx.address;
  if(map){map.classList.toggle('hidden',!ctx.mapHref);if(ctx.mapHref)map.href=ctx.mapHref;else map.removeAttribute('href');}
  setMapPreview('club-detail-map-preview','club-detail-map-frame',ctx.mapEmbedHref);
  if(admin){admin.classList.toggle('hidden',!isAdmin());const home=document.getElementById('club-kit-home-override'),away=document.getElementById('club-kit-away');if(home)home.value=ctx.profile.homeOverride;if(away)away.value=ctx.profile.awayOverride;}
}
async function openClubDetails(teamName=''){
  const name=String(teamName||'').trim();if(!name)return;renderClubDetails(name);document.getElementById('club-detail-dialog')?.showModal();
  try{await fetchClubDirectoryDetails(name);persistLocalState();if(document.getElementById('club-detail-dialog')?.open&&document.getElementById('club-detail-dialog')?.dataset.teamName===name)renderClubDetails(name);}catch(_){}
}
function saveClubKitProfile(){
  if(!isAdmin())return toast('Club Admin access is required');
  const dlg=document.getElementById('club-detail-dialog'),teamName=dlg?.dataset.teamName||'';if(!teamName)return;
  state.selkent=state.selkent||{};state.selkent.kitProfiles=state.selkent.kitProfiles||{};
  const key=selkentNorm(teamName),before=JSON.parse(JSON.stringify(state.selkent.kitProfiles[key]||{}));
  const home=(document.getElementById('club-kit-home-override')?.value||'').trim(),away=(document.getElementById('club-kit-away')?.value||'').trim();
  const next={};if(home)next.home=home;if(away)next.away=away;
  if(Object.keys(next).length)state.selkent.kitProfiles[key]=next;else delete state.selkent.kitProfiles[key];
  saveState();auditEvent('kit_profile_updated','team_kit_profile',key,`Updated kit profile for ${teamName}`,before,next);renderClubDetails(teamName);toast('Kit details saved');
}

function openMatchDetails(matchId){
  resetMatchReportMode();
  const m=state.matches.find(x=>x.id===matchId);if(!m)return;
  document.getElementById('match-detail-id').value=m.id;
  document.getElementById('match-detail-title').textContent='Match details';
  document.getElementById('match-detail-summary').innerHTML=`<strong>${formatDate(m.date)}</strong><span>${esc(m.competition||'Match')} · ${matchScoreText(m)}${matchStatus(m)!=='played'?' · '+statusLabel(m):''}</span>`;
  renderMatchOverview(m);
  const correction=document.getElementById('match-kit-correction');if(correction)correction.classList.toggle('hidden',!isCoach());
  detailPlayerInputs('detail-goals-inputs',m.id,'goals');
  detailPlayerInputs('detail-assists-inputs',m.id,'assists');
  detailBookingInputs(m.id);
  renderAwardFields('detail-award-fields',m.id);
  let visible=0;document.querySelectorAll('[data-detail-feature]').forEach(sec=>{const on=featureEnabled(sec.dataset.detailFeature);sec.classList.toggle('hidden',!on);if(on)visible++;});
  document.getElementById('empty-detail-options').classList.toggle('hidden',visible>0);
  const saveBtn=document.getElementById('save-match-details');if(saveBtn)saveBtn.classList.toggle('hidden',!isCoach());
  const undoBtn=document.getElementById('undo-match-played');if(undoBtn)undoBtn.classList.toggle('hidden',!(isCoach()&&isPlayedMatch(m)));
  const deleteBtn=document.getElementById('delete-match-detail');if(deleteBtn){const canDelete=isCoach()&&!isProviderOwnedMatch(m);deleteBtn.classList.toggle('hidden',!canDelete);deleteBtn.dataset.deleteMatch=canDelete?m.id:'';}
  document.getElementById('match-detail-dialog')?.classList.toggle('readonly-dialog',!isCoach());
  document.getElementById('match-detail-dialog').showModal();
  refreshMatchOverviewDirectory(m);
  loadCoachMatchNote(m.id);
  loadMatchAttendance(m);
}
function openMatchReportReview(matchId){
  const m=state.matches.find(x=>x.id===matchId);if(!m)return;openMatchDetails(matchId);const title=document.getElementById('match-detail-title');if(title)title.textContent='Match report';
}
async function loadCoachMatchNote(matchId){
  const section=document.getElementById('coach-note-section'),input=document.getElementById('coach-match-note'),read=document.getElementById('coach-note-readonly');if(!section)return;
  const allowed=CLOUD_MODE&&(['coach','assistant_coach','admin'].includes(currentRole));section.classList.toggle('hidden',!allowed);if(!allowed)return;
  if(input){input.value='';input.classList.toggle('hidden',!isCoach());input.disabled=!isCoach();}if(read){read.textContent='Loading coaching notes…';read.classList.toggle('hidden',isCoach());}
  try{const row=await window.ClubHubCloud.getCoachMatchNote(matchId);const note=row?.note||'';if(input)input.value=note;if(read)read.textContent=note||'No coaching notes recorded.';}catch{if(read)read.textContent='Coaching notes are temporarily unavailable.';}
}
async function saveMatchDetails(e){
  e.preventDefault();if(!requireCoach())return;
  const id=document.getElementById('match-detail-id').value;const m=state.matches.find(x=>x.id===id);if(!m)return;const reportMode=__matchReportMode;const beforeMatch=JSON.parse(JSON.stringify(m));if(reportMode){const homeScore=Number(document.getElementById('match-report-gf')?.value||0),awayScore=Number(document.getElementById('match-report-ga')?.value||0),away=String(m.venue||'').toUpperCase()==='A';m.gf=away?awayScore:homeScore;m.ga=away?homeScore:awayScore;m.status='played';}else if(isCoach()){const home=(document.getElementById('match-home-kit-colours')?.value||'').trim(),away=(document.getElementById('match-away-kit-colours')?.value||'').trim();if(home)m.homeKitColours=home;else delete m.homeKitColours;if(away)m.awayKitColours=away;else delete m.awayKitColours;}const beforeDetails={goals:state.goals.filter(x=>x.matchId===id),assists:(state.assists||[]).filter(x=>x.matchId===id),bookings:(state.bookings||[]).filter(x=>x.matchId===id),awards:state.awards.filter(x=>x.matchId===id),homeKitColours:beforeMatch.homeKitColours||'',awayKitColours:beforeMatch.awayKitColours||''};
  if(featureEnabled('goals')){
    state.goals=state.goals.filter(x=>x.matchId!==id);
    document.querySelectorAll('#detail-goals-inputs input[data-player]').forEach(i=>{const n=Number(i.value||0);if(n>0)state.goals.push({id:uid('g'),matchId:id,player:i.dataset.player,goals:n});});
  }
  if(featureEnabled('assists')){
    state.assists=(state.assists||[]).filter(x=>x.matchId!==id);
    document.querySelectorAll('#detail-assists-inputs input[data-player]').forEach(i=>{const n=Number(i.value||0);if(n>0)state.assists.push({id:uid('as'),matchId:id,player:i.dataset.player,assists:n});});
  }
  if(featureEnabled('bookings')&&document.getElementById('detail-booking-inputs')){
    state.bookings=(state.bookings||[]).filter(x=>x.matchId!==id);
    const map={};document.querySelectorAll('#detail-booking-inputs input[data-player]').forEach(i=>{map[i.dataset.player]=map[i.dataset.player]||{yellow:0,red:0};map[i.dataset.player][i.dataset.card]=Number(i.value||0);});
    Object.entries(map).forEach(([player,c])=>{if(c.yellow||c.red)state.bookings.push({id:uid('b'),matchId:id,player,yellow:c.yellow,red:c.red});});
  }
  if(featureEnabled('awards'))saveAwardFields('detail-award-fields',m);
  if(CLOUD_MODE&&isCoach()){
    try{await window.ClubHubCloud.saveCoachMatchNote(id,document.getElementById('coach-match-note')?.value||'');}catch(err){toast('Match details saved, but coaching note could not be saved');}
    try{await saveCurrentMatchAttendance(id);}catch(err){toast('Match details saved, but attendance could not be saved');}
  }
  saveState();if(reportMode&&matchStatus(beforeMatch)!=='played')auditEvent('match_played','match',id,`Marked match played vs ${m.opponent}`,beforeMatch,m);const afterDetails={goals:state.goals.filter(x=>x.matchId===id),assists:(state.assists||[]).filter(x=>x.matchId===id),bookings:(state.bookings||[]).filter(x=>x.matchId===id),awards:state.awards.filter(x=>x.matchId===id),homeKitColours:m.homeKitColours||'',awayKitColours:m.awayKitColours||''};auditEvent('match_details_updated','match_details',id,`Updated match details vs ${m.opponent}`,beforeDetails,afterDetails);document.getElementById('match-detail-dialog').close();resetMatchReportMode();toast(reportMode?'Match report saved':'Match details saved');
  if(CLOUD_MODE&&isCoach()&&window.ClubHubCloud?.notifyMatchReport&&isPlayedMatch(m)){window.ClubHubCloud.notifyMatchReport(m.id,m.opponent,matchScoreText(m)).then(()=>refreshNotifications(true)).catch(()=>{});}
}

async function undoMatchPlayed(){
  if(!requireCoach())return;
  const id=document.getElementById('match-detail-id')?.value||'';
  const m=state.matches.find(x=>x.id===id);
  if(!m||!isPlayedMatch(m)){toast('This match is not marked as played');return;}
  const warning=`Undo match played against ${m.opponent}?

This returns the match to Scheduled and removes the recorded score, attendance, goals, assists, bookings, awards and private post-match coaching note.

The Selkent fixture, matchday squad and availability are kept.`;
  if(!confirm(warning))return;

  const beforeMatch=JSON.parse(JSON.stringify(m));
  const beforeDetails={
    goals:state.goals.filter(x=>x.matchId===id),
    assists:(state.assists||[]).filter(x=>x.matchId===id),
    bookings:(state.bookings||[]).filter(x=>x.matchId===id),
    awards:state.awards.filter(x=>x.matchId===id),
    attendance:JSON.parse(JSON.stringify(__matchAttendanceRows||[]))
  };

  let noteWarning=false;
  if(CLOUD_MODE&&isCoach()){
    try{
      await window.ClubHubCloud.saveMatchAttendance(id,[]);
      __matchAttendanceRows=[];
      await refreshAppearanceStats(false);
    }catch(err){
      alert('Could not clear match attendance, so the result has not been undone. Check your connection and try again.');
      return;
    }
    try{
      await window.ClubHubCloud.saveCoachMatchNote(id,'');
    }catch(err){
      noteWarning=true;
    }
  }

  m.status='scheduled';
  m.gf=0;
  m.ga=0;
  state.goals=state.goals.filter(x=>x.matchId!==id);
  state.assists=(state.assists||[]).filter(x=>x.matchId!==id);
  state.bookings=(state.bookings||[]).filter(x=>x.matchId!==id);
  state.awards=state.awards.filter(x=>x.matchId!==id);

  const afterMatch=JSON.parse(JSON.stringify(m));
  const afterDetails={goals:[],assists:[],bookings:[],awards:[],attendance:[]};

  saveState();
  auditEvent('match_played_undone','match',id,`Returned match vs ${m.opponent} to Scheduled`,beforeMatch,afterMatch);
  auditEvent('match_report_cleared','match_details',id,`Cleared mistaken match report vs ${m.opponent}`,beforeDetails,afterDetails);

  document.getElementById('match-detail-dialog')?.close();
  resetMatchReportMode();

  if(CLOUD_MODE&&isCoach()&&window.ClubHubCloud?.notifyMatchReopened){
    try{
      await window.ClubHubCloud.notifyMatchReopened(id,m.opponent);
      await refreshNotifications(true);
    }catch(err){
      toast('Match restored; correction notification could not be sent');
      return;
    }
  }

  toast(noteWarning?'Match restored; coaching note could not be cleared':'Match returned to Scheduled');
}

function jerseyHTML(player){
  const role=player.role==='goalkeeper'?'goalkeeper':'outfield';
  return `<div class="jersey-icon ${role}" aria-label="${role==='goalkeeper'?'Goalkeeper':'Outfield'} jersey number ${player.number}">
    <svg viewBox="0 0 64 58" aria-hidden="true"><path d="M22 6 28 2h8l6 4 14 8-7 12-7-4v32H22V22l-7 4-7-12 14-8Z"/></svg>
    <span>${player.number}</span>
  </div>`;
}
let __tacticsSelected=null;
function tacticsPlayerId(p){return `p${Number(p.number)}`;}
const TACTICS_FORMATIONS={
  5:{'1-2-1 Diamond':[[50,91],[50,70],[27,47],[73,47],[50,18]],'2-1-1':[[50,91],[30,70],[70,70],[50,44],[50,18]],'1-1-2':[[50,91],[50,70],[50,48],[30,19],[70,19]]},
  7:{'2-3-1':[[50,92],[30,72],[70,72],[20,46],[50,48],[80,46],[50,18]],'3-2-1':[[50,92],[18,72],[50,74],[82,72],[35,45],[65,45],[50,18]],'2-2-2':[[50,92],[30,72],[70,72],[30,47],[70,47],[32,19],[68,19]]},
  9:{'3-3-2':[[50,92],[18,74],[50,76],[82,74],[20,48],[50,50],[80,48],[35,18],[65,18]],'3-2-3':[[50,92],[18,74],[50,76],[82,74],[35,49],[65,49],[18,19],[50,17],[82,19]],'2-3-3':[[50,92],[30,75],[70,75],[20,49],[50,51],[80,49],[18,19],[50,17],[82,19]]},
  11:{'4-3-3':[[50,93],[12,76],[37,73],[63,73],[88,76],[22,50],[50,52],[78,50],[18,20],[50,16],[82,20]],'4-4-2':[[50,93],[12,76],[37,73],[63,73],[88,76],[13,49],[38,50],[62,50],[87,49],[34,18],[66,18]],'4-2-3-1':[[50,93],[12,76],[37,73],[63,73],[88,76],[36,56],[64,56],[18,34],[50,35],[82,34],[50,15]],'3-5-2':[[50,93],[20,75],[50,77],[80,75],[10,49],[30,51],[50,47],[70,51],[90,49],[35,18],[65,18]]}
};
function formationOptionsFor(n){return TACTICS_FORMATIONS[n]||TACTICS_FORMATIONS[11];}
function defaultFormationName(n){return Object.keys(formationOptionsFor(n))[0];}
function formationSlots(n,name){const set=formationOptionsFor(n);return set[name]||set[defaultFormationName(n)]||[];}
function slotPos(slot){return Array.isArray(slot)?{x:Number(slot[0]||50),y:Number(slot[1]||50)}:{x:Number(slot?.x||50),y:Number(slot?.y||50)};}
function currentTacticsFixtureKey(){const f=nextPublishedFixture();if(!f)return 'general';const track=state.selkent?.fixtureTracking||{},key=fixtureStableKey(f);return track.key===key&&track.continuityKey?track.continuityKey:key;}
function currentMatchdaySelection(){ensureTacticsState();const key=currentTacticsFixtureKey();return [...(state.tactics.matchdaySelections[key]||[])];}
function ensureTacticsState(){
  state.tactics=state.tactics||{lineup:[],positions:{},formation:'',formationByFixture:{},matchdaySelections:{},matchdayAutoPrepared:{}};state.tactics.positions=state.tactics.positions||{};state.tactics.matchdaySelections=state.tactics.matchdaySelections||{};state.tactics.formationByFixture=state.tactics.formationByFixture||{};state.tactics.matchdayAutoPrepared=state.tactics.matchdayAutoPrepared||{};
  const f=footballFormat(),names=Object.keys(formationOptionsFor(f.onPitch)),key=currentTacticsFixtureKey();
  if(!names.includes(state.tactics.formationByFixture[key]))state.tactics.formationByFixture[key]=(key==='general'&&names.includes(state.tactics.formation))?state.tactics.formation:names[0];
  if(state.tactics.activeFixtureKey!==key){state.tactics.activeFixtureKey=key;state.tactics.positions={};state.tactics.lineup=[];}
  state.tactics.formation=state.tactics.formationByFixture[key];
  const ids=activePlayers().map(tacticsPlayerId);let selected=Array.isArray(state.tactics.matchdaySelections[key])?state.tactics.matchdaySelections[key].filter(id=>ids.includes(id)):[];
  if(!selected.length)selected=ids.slice(0,f.matchday);selected=selected.slice(0,f.matchday);state.tactics.matchdaySelections[key]=selected;
  state.tactics.lineup=(state.tactics.lineup||[]).filter(id=>selected.includes(id));selected.forEach(id=>{if(!state.tactics.lineup.includes(id))state.tactics.lineup.push(id);});
  Object.keys(state.tactics.positions).forEach(id=>{if(!state.tactics.lineup.includes(id))delete state.tactics.positions[id];});
}
function applyFormationTemplate(save=true){
  if(!isCoach()&&save)return;ensureTacticsState();const f=footballFormat(),slots=formationSlots(f.onPitch,state.tactics.formation);state.tactics.positions={};state.tactics.lineup.slice(0,f.onPitch).forEach((id,i)=>state.tactics.positions[id]=slotPos(slots[i]));__tacticsSelected=null;if(save)saveState();else renderTacticsBoard();
}
function setSquadPage(page){const swipe=document.getElementById('squad-swipe');if(!swipe)return;swipe.scrollTo({left:Number(page||0)*swipe.clientWidth,behavior:'smooth'});document.querySelectorAll('[data-squad-page]').forEach(b=>b.classList.toggle('active',Number(b.dataset.squadPage)===Number(page)));}
function renderMatchdaySquadPicker(){
  const box=document.getElementById('matchday-squad-options'),count=document.getElementById('matchday-squad-count'),title=document.getElementById('matchday-squad-title'),fixture=document.getElementById('matchday-squad-fixture');if(!box)return;
  ensureTacticsState();const f=footballFormat(),key=currentTacticsFixtureKey(),selected=state.tactics.matchdaySelections[key]||[],next=nextPublishedFixture();
  const rank={available:0,unsure:1,'no-response':2,unavailable:3};
  const players=activePlayers().slice().sort((a,b)=>(rank[availabilityStatusForPlayer(a.name)]??2)-(rank[availabilityStatusForPlayer(b.name)]??2)||a.number-b.number);
  const counts=availabilityCounts();
  if(count)count.textContent=`${selected.length} / ${f.matchday}`;if(title)title.textContent='Matchday squad';if(fixture)fixture.textContent=next?`${next.opponent||'TBC'} · ${next.date?formatDate(next.date):'Date TBC'}`:'No published fixture · general setup';
  const ready=document.getElementById('matchday-readiness-summary');if(ready)ready.textContent=__availabilityFixture===key?`${counts.available||0} available · ${counts.unsure||0} unsure · ${counts.unavailable||0} unavailable`:'Availability will appear when parents reply.';
  const selectAvailable=document.getElementById('select-all-available');if(selectAvailable){const available=players.filter(p=>availabilityStatusForPlayer(p.name)==='available');selectAvailable.classList.toggle('hidden',!isCoach()||!available.length);selectAvailable.disabled=!isCoach();}
  box.innerHTML=players.map(p=>{const id=tacticsPlayerId(p),on=selected.includes(id),blocked=!on&&selected.length>=f.matchday,status=availabilityStatusForPlayer(p.name),statusLabel=status==='available'?'Available':status==='unsure'?'Unsure':status==='unavailable'?'Unavailable':'No reply';return `<label class="matchday-player-option ${on?'selected':''} ${blocked?'disabled-limit':''} availability-${status}"><input type="checkbox" data-matchday-player="${id}" ${on?'checked':''} ${!isCoach()||blocked?'disabled':''}/><span class="matchday-player-label">${miniJerseyHTML(p.number,p.role,'compact')}<span>${esc(p.name)}<small>${statusLabel}</small></span></span></label>`;}).join('')||'<div class="empty-state compact-empty">Add active players to the squad first.</div>';
  box.querySelectorAll('[data-matchday-player]').forEach(el=>el.addEventListener('change',()=>toggleMatchdayPlayer(el.dataset.matchdayPlayer,el.checked)));
}
function selectAllAvailablePlayers(){
  if(!requireCoach())return;ensureTacticsState();const f=footballFormat(),key=currentTacticsFixtureKey();const selected=activePlayers().filter(p=>availabilityStatusForPlayer(p.name)==='available').slice(0,f.matchday).map(tacticsPlayerId);if(!selected.length)return toast('No players marked available yet');const before=[...(state.tactics.matchdaySelections[key]||[])];state.tactics.matchdaySelections[key]=selected;state.tactics.matchdayAutoPrepared[key]=true;state.tactics.lineup=[...selected];state.tactics.positions={};__tacticsSelected=null;saveState();auditEvent('squad_selected','matchday_squad',key,`Selected ${selected.length} available players`,before,selected);toast(`${selected.length} available player${selected.length===1?'':'s'} selected`);
}
function toggleMatchdayPlayer(id,checked){
  if(!requireCoach())return;ensureTacticsState();const f=footballFormat(),key=currentTacticsFixtureKey();let selected=[...(state.tactics.matchdaySelections[key]||[])];
  const player=activePlayers().find(p=>tacticsPlayerId(p)===id),status=player?availabilityStatusForPlayer(player.name):'no-response';
  if(checked&&status==='unavailable'&&!confirm(`${player?.name||'This player'} is marked unavailable. Add them to the matchday squad anyway?`)){renderTacticsBoard();return;}
  if(checked&&!selected.includes(id)){if(selected.length>=f.matchday){toast(`Matchday limit is ${f.matchday}`);renderTacticsBoard();return;}selected.push(id);}else if(!checked)selected=selected.filter(x=>x!==id);
  state.tactics.matchdaySelections[key]=selected;state.tactics.matchdayAutoPrepared[key]=true;state.tactics.lineup=(state.tactics.lineup||[]).filter(x=>selected.includes(x));selected.forEach(x=>{if(!state.tactics.lineup.includes(x))state.tactics.lineup.push(x);});delete state.tactics.positions[id];__tacticsSelected=null;saveState();auditEvent('squad_selection_changed','matchday_squad',key,`${selected.length} players in matchday squad`,null,selected);renderMatchdayDashboard();
}
function renderTacticsBoard(){
  const pitch=document.getElementById('tactics-pitch'),bench=document.getElementById('tactics-bench');if(!pitch||!bench)return;ensureTacticsState();renderMatchdaySquadPicker();const f=footballFormat(),players=activePlayers(),byId=new Map(players.map(p=>[tacticsPlayerId(p),p])),slots=formationSlots(f.onPitch,state.tactics.formation);pitch.querySelectorAll('.tactics-player').forEach(x=>x.remove());
  const formation=document.getElementById('tactics-formation');if(formation){const names=Object.keys(formationOptionsFor(f.onPitch));formation.innerHTML=names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');formation.value=state.tactics.formation;formation.disabled=!isCoach();}
  state.tactics.lineup.slice(0,f.onPitch).forEach((id,i)=>{const p=byId.get(id);if(!p)return;if(!state.tactics.positions[id])state.tactics.positions[id]=slotPos(slots[i]);const pos=slotPos(state.tactics.positions[id]),b=document.createElement('button');b.type='button';b.className=`tactics-player ${p.role==='goalkeeper'?'goalkeeper':''} ${__tacticsSelected===id?'selected':''}`;b.dataset.tacticsId=id;b.style.left=pos.x+'%';b.style.top=pos.y+'%';b.innerHTML=`${miniJerseyHTML(p.number,p.role,'tactics-shirt')}<span>${esc(p.name)}</span>`;b.addEventListener('click',()=>selectTacticsPlayer(id));if(isCoach())enableTacticsDrag(b,id,pitch);pitch.appendChild(b);});
  const benchIds=state.tactics.lineup.slice(f.onPitch);bench.innerHTML=benchIds.map(id=>{const p=byId.get(id);return p?`<button type="button" class="tactics-bench-player ${__tacticsSelected===id?'selected':''}" data-tactics-bench="${id}">${miniJerseyHTML(p.number,p.role,'compact')}<span>${esc(p.name)}</span></button>`:'';}).join('')||'<span class="muted">No substitutes selected.</span>';bench.querySelectorAll('[data-tactics-bench]').forEach(b=>b.addEventListener('click',()=>selectTacticsPlayer(b.dataset.tacticsBench)));
  const selectedCount=(state.tactics.matchdaySelections[currentTacticsFixtureKey()]||[]).length;document.getElementById('tactics-matchday-limit').textContent=`${f.format} · ${selectedCount}/${f.matchday} selected`;pitch.classList.toggle('tactics-readonly',!isCoach());
}
function selectTacticsPlayer(id){if(!isCoach())return;if(!__tacticsSelected){__tacticsSelected=id;renderTacticsBoard();return;}if(__tacticsSelected===id){__tacticsSelected=null;renderTacticsBoard();return;}const a=state.tactics.lineup.indexOf(__tacticsSelected),b=state.tactics.lineup.indexOf(id),f=footballFormat(),slots=formationSlots(f.onPitch,state.tactics.formation);if(a>=0&&b>=0){const selected=__tacticsSelected;[state.tactics.lineup[a],state.tactics.lineup[b]]=[state.tactics.lineup[b],state.tactics.lineup[a]];if(a<f.onPitch&&b>=f.onPitch){state.tactics.positions[id]=slotPos(state.tactics.positions[selected]||slots[a]);delete state.tactics.positions[selected];}else if(b<f.onPitch&&a>=f.onPitch){state.tactics.positions[selected]=slotPos(state.tactics.positions[id]||slots[b]);delete state.tactics.positions[id];}}__tacticsSelected=null;saveState();}
function enableTacticsDrag(node,id,pitch){node.addEventListener('pointerdown',e=>{if(!isCoach())return;let moved=false;node.setPointerCapture(e.pointerId);const move=ev=>{moved=true;const r=pitch.getBoundingClientRect();const x=Math.max(7,Math.min(93,(ev.clientX-r.left)/r.width*100)),y=Math.max(5,Math.min(95,(ev.clientY-r.top)/r.height*100));state.tactics.positions[id]={x,y};node.style.left=x+'%';node.style.top=y+'%';};const up=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);if(moved){__tacticsSelected=null;persistLocalState();if(CLOUD_MODE)window.ClubHubCloud?.queueStateSave?.(state);}};node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);});}
function resetTactics(){if(!requireCoach())return;const f=footballFormat(),formation=state.tactics?.formation||defaultFormationName(f.onPitch),key=currentTacticsFixtureKey(),selected=activePlayers().map(tacticsPlayerId).slice(0,f.matchday),savedSelections={...(state.tactics?.matchdaySelections||{}),[key]:selected},savedFormations={...(state.tactics?.formationByFixture||{}),[key]:formation},savedAuto={...(state.tactics?.matchdayAutoPrepared||{}),[key]:true};state.tactics={lineup:[...selected],positions:{},formation,formationByFixture:savedFormations,activeFixtureKey:key,matchdaySelections:savedSelections,matchdayAutoPrepared:savedAuto};__tacticsSelected=null;applyFormationTemplate(true);auditEvent('tactics_reset','tactics',key,'Reset matchday squad and tactics',null,{formation,selected});toast('Matchday squad and tactics reset');}

function renderSquad(){
  const squad=rosterPlayers(),f=footballFormat();document.getElementById('squad-count').textContent=squad.length;const space=Math.max(0,f.registered-squad.length);const sc=document.getElementById('squad-space-count');if(sc)sc.textContent=`${space} registration space${space===1?'':'s'} remaining`;
  const summary=document.getElementById('squad-format-summary');if(summary)summary.innerHTML=`<span>${f.format}</span><span>${f.onPitch} on pitch</span><span>Max registered ${f.registered}</span><span>Matchday ${f.matchday}</span>`;
  document.getElementById('squad-list').innerHTML=squad.map((p,i)=>{const action=isCoach()?`<button class="player-edit" data-edit-player="${p.number}">Edit</button>`:'';const role=p.role==='goalkeeper'?'Goalkeeper':'Outfield';const status=p.status==='inactive'?' · Inactive':'';const ownPlayer=currentRole!=='player'||selkentNorm(window.ClubHubCloud?.context?.profile?.full_name||'')===selkentNorm(p.name);const profile=playerAccountsAllowedForAge(ageGroupNumber())&&ownPlayer?` data-player-profile="${esc(p.name)}" title="Open player profile"`:'';return `<article class="player-card player-profile-card"${profile}>${jerseyHTML(p)}<div><div class="player-name">${esc(p.name)}</div><div class="player-sub">${role}${status}</div></div>${action}</article>`;}).join('')||'<div class="empty-state"><strong>No players yet</strong>Add players to build the squad.</div>';
  renderTacticsBoard();
}

function renderPlayerSelects(){
  renderAwardFields('match-award-fields',document.getElementById('match-id')?.value||null);
  const stand=document.getElementById('standalone-award-player');
  if(stand){const v=stand.value;stand.innerHTML=activePlayers().map(p=>`<option value="${esc(p.name)}">#${p.number} ${esc(p.name)}</option>`).join('');stand.value=v;}
  const type=document.getElementById('standalone-award-type');if(type&&!type.value&&configuredAwardTypes().length)type.value=configuredAwardTypes()[0];
}
function renderScorerInputs(existing=null){
  const area=document.getElementById('scorer-inputs');
  if(!area) return;
  const preserved={};
  area.querySelectorAll('input[data-player]').forEach(i=>preserved[i.dataset.player]=Number(i.value||0));
  const values=existing!==null?existing:preserved;
  area.innerHTML=activePlayers().map(p=>`<label class="scorer-row"><span class="scorer-player"><span class="shirt-tag">#${p.number}</span>${esc(p.name)}</span><input type="number" min="0" value="${values[p.name]||0}" data-player="${esc(p.name)}" aria-label="Goals by ${esc(p.name)}"></label>`).join('');
  area.querySelectorAll('input').forEach(i=>i.addEventListener('input',updateGoalCheck));
  updateGoalCheck();
}
function updateGoalCheck(){
  const away=String(document.getElementById('match-venue')?.value||'').toUpperCase()==='A';
  const target=Number(document.getElementById(away?'match-ga':'match-gf').value||0);
  const assigned=[...document.querySelectorAll('#scorer-inputs input')].reduce((s,i)=>s+Number(i.value||0),0);
  const box=document.getElementById('goal-check');
  if(!box) return;
  box.textContent=`${assigned} of ${target} goals assigned`;
  box.classList.toggle('good',assigned===target);
  box.classList.toggle('bad',assigned!==target);
}
function renderAwards(){
  const rows=[...state.awards].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('awards-list').innerHTML=rows.map(a=>`<div class="award-item"><div><div class="award-type">${esc(a.type)}</div><div class="award-player">${esc(a.player)}</div><div class="award-event">${esc(a.event||'')}</div></div><div class="award-item-actions"><div class="award-date">${formatDate(a.date)}</div>${isCoach()?`<button type="button" class="inline-action delete" data-remove-award-id="${esc(a.id)}">Remove</button>`:''}</div></div>`).join('') || '<div class="empty-state">No awards logged.</div>';
}
function removeRecordedAward(id){
  if(!requireCoach())return;
  const a=(state.awards||[]).find(x=>x.id===id);if(!a)return;
  if(!confirm(`Remove ${a.type||'this award'} for ${a.player||'this player'}?`))return;
  state.awards=(state.awards||[]).filter(x=>x.id!==id);saveState();auditEvent('award_removed','award',id,`Removed ${a.type||'award'} for ${a.player||'player'}`,a,null);toast('Award removed');
}
function renderTeamSettings(){
  renderClubTeamOptions();
  populateTeamPlayerInviteOptions();
  const locked=isTeamLocked();
  const team=locked?assignedTeam():(selectedClubTeam()||{ageGroup:state.meta.ageGroup,teamName:state.meta.teamName,leagueName:state.division.teamName});
  const seasonEl=document.getElementById('settings-season');if(seasonEl)seasonEl.value=state.meta.season||'';
  const autoAge=document.getElementById('settings-auto-age');if(autoAge)autoAge.textContent=team?.ageGroup||state.meta.ageGroup||'—';
  const autoDivision=document.getElementById('settings-auto-division');if(autoDivision)autoDivision.textContent=state.division.name||team?.division||'TBC';
  const note=document.getElementById('team-lock-note');
  if(note){note.classList.toggle('hidden',!locked);note.textContent=locked?`Team locked by Club Admin: ${team.ageGroup} ${team.teamName}. Age group and team cannot be changed from this account.`:'';}
}
async function switchAdminTeamAndLoad(cloudTeam){
  if(!CLOUD_MODE||!isAdmin()||!cloudTeam)return;
  await window.ClubHubCloud.switchAdminTeam(cloudTeam.id,(assigned)=>blankStateForTeam(assigned));
  const loaded=await window.ClubHubCloud.loadInitialState(state,(assigned)=>blankStateForTeam(assigned));
  if(loaded?.state)state=repairStateIdentity(normalizeState(loaded.state));
  const current=window.ClubHubCloud.currentTeam?.();
  if(current){state.meta.teamName=current.teamName;state.meta.ageGroup=current.ageGroup;state.division.teamName=current.leagueName;if(!state.division.name&&current.division)state.division.name=current.division;}
  persistLocalState();renderAll();resetMatchForm();
  await syncSelkent(true);
}
async function saveTeamSettings(){
  if(!requireCoach()) return;
  const locked=isTeamLocked();
  const team=locked?assignedTeam():selectedClubTeam();
  if(!team){ alert('Choose a club team from the list.'); return; }
  if(CLOUD_MODE && isAdmin()){
    const currentCloud=window.ClubHubCloud?.currentTeam?.();
    const cloudTeam=(window.ClubHubCloud?.visibleTeamList?.()||[]).find(t=>t.selkentName===team.selkentName||t.leagueName===team.leagueName);
    if(cloudTeam && currentCloud?.id!==cloudTeam.id){
      try{await switchAdminTeamAndLoad(cloudTeam);toast('Team switched');}catch(err){alert('Could not switch team: '+(err.message||err));}
      return;
    }
  }
  const season=document.getElementById('settings-season').value.trim();
  const oldLeagueName=state.division.teamName;
  const identityChanged=team.ageGroup!==state.meta.ageGroup||selkentNorm(team.leagueName)!==selkentNorm(state.division.teamName);
  state.meta.teamName=team.teamName;state.meta.ageGroup=team.ageGroup;state.meta.season=season||state.meta.season;
  const idx=state.division.teams.findIndex(t=>selkentNorm(t)===selkentNorm(oldLeagueName));
  if(idx>=0)state.division.teams[idx]=team.leagueName;else if(!state.division.teams.some(t=>selkentNorm(t)===selkentNorm(team.leagueName)))state.division.teams.push(team.leagueName);
  state.division.teamName=team.leagueName;
  if(identityChanged){state.division.name=team.division||'';state.division.teams=[team.leagueName];state.selkent.fixtures=[];state.selkent.results=[];state.selkent.table=[];state.selkent.lastSync='';state.selkent.lastDivisionSync='';state.selkent.lastTableSync='';state.selkent.status='Team changed. League information will update automatically.';}
  enforceAssignedTeam(false);saveState();toast('Team saved');
  if(identityChanged||!state.division.name)await syncSelkent(true);
}

function renderLeagueSettings(){
  const meetings=document.getElementById('settings-meetings');
  const opponents=document.getElementById('settings-opponents');
  if(meetings) meetings.value=Number(state.division.meetingsPerOpponent||2);
  if(opponents) opponents.value=divisionOpponents().join('\n');
  const div=document.getElementById('league-auto-division');if(div)div.textContent=state.division.name||'TBC';
  const opp=document.getElementById('league-auto-opponents');if(opp)opp.textContent=String(divisionOpponents().length);
  const meet=document.getElementById('league-auto-meetings');if(meet)meet.textContent=`${Number(state.division.meetingsPerOpponent||2)} each`;
}
function saveLeagueSettings(){
  if(!requireCoach()) return;
  const meetings=Math.max(1,Math.min(10,Number(document.getElementById('settings-meetings').value||2)));
  const raw=document.getElementById('settings-opponents').value
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean);
  const seen=new Set();
  const self=(state.division.teamName||state.meta.teamName||'').trim();
  const opponents=[];
  raw.forEach(name=>{
    const key=name.toLowerCase();
    if(!key || key===self.toLowerCase() || seen.has(key)) return;
    seen.add(key);
    opponents.push(name);
  });
  state.division.meetingsPerOpponent=meetings;
  state.division.teams=[...opponents];
  if(self) state.division.teams.push(self);
  saveState();
  toast('League teams saved');
}

function renderFeatureSettings(){
  ['goals','assists','awards','bookings'].forEach(name=>{const el=document.getElementById('feature-'+name);if(el)el.checked=featureEnabled(name);});
  document.querySelectorAll('[data-feature-panel]').forEach(el=>el.classList.toggle('hidden',!featureEnabled(el.dataset.featurePanel)));
  reflowDashboardFeaturePanels();
  document.querySelectorAll('[data-discipline-only]').forEach(el=>el.classList.toggle('hidden',!disciplineApplies()));
  const note=document.getElementById('mini-soccer-discipline-note');if(note)note.classList.toggle('hidden',disciplineApplies());
  renderAwardTypeSettings();
}
function saveFeatureSettings(){
  if(!requireCoach())return;
  state.features=state.features||{};
  ['goals','assists','awards'].forEach(name=>state.features[name]=!!document.getElementById('feature-'+name)?.checked);
  if(disciplineApplies())state.features.bookings=!!document.getElementById('feature-bookings')?.checked;
  saveState();toast('Match detail options saved');
}
function clearDetailData(type){
  if(!requireCoach())return;
  const labels={goals:'all goalscorer data',assists:'all assist data',awards:'all player award data',bookings:'all booking data'};
  if(!confirm(`Permanently delete ${labels[type]||'this data'} for this team?`))return;
  if(type==='goals')state.goals=[];if(type==='assists')state.assists=[];if(type==='awards')state.awards=[];if(type==='bookings')state.bookings=[];
  saveState();toast('Stored detail data cleared');
}
let __adminOverviewStamp=0,__adminOverviewRows=[],__adminCoachRows=[];
function nextWeekendDates(){
  const now=new Date();now.setHours(0,0,0,0);const day=now.getDay();
  const addSat=(6-day+7)%7;const sat=new Date(now);sat.setDate(now.getDate()+addSat);const sun=new Date(sat);sun.setDate(sat.getDate()+1);
  const iso=d=>d.toISOString().slice(0,10);return [iso(sat),iso(sun)];
}
function fixtureTimeMinutes(t=''){const m=String(t).match(/(\d{1,2})[:.](\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;}
function renderAdminWeekend(rows){
  const box=document.getElementById('admin-weekend-list'),meta=document.getElementById('admin-weekend-meta');if(!box)return;
  const [sat,sun]=nextWeekendDates();const all=buildAdminFixtureRows(rows).filter(f=>f.source!=='TBC'&&[sat,sun].includes(f.date));
  const home=all.filter(f=>String(f.venue||'').toUpperCase()==='H');const conflicts=new Set();
  for(let i=0;i<home.length;i++)for(let j=i+1;j<home.length;j++){if(home[i].date!==home[j].date)continue;const a=fixtureTimeMinutes(home[i].time),b=fixtureTimeMinutes(home[j].time);if(a!==null&&b!==null&&Math.abs(a-b)<=45){conflicts.add(`${home[i].team.id}|${home[i].date}`);conflicts.add(`${home[j].team.id}|${home[j].date}`);}}
  if(meta)meta.textContent=`${formatDate(sat)}–${formatDate(sun)} · ${all.length} fixture${all.length===1?'':'s'}`;
  box.innerHTML=all.length?all.map(f=>{const ack=f.ack||{status:'awaiting',label:'Awaiting confirmation'};const warn=conflicts.has(`${f.team.id}|${f.date}`);return `<article class="weekend-fixture-row ${warn?'warning':''}"><div><strong>${esc(f.team.ageGroup)} ${esc(f.team.teamName)}</strong><span>${f.date?formatDate(f.date):'TBC'} · ${esc(f.time||'Kick-off TBC')} · ${String(f.venue||'').toUpperCase()==='A'?'Away':'Home'}</span><small>${esc(f.opponent||'Opponent TBC')}${warn?' · ⚠ Possible home-time conflict':''}</small></div><span class="fixture-ack-pill ${ack.status}">${esc(ack.label)}</span></article>`;}).join(''):'<div class="empty-state compact-empty">No published fixtures for the next weekend yet.</div>';
}
async function refreshAdminClubOverview(quiet=false){
  const panel=document.getElementById('admin-club-overview');if(!panel)return;
  const show=CLOUD_MODE&&isAdmin();panel.classList.toggle('hidden',!show);if(!show)return;
  if(quiet&&Date.now()-__adminOverviewStamp<15000)return;__adminOverviewStamp=Date.now();
  const meta=document.getElementById('admin-overview-meta');if(meta)meta.textContent='Loading club data…';
  try{
    const [rows,coaches,accessRows]=await Promise.all([window.ClubHubCloud.getClubOverview(),window.ClubHubCloud.listClubCoaches().catch(()=>[]),window.ClubHubCloud.listClubAccessAccounts().catch(()=>[])]);
    __adminOverviewRows=rows||[];__adminCoachRows=coaches||[];renderAdminWeekend(__adminOverviewRows);
    const coachesByTeam=new Map();
    __adminCoachRows.forEach(c=>{if(!c.team_id)return;const a=coachesByTeam.get(c.team_id)||[];a.push(c);coachesByTeam.set(c.team_id,a);});
    let fixtures=0,squadAlerts=0;const alerts=[];
    const leagueAges=publishedLeagueAges().map(x=>String(x).toUpperCase());
    const ageSort=r=>Number(String(r.team?.ageGroup||'').replace(/\D/g,''))||999;
    rows.forEach(r=>{
      const st=r.state||{};fixtures+=Number(st.selkent?.fixtures?.length||0);
      const age=Number(String(r.team?.ageGroup||'').replace(/\D/g,''))||14;const fmt=FOOTBALL_FORMATS[age]||FOOTBALL_FORMATS[14];const squad=(st.squad||[]).filter(p=>p&&p.name).length;const teamCoaches=coachesByTeam.get(r.team.id)||[];
      if(!teamCoaches.length)alerts.push({team:r.team,text:'No coaching staff assigned',kind:'high'});
      if(!squad)alerts.push({team:r.team,text:'No squad registered',kind:'medium'});
      if(squad>=fmt.registered){alerts.push({team:r.team,text:`Squad at ${fmt.registered}-player limit`,kind:'medium'});squadAlerts++;}
      else if(squad>=Math.max(fmt.registered-1,1)){alerts.push({team:r.team,text:`Squad nearly full (${squad}/${fmt.registered})`,kind:'low'});squadAlerts++;}
      const nextFixture=(Array.isArray(st.selkent?.fixtures)?st.selkent.fixtures:[]).filter(f=>!f.date||f.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))[0];
      if(nextFixture){const ack=fixtureAckState(st,nextFixture);if(ack.status==='changed')alerts.push({team:r.team,text:'Fixture changed · coach must reconfirm',kind:'high'});else if(ack.status==='issue')alerts.push({team:r.team,text:'Fixture issue reported by coach',kind:'high'});else if(ack.status==='awaiting')alerts.push({team:r.team,text:'Upcoming fixture awaiting coach confirmation',kind:'low'});}
    });
    const pendingParents=(accessRows||[]).filter(r=>r.role==='pending_parent');
    const noStaff=alerts.filter(a=>a.text==='No coaching staff assigned'),fixtureAlerts=alerts.filter(a=>/fixture/i.test(a.text)),squadHealth=alerts.filter(a=>/Squad/.test(a.text));
    const totalHealth=noStaff.length+fixtureAlerts.length+squadHealth.length+pendingParents.length;
    const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v)};
    setText('admin-team-count',rows.length);setText('admin-coach-count',__adminCoachRows.length);setText('admin-fixtures-count',fixtures);setText('admin-squad-alert-count',squadAlerts);setText('admin-alert-count',totalHealth);
    const attention=document.getElementById('admin-attention-list');
    if(attention){const teamLinks=items=>items.slice(0,6).map(a=>`<button type="button" class="health-team-link" data-admin-open-team="${a.team.id}">${esc(a.team.ageGroup)} ${esc(a.team.teamName)}</button>`).join('');const pendingLinks=pendingParents.slice(0,6).map(p=>{const t=(window.ClubHubCloud?.visibleTeamList?.()||[]).find(x=>x.id===p.team_id);return `<span class="health-team-link static">${esc(p.full_name||'Parent')}${t?' · '+esc(t.ageGroup+' '+t.teamName):''}</span>`;}).join('');attention.innerHTML=totalHealth?`<div class="admin-attention-heading"><strong>Needs attention</strong><span>${totalHealth}</span></div><div class="admin-health-groups"><article class="admin-health-group ${noStaff.length?'warn':''}"><span>Coaching coverage</span><strong>${noStaff.length}</strong><small>${noStaff.length?'team'+(noStaff.length===1?'':'s')+' without staff':'All teams covered'}</small><div>${teamLinks(noStaff)}</div></article><article class="admin-health-group ${fixtureAlerts.length?'warn':''}"><span>Fixture confirmation</span><strong>${fixtureAlerts.length}</strong><small>${fixtureAlerts.length?'need action':'All clear'}</small><div>${teamLinks(fixtureAlerts)}</div></article><article class="admin-health-group ${squadHealth.length?'warn':''}"><span>Squad capacity</span><strong>${squadHealth.length}</strong><small>${squadHealth.length?'near/full limits':'No capacity warnings'}</small><div>${teamLinks(squadHealth)}</div></article><article class="admin-health-group ${pendingParents.length?'warn':''}"><span>Parent approvals</span><strong>${pendingParents.length}</strong><small>${pendingParents.length?'waiting for approval':'None waiting'}</small><div>${pendingLinks}</div></article></div>`:'<div class="admin-health-good">✓ No current club health warnings</div>';}
    const activeId=window.ClubHubCloud.currentTeam?.()?.id;
    const grid=document.getElementById('admin-team-grid');
    const cardHtml=r=>{
      const st=r.state||{};const table=Array.isArray(st.selkent?.table)?st.selkent.table:[];const own=table.find(x=>normalizeTeamKey(x.team)===normalizeTeamKey(r.team.leagueName));const ageNo=Number(String(r.team.ageGroup||'').replace(/\D/g,''));const teamLeague=ageNo>=12&&leagueAges.includes(String(r.team.ageGroup||'').toUpperCase());const played=teamLeague?(own?.p??st.matches?.filter(isLeagueMatch).length??0):(st.matches?.filter(isDivisionMatch).length??0);
      const rawDiv=st.division?.name||r.team.division||'';const divAge=Number(String(rawDiv).match(/(?:Under\s*|U\s*)(\d{1,2})/i)?.[1]||0);const div=(divAge&&ageNo&&divAge!==ageNo)?'Division TBC':(rawDiv||'Division TBC');
      const mode=teamLeague?'League':'No-league';const fmt=FOOTBALL_FORMATS[ageNo]||FOOTBALL_FORMATS[14];const squad=(st.squad||[]).filter(p=>p&&p.name).length;
      const staff=(coachesByTeam.get(r.team.id)||[]).map(c=>`${c.full_name||'Staff'}${c.role==='club_admin'?' (Admin Coach)':c.role==='assistant_coach'?' (Assistant)':''}`);const coach=staff.length?staff.join(', '):'No coaching staff assigned';const capacity=squad>=fmt.registered?'full':squad>=fmt.registered-1?'near':'';
      return `<article class="admin-team-row ${r.team.id===activeId?'active-team':''}" data-admin-open-team="${r.team.id}" role="button" tabindex="0"><div class="admin-team-row-main"><div class="admin-team-row-title"><strong>${esc(r.team.teamName)}</strong><em class="competition-mode-pill ${mode==='League'?'league':'no-league'}">${mode}</em></div><span>${esc(div)} · ${esc(coach)}</span></div><div class="admin-team-row-stats"><span class="squad-capacity ${capacity}"><b>${squad}/${fmt.registered}</b> squad</span><span><b>${played}</b> P</span><span><b>${st.selkent?.fixtures?.length||0}</b> F</span></div><span class="admin-row-chevron">›</span></article>`;
    };
    const grouped=new Map();
    [...rows].sort((a,b)=>ageSort(a)-ageSort(b)||String(a.team?.teamName||'').localeCompare(String(b.team?.teamName||''))).forEach(r=>{const key=r.team?.ageGroup||'Other';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);});
    const groups=[...grouped.entries()].sort((a,b)=>(Number(String(a[0]).replace(/\D/g,''))||999)-(Number(String(b[0]).replace(/\D/g,''))||999));
    if(grid)grid.innerHTML=groups.map(([age,items],idx)=>`<details class="panel admin-age-group" ${idx===0?'open':''}><summary><strong>${esc(age)}</strong><span>${items.length} team${items.length===1?'':'s'}</span></summary><div class="admin-age-group-body">${items.map(cardHtml).join('')}</div></details>`).join('')||'<div class="empty-state">No club teams available.</div>';
    if(meta)meta.textContent=`${rows.length} teams · ${__adminCoachRows.length} coaching staff · team views are read-only for Club Admin.`;
    populateAdminCoachInviteTeams();
  }catch(err){if(meta)meta.textContent='Club overview is temporarily unavailable.';}
}

let __teamMembersStamp=0;
let __teamParentLinks=[];
let __teamPlayerAccountLinks=[];
async function refreshTeamMembers(quiet=false){
  const list=document.getElementById('team-members-list');
  if(!list||!CLOUD_MODE||!(isCoach()||isAdminTeamPreviewMode()))return;
  if(quiet&&Date.now()-__teamMembersStamp<12000)return;__teamMembersStamp=Date.now();
  if(!quiet)list.innerHTML='<div class="empty-state compact-empty">Loading team access…</div>';
  try{
    const teamId=window.ClubHubCloud?.currentTeam?.()?.id||null;
    const [rows,links,playerLinks]=await Promise.all([window.ClubHubCloud.listTeamMembers(teamId),window.ClubHubCloud.listParentPlayerLinks(null),window.ClubHubCloud.listPlayerAccountLinks(null)]);__teamParentLinks=links||[];__teamPlayerAccountLinks=playerLinks||[];
    const pending=rows.filter(r=>r.role==='pending_parent'),active=rows.filter(r=>r.role!=='pending_parent'),preview=isAdminTeamPreviewMode();
    const rowHtml=r=>{const pendingRow=r.role==='pending_parent',staff=['club_admin','coach','assistant_coach'].includes(r.role),parent=r.role==='parent',player=r.role==='player';const roleText=r.role==='club_admin'?'Club Admin · Coach':r.role==='assistant_coach'?'Assistant Coach':r.role==='coach'?'Coach':player?'Player profile':pendingRow?'Parent · awaiting approval':'Parent';const pill=r.role==='club_admin'?'Admin Coach':r.role==='assistant_coach'?'Assistant':r.role==='coach'?'Coach':player?'Player':pendingRow?'Pending':'Parent';const canRemove=!preview&&(!staff||(isAdmin()&&isClubOverviewMode()));const pinState=player?(r.access_method==='player_code'?'Reusable code':r.pin_reset_required?'Temporary PIN':r.pin_set?'PIN set':'Legacy access'):parent?(r.access_method==='email'?'Email login':r.pin_reset_required?'Temporary PIN':r.pin_set?'Legacy PIN':'Email login'):'';const linked=parent?__teamParentLinks.filter(x=>x.parent_user_id===r.user_id):player?__teamPlayerAccountLinks.filter(x=>x.user_id===r.user_id):[];const linkText=linked.length?` · ${linked.map(x=>x.player_name).join(', ')}`:(parent?' · No player linked':'');return `<div class="team-member-row ${pendingRow?'pending':''}"><div class="team-member-copy"><strong>${esc(r.full_name||'Member')}</strong><span>${esc(roleText)}${pinState?' · '+esc(pinState):''}${(parent||player)?esc(linkText):''}</span></div><div class="team-member-actions"><span class="member-role-pill">${pill}</span>${!preview&&pendingRow?`<button class="inline-action" data-approve-parent="${r.user_id}">Approve</button>`:''}${!preview&&parent?`<button class="inline-action" data-link-parent-player="${r.user_id}" data-parent-name="${esc(r.full_name||'Parent')}">Link player</button>${r.access_method!=='email'?`<button class="inline-action" data-reset-parent-pin="${r.user_id}" data-parent-name="${esc(r.full_name||'Parent')}">Reset legacy PIN</button>`:''}`:''}${canRemove?`<button class="inline-action delete" data-remove-member="${r.user_id}">Remove</button>`:''}</div></div>`;};
    list.innerHTML=(pending.length?`<div class="member-group-label">Awaiting approval</div>${pending.map(rowHtml).join('')}`:'')+(active.length?`<div class="member-group-label">Active access</div>${active.map(rowHtml).join('')}`:'')||'<div class="empty-state compact-empty">No team access accounts yet.</div>';
  }catch(err){list.innerHTML='<div class="empty-state compact-empty">Team access is temporarily unavailable.</div>';}
}
async function openParentLinkDialog(userId,parentName='Parent'){
  if(!requireCoach())return;const dlg=document.getElementById('parent-link-dialog'),list=document.getElementById('parent-link-player-list');if(!dlg||!list)return;
  document.getElementById('parent-link-user-id').value=userId;document.getElementById('parent-link-title').textContent=`Link player · ${parentName}`;
  let links=[];try{links=await window.ClubHubCloud.listParentPlayerLinks(userId);}catch{}
  const linked=new Set(links.map(x=>x.player_name));list.innerHTML=activePlayers().map(p=>`<label class="parent-link-player"><input type="checkbox" value="${esc(p.name)}" data-shirt-number="${p.number}" ${linked.has(p.name)?'checked':''}/>${miniJerseyHTML(p.number,p.role,'compact')}<span>${esc(p.name)}</span></label>`).join('')||'<div class="empty-state compact-empty">Add players to the squad before linking parents.</div>';dlg.showModal();
}
async function saveParentLinkDialog(e){
  e.preventDefault();if(!requireCoach())return;const userId=document.getElementById('parent-link-user-id')?.value||'',checked=[...document.querySelectorAll('#parent-link-player-list input[type="checkbox"]:checked')].map(el=>({name:el.value,number:Number(el.dataset.shirtNumber)||null}));
  try{await window.ClubHubCloud.saveParentPlayerLinks(userId,checked);auditEvent('player_link_updated','access',userId,checked.length?`Linked parent to ${checked.map(x=>x.player_name||x.name||x).join(', ')}`:'Cleared parent player links',null,checked);document.getElementById('parent-link-dialog')?.close();toast(checked.length?'Player link saved':'Player links cleared');__teamMembersStamp=0;await refreshTeamMembers(false);}catch(err){alert(err.message||err);}
}
async function createTeamParentInvite(){
  if(!requireCoach())return;
  if(!CLOUD_MODE)return toast('Cloud access is required.');
  const team=window.ClubHubCloud?.currentTeam?.();if(!team)return;
  try{
    const invite=await window.ClubHubCloud.createInvite({teamId:team.id,role:'parent',label:'',expiresHours:168});
    const out=document.getElementById('team-parent-invite-code');if(out)out.value=invite?.code||'';
    toast('Parent account invite created');
  }catch(err){alert('Could not create parent invite: '+(err.message||err));}
}
function populateTeamPlayerInviteOptions(){
  const wrap=document.getElementById('team-player-invite-section'),sel=document.getElementById('team-player-invite-player');if(!wrap||!sel)return;
  const allowed=playerAccountsAllowedForAge(ageGroupNumber());wrap.classList.toggle('hidden',!allowed);if(!allowed)return;
  const keep=sel.value;sel.innerHTML='<option value="">Choose player…</option>'+activePlayers().map(p=>`<option value="${esc(p.name)}">#${p.number} ${esc(p.name)}</option>`).join('');if([...sel.options].some(o=>o.value===keep))sel.value=keep;
}
async function createTeamPlayerInvite(){
  if(!requireCoach()||!playerAccountsAllowedForAge(ageGroupNumber()))return toast('Player app access is not enabled for this age group.');
  if(!CLOUD_MODE)return toast('Cloud access is required.');
  const team=window.ClubHubCloud?.currentTeam?.(),player=document.getElementById('team-player-invite-player')?.value||'';if(!team||!player)return toast('Choose a player');
  try{const invite=await window.ClubHubCloud.createInvite({teamId:team.id,role:'player',label:player,expiresHours:168});const out=document.getElementById('team-player-invite-code');if(out)out.value=invite?.code||'';toast(`Reusable Player Access code created for ${player}`);}catch(err){alert(err.message||err);}
}
async function copyTeamPlayerInvite(){
  const el=document.getElementById('team-player-invite-code');if(!el?.value)return toast('Create a Player Access code first');
  try{await navigator.clipboard.writeText(el.value);toast('Player Access code copied');}catch{el.select();document.execCommand('copy');toast('Player Access code copied');}
}

async function approveParent(userId){
  if(!requireCoach())return;
  try{await window.ClubHubCloud.approveParent(userId);auditEvent('parent_approved','access',userId,'Approved parent access');toast('Parent approved');await refreshTeamMembers(false);}catch(err){alert(err.message||err);}
}
async function resetParentPin(userId,parentName='Parent'){
  if(!requireCoach())return;if(!confirm(`Reset ${parentName}'s PIN? The old PIN will stop working.`))return;
  try{const data=await window.ClubHubCloud.resetParentPin(userId);const pin=data?.temporary_pin||'';if(pin){try{await navigator.clipboard.writeText(pin);}catch{}prompt(`Temporary PIN for ${data?.full_name||parentName}. It must be changed after sign-in.`,pin);}auditEvent('pin_reset','access',userId,`Reset PIN for ${data?.full_name||parentName}`);toast('Temporary PIN created');await refreshTeamMembers(false);}catch(err){alert(err.message||err);}
}
async function removeTeamMember(userId){
  if(!requireCoach())return;
  if(!confirm("Remove this person\'s access? Their football data is not deleted."))return;
  try{await window.ClubHubCloud.removeTeamMember(userId);auditEvent('access_removed','access',userId,'Removed team app access');toast('Access removed');await refreshTeamMembers(false);}catch(err){alert(err.message||err);}
}
async function copyTeamParentInvite(){
  const el=document.getElementById('team-parent-invite-code');if(!el?.value)return toast('Create an invite first');
  try{await navigator.clipboard.writeText(el.value);toast('Invite code copied');}catch{el.select();document.execCommand('copy');toast('Invite code copied');}
}

let __clubCoachStamp=0;
async function refreshClubCoaches(quiet=false){
  const list=document.getElementById('club-coaches-list');if(!list||!CLOUD_MODE||!isAdmin())return;
  if(quiet&&Date.now()-__clubCoachStamp<12000)return;__clubCoachStamp=Date.now();
  if(!quiet)list.innerHTML='<div class="empty-state compact-empty">Loading coaching staff…</div>';
  try{
    const rows=await window.ClubHubCloud.listClubCoaches();__adminCoachRows=rows;
    list.innerHTML=rows.map(r=>{const role=r.role==='club_admin'?'Club Admin · Coach':r.role==='assistant_coach'?'Assistant Coach':'Coach';const removeLabel=r.role==='club_admin'?'Remove coaching role':'Remove';return `<div class="team-member-row"><div class="team-member-copy"><strong>${esc(r.full_name||role)}</strong><span>${esc((r.age_group?'U'+r.age_group+' ':'')+(r.team_name||'Team not assigned'))}</span></div><div class="team-member-actions"><span class="member-role-pill">${role}</span><button class="inline-action delete" data-remove-club-coach="${r.user_id}">${removeLabel}</button></div></div>`;}).join('')||'<div class="empty-state compact-empty">No coaching staff accounts currently have access.</div>';
    populateAdminCoachInviteTeams();
    await refreshAdminAccessManagement(true);
  }catch(err){list.innerHTML='<div class="empty-state compact-empty">Coaching staff are temporarily unavailable.</div>';}
}
let __adminAccessRows=[];
function accessRoleLabel(role){return role==='club_admin'?'Club Admin':role==='assistant_coach'?'Assistant Coach':role==='coach'?'Coach':role==='player'?'Player':role==='pending_parent'?'Parent · pending':'Parent';}
function renderAdminAccessManagement(){
  const list=document.getElementById('admin-access-list'),stats=document.getElementById('admin-access-stats'),filter=document.getElementById('admin-access-filter');if(!list)return;
  const mode=filter?.value||'all',rows=__adminAccessRows.filter(r=>mode==='all'||(mode==='staff'?['coach','assistant_coach'].includes(r.role):mode==='parent'?r.role==='parent':r.role===mode));
  const counts={admins:__adminAccessRows.filter(r=>r.role==='club_admin').length,staff:__adminAccessRows.filter(r=>['coach','assistant_coach'].includes(r.role)||(r.role==='club_admin'&&r.coach_team_id)).length,parents:__adminAccessRows.filter(r=>r.role==='parent').length,players:__adminAccessRows.filter(r=>r.role==='player').length,pending:__adminAccessRows.filter(r=>r.role==='pending_parent').length};
  if(stats)stats.innerHTML=`<span class="admin-access-stat">${counts.admins} Admin</span><span class="admin-access-stat">${counts.staff} coaching staff</span><span class="admin-access-stat">${counts.parents} parents</span><span class="admin-access-stat">${counts.players} players</span>${counts.pending?`<span class="admin-access-stat">${counts.pending} pending</span>`:''}`;
  list.innerHTML=rows.map(r=>{const dual=r.role==='club_admin'&&r.coach_team_id,role=dual?'Club Admin · Coach':accessRoleLabel(r.role),team=(r.age_group&&r.team_name)?`U${r.age_group} ${r.team_name}`:(r.role==='club_admin'?'Club-wide':'Team not assigned');return `<div class="team-member-row"><div class="team-member-copy"><strong>${esc(r.full_name||role)}</strong><span>${esc(team)}</span><div class="admin-access-row-role"><span class="member-role-pill">${esc(role)}</span><span class="access-method-pill">${esc(r.access_method||'access')}</span></div></div><div class="team-member-actions"></div></div>`;}).join('')||'<div class="empty-state compact-empty">No accounts match this filter.</div>';
}
async function refreshAdminAccessManagement(quiet=false){
  if(!CLOUD_MODE||!isAdmin())return;const list=document.getElementById('admin-access-list');if(!list)return;if(!quiet)list.innerHTML='<div class="empty-state compact-empty">Loading club access…</div>';
  try{__adminAccessRows=await window.ClubHubCloud.listClubAccessAccounts();renderAdminAccessManagement();}catch(err){list.innerHTML='<div class="empty-state compact-empty">Club access is temporarily unavailable.</div>';}
}

async function removeClubCoach(userId){
  if(!isAdmin()||!CLOUD_MODE)return;
  const row=__adminCoachRows.find(r=>String(r.user_id)===String(userId));const dual=row?.role==='club_admin';
  const question=dual?'Remove this Club Admin\'s coaching assignment? Their Club Admin access will be kept.':"Remove this coach's app access? Team data will not be deleted.";
  if(!confirm(question))return;
  try{await window.ClubHubCloud.removeClubCoach(userId);auditEvent(dual?'coach_assignment_removed':'coach_access_removed','access',userId,dual?'Removed Club Admin coaching assignment':'Removed coach app access');toast(dual?'Coaching assignment removed':'Coach access removed');await refreshClubCoaches(false);await refreshAdminClubOverview(false);}catch(err){alert(err.message||err);}
}

let __adminFixtureStamp=0,__adminDirectoryCache=new Map(),__adminFixtureRows=[];
function populateAdminFixtureAgeFilter(){
  const sel=document.getElementById('admin-fixtures-age');if(!sel)return;
  const ages=[...new Set((window.ClubHubCloud?.visibleTeamList?.()||[]).map(t=>Number(String(t.ageGroup||'').replace(/\D/g,''))).filter(Boolean))].sort((a,b)=>a-b);const keep=sel.value||'all';sel.innerHTML='<option value="all">All age groups</option>'+ages.map(a=>`<option value="${a}">Under ${a}s</option>`).join('');sel.value=[...sel.options].some(o=>o.value===keep)?keep:'all';
}
async function fetchAdminDirectoryDetail(teamName){
  const key=selkentNorm(teamName);if(!key)return null;if(__adminDirectoryCache.has(key))return __adminDirectoryCache.get(key);
  try{const r=await fetch(`${SELKENT_DIRECTORY_API}?team=${encodeURIComponent(teamName)}`,{cache:'no-store'});if(!r.ok)throw new Error();const d=await r.json();const detail={clubName:d.club_name||teamName,colours:d.club_colours||'TBC',groundName:d.home_ground?.name||'TBC',address:d.home_ground?.address||'TBC'};__adminDirectoryCache.set(key,detail);return detail;}catch{__adminDirectoryCache.set(key,null);return null;}
}
function buildAdminFixtureRows(rows){
  const now=new Date().toISOString().slice(0,10),out=[];
  (rows||[]).forEach(r=>{const st=r.state||{},team=r.team||{};const fixtures=Array.isArray(st.selkent?.fixtures)?st.selkent.fixtures:[];const scheduled=(st.matches||[]).filter(m=>['scheduled','postponed'].includes(matchStatus(m))&&(!m.date||m.date>=now));
    fixtures.forEach(f=>out.push({team,source:'Selkent',date:f.date||'',time:f.time||'',opponent:f.opponent||'TBC',venue:f.venue||'',competition:f.competition||'Division',kitColours:f.kitColours||'',groundName:f.groundName||'',address:f.address||'',ack:fixtureAckState(st,f)}));
    scheduled.forEach(m=>{const dup=out.some(x=>x.team.id===team.id&&x.date===m.date&&normalizeTeamKey(x.opponent)===normalizeTeamKey(m.opponent));if(!dup)out.push({team,source:'Team',date:m.date||'',time:m.time||'',opponent:m.opponent||'TBC',venue:m.venue||'',competition:m.competition||m.type||'Match',status:matchStatus(m)});});
    if(!fixtures.length&&!scheduled.length)out.push({team,source:'TBC',date:'',time:'',opponent:'TBC',venue:'',competition:'Division fixture'});
  });
  return out.sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||(Number(String(a.team.ageGroup||'').replace(/\D/g,''))||99)-(Number(String(b.team.ageGroup||'').replace(/\D/g,''))||99)||String(a.team.teamName||'').localeCompare(String(b.team.teamName||'')));
}
function renderAdminFixtures(){
  const list=document.getElementById('admin-fixture-list');if(!list)return;populateAdminFixtureAgeFilter();const age=document.getElementById('admin-fixtures-age')?.value||'all';const rows=__adminFixtureRows.filter(r=>age==='all'||Number(String(r.team.ageGroup||'').replace(/\D/g,''))===Number(age));
  const ownGround='East Wickham Primary Academy · Wickham Street, DA16 3BP';
  list.innerHTML=rows.map(f=>{if(f.source==='TBC')return `<article class="admin-fixture-row tbc"><div class="admin-fixture-date"><strong>TBC</strong><span>${esc(f.team.ageGroup)}</span></div><div class="admin-fixture-main"><strong>${esc(f.team.teamName)} · Opponent TBC</strong><span>Fixture details TBC</span><small>Kick-off, venue, kit colours and address TBC</small></div><span class="fixture-source-pill">TBC</span></article>`;const detail=__adminDirectoryCache.get(selkentNorm(f.opponent))||{};const colours=f.kitColours||detail?.colours||'TBC';const away=String(f.venue||'').toUpperCase()==='A';const venue=away?'Away':String(f.venue||'').toUpperCase()==='H'?'Home':'Venue TBC';const ground=away?[f.groundName||detail?.groundName,f.address||detail?.address].filter(Boolean).join(' · '):String(f.venue||'').toUpperCase()==='H'?ownGround:'Ground TBC';const clash=/\bgreen\b/i.test(colours);const map=away?mapsHref(f.groundName||detail?.groundName,f.address||detail?.address):mapsHref(f.groundName,f.address);const ack=f.ack||{status:'awaiting',label:'Awaiting confirmation'};return `<article class="admin-fixture-row"><div class="admin-fixture-date"><strong>${f.date?formatDate(f.date):'TBC'}</strong><span>${f.time?esc(f.time):'Kick-off TBC'}</span></div><div class="admin-fixture-main"><strong>${esc(f.team.ageGroup)} ${esc(f.team.teamName)} <b>${venue==='Away'?'@':'v'}</b> ${esc(f.opponent)}</strong><span>${esc(f.competition||'Fixture')} · ${venue}${clash?' · ⚠ Possible green kit clash':''}</span><small>${esc(ground||'Ground TBC')}</small><small>${esc(f.opponent)} kit: ${esc(colours)}</small>${map?`<a class="map-link compact" href="${esc(map)}">Open in Maps</a>`:''}<span class="fixture-ack-pill ${ack.status}">${esc(ack.label)}</span></div><span class="fixture-source-pill ${f.source==='Selkent'?'selkent':''}">${esc(f.source)}</span></article>`;}).join('')||'<div class="empty-state">No fixtures match this filter.</div>';
}
async function refreshAdminFixtures(quiet=false){
  if(!CLOUD_MODE||!isAdmin())return;const list=document.getElementById('admin-fixture-list');if(!list)return;if(quiet&&Date.now()-__adminFixtureStamp<15000){renderAdminFixtures();return;}__adminFixtureStamp=Date.now();if(!quiet)list.innerHTML='<div class="empty-state compact-empty">Loading club fixtures…</div>';
  try{const rows=__adminOverviewRows.length?__adminOverviewRows:await window.ClubHubCloud.getClubOverview();__adminOverviewRows=rows;__adminFixtureRows=buildAdminFixtureRows(rows);renderAdminFixtures();const names=[...new Set(__adminFixtureRows.filter(f=>f.opponent&&f.opponent!=='TBC').map(f=>f.opponent))].slice(0,20);await Promise.all(names.map(fetchAdminDirectoryDetail));renderAdminFixtures();}catch(err){list.innerHTML=`<div class="empty-state compact-empty">Could not load fixtures: ${esc(err.message||err)}</div>`;}
}
function populateAdminCoachInviteTeams(){
  const sel=document.getElementById('admin-coach-invite-team');if(!sel||!isAdmin())return;const teams=window.ClubHubCloud?.visibleTeamList?.()||[];const keep=sel.value;sel.innerHTML=teams.map(t=>`<option value="${t.id}">${esc(t.ageGroup)} ${esc(t.teamName)}</option>`).join('');if(teams.some(t=>t.id===keep))sel.value=keep;
}
async function createAdminCoachInvite(){
  if(!isAdmin()||!CLOUD_MODE||!isClubOverviewMode())return;
  const teamId=document.getElementById('admin-coach-invite-team')?.value;
  const rawRole=document.getElementById('admin-coach-invite-role')?.value||'coach';
  const inviteRole=['assistant_coach','club_admin'].includes(rawRole)?rawRole:'coach';
  if(inviteRole!=='club_admin'&&!teamId)return toast('Choose a team');
  const roleName=inviteRole==='club_admin'?'Club Admin':inviteRole==='assistant_coach'?'Assistant Coach':'Coach';
  try{
    const invite=await window.ClubHubCloud.createInvite({teamId:inviteRole==='club_admin'?null:teamId,role:inviteRole,label:`${roleName} invite`,expiresHours:168});
    const wrap=document.getElementById('admin-coach-invite-output'),out=document.getElementById('admin-coach-invite-code');if(out)out.value=invite?.code||'';wrap?.classList.remove('hidden');toast(`${roleName} invite created`);
  }catch(err){alert(err.message||err);}
}
async function copyAdminCoachInvite(){const el=document.getElementById('admin-coach-invite-code');if(!el?.value)return;try{await navigator.clipboard.writeText(el.value);toast('Coach invite copied');}catch{el.select();document.execCommand('copy');toast('Coach invite copied');}}

async function createClubAdminInvite(){
  if(!CLOUD_MODE||!isAdmin()||!isClubOverviewMode())return;
  try{
    const invite=await window.ClubHubCloud.createInvite({teamId:null,role:'club_admin',label:'Club Admin invite',expiresHours:168});
    const out=document.getElementById('club-admin-invite-code'),wrap=document.getElementById('club-admin-invite-output');if(out)out.value=invite?.code||'';wrap?.classList.remove('hidden');toast('Club Admin invite created');
  }catch(err){alert(err.message||err);}
}
async function copyClubAdminInvite(){const el=document.getElementById('club-admin-invite-code');if(!el?.value)return toast('Create an invite first');try{await navigator.clipboard.writeText(el.value);toast('Club Admin invite copied');}catch{el.select();document.execCommand('copy');toast('Club Admin invite copied');}}

let __complianceStatus=null;
async function refreshCompliancePanel(){
  const box=document.getElementById('compliance-status');if(!CLOUD_MODE||!window.ClubHubCloud?.getClubComplianceStatus)return;
  try{
    __complianceStatus=await window.ClubHubCloud.getClubComplianceStatus();
    if(box&&isAdmin()){
      box.textContent=__complianceStatus?.fully_configured?'Compliance setup complete':'Action required: add reviewer/safeguarding contacts';
      const set=(id,v)=>{const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=v||'';};
      set('compliance-primary-reviewer',__complianceStatus?.primary_reviewer_name);set('compliance-backup-reviewer',__complianceStatus?.backup_reviewer_name);set('compliance-welfare-name',__complianceStatus?.welfare_officer_name);set('compliance-welfare-contact',__complianceStatus?.welfare_officer_contact);set('compliance-county-fa',__complianceStatus?.county_fa_name||'London FA');set('compliance-county-contact',__complianceStatus?.county_fa_safeguarding_contact);
      const fb=document.getElementById('compliance-fallback');if(fb)fb.checked=!!__complianceStatus?.fallback_to_county_fa;
      const cp=document.getElementById('club-cancel-status');if(cp)cp.textContent=__complianceStatus?.deletion_due_at?`Deletion scheduled: ${new Date(__complianceStatus.deletion_due_at).toLocaleString('en-GB')}`:'Club active';
      try{const audit=await window.ClubHubCloud.listSafeguardingExportAudit();const a=document.getElementById('safeguarding-export-audit');if(a)a.innerHTML=(audit||[]).slice(0,20).map(x=>`<div class="audit-history-row"><strong>${new Date(x.exported_at).toLocaleString('en-GB')}</strong><span>${esc(x.team_name||'Team')} · ${esc((x.player_names||[]).join(', '))}</span><small>Exported by ${esc(x.exported_by_name||'Club user')}</small></div>`).join('')||'<div class="empty-state compact-empty">No safeguarding exports logged.</div>';}catch{}
    }
    await refreshDisputeReviewerPanel();
  }catch(e){if(box&&isAdmin())box.textContent='Could not load compliance status';}
}
async function refreshDisputeReviewerPanel(){const panel=document.getElementById('dispute-reviewer-panel');if(!panel)return;const show=!!__complianceStatus?.is_current_user_reviewer;panel.classList.toggle('hidden',!show);if(!show)return;try{const rows=await window.ClubHubCloud.listGeneralDisputes();const box=document.getElementById('reviewer-dispute-list');box.innerHTML=(rows||[]).map(r=>`<article class="inbox-message theirs"><div class="inbox-message-meta"><strong>${esc(r.reporter_name||'Reporter')}</strong><span>${new Date(r.created_at).toLocaleString('en-GB')}</span></div><b>${esc(r.subject||'General dispute')}</b><p>${esc(r.body||'').replace(/\n/g,'<br>')}</p><small>${esc(r.status||'open')}</small></article>`).join('')||'<div class="empty-state compact-empty">No retained general disputes.</div>';}catch{panel.classList.add('hidden');}}
async function loadRetainedThread(){const id=document.getElementById('reviewer-thread-id')?.value.trim()||'';if(!id)return toast('Enter a thread ID');try{const rows=await window.ClubHubCloud.listDisputeMessages(id);const box=document.getElementById('reviewer-retained-thread');box.innerHTML=(rows||[]).map(r=>`<article class="inbox-message"><div class="inbox-message-meta"><strong>${esc(r.sender_name||'Sender')} → ${esc(r.recipient_name||'Recipient')}</strong><span>${new Date(r.sent_at).toLocaleString('en-GB')}</span></div>${r.subject?`<b>${esc(r.subject)}</b>`:''}<p>${esc(r.body||'').replace(/\n/g,'<br>')}</p></article>`).join('')||'<div class="empty-state compact-empty">No retained messages for this thread.</div>';}catch(e){alert(e.message||e);}}
async function saveComplianceSettings(){
  if(!isAdmin())return;
  try{await window.ClubHubCloud.setDisputeReviewers({primaryName:document.getElementById('compliance-primary-reviewer').value.trim(),primaryUserId:document.getElementById('compliance-primary-user').value||null,backupName:document.getElementById('compliance-backup-reviewer').value.trim(),backupUserId:document.getElementById('compliance-backup-user').value||null,fallback:document.getElementById('compliance-fallback').checked});await window.ClubHubCloud.setClubSafeguardingContacts({welfareName:document.getElementById('compliance-welfare-name').value.trim(),welfareContact:document.getElementById('compliance-welfare-contact').value.trim(),countyFaName:document.getElementById('compliance-county-fa').value.trim(),countyFaContact:document.getElementById('compliance-county-contact').value.trim()});toast('Compliance settings saved');await refreshCompliancePanel();}catch(e){alert(e.message||e);}
}
async function loadComplianceAccountChoices(){if(!isAdmin())return;try{const rows=await window.ClubHubCloud.listClubAccessAccounts();const opts='<option value="">Name only / not yet an app user</option>'+rows.filter(r=>['club_admin','coach','assistant_coach','parent'].includes(r.role)).map(r=>`<option value="${r.user_id}">${esc(r.full_name)} · ${esc(accessRoleLabel(r.role))}</option>`).join('');['compliance-primary-user','compliance-backup-user'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});}catch{}}
async function submitConcern(){const category=document.getElementById('concern-category')?.value||'general',subject=document.getElementById('concern-subject')?.value.trim()||'',body=document.getElementById('concern-body')?.value.trim()||'';try{const r=await window.ClubHubCloud.raiseClubConcern({category,subject,body});const out=document.getElementById('concern-result');if(category==='safeguarding'){const c=r.contacts||{};out.innerHTML=`<strong>Do not enter safeguarding details in this app.</strong><br>Contact ${esc(c.club_welfare_officer?.name||'your Club Welfare Officer')}: ${esc(c.club_welfare_officer?.contact||'contact not configured')}<br>${esc(c.county_fa?.name||'County FA')}: ${esc(c.county_fa?.safeguarding_contact||'contact not configured')}<br>NSPCC Sport: 0116 366 5580 · sport@nspcc.org.uk<br>Immediate danger: 999`;document.getElementById('concern-subject').value='';document.getElementById('concern-body').value='';}else{out.textContent='General dispute submitted to the club Dispute Reviewer.';}}catch(e){alert(e.message||e);}}
async function saveU11SafeguardingInfo(){const team=window.ClubHubCloud?.currentTeam?.(),player=document.getElementById('u11-safeguarding-player')?.value||'';if(!team||!player)return toast('Choose a player');try{await window.ClubHubCloud.upsertU11SafeguardingInfo({teamId:team.id,playerName:player,emergencyName:document.getElementById('u11-emergency-name').value.trim(),emergencyPhone:document.getElementById('u11-emergency-phone').value.trim(),medicalInfo:document.getElementById('u11-medical-info').value.trim()});toast('Safeguarding information saved');}catch(e){alert(e.message||e);}}
async function exportU11Safeguarding(){const team=window.ClubHubCloud?.currentTeam?.(),player=document.getElementById('u11-safeguarding-player')?.value||'';if(!team)return;try{const rows=await window.ClubHubCloud.exportU11SafeguardingPack(team.id,player?[player]:[]);const csv=[['Player','Emergency contact','Phone','Medical / allergy information'],...(rows||[]).map(r=>[r.player_name,r.emergency_contact_name||'',r.emergency_contact_phone||'',r.medical_allergy_info||''])];download(`${safeFileName()}_Safeguarding_Pack.csv`,csv.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv');toast('Safeguarding export logged');}catch(e){alert(e.message||e);}}
function renderU11SafeguardingControls(){const panel=document.getElementById('u11-safeguarding-panel');if(!panel)return;const show=isCoach()&&ageGroupNumber()<=11;panel.classList.toggle('hidden',!show);if(!show)return;const sel=document.getElementById('u11-safeguarding-player');if(sel)sel.innerHTML='<option value="">Choose player…</option>'+activePlayers().map(p=>`<option value="${esc(p.name)}">#${p.number||'—'} ${esc(p.name)}</option>`).join('');}
async function requestClubCancellationUi(){if(!confirm('Cancel this club workspace? Data will be permanently deleted 30 days after this request.'))return;try{await window.ClubHubCloud.requestClubCancellation();toast('Club cancellation scheduled');await refreshCompliancePanel();}catch(e){alert(e.message||e);}}
async function cancelClubCancellationUi(){try{await window.ClubHubCloud.cancelClubCancellation();toast('Club cancellation withdrawn');await refreshCompliancePanel();}catch(e){alert(e.message||e);}}

let __inboxStamp=0,__inboxMessages=[],__inboxContacts=[],__inboxSelected='';
function inboxMyUserId(){return window.ClubHubCloud?.session?.user?.id||'';}
function inboxOtherId(m){const me=inboxMyUserId();return m.sender_user_id===me?m.recipient_user_id:m.sender_user_id;}
function inboxContactRoleLabel(c){
  if(c?.role==='club_admin')return 'Club Admin';
  if(c?.role==='assistant_coach')return 'Assistant Coach';
  if(c?.role==='coach')return 'Coach';
  return 'Parent';
}
function inboxContactLabel(c){
  const role=inboxContactRoleLabel(c),team=(c?.age_group&&c?.team_name)?` · U${c.age_group} ${c.team_name}`:'';
  return `${c?.full_name||role} · ${role}${team}`;
}
function inboxGroupRecipients(value){
  if(value==='group:all')return __inboxContacts.map(c=>c.user_id);
  if(value==='group:coaches')return __inboxContacts.filter(c=>['coach','assistant_coach'].includes(c.role)).map(c=>c.user_id);
  if(value==='group:parents')return __inboxContacts.filter(c=>c.role==='parent').map(c=>c.user_id);
  return [];
}
function populateInboxContacts(){
  const sel=document.getElementById('inbox-contact-select');if(!sel)return;
  const keep=__inboxSelected||sel.value,groups=[];
  if(isAdmin()&&isClubOverviewMode()){
    if(__inboxContacts.length)groups.push('<option value="group:all">All club members</option>');
    if(__inboxContacts.some(c=>['coach','assistant_coach'].includes(c.role)))groups.push('<option value="group:coaches">All coaching staff</option>');
    if(__inboxContacts.some(c=>c.role==='parent'))groups.push('<option value="group:parents">All parents</option>');
  }else if(['coach','assistant_coach'].includes(currentRole)&&__inboxContacts.some(c=>c.role==='parent')){
    groups.push('<option value="group:parents">All parents</option>');
  }
  const individuals=__inboxContacts.map(c=>`<option value="${c.user_id}">${esc(inboxContactLabel(c))}</option>`);
  sel.innerHTML=[...groups,...individuals].join('')||'<option value="">No contacts available</option>';
  const valid=__inboxContacts.some(c=>c.user_id===keep)||keep.startsWith('group:');
  if(valid)__inboxSelected=keep;
  else{
    const unreadContact=__inboxMessages.find(m=>!m.read_at&&m.recipient_user_id===inboxMyUserId());
    __inboxSelected=unreadContact?inboxOtherId(unreadContact):(__inboxContacts[0]?.user_id||'');
  }
  sel.value=__inboxSelected;
}
function updateInboxBadges(count){
  ['club-inbox-badge','global-inbox-badge'].forEach(id=>{const badge=document.getElementById(id);if(badge){badge.textContent=String(count);badge.classList.toggle('hidden',count===0);}});
}
function renderInbox(){
  const box=document.getElementById('inbox-thread'),hint=document.getElementById('inbox-compose-hint');if(!box)return;
  populateInboxContacts();const me=inboxMyUserId();const unread=__inboxMessages.filter(m=>m.recipient_user_id===me&&!m.read_at).length;updateInboxBadges(unread);
  const selected=__inboxSelected;
  if(selected.startsWith('group:')){
    const recipients=inboxGroupRecipients(selected),labels={'group:all':'all club members','group:coaches':'all coaching staff','group:parents':'all parents'};
    box.innerHTML=`<div class="empty-state compact-empty"><strong>Message ${labels[selected]||'group'}</strong>Each person receives a private copy.</div>`;
    if(hint)hint.textContent=`${recipients.length} recipient${recipients.length===1?'':'s'}`;
    return;
  }
  const rows=__inboxMessages.filter(m=>inboxOtherId(m)===selected),contact=__inboxContacts.find(c=>c.user_id===selected);
  if(hint)hint.textContent=contact?`Conversation with ${inboxContactLabel(contact)}`:'Choose a conversation';
  box.innerHTML=rows.map(m=>{const mine=m.sender_user_id===me;return `<article class="inbox-message ${mine?'mine':'theirs'}"><div class="inbox-message-meta"><strong>${mine?'You':esc(contact?.full_name||inboxContactRoleLabel(contact))}</strong><span>${new Date(m.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>${m.subject?`<b class="inbox-message-subject">${esc(m.subject)}</b>`:''}<p>${esc(m.body).replace(/\n/g,'<br>')}</p>${mine?`<small>${m.read_at?'Read':'Sent'}</small>`:''}</article>`;}).join('')||'<div class="empty-state compact-empty">No messages in this conversation yet.</div>';
  box.scrollTop=box.scrollHeight;
  const ids=rows.filter(m=>m.recipient_user_id===me&&!m.read_at).map(m=>m.id);
  if(ids.length)window.ClubHubCloud.markClubMessagesRead(ids).then(()=>{const stamp=new Date().toISOString();__inboxMessages.forEach(m=>{if(ids.includes(m.id))m.read_at=stamp;});updateInboxBadges(__inboxMessages.filter(m=>m.recipient_user_id===me&&!m.read_at).length);}).catch(()=>{});
}
async function refreshInbox(quiet=false){
  if(!CLOUD_MODE||!['admin','coach','assistant_coach','parent'].includes(currentRole))return;
  const box=document.getElementById('inbox-thread');if(!box)return;
  if(quiet&&Date.now()-__inboxStamp<10000){renderInbox();return;}__inboxStamp=Date.now();
  if(!quiet)box.innerHTML='<div class="empty-state compact-empty">Loading messages…</div>';
  try{
    const [contacts,messages]=await Promise.all([window.ClubHubCloud.listMessageContacts(),window.ClubHubCloud.listClubMessages()]);
    let visibleContacts=contacts||[];
    if(isAdminCoachMode()){
      const own=dualCoachTeam();
      visibleContacts=visibleContacts.filter(c=>c.role==='club_admin'||(c.role==='parent'&&own&&String(c.team_id||'')===String(own.id)));
    }
    __inboxContacts=visibleContacts;__inboxMessages=messages||[];renderInbox();
    const help=document.getElementById('club-inbox-help');
    if(help)help.textContent=isAdmin()?'Message anyone in the club, individually or as private group copies.':['coach','assistant_coach'].includes(currentRole)?'Message Club Admin or parents on your team.':'Message Club Admin or your team coaching staff.';
  }catch(err){box.innerHTML='<div class="empty-state compact-empty">Inbox is temporarily unavailable.</div>';}
}
function existingInboxThread(recipient){const me=inboxMyUserId();const rows=__inboxMessages.filter(m=>(m.sender_user_id===me&&m.recipient_user_id===recipient)||(m.recipient_user_id===me&&m.sender_user_id===recipient));return rows.length?rows[rows.length-1].thread_id:null;}
async function sendInboxMessage(){
  if(!CLOUD_MODE||!['admin','coach','assistant_coach','parent'].includes(currentRole))return;
  const body=document.getElementById('inbox-message-body')?.value?.trim()||'',subject=document.getElementById('inbox-subject')?.value?.trim()||'';if(!body)return toast('Write a message first');
  const btn=document.getElementById('send-inbox-message');if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    const recipients=__inboxSelected.startsWith('group:')?inboxGroupRecipients(__inboxSelected):[__inboxSelected].filter(Boolean);
    if(!recipients.length)throw new Error('Choose a recipient');
    for(const id of recipients)await window.ClubHubCloud.sendClubMessage({recipientUserId:id,subject,body,threadId:existingInboxThread(id)});
    document.getElementById('inbox-message-body').value='';document.getElementById('inbox-subject').value='';
    toast(recipients.length>1?`Message sent to ${recipients.length} people`:'Message sent');await refreshInbox(false);
  }catch(err){alert('Could not send message: '+(err.message||err));}finally{if(btn){btn.disabled=false;btn.textContent='Send';}}
}
function openCoachInbox(userId){__inboxSelected=String(userId||'');navigate('inbox',false);setTimeout(()=>refreshInbox(false),0);}
let __clubResultsStamp=0,__clubResultsRows=[],__clubResultsAge=12,__clubResultsPage=0;const CLUB_RESULTS_PAGE_SIZE=6;
function internalAdminClubResults(rows=[]){
  const out=[],seen=new Set();
  (rows||[]).forEach(entry=>{
    const team=entry?.team||{},st=entry?.state||{},age=Number(String(team.ageGroup||'').replace(/\D/g,''))||0,teamName=team.teamName||team.name||'';
    (Array.isArray(st.matches)?st.matches:[]).forEach(m=>{
      if(String(m?.status||'played').toLowerCase()!=='played'||!m?.opponent)return;
      const away=String(m.venue||'').toUpperCase()==='A';
      const gf=Number(m.gf||0),ga=Number(m.ga||0),home=away?String(m.opponent):String(teamName),awayName=away?String(teamName):String(m.opponent);
      const key=[team.id||teamName,m.id||'',m.date||'',home,awayName,gf,ga].join('|').toLowerCase();
      if(seen.has(key))return;seen.add(key);
      out.push({home,away:awayName,hg:away?ga:gf,ag:away?gf:ga,date:m.date||'',competition:m.type||m.competition||'',teamName,ageGroup:age,source:'internal'});
    });
  });
  return out;
}
function resultSides(r={}){const home=String(r.home||r.homeTeam||'').trim(),away=String(r.away||r.awayTeam||'').trim();const hg=Number(r.homeGoals??r.hg??0),ag=Number(r.awayGoals??r.ag??0);return{home,away,hg,ag,date:r.date||'',competition:r.competition||''};}
function renderClubResultsBrowser(){
  const list=document.getElementById('club-results-list'),ageSel=document.getElementById('club-results-age'),pageEl=document.getElementById('club-results-page');if(!list||!ageSel)return;
  if(currentView==='club'&&__clubTab==='results')document.getElementById('admin-club-overview')?.classList.add('hidden');
  const ages=[...new Set((window.ClubHubCloud?.visibleTeamList?.()||[]).map(t=>Number(String(t.ageGroup||'').replace(/\D/g,''))).filter(Boolean))].sort((a,b)=>a-b);if(!ages.length)ages.push(8,9,10,11,12,13,14,15);
  const prev=Number(ageSel.value||__clubResultsAge);ageSel.innerHTML=ages.map(a=>`<option value="${a}">Under ${a}s</option>`).join('');__clubResultsAge=ages.includes(prev)?prev:(ages.includes(__clubResultsAge)?__clubResultsAge:ages[0]);ageSel.value=String(__clubResultsAge);
  const filtered=__clubResultsRows.filter(r=>Number(r.ageGroup)===Number(__clubResultsAge));const pages=Math.max(1,Math.ceil(filtered.length/CLUB_RESULTS_PAGE_SIZE));__clubResultsPage=Math.max(0,Math.min(__clubResultsPage,pages-1));const rows=filtered.slice(__clubResultsPage*CLUB_RESULTS_PAGE_SIZE,(__clubResultsPage+1)*CLUB_RESULTS_PAGE_SIZE);
  list.innerHTML=rows.map(r=>{const rr=resultForNamedTeam(r.home,r.away,r.hg,r.ag,r.teamName);const comp=r.competition?` · ${esc(String(r.competition).replace(/_/g,' '))}`:'';return `<article class="club-result-row ${resultClass(rr)}"><div class="club-result-meta"><span>U${esc(r.ageGroup)} · ${esc(r.teamName)}${comp}</span><small>${formatDate(r.date)||esc(r.date)||'Date TBC'}</small></div><div class="club-result-score"><span>${esc(r.home)}</span><strong>${r.hg}–${r.ag}</strong><span>${esc(r.away)}</span></div></article>`;}).join('')||`<div class="empty-state"><strong>${isAdmin()&&isClubOverviewMode()?'No recorded results':'No published results'}</strong>${isAdmin()&&isClubOverviewMode()?'No completed matches have been recorded for this age group.':Number(__clubResultsAge)<=11?'Selkent does not publish standard league results for this age group.':'No club results have been published for this age group yet.'}</div>`;
  if(pageEl)pageEl.textContent=filtered.length?`${__clubResultsPage+1} of ${pages}`:'0 of 0';const p=document.getElementById('club-results-prev'),n=document.getElementById('club-results-next');if(p)p.disabled=__clubResultsPage<=0;if(n)n.disabled=__clubResultsPage>=pages-1;
}
async function refreshClubResults(quiet=false){
  const list=document.getElementById('club-results-list');if(!list||!CLOUD_MODE||!['admin','coach','assistant_coach'].includes(currentRole))return;
  if(quiet&&Date.now()-__clubResultsStamp<12000){renderClubResultsBrowser();return;}__clubResultsStamp=Date.now();
  const adminInternal=isAdmin()&&isClubOverviewMode();
  if(!quiet)list.innerHTML=`<div class="empty-state compact-empty">Loading ${adminInternal?'club match history':'published results'}…</div>`;
  try{
    if(adminInternal){
      const overview=await window.ClubHubCloud.getClubOverview();
      __clubResultsRows=internalAdminClubResults(overview).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(a.ageGroup)-Number(b.ageGroup));
    }else{
      const rows=await window.ClubHubCloud.listPublishedClubResults(),seen=new Set(),clean=[];
      rows.forEach(row=>{if(Number(row.age_group||0)<12)return;const x=resultSides(row.result||{});if(!x.home||!x.away)return;const key=[x.date,x.home,x.away,x.hg,x.ag].join('|').toLowerCase();if(seen.has(key))return;seen.add(key);clean.push({...x,teamName:row.team_name||'',ageGroup:row.age_group||'',source:'selkent'});});
      __clubResultsRows=clean.sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(a.ageGroup)-Number(b.ageGroup));
    }
    renderClubResultsBrowser();
  }catch(err){list.innerHTML='<div class="empty-state compact-empty">Results are temporarily unavailable.</div>';}
}
let __clubTab='overview';
function setClubTab(tab='overview'){
  const admin=isAdmin()&&isClubOverviewMode(),coaching=['coach','assistant_coach'].includes(currentRole)||isAdminCoachMode();
  const allowed=admin?['overview','fixtures','results','coaches']:coaching?['results']:[];
  if(!allowed.length){navigate('home',false);return;}
  if(!allowed.includes(tab))tab=admin?'overview':'results';__clubTab=tab;
  document.getElementById('admin-club-overview')?.classList.toggle('hidden',tab!=='overview'||!admin);
  document.getElementById('club-fixtures-panel')?.classList.toggle('hidden',tab!=='fixtures'||!admin);
  document.getElementById('club-results-panel')?.classList.toggle('hidden',tab!=='results');
  document.getElementById('club-coaches-panel')?.classList.toggle('hidden',tab!=='coaches'||!admin);
  document.getElementById('admin-season-management-panel')?.classList.toggle('hidden',tab!=='overview'||!admin);
  document.querySelectorAll('[data-admin-club-tab]').forEach(b=>b.classList.toggle('hidden',!admin));
  document.querySelectorAll('[data-club-tab]').forEach(b=>b.classList.toggle('active',b.dataset.clubTab===tab));
  const title=document.getElementById('club-view-title'),kick=document.getElementById('club-view-kicker');const names={overview:'Club Overview',fixtures:'Fixture Centre',results:'Club Results',coaches:'Coach Overview'};if(title)title.textContent=names[tab]||'Club';if(kick)kick.textContent=admin?'Club administration':isAdminCoachMode()?`Coach · ${dualCoachTeam()?.ageGroup||''} ${dualCoachTeam()?.teamName||''}`.trim():roleLabel();
  if(tab==='overview')refreshAdminClubOverview(true);
  if(tab==='fixtures')refreshAdminFixtures(false);
  if(tab==='results')refreshClubResults(false);
  if(tab==='coaches')refreshClubCoaches(false);
}
function refreshCoachClubResults(quiet=false){return refreshClubResults(quiet);}

let __divisionEntryMode=false;
let __programmeCompetition='Division';
function setDivisionEntryMode(enabled,competitionName=null){
  if(enabled)__programmeCompetition=competitionName||(isPublishedLeagueTeam()?'League':'Division');
  __divisionEntryMode=!!enabled;
  const inputWrap=document.getElementById('match-opponent-input-wrap'),selectWrap=document.getElementById('match-opponent-select-wrap');
  const input=document.getElementById('match-opponent'),select=document.getElementById('match-opponent-select'),competition=document.getElementById('match-competition'),venue=document.getElementById('match-venue');
  if(inputWrap)inputWrap.classList.toggle('hidden',__divisionEntryMode);if(selectWrap)selectWrap.classList.toggle('hidden',!__divisionEntryMode);
  if(input)input.required=!__divisionEntryMode;
  if(select){select.required=__divisionEntryMode;select.innerHTML='<option value="">Select opponent</option>'+divisionOpponents().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');}
  if(competition){competition.disabled=__divisionEntryMode;if(__divisionEntryMode)competition.value=__programmeCompetition;}
  if(venue){
    const value=venue.value;
    if(__divisionEntryMode){venue.innerHTML='<option value="">Choose H / A</option><option value="H">Home</option><option value="A">Away</option>';venue.value=['H','A'].includes(value)?value:'';}
    else {venue.innerHTML='<option value="">Not set</option><option value="H">Home</option><option value="A">Away</option><option value="N">Neutral</option>';venue.value=value;}
  }
  const title=document.getElementById('form-title'),kick=document.getElementById('form-kicker');
  if(__divisionEntryMode&&title&&!document.getElementById('match-id')?.value){title.textContent=`Add ${__programmeCompetition} Result`;if(kick)kick.textContent='Coach-entered result';}
}
function openDivisionResultEntry(teamName='',preferredVenue=''){
  if(!requireCoach())return;
  if(!divisionOpponents().length){toast('Sync the Selkent division first to load opponents.');return;}
  const team=String(teamName||'').trim();
  const existing=team?leagueMatchesFor(team):[];
  const hasH=existing.some(m=>String(m.venue||'').toUpperCase()==='H');
  const hasA=existing.some(m=>String(m.venue||'').toUpperCase()==='A');
  if(team&&hasH&&hasA){toast('Home and away results are already recorded. Tap either result to view details.');return;}
  const competition=isPublishedLeagueTeam()?'League':'Division';
  resetMatchForm();setDivisionEntryMode(true,competition);setDefaultDate();navigate('add');
  const opponent=document.getElementById('match-opponent-select');if(opponent&&team)opponent.value=team;
  const venue=document.getElementById('match-venue');if(venue&&team){
    if(['H','A'].includes(preferredVenue)&&!((preferredVenue==='H'&&hasH)||(preferredVenue==='A'&&hasA)))venue.value=preferredVenue;
    else if(hasH&&!hasA)venue.value='A';else if(hasA&&!hasH)venue.value='H';
  }
}
function renderCompetitionMode(){
  const league=isPublishedLeagueTeam();
  document.body.classList.toggle('team-has-league',league);
  if(!league&&currentView==='league')navigate('matches',false);
  const nav=document.getElementById('league-nav-item');if(nav){const show=league&&!isClubOverviewMode();nav.classList.toggle('hidden',!show);nav.setAttribute('aria-hidden',show?'false':'true');}
  const heading=document.getElementById('primary-record-heading');if(heading)heading.textContent=league?'League record':'Division record';
  const summary=document.getElementById('league-summary-card');if(summary)summary.classList.remove('hidden');
  const summaryKicker=summary?.querySelector('.kicker');if(summaryKicker)summaryKicker.textContent=league?'League':'Division';
  const tableHome=document.getElementById('league-table-panel');if(tableHome)tableHome.classList.toggle('hidden',!league);
  const programme=document.querySelector('#view-matches .league-programme .kicker');if(programme)programme.textContent=league?'League programme':'Division programme';
  const matchHeading=document.querySelector('#league-match-section .match-section-heading h3');if(matchHeading)matchHeading.textContent=miniResultsRestrictedView()?'Matches':league?'League matches':'Division results';
  const matchKicker=document.querySelector('#league-match-section .match-section-heading .kicker');if(matchKicker)matchKicker.textContent=league?'League':'Division';
}
function renderLeagueQuickView(){
  const view=document.getElementById('view-league');if(!view)return;
  const league=isPublishedLeagueTeam();view.classList.toggle('hidden',!league);
  if(!league)return;
  const title=document.getElementById('league-quick-title');if(title)title.textContent=state.division.name||'League';
  const remote=sanitizeRemoteStandings(state.selkent?.table||[]);const table=remote.length?remote:calculateLeagueTable();
  const body=document.getElementById('league-quick-table-body');if(body)body.innerHTML=table.map((r,i)=>`<tr class="${normalizeTeamKey(r.team)===normalizeTeamKey(state.division.teamName)?'our-team-row':''}"><td>${i+1}</td><td>${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td><td>${r.pts}</td></tr>`).join('')||'<tr><td colspan="10" class="table-empty">Table TBC</td></tr>';
  const meta=document.getElementById('league-quick-table-meta');if(meta)meta.textContent=(state.selkent?.table||[]).length?'Official league table':'League table TBC.';
  const opp=divisionOpponents(),oc=document.getElementById('league-quick-opponent-count');if(oc)oc.textContent=String(opp.length);
  const ob=document.getElementById('league-quick-opponents');if(ob)ob.innerHTML=opp.map(t=>`<div class="division-row"><div class="division-team">${esc(t)}</div></div>`).join('')||'<div class="empty-state">Opponents TBC.</div>';
  const fixtures=[...(state.selkent?.fixtures||[])].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const fc=document.getElementById('league-quick-fixture-count');if(fc)fc.textContent=String(fixtures.length);
  const fb=document.getElementById('league-quick-fixtures');if(fb)fb.innerHTML=fixtures.slice(0,16).map(f=>{const detail=state.selkent?.directoryDetails?.[selkentNorm(f.opponent)]||{};const map=f.venue==='A'?mapsHref(f.groundName||detail.groundName,f.address||detail.address):mapsHref(f.groundName,f.address);return `<div class="synced-fixture"><span class="synced-fixture-date">${f.date?formatDate(f.date):'TBC'}${f.time?' · '+esc(f.time):''}</span><span class="synced-fixture-opponent">${esc(f.opponent)}</span><span class="synced-fixture-venue">${f.venue==='A'?'Away':'Home'}</span>${map?`<a class="map-link compact" href="${esc(map)}">Open in Maps</a>`:''}</div>`;}).join('')||'<div class="empty-state compact-empty">No fixtures released yet.</div>';
}

function updateMatchStatusUI(){
  const status=document.getElementById('match-status')?.value||'played';
  const score=document.querySelector('#match-form .score-entry');
  const scorer=document.querySelector('#match-form .form-panel:nth-of-type(2)');
  const awards=document.querySelector('#match-form [data-feature-panel="awards"]');
  const noScore=status==='scheduled'||status==='postponed';
  if(score)score.classList.toggle('status-no-score',noScore);
  ['match-gf','match-ga'].forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=noScore;if(noScore)el.value=0;}});
  if(scorer)scorer.classList.toggle('hidden',noScore);
  if(awards)awards.classList.toggle('hidden',noScore);
  updateGoalCheck();
}
const DEFAULT_COMPETITION_OPTIONS=['League','Division','Friendly','Challenge Cup','Challenge Vase','Shield','Cup','Tournament','Preseason Tournament','Other'];
function setCompetitionOptions(mode='all',selected=''){
  const sel=document.getElementById('match-competition');if(!sel)return;
  const values=mode==='nonleague'?['Friendly','Tournament']:DEFAULT_COMPETITION_OPTIONS;
  sel.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const normalized=mode==='nonleague'?(String(selected).toLowerCase().includes('friendly')?'Friendly':'Tournament'):selected;
  if(normalized&&![...sel.options].some(o=>o.value===normalized))sel.add(new Option(normalized,normalized));
  if(normalized)sel.value=normalized;
}

function openNewMatchForCompetition(competition,status='scheduled'){
  if(!requireCoach())return;
  resetMatchForm();
  const sel=document.getElementById('match-competition');
  if(sel){let option=[...sel.options].find(o=>o.value===competition);if(!option){option=new Option(competition,competition);sel.add(option);}sel.value=competition;}
  const st=document.getElementById('match-status');if(st)st.value=status;
  document.getElementById('form-title').textContent=competition==='Friendly'?'Add Friendly':`Add ${competition} Game`;
  document.getElementById('form-kicker').textContent=status==='scheduled'?'Fixture entry':'Matchday entry';
  setDivisionEntryMode(false);updateTournamentMatchUI();updateMatchStatusUI();navigate('add');
}

function setDefaultDate(){
  const el=document.getElementById('match-date');
  if(el&&!el.value) el.value=new Date().toISOString().slice(0,10);
}
function resetMatchForm(){
  setCompetitionOptions('all');
  setDivisionEntryMode(false);
  document.getElementById('match-form').reset();
  document.getElementById('match-id').value='';
  document.getElementById('match-competition').value=isPublishedLeagueTeam()?'League':'Division';
  document.getElementById('match-gf').value=0;
  document.getElementById('match-ga').value=0;
  const status=document.getElementById('match-status');if(status)status.value='scheduled';
  document.getElementById('form-title').textContent='Add Match';
  document.getElementById('form-kicker').textContent='Fixture entry';
  document.getElementById('cancel-edit').classList.add('hidden');
  const deleteEdit=document.getElementById('delete-match-edit');if(deleteEdit){deleteEdit.classList.add('hidden');deleteEdit.dataset.deleteMatch='';}
  populateTournamentSelect('');updateTournamentMatchUI('');
  setDefaultDate();
  renderScorerInputs({});
  renderPlayerSelects();
  updateMatchStatusUI();
}
function editMatch(id){
  if(!requireCoach()) return;
  const m=state.matches.find(x=>x.id===id); if(!m) return;
  navigate('add');
  setDivisionEntryMode(isDivisionMatch(m));
  document.getElementById('match-id').value=m.id;
  document.getElementById('match-date').value=m.date;
  ensureOpponentOption(m.opponent);
  if(isDivisionMatch(m))document.getElementById('match-opponent-select').value=m.opponent;
  const simpleNonLeague=isPlayedMatch(m)&&!isLeagueMatch(m)&&!isDivisionMatch(m)&&!competitionBucket(m);
  if(simpleNonLeague)setCompetitionOptions('nonleague',m.competition);else setCompetitionOptions('all',m.competition);
  document.getElementById('match-competition').value=simpleNonLeague?(isFriendlyMatch(m)?'Friendly':'Tournament'):m.competition;
  if(!document.getElementById('match-competition').value) document.getElementById('match-competition').add(new Option(m.competition,m.competition,true,true));
  updateTournamentMatchUI(m.tournamentId||'');if(document.getElementById('match-tournament'))document.getElementById('match-tournament').value=m.tournamentId||'';
  document.getElementById('match-venue').value=m.venue||'';
  document.getElementById('match-stage').value=m.stage||'';
  const editAway=String(m.venue||'').toUpperCase()==='A';
  document.getElementById('match-gf').value=Number(editAway?m.ga:m.gf||0);
  document.getElementById('match-ga').value=Number(editAway?m.gf:m.ga||0);
  const status=document.getElementById('match-status');if(status)status.value=matchStatus(m);
  document.getElementById('match-notes').value=m.notes||'';
  const gs={};
  state.goals.filter(g=>g.matchId===id).forEach(g=>gs[g.player]=g.goals);
  renderScorerInputs(gs);
  renderAwardFields('match-award-fields',id);
  document.getElementById('form-title').textContent=isPlayedMatch(m)?'Edit Match':'Edit Scheduled Match';
  document.getElementById('form-kicker').textContent=isPlayedMatch(m)?'Update matchday record':'Update fixture details';
  document.getElementById('cancel-edit').classList.remove('hidden');
  const deleteEdit=document.getElementById('delete-match-edit');if(deleteEdit){const canDelete=!isProviderOwnedMatch(m);deleteEdit.classList.toggle('hidden',!canDelete);deleteEdit.dataset.deleteMatch=canDelete?m.id:'';}
  updateMatchStatusUI();
}
function submitMatch(e){
  e.preventDefault();
  if(!requireCoach()) return;
  const id=document.getElementById('match-id').value||uid('m');
  const existing=state.matches.find(x=>x.id===id);
  const competition=document.getElementById('match-competition').value;
  const divisionEntry=__divisionEntryMode||isDivisionMatch({competition});
  const opponent=(divisionEntry?document.getElementById('match-opponent-select').value:document.getElementById('match-opponent').value).trim();
  const venue=document.getElementById('match-venue').value;
  const status=String(document.getElementById('match-status')?.value||'scheduled').toLowerCase();
  const homeScore=Number(document.getElementById('match-gf').value||0),awayScore=Number(document.getElementById('match-ga').value||0),isAway=String(venue||'').toUpperCase()==='A';
  if(divisionEntry&&(!opponent||!divisionOpponents().includes(opponent))){toast('Select an opponent from your Selkent division.');return;}
  if(divisionEntry&&!['H','A'].includes(venue)){toast('Choose Home or Away.');return;}
  if(divisionEntry){const sameComp=isPublishedLeagueTeam()?isLeagueMatch:isDivisionMatch;const duplicate=state.matches.find(x=>x.id!==id&&sameComp(x)&&x.opponent===opponent&&String(x.venue||'').toUpperCase()===venue);if(duplicate){toast(`${venue==='H'?'Home':'Away'} result already exists for ${opponent}. Tap that result to edit its details.`);return;}}
  const m={
    id,
    date:document.getElementById('match-date').value,
    opponent,
    competition,
    type:competition.includes('Tournament')?'Tournament':competition,
    tournamentId:/tournament/i.test(competition)?(document.getElementById('match-tournament')?.value||null):null,
    venue,
    duration:existing?.duration ?? null,
    stage:document.getElementById('match-stage').value.trim(),
    gf:isAway?awayScore:homeScore,
    ga:isAway?homeScore:awayScore,
    status,
    notes:document.getElementById('match-notes').value.trim(),
    source:existing?.source||'manual',
    providerTeamIds:Array.isArray(existing?.providerTeamIds)?[...existing.providerTeamIds]:[],
    groundName:existing?.groundName||'',
    address:existing?.address||'',
    homeKitColours:existing?.homeKitColours||'',
    awayKitColours:existing?.awayKitColours||''
  };
  if(status==='scheduled'||status==='postponed'){m.gf=0;m.ga=0;}
  const idx=state.matches.findIndex(x=>x.id===id);
  if(idx>=0) state.matches[idx]=m; else state.matches.push(m);
  state.goals=state.goals.filter(g=>g.matchId!==id);
  if(status==='played'||status==='abandoned')document.querySelectorAll('#scorer-inputs input').forEach(i=>{
    const n=Number(i.value||0);
    if(n>0) state.goals.push({id:uid('g'),matchId:id,player:i.dataset.player,goals:n});
  });
  if(featureEnabled('awards')&&(status==='played'||status==='abandoned'))saveAwardFields('match-award-fields',m);
  else state.awards=state.awards.filter(a=>a.matchId!==id);
  saveState();
  auditEvent(existing?'match_edited':'match_added','match',id,`${existing?'Edited':'Added'} ${m.competition} vs ${m.opponent}`,existing||null,m);
  resetMatchForm();
  navigate('matches');
  toast('Match saved');
}
function isProviderOwnedMatch(m={}){return /selkent|github-static|static-fixture/i.test(String(m.source||''));}
async function deleteMatch(id){
  if(!requireCoach())return;
  const m=state.matches.find(x=>x.id===id);if(!m)return;
  if(isProviderOwnedMatch(m)){toast('Published Selkent fixtures cannot be removed. Use fixture correction or match status instead.');return;}
  if(!confirm(`Delete the match against ${m.opponent}? This removes its score, attendance, goals, assists, bookings, awards and private match note.`))return;
  let noteWarning=false;
  if(CLOUD_MODE&&isCoach()){
    try{await window.ClubHubCloud.saveMatchAttendance(id,[]);await refreshAppearanceStats(false);}catch(err){alert('Could not clear match attendance, so the match has not been deleted. Check your connection and try again.');return;}
    try{await window.ClubHubCloud.saveCoachMatchNote(id,'');}catch(err){noteWarning=true;}
  }
  state.matches=state.matches.filter(x=>x.id!==id);
  state.goals=state.goals.filter(g=>g.matchId!==id);
  state.assists=(state.assists||[]).filter(a=>a.matchId!==id);
  state.bookings=(state.bookings||[]).filter(b=>b.matchId!==id);
  state.awards=state.awards.filter(a=>a.matchId!==id);
  saveState();auditEvent('match_deleted','match',id,`Deleted match vs ${m.opponent}`,m,null);
  document.getElementById('match-detail-dialog')?.close();resetMatchForm();renderAll();navigate('matches',false);
  toast(noteWarning?'Match deleted; private note could not be cleared':'Match deleted');
}

function playerSeasonSummary(name){
  const player=playerForName(name);const matchIds=new Set(state.matches.filter(isPlayedMatch).map(m=>m.id));
  const goals=state.goals.filter(g=>g.player===name&&matchIds.has(g.matchId)).reduce((n,g)=>n+Number(g.goals||0),0);
  const assists=(state.assists||[]).filter(a=>a.player===name&&matchIds.has(a.matchId)).reduce((n,a)=>n+Number(a.assists||0),0);
  const awards=state.awards.filter(a=>a.player===name).length;
  let picks=0;Object.values(state.tactics?.matchdaySelections||{}).forEach(ids=>{if(Array.isArray(ids)&&player&&ids.includes(tacticsPlayerId(player)))picks++;});
  const appearance=appearanceStatFor(name);return {goals,assists,awards,picks,appearance};
}
async function openPlayerProfile(name){
  if(!playerAccountsAllowedForAge(ageGroupNumber()))return toast('Player profiles are not enabled for this age group.');
  const p=playerForName(name);if(!p)return;
  const dlg=document.getElementById('player-profile-dialog');if(!dlg)return;
  const sum=playerSeasonSummary(p.name);document.getElementById('player-profile-name').textContent=p.name;
  document.getElementById('player-profile-hero').innerHTML=`<div class="player-profile-jersey">${jerseyHTML(p)}</div><div><strong>${esc(p.name)}</strong><span>Shirt ${esc(p.number)} · ${p.role==='goalkeeper'?'Goalkeeper':'Outfield'} · ${esc(state.meta.ageGroup||'')}</span></div>`;
  const ap=sum.appearance||appearanceStatFor(p.name);const stats=[['Appearances',Number(ap.appearances||0)],...(ageGroupNumber()>=12?[['Starts',Number(ap.starts||0)],['Sub appearances',Number(ap.substitutes||0)]]:[]),['Attendance',attendancePercent(ap)+'%'],['Goals',sum.goals],['Assists',sum.assists],['Goal contributions',sum.goals+sum.assists],['Awards',sum.awards],['No-shows',Number(ap.no_shows||0)]];
  document.getElementById('player-profile-stats').innerHTML=stats.map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
  const sec=document.getElementById('player-profile-availability'),note=document.getElementById('player-profile-availability-note');const fixture=nextPublishedFixture();
  let linked=false;if(CLOUD_MODE&&['parent','player'].includes(currentRole)){try{const uid=window.ClubHubCloud?.session?.user?.id||'';const links=currentRole==='player'?await window.ClubHubCloud.listPlayerAccountLinks(uid):await window.ClubHubCloud.listParentPlayerLinks(uid);linked=links.some(x=>selkentNorm(x.player_name)===selkentNorm(p.name));}catch{}}
  sec?.classList.toggle('hidden',!(['parent','player'].includes(currentRole)&&linked&&fixture));
  if(fixture){document.getElementById('player-profile-fixture').textContent=fixtureSummary(fixture);const key=fixtureStableKey(fixture);try{const rows=await window.ClubHubCloud.listMatchAvailability(key);const row=rows.find(r=>selkentNorm(r.player_name)===selkentNorm(p.name));document.querySelectorAll('[data-profile-availability]').forEach(b=>b.classList.toggle('selected',b.dataset.profileAvailability===row?.status));}catch{}}
  if(note)note.textContent=linked?'This response is shared for the player, so linked parent accounts will not create duplicates.':'Only a linked parent account can change availability.';
  dlg.dataset.playerName=p.name;dlg.showModal();
}
async function saveProfileAvailability(status){
  if(!['parent','player'].includes(currentRole))return;const dlg=document.getElementById('player-profile-dialog');const name=dlg?.dataset.playerName||'';const fixture=nextPublishedFixture();if(!name||!fixture)return;
  try{await window.ClubHubCloud.saveMatchAvailability({fixtureKey:fixtureStableKey(fixture),playerName:name,status});document.querySelectorAll('[data-profile-availability]').forEach(b=>b.classList.toggle('selected',b.dataset.profileAvailability===status));await refreshMatchAvailability(false);toast('Availability updated');}catch(err){toast(err.message||'Could not update availability');}
}

function openPlayerDialog(number=null){
  if(!requireCoach()) return;
  const dialog=document.getElementById('player-dialog');
  const existing=state.squad.find(p=>p.number===Number(number));
  document.getElementById('player-original-number').value=existing?.number||'';
  document.getElementById('player-number').value=existing?.number||'';
  document.getElementById('player-name').value=existing?.name||'';
  document.getElementById('player-role').value=existing?.role==='goalkeeper'?'goalkeeper':'outfield';
  document.getElementById('player-status').value=existing?.status==='inactive'?'inactive':'active';
  document.getElementById('player-dialog-title').textContent=existing?'Edit player':'Add player';
  document.getElementById('remove-player')?.classList.toggle('hidden',!existing);
  document.getElementById('remove-player-note')?.classList.toggle('hidden',!existing);
  dialog.showModal();
}
function removePlayerFromSquad(){
  if(!requireCoach())return;
  const original=Number(document.getElementById('player-original-number').value||0);
  const player=state.squad.find(p=>p.number===original);if(!player)return;
  if(!confirm(`Remove ${player.name} from the current squad? Historical goals, assists, bookings and awards will be kept.`))return;
  state.squad=state.squad.filter(p=>p.number!==original);
  if(state.tactics){const id=`p${original}`;state.tactics.lineup=(state.tactics.lineup||[]).filter(x=>x!==id);delete state.tactics.positions?.[id];}
  saveState();auditEvent('player_removed','squad',String(original),`Removed ${player.name} from squad`,player,null);
  document.getElementById('player-dialog').close();
  toast(`${player.name} removed from squad`);
}
function savePlayer(e){
  e.preventDefault();
  if(!requireCoach()) return;
  const original=Number(document.getElementById('player-original-number').value||0);
  const number=Number(document.getElementById('player-number').value);
  const name=document.getElementById('player-name').value.trim();
  const role=document.getElementById('player-role').value;
  const status=document.getElementById('player-status').value;
  if(!name || number<1 || number>99){ alert('Enter a player name and shirt number from 1 to 99.'); return; }
  const format=footballFormat();if(!original&&state.squad.filter(p=>p&&p.name).length>=format.registered){alert(`${state.meta.ageGroup} is limited to ${format.registered} registered players for ${format.format}.`);return;}
  const collision=state.squad.find(p=>p.number===number&&p.number!==original&&p.name);
  if(collision){ alert(`Shirt #${number} is already assigned to ${collision.name}.`); return; }
  const beforePlayer=original?state.squad.find(p=>p.number===original)||null:null;
  if(original){ state.squad=state.squad.filter(p=>p.number!==original); if(state.tactics&&original!==number){const oldId=`p${original}`,newId=`p${number}`;state.tactics.lineup=(state.tactics.lineup||[]).map(x=>x===oldId?newId:x);if(state.tactics.positions?.[oldId]){state.tactics.positions[newId]=state.tactics.positions[oldId];delete state.tactics.positions[oldId];}} }
  const savedPlayer={number,name,status,role:role==='goalkeeper'?'goalkeeper':'outfield'};state.squad.push(savedPlayer);
  saveState();auditEvent(beforePlayer?'player_edited':'player_added','squad',String(number),`${beforePlayer?'Updated':'Added'} ${name} in squad`,beforePlayer,savedPlayer);
  document.getElementById('player-dialog').close();
  toast('Squad updated');
}

function openAwardDialog(){
  if(!requireCoach()) return;
  document.getElementById('award-form').reset();
  document.getElementById('standalone-award-date').value=new Date().toISOString().slice(0,10);
  renderPlayerSelects();
  document.getElementById('award-dialog').showModal();
}
function saveStandaloneAward(e){
  e.preventDefault();
  if(!requireCoach()) return;
  const newAward={
    id:uid('a'),
    date:document.getElementById('standalone-award-date').value,
    event:document.getElementById('standalone-award-event').value.trim(),
    type:document.getElementById('standalone-award-type').value.trim(),
    player:document.getElementById('standalone-award-player').value,
    matchId:null,
    notes:document.getElementById('standalone-award-notes').value.trim()
  };state.awards.push(newAward);
  saveState();auditEvent('award_added','award',newAward.id,`Added ${newAward.type} for ${newAward.player}`,null,newAward);
  document.getElementById('award-dialog').close();
  toast('Award added');
}

function download(name,text,type){
  const blob=new Blob([text],{type});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),800);
}
function csvCell(v){ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
function exportMatches(){if(ageGroupNumber()<=11)return toast('U7–U11 match/performance exports are disabled. Use the safeguarding export for emergency/medical information only.');
  if(!requireCoach()) return;
  const rows=[['Date','Competition','Type','Opponent','Venue','Status','Duration','GF','GA','Result','Stage','Notes'],...state.matches.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(m=>[m.date,m.competition,m.type,m.opponent,m.venue,statusLabel(m),m.duration??'',m.gf,m.ga,resultOf(m),m.stage,m.notes])];
  download(`${safeFileName()}_Matches_${state.meta.season.replace('/','-')}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');
}
function exportGoals(){if(ageGroupNumber()<=11)return toast('U7–U11 performance exports are disabled.');
  if(!requireCoach()) return;
  const matchMap=Object.fromEntries(state.matches.map(m=>[m.id,m]));
  const rows=[['Date','Opponent','Player','Shirt No','Goals','Competition'],...state.goals.map(g=>{const m=matchMap[g.matchId]||{};return[m.date||'',m.opponent||'',g.player,shirtFor(g.player),g.goals,m.competition||''];})];
  download(`${safeFileName()}_Goals_${state.meta.season.replace('/','-')}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');
}
function importBackup(file){
  if(!requireCoach()) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const incoming=repairStateIdentity(normalizeState(JSON.parse(reader.result)));
      if(isTeamLocked()&&selkentNorm(incoming.division.teamName)!==selkentNorm(assignedTeam().leagueName)){alert('That backup belongs to a different team. This account is locked to '+assignedTeam().ageGroup+' '+assignedTeam().teamName+'.');return;}
      state=incoming;enforceAssignedTeam(false);saveState();toast('Backup imported');
    }catch{ alert('That file is not a valid team tracker backup.'); }
  };
  reader.readAsText(file);
}
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>t.classList.remove('show'),1800);
}

// Events
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');
  if(nav){ navigate(nav.dataset.nav); return; }
  if(e.target.closest('[data-action="quick-add"]')){ if(!requireCoach()) return; resetMatchForm(); navigate('add'); return; }
  const details=e.target.closest('[data-details-match]'); if(details){ openMatchDetails(details.dataset.detailsMatch); return; }
  const reportReview=e.target.closest('[data-match-report-review]');if(reportReview){openMatchReportReview(reportReview.dataset.matchReportReview);return;}
  const clubDetail=e.target.closest('[data-club-details-team]');if(clubDetail){openClubDetails(clubDetail.dataset.clubDetailsTeam);return;}
  const furtherPlayed=e.target.closest('[data-further-match-played]');if(furtherPlayed){openFurtherFixtureMatchReport(furtherPlayed.dataset.furtherMatchPlayed);return;}
  const played=e.target.closest('[data-match-played]');if(played){openMatchReport(played.dataset.matchPlayed);return;}
  const attendanceToggle=e.target.closest('[data-attendance-toggle]');if(attendanceToggle&&isCoach()){const present=attendanceToggle.dataset.status!=='attended';attendanceToggle.dataset.status=present?'attended':'unavailable';attendanceToggle.classList.toggle('is-present',present);attendanceToggle.setAttribute('aria-pressed',present?'true':'false');const label=attendanceToggle.querySelector('.attendance-switch-label');if(label)label.textContent=present?'Present':'Not present';return;}
  const edit=e.target.closest('[data-edit-match]');if(edit){editMatch(edit.dataset.editMatch);return;}
  const addDivision=e.target.closest('[data-add-division-team]'); if(addDivision){ openDivisionResultEntry(addDivision.dataset.addDivisionTeam||'',addDivision.dataset.addDivisionVenue||''); return; }
  const addCompetition=e.target.closest('[data-add-competition]');if(addCompetition){const comp=addCompetition.dataset.addCompetition||'Friendly';openNewMatchForCompetition(comp,addCompetition.dataset.defaultStatus||'scheduled');return;}
  const editTournament=e.target.closest('[data-edit-tournament]');if(editTournament){openTournamentDialog(editTournament.dataset.editTournament);return;}
  const addTournamentGameBtn=e.target.closest('[data-add-tournament-game]');if(addTournamentGameBtn){addTournamentGame(addTournamentGameBtn.dataset.addTournamentGame);return;}
  const deleteTournamentBtn=e.target.closest('[data-delete-tournament]');if(deleteTournamentBtn){deleteTournament(deleteTournamentBtn.dataset.deleteTournament);return;}
  const adminTeam=e.target.closest('[data-admin-open-team]'); if(adminTeam&&isAdmin()){const team=(window.ClubHubCloud?.visibleTeamList?.()||[]).find(t=>t.id===adminTeam.dataset.adminOpenTeam);if(team){switchAdminTeamAndLoad(team).then(()=>{adminUiMode='view';localStorage.setItem(ADMIN_UI_MODE_KEY,'view');renderAll();navigate('home',false);toast(`${team.ageGroup} ${team.teamName} opened read-only`);}).catch(err=>alert(err.message||err));}return;}
  const approve=e.target.closest('[data-approve-parent]');if(approve){approveParent(approve.dataset.approveParent);return;}
  const resetPin=e.target.closest('[data-reset-parent-pin]');if(resetPin){resetParentPin(resetPin.dataset.resetParentPin,resetPin.dataset.parentName||'Parent');return;}
  const linkParent=e.target.closest('[data-link-parent-player]');if(linkParent){openParentLinkDialog(linkParent.dataset.linkParentPlayer,linkParent.dataset.parentName||'Parent');return;}
  const removeMember=e.target.closest('[data-remove-member]');if(removeMember){removeTeamMember(removeMember.dataset.removeMember);return;}
  const removeAward=e.target.closest('[data-remove-award-type]');if(removeAward){removeAwardType(removeAward.dataset.removeAwardType);return;}
  const removeAwardEntry=e.target.closest('[data-remove-award-id]');if(removeAwardEntry){removeRecordedAward(removeAwardEntry.dataset.removeAwardId);return;}
  const removeCoach=e.target.closest('[data-remove-club-coach]');if(removeCoach){removeClubCoach(removeCoach.dataset.removeClubCoach);return;}
  const clear=e.target.closest('[data-clear-detail]'); if(clear){clearDetailData(clear.dataset.clearDetail);return;}
  const del=e.target.closest('[data-delete-match]'); if(del){ deleteMatch(del.dataset.deleteMatch); return; }
  const ep=e.target.closest('[data-edit-player]'); if(ep){ openPlayerDialog(ep.dataset.editPlayer); return; }
  const pp=e.target.closest('[data-player-profile]'); if(pp){ openPlayerProfile(pp.dataset.playerProfile); return; }
  const dlr=e.target.closest('[data-delete-league-result]'); if(dlr){ deleteLeagueResult(dlr.dataset.deleteLeagueResult); return; }
  const readNotice=e.target.closest('[data-read-announcement]');if(readNotice){markAnnouncementRead(readNotice.dataset.readAnnouncement);return;}
  const delNotice=e.target.closest('[data-delete-announcement]');if(delNotice){deleteAnnouncement(delNotice.dataset.deleteAnnouncement);return;}
  const readNotification=e.target.closest('[data-read-notification]');if(readNotification){markAppNotificationRead(readNotification.dataset.readNotification);return;}
});
document.getElementById('appearance-theme')?.addEventListener('change',e=>applyTheme(e.target.value));
document.getElementById('notification-bell')?.addEventListener('click',openNotifications);
document.getElementById('notifications-mark-all')?.addEventListener('click',markAllNotificationsRead);
document.getElementById('availability-deadline-save')?.addEventListener('click',saveAvailabilityDeadline);
document.getElementById('availability-reminder-send')?.addEventListener('click',sendAvailabilityReminder);
document.getElementById('next-match-calendar')?.addEventListener('click',()=>addFixtureToCalendar());
document.getElementById('matches-next-calendar')?.addEventListener('click',()=>addFixtureToCalendar());
document.getElementById('next-match-played')?.addEventListener('click',openNextFixtureMatchReport);
document.getElementById('matches-next-played')?.addEventListener('click',openNextFixtureMatchReport);
document.getElementById('matchday-add-calendar')?.addEventListener('click',()=>addFixtureToCalendar());
document.getElementById('matchday-notify-squad')?.addEventListener('click',notifySelectedSquad);
document.querySelectorAll('[data-profile-availability]').forEach(b=>b.addEventListener('click',()=>saveProfileAvailability(b.dataset.profileAvailability)));
document.getElementById('match-search').addEventListener('input',applyMatchFilter);
document.getElementById('match-gf').addEventListener('input',updateGoalCheck);
document.getElementById('match-status')?.addEventListener('change',updateMatchStatusUI);
document.getElementById('match-venue')?.addEventListener('change',updateGoalCheck);
document.getElementById('match-competition')?.addEventListener('change',()=>updateTournamentMatchUI());
document.getElementById('create-tournament')?.addEventListener('click',()=>openTournamentDialog());
document.getElementById('tournament-form')?.addEventListener('submit',saveTournament);
document.getElementById('open-season-archive')?.addEventListener('click',openSeasonArchive);
document.getElementById('refresh-audit-history')?.addEventListener('click',()=>refreshAuditHistory(false));
document.getElementById('archive-current-season')?.addEventListener('click',archiveCurrentSeason);
document.getElementById('rollover-season')?.addEventListener('click',rolloverSeason);
document.getElementById('match-form').addEventListener('submit',submitMatch);
document.getElementById('cancel-edit').addEventListener('click',()=>{resetMatchForm();navigate('matches');});
document.getElementById('add-player-btn').addEventListener('click',()=>openPlayerDialog());
document.getElementById('player-form').addEventListener('submit',savePlayer);
document.getElementById('parent-link-form')?.addEventListener('submit',saveParentLinkDialog);
document.getElementById('remove-player')?.addEventListener('click',removePlayerFromSquad);
document.getElementById('match-detail-form').addEventListener('submit',saveMatchDetails);
document.getElementById('undo-match-played')?.addEventListener('click',undoMatchPlayed);
document.getElementById('match-report-back')?.addEventListener('click',()=>changeMatchReportStep(-1));
document.getElementById('match-report-next')?.addEventListener('click',()=>changeMatchReportStep(1));
document.getElementById('match-detail-dialog')?.addEventListener('close',resetMatchReportMode);
document.getElementById('save-club-kit-profile')?.addEventListener('click',saveClubKitProfile);
document.getElementById('add-award-btn').addEventListener('click',openAwardDialog);
document.getElementById('award-form').addEventListener('submit',saveStandaloneAward);
document.getElementById('save-team-settings')?.addEventListener('click',saveTeamSettings);
document.getElementById('save-feature-settings').addEventListener('click',saveFeatureSettings);
document.getElementById('add-award-type')?.addEventListener('click',addAwardType);
document.getElementById('concern-category')?.addEventListener('change',e=>{const safe=e.target.value==='safeguarding';const subj=document.getElementById('concern-subject'),body=document.getElementById('concern-body');if(safe){subj.value='';body.value='';subj.disabled=true;body.disabled=true;document.getElementById('concern-result').textContent='Safeguarding details must not be entered here. Continue to see the external reporting contacts.';}else{subj.disabled=false;body.disabled=false;document.getElementById('concern-result').textContent='';}});
document.getElementById('load-retained-thread')?.addEventListener('click',loadRetainedThread);
document.getElementById('save-u11-safeguarding')?.addEventListener('click',saveU11SafeguardingInfo);
document.getElementById('export-u11-safeguarding')?.addEventListener('click',exportU11Safeguarding);
document.getElementById('request-club-cancellation')?.addEventListener('click',requestClubCancellationUi);
document.getElementById('cancel-club-cancellation')?.addEventListener('click',cancelClubCancellationUi);
document.getElementById('inbox-contact-select')?.addEventListener('change',e=>{__inboxSelected=e.target.value;renderInbox();});
document.getElementById('send-inbox-message')?.addEventListener('click',sendInboxMessage);
document.getElementById('refresh-club-coaches')?.addEventListener('click',()=>refreshClubCoaches(false));
document.getElementById('refresh-coach-club-results')?.addEventListener('click',()=>refreshCoachClubResults(false));
document.getElementById('admin-mode-club')?.addEventListener('click',()=>setAdminUiMode('club'));
document.getElementById('admin-mode-coach')?.addEventListener('click',()=>setAdminUiMode('coach'));
document.getElementById('admin-account-mode-switch')?.addEventListener('click',()=>setAdminUiMode(isAdminCoachMode()?'club':'coach'));
document.getElementById('hero-profile-switch')?.addEventListener('click',()=>setAdminUiMode(isAdminCoachMode()?'club':'coach'));
document.getElementById('hero-admin-preview-back')?.addEventListener('click',()=>setAdminUiMode('club'));
document.getElementById('settings-team-name')?.addEventListener('change',()=>{if(!isTeamLocked())applySelectedClubTeamToForm();});
const refreshClubTeamsBtn=document.getElementById('refresh-club-teams');if(refreshClubTeamsBtn)refreshClubTeamsBtn.addEventListener('click',()=>syncProviderClubTeams(false));
document.getElementById('save-league-settings')?.addEventListener('click',saveLeagueSettings);
document.getElementById('save-selkent-settings')?.addEventListener('click',saveSelkentSettings);
document.getElementById('sync-selkent-now')?.addEventListener('click',()=>syncSelkent(false));
document.getElementById('sync-league-table')?.addEventListener('click',()=>syncSelkentLeagueTable(false));
document.getElementById('import-league-results')?.addEventListener('click',importPastedLeagueResults);
document.getElementById('clear-league-results')?.addEventListener('click',clearImportedLeagueResults);
document.getElementById('export-json')?.addEventListener('click',()=>{if(!requireCoach())return;if(ageGroupNumber()<=11)return toast('U7–U11 backup export is disabled.');download(`${safeFileName()}_Backup_${state.meta.season.replace('/','-')}.json`,JSON.stringify(state,null,2),'application/json');});
document.getElementById('export-matches')?.addEventListener('click',exportMatches);
document.getElementById('export-goals')?.addEventListener('click',exportGoals);
document.getElementById('import-json')?.addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
document.getElementById('reset-data')?.addEventListener('click',()=>{if(!requireCoach())return;if(confirm("Reset this team\'s app data?")){state=(CLOUD_MODE&&window.ClubHubCloud?.currentTeam?.())?blankStateForTeam(window.ClubHubCloud.currentTeam()):(isTeamLocked()?blankStateForTeam(assignedTeam()):cloneStarter());enforceAssignedTeam(false);saveState();toast('Team data reset');}});
const activateBtn=document.getElementById('activate-account-btn');if(activateBtn)activateBtn.addEventListener('click',activateAssignment);
const assignmentRoleSelect=document.getElementById('assignment-role');if(assignmentRoleSelect)assignmentRoleSelect.addEventListener('change',updateAssignmentRoleUi);
const generateBtn=document.getElementById('generate-assignment-code');if(generateBtn)generateBtn.addEventListener('click',generateAssignmentCode);
const copyBtn=document.getElementById('copy-assignment-code');if(copyBtn)copyBtn.addEventListener('click',copyAssignmentCode);
const parentInviteBtn=document.getElementById('generate-team-parent-invite');if(parentInviteBtn)parentInviteBtn.addEventListener('click',createTeamParentInvite);
const copyParentInviteBtn=document.getElementById('copy-team-parent-invite');if(copyParentInviteBtn)copyParentInviteBtn.addEventListener('click',copyTeamParentInvite);
const playerInviteBtn=document.getElementById('generate-team-player-invite');if(playerInviteBtn)playerInviteBtn.addEventListener('click',createTeamPlayerInvite);
const copyPlayerInviteBtn=document.getElementById('copy-team-player-invite');if(copyPlayerInviteBtn)copyPlayerInviteBtn.addEventListener('click',copyTeamPlayerInvite);
const refreshMembersBtn=document.getElementById('refresh-team-members');if(refreshMembersBtn)refreshMembersBtn.addEventListener('click',()=>refreshTeamMembers(false));
document.querySelectorAll('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog')?.close()));


document.getElementById('squad-list-tab')?.addEventListener('click',()=>setSquadPage(0));
document.getElementById('squad-tactics-tab')?.addEventListener('click',()=>setSquadPage(1));
document.getElementById('squad-swipe')?.addEventListener('scroll',()=>{const s=document.getElementById('squad-swipe');if(!s)return;const p=Math.round(s.scrollLeft/Math.max(1,s.clientWidth));document.querySelectorAll('[data-squad-page]').forEach(b=>b.classList.toggle('active',Number(b.dataset.squadPage)===p));},{passive:true});
document.getElementById('reset-tactics')?.addEventListener('click',resetTactics);
document.getElementById('select-all-available')?.addEventListener('click',selectAllAvailablePlayers);
document.getElementById('matchday-open-tactics')?.addEventListener('click',()=>{navigate('squad');setTimeout(()=>setSquadPage(1),80);});
document.getElementById('save-matchday-dashboard-note')?.addEventListener('click',saveMatchdayDashboardNote);
document.getElementById('tactics-formation')?.addEventListener('change',e=>{if(!isCoach())return;ensureTacticsState();const key=currentTacticsFixtureKey(),before=state.tactics.formation||'';state.tactics.formation=e.target.value;state.tactics.formationByFixture[key]=e.target.value;applyFormationTemplate(true);auditEvent('formation_changed','tactics',key,`Formation ${before||'unset'} → ${e.target.value}`,before,e.target.value);renderMatchdayDashboard();});
document.getElementById('fixture-confirm')?.addEventListener('click',()=>setFixtureAcknowledgement('confirmed'));
document.getElementById('fixture-report-issue')?.addEventListener('click',()=>setFixtureAcknowledgement('issue'));
document.querySelectorAll('[data-availability-status]').forEach(b=>b.addEventListener('click',()=>saveParentAvailability(b.dataset.availabilityStatus)));
document.getElementById('availability-player')?.addEventListener('change',()=>{if(currentRole!=='parent')return;const name=document.getElementById('availability-player')?.value||'';const own=window.ClubHubCloud?.session?.user?.id||'';const row=__availabilityRows.find(r=>r.parent_user_id===own&&r.player_name===name);document.querySelectorAll('[data-availability-status]').forEach(b=>b.classList.toggle('selected',b.dataset.availabilityStatus===row?.status));});
document.getElementById('admin-access-filter')?.addEventListener('change',renderAdminAccessManagement);
document.getElementById('announcement-audience')?.addEventListener('change',populateAnnouncementTargets);
document.getElementById('announcement-send')?.addEventListener('click',publishAnnouncement);
document.querySelectorAll('[data-club-tab]').forEach(b=>b.addEventListener('click',()=>setClubTab(b.dataset.clubTab)));
document.getElementById('refresh-club-results')?.addEventListener('click',()=>refreshClubResults(false));
document.getElementById('club-results-age')?.addEventListener('change',e=>{__clubResultsAge=Number(e.target.value)||__clubResultsAge;__clubResultsPage=0;renderClubResultsBrowser();});
document.getElementById('club-results-prev')?.addEventListener('click',()=>{__clubResultsPage=Math.max(0,__clubResultsPage-1);renderClubResultsBrowser();});
document.getElementById('club-results-next')?.addEventListener('click',()=>{__clubResultsPage++;renderClubResultsBrowser();});


// Horizontal navigation remains visible; dialogs no longer manipulate a footer bar.
window.closeTopDialog=function(){const dlg=[...document.querySelectorAll('dialog[open]')].pop();if(dlg){try{document.activeElement?.blur?.();}catch{}dlg.close();return true;}return false;};
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('cancel',e=>{e.preventDefault();window.closeTopDialog();});d.addEventListener('close',()=>{try{document.activeElement?.blur?.();}catch{}});});

if('serviceWorker' in navigator && location.protocol.startsWith('http')){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); }

let __booting=false;
async function bootTracker(){
  if(__booting)return;
  __booting=true;
  try{
    if(CLOUD_MODE){
      const ctx=await window.ClubHubCloud.bootstrap({
        localState:state,
        onRemoteState:(remote)=>{state=repairStateIdentity(normalizeState(remote));persistLocalState();if(isTeamLocked())enforceAssignedTeam(false);renderAll();resetMatchForm();},
      });
      if(!ctx)return;
      cloudBootContext=ctx;
      applyClubConfiguration(ctx.configuration||window.ClubHubCloud?.configuration||null);
      currentRole=ctx.role;
      const bootAge=Number(String(ctx.team?.ageGroup||ctx.team?.age_group||'').replace(/\D/g,''));
      if(bootAge>=7&&bootAge<=11)localStorage.removeItem(STORAGE_KEY);
      account={user:ctx.profile?.full_name||ctx.email||roleLabel(),role:ctx.role==='admin'?'admin':ctx.role,team:ctx.team};
      if(currentRole==='admin'&&adminUiMode==='coach'){
        const own=window.ClubHubCloud?.coachTeam?.();
        if(own)await window.ClubHubCloud.switchAdminTeam(own.id,(team)=>blankStateForTeam(team));
        else{adminUiMode='club';localStorage.setItem(ADMIN_UI_MODE_KEY,'club');}
      }
      const loaded=await window.ClubHubCloud.loadInitialState(state,(team)=>{
        const localMatches=selkentNorm(state.division?.teamName||'')===selkentNorm(team.leagueName||'');
        return localMatches?state:blankStateForTeam(team);
      });
      if(loaded?.state){state=repairStateIdentity(normalizeState(loaded.state));persistLocalState();}
      applyClubConfiguration(ctx.configuration||window.ClubHubCloud?.configuration||null);
      if(isTeamLocked())enforceAssignedTeam(false);
    }else if(isTeamLocked())enforceAssignedTeam(true);

    resetMatchForm();
    applyTheme(themePreference());
    renderAll();
    if(CLOUD_MODE)setTimeout(()=>refreshSelkentOpponentDirectory(true),900);
    setTimeout(()=>refreshPublishedLeagueAges(true).then(()=>renderAll()).catch(()=>{}),500);
    updateActivationGate();
    navigate(isClubOverviewMode()?'club':'home',false);

    if(CLOUD_MODE){
      window.ClubHubCloud.updateCloudPanel?.();
      window.ClubHubCloud.startPolling?.();
      if(['admin','coach','assistant_coach','parent','player'].includes(currentRole)){
        setTimeout(()=>{refreshAnnouncements(true);refreshNotifications(true);refreshAppearanceStats(true);},700);
        if(!window.__clubNoticeTimer)window.__clubNoticeTimer=setInterval(()=>{if(document.visibilityState==='visible'){refreshAnnouncements(true);refreshNotifications(true);refreshAppearanceStats(true);}},30000);
      }
      if(isAdmin()&&!window.__adminBackgroundTimer)window.__adminBackgroundTimer=setInterval(()=>{if(document.visibilityState==='visible'){refreshAdminClubOverview(true);refreshAdminFixtures(true);refreshClubCoaches(true);if(__clubTab==='results')refreshClubResults(true);}},60000);
    }
    setTimeout(()=>{if(!assignmentRequired()||account){if(shouldAutoSync())syncSelkent(true);else if(shouldScanFixtures())scanUpcomingFixtures(true);}},700);
    if(!window.__fixtureScanTimer)window.__fixtureScanTimer=setInterval(()=>{if(document.visibilityState==='visible'&&shouldScanFixtures())scanUpcomingFixtures(true);},5*60*1000);
  }finally{__booting=false;}
}
window.addEventListener('clubhub-authenticated',()=>{const run=()=>{if(__booting){setTimeout(run,60);return;}bootTracker().catch(err=>console.error('Auth handoff failed',err));};requestAnimationFrame(run);});
bootTracker().catch(err=>console.error('Tracker boot failed',err));

// v2.0.18: club results browser, Selkent directory details, TBC fixtures and tactics board.

// v2.0.19: Android auth callback and Club Admin recovery reliability fix.
// v2.0.20: Club Admin oversight, fixture centre, coach management, read-only inspection and Admin ↔ Coach inbox.
// v2.0.21: instant login handoff, horizontal navigation, background refresh, Assistant Coach role and all-role inbox.

// v2.0.22: persistent top navigation, automated-only Selkent flow, formation presets, Maps links and admin overview ordering.
// v2.0.23: stable dual-role Admin/Coach view switching, Club Admin invites and dual-role coaching visibility.
// v2.0.24: reliable Supabase/local session sign-out and immediate login-gate reset.

// v2.0.25: opening badge splash, fixture acknowledgements/change alerts, fixture-linked matchday squads and consolidated access management.

// v2.0.27: approved-parent PIN access, RSVP, per-fixture formations, coaching notes and richer player stats.
// v2.0.29: dynamic stat dashboard, removable awards, mini-soccer score entry, U12+ publication threshold and next-fixture match-page priority.

// v2.0.30: club announcements, match attendance, grouped admin health and improved parent PIN onboarding.

// v2.0.31: editable completed non-league matches, mini-soccer present/not-present attendance, U15 player profiles, shared child RSVP, light/dark themes and age-matched Selkent opponent directory.

// v2.0.31: editable non-league results, rolling-sub attendance, U15 player profiles, Selkent opponent directory and light/dark appearance.
// v2.0.32: attendance-driven appearances, RSVP deadlines/reminders, notification centre, calendar integration and debug quick-login.

// v2.0.33: Admin internal results, U15-only player access, and dark-mode contrast pass.
// v2.0.34: season archive/rollover, audit history and grouped tournament events.
// v2.0.35: restored add/edit scheduled match controls, Admin Results isolation and dark-mode contrast fixes.

// Universal Core v1: club configuration, competition rules, provider abstraction and multi-tenant branding.
