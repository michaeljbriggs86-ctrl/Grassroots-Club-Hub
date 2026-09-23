(function(){
  'use strict';

  const cfg = window.CLUB_HUB_CLOUD || {};
  const SESSION_KEY = 'grassroots_hub_cloud_session_v1';
  const INVITE_KEY = 'grassroots_hub_pending_invite_v1';
  const ACTIVE_TEAM_KEY = 'grassroots_hub_admin_active_team_v1';
  const VERIFY_EMAIL_KEY = 'grassroots_hub_verify_email_v1';
  const TEAM_DIRECTORY_CACHE_KEY = 'grassroots_hub_team_directory_cache_v1';
  const TEAM_STATE_CACHE_PREFIX = 'grassroots_hub_team_state_cache_v1_';
  const INVITE_LOCK_KEY = 'grassroots_hub_invite_lock_v1';
  const PENDING_PARENT_PIN_KEY = 'grassroots_hub_pending_parent_pin_v1';
  const PENDING_PARENT_REQUEST_KEY = 'pitchkind_pending_parent_request_v1';
  const TEST_MODE_KEY = 'grassroots_hub_debug_test_mode_v1';
  const TEST_CLUB_KEY = 'grassroots_hub_debug_club_v1';
  const LOGIN_CLUB_KEY = 'grassroots_hub_login_club_v1';
  const APP_STATE_STORAGE_KEY = 'grassrootsHub_team_state_v1';
  const AUTH_REDIRECT = 'grassrootsclubhub://auth-callback';
  const AUTH_DESIGN_REVISION = 'approved-app-ui-2026-09-21-v1.4-pitchkind';
  const INITIAL_AUTH_CALLBACK = new URLSearchParams(location.search).get('auth_callback') || '';
  let initialAuthCallbackHandled = false;
  let session = null;
  let context = null;
  let clubConfiguration = null;
  let visibleTeams = [];
  let activeTeam = null;
  let activeRevision = -1;
  let lastRemoteUpdatedAt = '';
  let saveTimer = null;
  let saving = false;
  let pendingState = null;
  let pollTimer = null;
  let hooks = {};
  const TEST_TEAM={id:'debug-u9-green',club_id:'debug-club',name:'Green',age_group:9,division:'U9 Development',season:'2026/27',selkent_label:'Under 9s Green',league_name:'Demo Juniors FC Green',active:true};
  const TEST_CLUB_CONFIG={club:{id:'debug-club',name:'Demo Juniors FC'},settings:{slug:'demo-juniors',display_name:'Demo Juniors FC',short_name:'Demo Juniors',primary_color:'#1d7a65',secondary_color:'#ffffff',accent_color:'#165c4d',logo_asset:'',current_season:'2026/27',default_provider_key:'manual',results_publish_from_age:12,player_account_age_groups:[15],is_demo:true},rules:[{age_group:9,format:'5v5',players_on_pitch:5,max_registered:10,matchday_max:10,rolling_substitutions:true,results_published:false,player_accounts_allowed:false}],providers:[{provider_key:'manual',provider_type:'manual',enabled:true,is_primary:true,config:{}}],teams:[TEST_TEAM]};

  function debugBuild(){try{return !!window.ClubHubNative?.isDebugBuild?.();}catch{return false;}}
  function testModeActive(){return debugBuild()&&localStorage.getItem(TEST_MODE_KEY)==='coach';}
  function testClubSlug(){return localStorage.getItem(TEST_CLUB_KEY)||'demo-juniors';}

  function configured(){
    return cfg.enabled !== false && /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url||'')) &&
      String(cfg.anonKey||'').length > 40 && !String(cfg.anonKey).includes('YOUR-');
  }
  function base(){ return String(cfg.url||'').replace(/\/$/,''); }
  function emitStatus(text, type='info'){
    const el=document.getElementById('cloud-sync-status');
    if(el){el.textContent=text;el.dataset.state=type;}
    window.dispatchEvent(new CustomEvent('clubhub-cloud-status',{detail:{text,type}}));
  }
  function saveSession(s){
    session=s||null;
    if(session) localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  function loadSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
  }
  function cachedTeams(){try{const x=JSON.parse(localStorage.getItem(TEAM_DIRECTORY_CACHE_KEY)||'null');return Array.isArray(x?.rows)?x.rows:[];}catch{return [];}}
  function cacheTeams(rows){try{localStorage.setItem(TEAM_DIRECTORY_CACHE_KEY,JSON.stringify({savedAt:Date.now(),rows:Array.isArray(rows)?rows:[]}));}catch{}}
  function cachedTeamState(teamId){try{const x=JSON.parse(localStorage.getItem(TEAM_STATE_CACHE_PREFIX+teamId)||'null');return x&&x.state?x:null;}catch{return null;}}
  function cacheTeamState(teamId,row){if(!teamId||!row?.state)return;try{localStorage.setItem(TEAM_STATE_CACHE_PREFIX+teamId,JSON.stringify({state:row.state,revision:Number(row.revision??0),updated_at:row.updated_at||'',savedAt:Date.now()}));}catch{}}
  function clearAccountLocalData(){
    try{
      localStorage.removeItem(APP_STATE_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_TEAM_KEY);
      localStorage.removeItem(TEAM_DIRECTORY_CACHE_KEY);
      Object.keys(localStorage).forEach(k=>{
        if(k.startsWith(TEAM_STATE_CACHE_PREFIX))localStorage.removeItem(k);
      });
    }catch{}
  }
  function authHeaders(accessToken){
    const h={'apikey':cfg.anonKey,'Content-Type':'application/json'};
    if(accessToken)h['Authorization']='Bearer '+accessToken;
    return h;
  }
  async function request(path,{method='GET',body=null,token=true,headers={}}={}){
    const res=await fetch(base()+path,{method,headers:{...authHeaders(token?session?.access_token:null),...headers},body:body==null?undefined:JSON.stringify(body)});
    const text=await res.text();
    let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
    if(!res.ok){
      const msg=(data&&typeof data==='object'&&(data.msg||data.message||data.error_description||data.hint||data.details||data.error))||text||('HTTP '+res.status);
      const err=new Error(msg);err.status=res.status;err.data=data;throw err;
    }
    return {data,headers:res.headers,status:res.status};
  }
  async function refreshSession(){
    if(!session?.refresh_token)return false;
    try{
      const res=await fetch(base()+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:authHeaders(),body:JSON.stringify({refresh_token:session.refresh_token})});
      const data=await res.json();
      if(!res.ok||!data.access_token)throw new Error(data?.msg||data?.error_description||'Session refresh failed');
      data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
      saveSession(data);return true;
    }catch{saveSession(null);return false;}
  }
  async function ensureFreshSession(){
    session=loadSession();
    if(!session?.access_token)return false;
    const exp=Number(session.expires_at||0);
    if(!exp||exp < Math.floor(Date.now()/1000)+90)return await refreshSession();
    return true;
  }
  async function signIn(email,password){
    const normalizedEmail=String(email||'').trim().toLowerCase();
    let res;
    try{
      res=await fetch(base()+'/auth/v1/token?grant_type=password',{method:'POST',headers:authHeaders(),body:JSON.stringify({email:normalizedEmail,password:String(password||'')})});
    }catch(e){
      throw new Error('Could not reach the sign-in service. Check your internet connection and try again.');
    }
    const text=await res.text();
    let data={};try{data=text?JSON.parse(text):{};}catch{data={message:text};}
    if(!res.ok){
      const raw=data?.error_description||data?.msg||data?.message||data?.error||'Sign in failed';
      if(/invalid login credentials/i.test(raw))throw new Error('Email or password not accepted. Use Forgot password if you are unsure of the password.');
      throw new Error(raw);
    }
    if(!data?.access_token||!data?.refresh_token)throw new Error('Sign in was accepted but no session was returned. Please try again.');
    data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
    saveSession(data);
    return data;
  }
  async function signUp(email,password,fullName,inviteCode,metadata={}){
    const url=base()+'/auth/v1/signup?redirect_to='+encodeURIComponent(AUTH_REDIRECT);
    const res=await fetch(url,{method:'POST',headers:authHeaders(),body:JSON.stringify({email,password,data:{full_name:fullName||'',...(metadata||{})}})});
    const data=await res.json();
    if(!res.ok)throw new Error(data?.msg||data?.message||data?.error_description||'Account creation failed');
    if(inviteCode)localStorage.setItem(INVITE_KEY,inviteCode.trim());
    localStorage.setItem(VERIFY_EMAIL_KEY,email.trim());
    if(data?.access_token){data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);saveSession(data);}
    return data;
  }
  async function resendSignup(email){
    const res=await fetch(base()+'/auth/v1/resend?redirect_to='+encodeURIComponent(AUTH_REDIRECT),{method:'POST',headers:authHeaders(),body:JSON.stringify({type:'signup',email})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data?.msg||data?.message||data?.error_description||'Could not resend confirmation email');
    localStorage.setItem(VERIFY_EMAIL_KEY,email.trim());
    return data;
  }
  async function sendPasswordReset(email){
    const res=await fetch(base()+'/auth/v1/recover?redirect_to='+encodeURIComponent(AUTH_REDIRECT),{method:'POST',headers:authHeaders(),body:JSON.stringify({email})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data?.msg||data?.message||data?.error_description||'Could not send password reset email');
    return data;
  }
  async function joinWithInvite(name,inviteCode){
    const res=await fetch(base()+'/functions/v1/join-team',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({name:String(name||'').trim(),invite_code:String(inviteCode||'').trim()})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data?.session?.access_token)throw new Error(data?.error||data?.message||'Could not join the team');
    const next=data.session;
    if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);
    saveSession(next);
    return data;
  }

  async function playerAccessRequest(action,payload={},useSession=false){
    const headers={'apikey':cfg.anonKey,'Content-Type':'application/json'};
    if(useSession&&session?.access_token)headers['Authorization']='Bearer '+session.access_token;
    let res;
    try{
      res=await fetch(base()+'/functions/v1/player-access',{method:'POST',headers,body:JSON.stringify({action,...payload})});
    }catch{
      throw new Error('Could not reach Player Access. Check your internet connection and try again.');
    }
    const text=await res.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={error:text};}
    if(!res.ok||data?.error)throw new Error(data?.error||data?.message||'Player Access is unavailable.');
    return data;
  }
  async function playerCodeLogin(name,code){
    const data=await playerAccessRequest('login',{name:String(name||'').trim(),code:String(code||'').trim().toUpperCase()},false);
    if(!data?.session?.access_token)throw new Error('Player Access did not return a sign-in session.');
    const next={...data.session};if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);saveSession(next);return data;
  }
  async function issuePlayerAccessCode(teamId,playerName){
    if(!session?.access_token)throw new Error('Sign in first.');
    return await playerAccessRequest('issue',{team_id:String(teamId||''),player_name:String(playerName||'').trim()},true);
  }

  async function loginWithPin(club,team,name,pin){
    const res=await fetch(base()+'/functions/v1/pin-login',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({club:String(club||'').trim(),team:String(team||'').trim(),name:String(name||'').trim(),pin:String(pin||'').trim()})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data?.session?.access_token)throw new Error(data?.error||data?.message||'Could not sign in with PIN');
    const next=data.session;if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);saveSession(next);return data;
  }
  async function pinAdmin(action,payload={}){
    if(!session?.access_token)throw new Error('Sign in required');
    const res=await fetch(base()+'/functions/v1/pin-admin',{method:'POST',headers:{...authHeaders(session.access_token)},body:JSON.stringify({action,...payload})});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||data?.message||'PIN action failed');return data;
  }
  function accessPinPassword(pin){return `GCH-PIN!${String(pin||'').trim()}#APP`;}
  async function setAccessPin(pin){
    const clean=String(pin||'').trim();if(!/^\d{6}$/.test(clean))throw new Error('Choose a 6-digit PIN');
    if(['player','pending_parent'].includes(role())){
      await updatePassword(accessPinPassword(clean));
      await rpc(role()==='player'?'mark_my_player_pin_set':'mark_my_pending_parent_pin_set',{});
      context=await getContext();return {ok:true,pending_approval:role()==='pending_parent'};
    }
    const data=await pinAdmin('set_pin',{pin:clean});if(data?.session?.access_token){const next=data.session;if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);saveSession(next);}context=await getContext();return data;
  }
  async function resetParentPin(userId){return await pinAdmin('reset_parent',{user_id:String(userId||'')});}
  function pendingParentPin(){const pin=localStorage.getItem(PENDING_PARENT_PIN_KEY)||'';return /^\d{6}$/.test(pin)?pin:'';}
  async function activatePendingParentPin(){
    const pin=pendingParentPin();
    if(!pin||context?.profile?.role!=='parent'||context?.profile?.pin_set_at)return false;
    await setAccessPin(pin);
    localStorage.removeItem(PENDING_PARENT_PIN_KEY);
    context=await getContext();
    return true;
  }

  async function updatePassword(newPassword){
    const {data}=await request('/auth/v1/user',{method:'PUT',body:{password:newPassword}});
    if(session&&data){session.user=data;saveSession(session);}
    return data;
  }
  async function hydrateSessionUser(){
    try{
      const {data}=await request('/auth/v1/user');
      if(session&&data){session.user=data;saveSession(session);}
    }catch{}
  }
  async function handleAuthCallback(uri,{duringBootstrap=false}={}){
    if(!uri)return null;
    try{
      const u=new URL(uri);
      const hash=new URLSearchParams((u.hash||'').replace(/^#/,''));
      const query=u.searchParams;
      const get=(k)=>hash.get(k)||query.get(k)||'';
      const error=get('error_description')||get('error');
      const errorCode=get('error_code');
      if(error){setGateHtml('signin',decodeURIComponent(error.replace(/\+/g,' '))+(errorCode?' ('+errorCode+')':''));return 'error';}
      const accessToken=get('access_token');
      const refreshToken=get('refresh_token');
      const type=get('type');
      if(!accessToken||!refreshToken){
        if(type==='recovery')setGateHtml('signin','The password reset link opened, but Supabase did not return a recovery session. Request a fresh reset email and try again.');
        return null;
      }
      const expiresIn=Number(get('expires_in')||3600);
      saveSession({access_token:accessToken,refresh_token:refreshToken,token_type:get('token_type')||'bearer',expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn});
      await hydrateSessionUser();
      localStorage.removeItem(VERIFY_EMAIL_KEY);
      if(type==='recovery'){
        setGateHtml('newpassword','Password reset verified. Choose your new password below.');
        return 'recovery';
      }
      const parentMeta=session?.user?.user_metadata||{},metaTeam=String(parentMeta.requested_team_id||''),metaChild=String(parentMeta.requested_child_name||'').trim();
      if(parentMeta.parent_signup&&metaTeam&&metaChild){
        try{await requestParentAccess(metaTeam,metaChild);localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);context=await getContext();setGateHtml('approval','Your email is confirmed. Your parent access request is waiting for coach approval.');return 'parentrequest';}
        catch(e){setGateHtml('signin','Your account was created, but the parent access request could not be submitted. '+(e.message||''));return 'error';}
      }
      if(!duringBootstrap) location.reload();
      return type||'auth';
    }catch(e){
      if(!duringBootstrap)setGateHtml('signin','The email link could not be opened in the app. '+(e.message||''));
      return 'error';
    }
  }
  async function rpc(name,args={}){
    const {data}=await request('/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',body:args});return data;
  }
  async function getContext(){
    let data=await rpc('get_my_context',{});
    if(Array.isArray(data)&&data.length===1)data=data[0];
    if(data&&data.context)data=data.context;
    return data;
  }
  async function getClubConfiguration(){
    if(testModeActive()){
      return TEST_CLUB_CONFIG;
    }
    return await rpc('get_my_club_configuration',{});
  }
  async function listLoginClubs(){const {data}=await request('/rest/v1/rpc/list_login_clubs',{method:'POST',body:{},token:false});return Array.isArray(data)?data:[];}
  async function listLoginTeams(slug){if(!slug)return[];const {data}=await request('/rest/v1/rpc/list_login_teams',{method:'POST',body:{p_club_slug:String(slug)},token:false});return Array.isArray(data)?data:[];}
  async function populatePinClubChoices(){
    const clubSel=document.getElementById('cloud-pin-club'),teamSel=document.getElementById('cloud-pin-team');if(!clubSel||!teamSel)return;
    try{
      const clubs=await listLoginClubs();
      clubSel.innerHTML='<option value="">Choose club…</option>'+clubs.map(c=>`<option value="${escapeHtml(c.slug)}">${escapeHtml(c.display_name)}</option>`).join('');
      const saved=localStorage.getItem(LOGIN_CLUB_KEY)||'';if(clubs.some(c=>c.slug===saved))clubSel.value=saved;else if(clubs.length===1)clubSel.value=clubs[0].slug;
      const loadTeams=async()=>{const slug=clubSel.value||'';localStorage.setItem(LOGIN_CLUB_KEY,slug);teamSel.innerHTML='<option value="">Loading teams…</option>';const teams=await listLoginTeams(slug);teamSel.innerHTML='<option value="">Choose team…</option>'+teams.map(t=>`<option value="${escapeHtml(t.label||('U'+t.age_group+' '+t.name))}">${escapeHtml(t.label||('U'+t.age_group+' '+t.name))}</option>`).join('');};
      clubSel.onchange=()=>loadTeams().catch(()=>{teamSel.innerHTML='<option value="">Teams unavailable</option>';});if(clubSel.value)await loadTeams();
    }catch{clubSel.innerHTML='<option value="">Club list unavailable</option>';teamSel.innerHTML='<option value="">Choose a club first</option>';}
  }
  async function populateParentSignupChoices(){
    const clubSel=document.getElementById('cloud-parent-club'),teamSel=document.getElementById('cloud-parent-team');if(!clubSel||!teamSel)return;
    try{
      const clubs=await listLoginClubs();
      clubSel.innerHTML='<option value="">Choose club…</option>'+clubs.map(c=>`<option value="${escapeHtml(c.slug)}">${escapeHtml(c.display_name)}</option>`).join('');
      const saved=localStorage.getItem(LOGIN_CLUB_KEY)||'';if(clubs.some(c=>c.slug===saved))clubSel.value=saved;else if(clubs.length===1)clubSel.value=clubs[0].slug;
      const loadTeams=async()=>{const slug=clubSel.value||'';localStorage.setItem(LOGIN_CLUB_KEY,slug);teamSel.innerHTML='<option value="">Loading teams…</option>';const teams=await listLoginTeams(slug);teamSel.innerHTML='<option value="">Choose team…</option>'+teams.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.label||('U'+t.age_group+' '+t.name))}</option>`).join('');};
      clubSel.onchange=()=>loadTeams().catch(()=>{teamSel.innerHTML='<option value="">Teams unavailable</option>';});if(clubSel.value)await loadTeams();
    }catch{clubSel.innerHTML='<option value="">Club list unavailable</option>';teamSel.innerHTML='<option value="">Choose a club first</option>';}
  }
  async function claimInvite(code){return await rpc('claim_invite',{p_code:String(code||'').trim()});}
  async function requestParentAccess(teamId,childName){return await rpc('request_parent_access',{p_team_id:String(teamId||''),p_child_name:String(childName||'').trim()});}
  async function listPendingParentRequests(teamId=null){
    if(!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_pending_parent_requests',{p_team_id:teamId||null});
    return Array.isArray(data)?data:[];
  }
  async function listTeams(){
    if(testModeActive())return [TEST_TEAM];
    const {data}=await request('/rest/v1/teams?select=id,club_id,name,age_group,division,season,selkent_label,league_name,active&active=eq.true&order=age_group.asc,name.asc');
    const rows=Array.isArray(data)?data:[];if(rows.length)cacheTeams(rows);return rows;
  }
  function oldShapeTeam(t){
    if(!t)return null;
    const age = typeof t.age_group==='number'?'U'+t.age_group:String(t.age_group||'');
    return {id:t.id,selkentName:t.selkent_label||t.name,teamName:t.name,ageGroup:age,leagueName:t.league_name||t.name,division:t.division||'',season:t.season||''};
  }
  function role(){
    if(testModeActive())return 'coach';
    const r=context?.profile?.role||context?.role||'pending';
    return r==='club_admin'?'admin':r;
  }
  function assignedTeam(){
    if(testModeActive())return oldShapeTeam(TEST_TEAM);
    const t=context?.team||null;return oldShapeTeam(t);
  }
  function coachTeam(){
    if(testModeActive())return oldShapeTeam(TEST_TEAM);
    const direct=context?.coach_team||null;
    if(direct)return oldShapeTeam(direct);
    const id=context?.profile?.coach_team_id||null;
    if(!id)return null;
    return oldShapeTeam(visibleTeams.find(t=>t.id===id)||null);
  }
  function hasDualCoachAccess(){return role()==='admin'&&!!coachTeam();}
  function canEdit(){
    if(testModeActive())return true;
    const r=role();
    if(r==='coach'||r==='assistant_coach')return !!activeTeam&&context?.team?.id===activeTeam.id;
    if(r==='admin')return !!activeTeam&&!!context?.profile?.coach_team_id&&context.profile.coach_team_id===activeTeam.id;
    return false;
  }
  function canAdmin(){return !testModeActive()&&role()==='admin';}
  function teamMatchesState(team,state){
    const stateName=String(state?.division?.teamName||state?.meta?.teamName||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const teamName=String(team?.league_name||team?.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return stateName && teamName && (stateName===teamName || stateName.includes(teamName) || teamName.includes(stateName));
  }
  function chooseActiveTeam(localState){
    if(!visibleTeams.length)return null;
    const own=context?.team;
    if(own)return visibleTeams.find(t=>t.id===own.id)||own;
    const stored=localStorage.getItem(ACTIVE_TEAM_KEY);
    let found=visibleTeams.find(t=>t.id===stored);
    if(!found)found=visibleTeams.find(t=>teamMatchesState(t,localState));
    if(!found)found=visibleTeams[0];
    localStorage.setItem(ACTIVE_TEAM_KEY,found.id);return found;
  }
  function sanitizeMiniSoccerParentStateClient(input,age,profileRole=context?.profile?.role||''){
    const restricted=Number(age)>=7&&Number(age)<=11&&['parent','player'].includes(String(profileRole||''));
    if(!restricted||!input||typeof input!=='object')return input;
    const copy=JSON.parse(JSON.stringify(input));
    copy.matches=(Array.isArray(copy.matches)?copy.matches:[]).map(match=>{
      const m={...(match||{})};
      ['gf','ga','score','result','outcome','points','won','drawn','lost','goalDifference','winRate','notes'].forEach(key=>delete m[key]);
      m.resultRestricted=true;
      return m;
    });
    copy.goals=[];
    copy.assists=[];
    copy.bookings=[];
    copy.leagueResults=[];
    if(copy.selkent&&typeof copy.selkent==='object'){
      copy.selkent.results=[];
      copy.selkent.table=[];
      if(Array.isArray(copy.selkent.publishedLeagueAges)){
        copy.selkent.publishedLeagueAges=copy.selkent.publishedLeagueAges.filter(v=>!/^(?:U(?:[7-9]|10|11))$/i.test(String(v||'')));
      }
    }
    copy.squad=(Array.isArray(copy.squad)?copy.squad:[]).map(player=>{
      const p={...(player||{})};
      delete p.number;
      return p;
    });
    ['record','leagueTable','table','winRate','played','won','drawn','lost','gf','ga','gd','goalDifference'].forEach(key=>delete copy[key]);
    copy.meta={...(copy.meta||{}),miniSoccerResultRestriction:true,miniSoccerResultRestrictionAges:'U7-U11'};
    return copy;
  }
  async function fetchTeamState(teamId){
    const data=await rpc('get_team_state_for_me',{p_team_id:teamId});
    const row=Array.isArray(data)?data[0]:data;
    if(row){
      activeRevision=Number(row.revision||0);lastRemoteUpdatedAt=row.updated_at||'';
      const age=Number((visibleTeams.find(t=>t.id===teamId)||activeTeam)?.age_group||0);
      if(row.state)row.state=sanitizeMiniSoccerParentStateClient(row.state,age,context?.profile?.role||'');
      // Never persist the U7-U11 staff identity mapping in a device cache.
      if(age>=7&&age<=11)localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+teamId);else cacheTeamState(teamId,row);
    }else{activeRevision=-1;lastRemoteUpdatedAt='';}
    return row||null;
  }
  async function getClubOverview(){
    if(!canAdmin())return [];
    const data=await rpc('get_club_overview_for_me',{});
    const rows=Array.isArray(data)?data:[];
    const byTeam=new Map(rows.map(row=>[row.team_id,row]));
    return visibleTeams.map(t=>{
      const row=byTeam.get(t.id)||{};
      return {team:oldShapeTeam(t),state:row.state||{},revision:Number(row.revision||0),updatedAt:row.updated_at||''};
    });
  }
  async function saveTeamStateNow(nextState,{force=false}={}){
    if(!configured()||!session||!activeTeam||!canEdit())return null;
    if(saving){pendingState=nextState;return null;}
    saving=true;emitStatus('Saving…','working');
    try{
      const data=await rpc('save_team_state',{p_team_id:activeTeam.id,p_state:nextState,p_expected_revision:force?-2:activeRevision});
      const row=Array.isArray(data)?data[0]:data;
      if(row){activeRevision=Number(row.revision);lastRemoteUpdatedAt=row.updated_at||lastRemoteUpdatedAt;}
      // Read back the server-normalized state. For U7-U11 this removes name-keyed performance data.
      const saved=await fetchTeamState(activeTeam.id);
      if(saved?.state&&hooks.onRemoteState)hooks.onRemoteState(saved.state,{reason:'save-normalized'});
      emitStatus('Cloud synced','ok');return row;
    }catch(err){
      if(String(err.message||'').includes('STALE_STATE')){
        emitStatus('Newer cloud changes found — reloading','warn');
        const row=await fetchTeamState(activeTeam.id);
        if(row?.state&&hooks.onRemoteState)hooks.onRemoteState(row.state,{reason:'conflict'});
      }else emitStatus('Sync failed: '+(err.message||err),'error');
      throw err;
    }finally{
      saving=false;
      if(pendingState){const p=pendingState;pendingState=null;setTimeout(()=>saveTeamStateNow(p).catch(()=>{}),50);}
    }
  }
  function queueStateSave(nextState){
    if(!configured()||!canEdit()||!activeTeam)return;
    pendingState=JSON.parse(JSON.stringify(nextState));
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{const p=pendingState;pendingState=null;if(p)saveTeamStateNow(p).catch(()=>{});},700);
  }
  async function pullLatest({quiet=false}={}){
    if(!configured()||!session||!activeTeam)return null;
    if(!quiet)emitStatus('Checking cloud…','working');
    try{
      const before=activeRevision;
      const row=await fetchTeamState(activeTeam.id);
      if(row?.state&&Number(row.revision)!==before&&hooks.onRemoteState){hooks.onRemoteState(row.state,{reason:'pull'});}
      if(!quiet)emitStatus('Cloud synced','ok');
      return row;
    }catch(err){if(!quiet)emitStatus('Sync failed: '+(err.message||err),'error');return null;}
  }
  async function switchAdminTeam(teamId,seedFactory){
    if(!canAdmin())throw new Error('Club Admin access required');
    const team=visibleTeams.find(t=>t.id===teamId);if(!team)throw new Error('Team not found');
    if(pendingState&&canEdit()){const p=pendingState;pendingState=null;await saveTeamStateNow(p).catch(()=>{});}
    activeTeam=team;localStorage.setItem(ACTIVE_TEAM_KEY,team.id);
    const sensitiveMini=Number(team.age_group||0)>=7&&Number(team.age_group||0)<=11;
    if(sensitiveMini)localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+team.id);
    const cached=sensitiveMini?null:cachedTeamState(team.id);
    if(cached?.state){
      activeRevision=Number(cached.revision??0);lastRemoteUpdatedAt=cached.updated_at||'';
      hooks.onRemoteState&&hooks.onRemoteState(cached.state,{reason:'switch-cache'});
      updateCloudPanel();
      fetchTeamState(team.id).then(row=>{if(row?.state&&Number(row.revision)!==Number(cached.revision))hooks.onRemoteState&&hooks.onRemoteState(row.state,{reason:'switch-refresh'});}).catch(()=>{});
      return oldShapeTeam(team);
    }
    const row=await fetchTeamState(team.id);
    if(row?.state){hooks.onRemoteState&&hooks.onRemoteState(row.state,{reason:'switch'});}
    else if(seedFactory){
      const seed=seedFactory(oldShapeTeam(team));
      activeRevision=-1;
      if(canEdit())await saveTeamStateNow(seed);
      hooks.onRemoteState&&hooks.onRemoteState(seed,{reason:canEdit()?'switch-seed':'switch-preview'});
    }
    updateCloudPanel();return oldShapeTeam(team);
  }
  async function createInvite({teamId,role:inviteRole,label='',expiresHours=168}){
    if(!['admin','coach','assistant_coach'].includes(role()))throw new Error('Coaching staff or Club Admin access required');
    if(['coach','assistant_coach'].includes(role())&&!['parent','player'].includes(inviteRole))throw new Error('Coaching staff can only invite parents or players');
    if(inviteRole==='club_admin'&&role()!=='admin')throw new Error('Only a Club Admin can invite another Club Admin');
    if(inviteRole!=='club_admin'&&!teamId)throw new Error('Choose a team');
    if(inviteRole==='player'){
      const target=visibleTeams.find(t=>String(t.id)===String(teamId));const age=Number(target?.age_group||String(target?.ageGroup||'').replace(/\D/g,''));
      if(age!==15)throw new Error('Player app access is only available to U15 squads');
      if(String(label||'').trim().length<2)throw new Error('Choose the player first');
      return await issuePlayerAccessCode(teamId,label);
    }
    const data=await rpc('create_invite',{p_team_id:teamId||null,p_role:inviteRole,p_label:label||'',p_expires_hours:expiresHours});
    return Array.isArray(data)?data[0]:data;
  }
  async function listClubCoaches(){
    if(role()!=='admin')return [];
    const data=await rpc('list_club_coaches',{});
    return Array.isArray(data)?data:[];
  }
  async function listClubAccessAccounts(){
    if(role()!=='admin')return [];
    const data=await rpc('list_club_access_accounts',{});
    return Array.isArray(data)?data:[];
  }
  async function removeClubCoach(userId){
    if(role()!=='admin')throw new Error('Club Admin access required');
    return await rpc('remove_club_coach',{p_user_id:userId});
  }
  async function listPublishedClubResults(){
    if(!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_published_club_results',{});
    return Array.isArray(data)?data:[];
  }
  async function listTeamMembers(teamId=null){
    if(testModeActive())return [];
    if(!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_team_members_v2',{p_team_id:teamId||null});
    return Array.isArray(data)?data:[];
  }
  async function listMessageContacts(){
    if(!['admin','coach','assistant_coach','parent'].includes(role()))return [];
    const data=await rpc('list_message_contacts',{});
    return Array.isArray(data)?data:[];
  }
  async function listClubMessages(){
    if(!['admin','coach','assistant_coach','parent'].includes(role()))return [];
    const data=await rpc('list_active_messages',{});
    const rows=Array.isArray(data)?data:[];
    return rows.map(r=>({...r,id:r.message_id||r.id,created_at:r.sent_at||r.created_at}));
  }
  async function sendClubMessage({recipientUserId,subject='',body='',threadId=null}={}){
    if(!['admin','coach','assistant_coach','parent'].includes(role()))throw new Error('Inbox access required');
    const recipient=String(recipientUserId||'').trim(),text=String(body||'').trim();
    if(!recipient)throw new Error('Choose a recipient');
    if(!text)throw new Error('Write a message first');
    if(text.length>4000)throw new Error('Message is too long');
    return await rpc('send_club_message',{p_recipient_user_id:recipient,p_subject:String(subject||'').trim().slice(0,120),p_body:text,p_thread_id:threadId||null});
  }
  async function markClubMessagesRead(ids=[]){
    if(!['admin','coach','assistant_coach','parent'].includes(role()))return false;
    const clean=[...new Set((ids||[]).map(String).filter(x=>/^[0-9a-f-]{36}$/i.test(x)))];
    await Promise.all(clean.map(id=>rpc('mark_club_message_read',{p_message_id:id})));
    return true;
  }
  async function getClubComplianceStatus(){if(!['admin','coach','assistant_coach','parent'].includes(role()))return null;return await rpc('get_club_compliance_status',{});}
  async function setDisputeReviewers({primaryName,primaryUserId=null,backupName='',backupUserId=null,fallback=false}={}){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('set_dispute_reviewers',{p_primary_name:primaryName,p_primary_user_id:primaryUserId||null,p_backup_name:backupName||null,p_backup_user_id:backupUserId||null,p_fallback_to_county_fa:!!fallback});}
  async function setClubSafeguardingContacts({welfareName,welfareContact,countyFaName,countyFaContact}={}){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('set_club_safeguarding_contacts',{p_welfare_officer_name:welfareName,p_welfare_officer_contact:welfareContact,p_county_fa_name:countyFaName,p_county_fa_safeguarding_contact:countyFaContact});}
  async function getConcernRouting(){if(!['admin','coach','assistant_coach','parent'].includes(role()))throw new Error('Players do not have complaint/inbox access');return await rpc('get_concern_routing',{});}
  async function raiseClubConcern({category,subject='',body=''}={}){if(!['admin','coach','assistant_coach','parent'].includes(role()))throw new Error('Players do not have complaint/inbox access');return await rpc('raise_club_concern',{p_category:category,p_subject:subject||null,p_body:body||null});}
  async function listGeneralDisputes(){return await rpc('list_general_disputes',{});}
  async function listDisputeMessages(threadId=null){return await rpc('list_dispute_messages',{p_thread_id:threadId||null});}
  async function upsertU11SafeguardingInfo({teamId,playerName,emergencyName='',emergencyPhone='',medicalInfo=''}={}){return await rpc('upsert_u11_safeguarding_info',{p_team_id:teamId,p_player_name:playerName,p_emergency_contact_name:emergencyName,p_emergency_contact_phone:emergencyPhone,p_medical_allergy_info:medicalInfo});}
  async function exportU11SafeguardingPack(teamId,playerNames=[]){return await rpc('export_u11_safeguarding_pack',{p_team_id:teamId,p_player_names:Array.isArray(playerNames)?playerNames:[]});}
  async function listSafeguardingExportAudit(){if(role()!=='admin')return [];const d=await rpc('list_safeguarding_export_audit',{});return Array.isArray(d)?d:[];}
  async function requestClubCancellation(){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('request_club_cancellation',{});}
  async function cancelClubCancellation(){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('cancel_club_cancellation',{});}

  async function listParentPlayerLinks(parentUserId=null){
    if(testModeActive())return [];
    if(!activeTeam||!['admin','coach','assistant_coach','parent'].includes(role()))return [];
    const data=await rpc('list_parent_player_links',{p_parent_user_id:parentUserId||null,p_team_id:activeTeam.id});
    return Array.isArray(data)?data:[];
  }
  async function saveParentPlayerLinks(parentUserId,players=[]){
    if(testModeActive())return players||[];
    if(!activeTeam||!['admin','coach','assistant_coach'].includes(role()))throw new Error('Coaching staff or Club Admin access required');
    const parent=String(parentUserId||'').trim();if(!parent)throw new Error('Choose a parent');
    const clean=(players||[]).filter(x=>x&&x.name).map(x=>({name:String(x.name).trim().slice(0,80),number:Number(x.number)||null}));
    const data=await rpc('save_parent_player_links',{p_parent_user_id:parent,p_team_id:activeTeam.id,p_players:clean});
    return Array.isArray(data)?data:[];
  }
  async function listPlayerAccountLinks(userId=null){
    if(testModeActive())return [];
    if(!activeTeam||!['admin','coach','assistant_coach','player'].includes(role()))return [];
    const data=await rpc('list_player_account_links',{p_user_id:userId||null,p_team_id:activeTeam.id});
    return Array.isArray(data)?data:[];
  }
  async function listMatchAvailability(fixtureKey){
    if(testModeActive())return [];
    if(!activeTeam||!fixtureKey)return [];
    const q=`/rest/v1/match_availability?select=id,team_id,fixture_key,parent_user_id,player_name,status,updated_at&team_id=eq.${encodeURIComponent(activeTeam.id)}&fixture_key=eq.${encodeURIComponent(fixtureKey)}&order=updated_at.desc`;
    const {data}=await request(q);return Array.isArray(data)?data:[];
  }
  async function saveMatchAvailability({fixtureKey,playerName,status}={}){
    const r=role();if(!['parent','player'].includes(r))throw new Error('Parent or player access required');
    if(!activeTeam||!session?.user?.id)throw new Error('Team session is not ready');
    if(!fixtureKey||!['available','unavailable','unsure'].includes(status))throw new Error('Choose your availability');
    const name=String(playerName||'').trim().slice(0,80);if(!name)throw new Error('No linked player was selected');
    const links=r==='player'?await listPlayerAccountLinks(session.user.id):await listParentPlayerLinks(session.user.id);
    if(!links.some(x=>x.player_name===name))throw new Error('This player profile is not linked to this account');
    const payload={team_id:activeTeam.id,fixture_key:String(fixtureKey),parent_user_id:session.user.id,player_name:name,status,updated_at:new Date().toISOString()};
    const {data}=await request('/rest/v1/match_availability?on_conflict=team_id,fixture_key,player_name',{method:'POST',body:payload,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
    return Array.isArray(data)?data[0]:data;
  }
  async function listSelkentTeamDirectory(ageGroup){
    const age=Number(ageGroup||0);
    if(testModeActive()){return age===9?[
      {id:'test-1',club_name:'Demo Town',team_label:'Under 9 Reds',display_name:'Demo Town Reds',age_group:9,age_variant:'U9'},
      {id:'test-2',club_name:'Example Athletic',team_label:'Under 9 Blue',display_name:'Example Athletic Blue',age_group:9,age_variant:'U9'},
      {id:'test-3',club_name:'Sample Rovers',team_label:'Under 9',display_name:'Sample Rovers',age_group:9,age_variant:'U9'}
    ]:[];}
    if(!session?.access_token)return [];
    if(!age)return [];
    const q=`/rest/v1/selkent_team_directory?select=id,source_club_id,club_name,team_label,display_name,age_group,age_variant,club_url,last_seen_at&age_group=eq.${age}&order=display_name.asc`;
    const {data}=await request(q);return Array.isArray(data)?data:[];
  }
  async function syncSelkentTeamDirectory(){
    if(!session?.access_token)throw new Error('Sign in required');
    const res=await fetch(base()+'/functions/v1/selkent-teams-sync',{method:'POST',headers:{...authHeaders(session.access_token)},body:'{}'});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||data?.message||'Could not refresh Selkent team directory');return data;
  }

  async function getCoachMatchNote(matchId){
    if(testModeActive())return null;
    if(!activeTeam||!matchId||!['admin','coach','assistant_coach'].includes(role()))return null;
    const {data}=await request(`/rest/v1/coach_match_notes?select=id,team_id,match_id,note,updated_at,updated_by&team_id=eq.${encodeURIComponent(activeTeam.id)}&match_id=eq.${encodeURIComponent(String(matchId))}&limit=1`);
    return Array.isArray(data)?(data[0]||null):null;
  }
  async function saveCoachMatchNote(matchId,note){
    if(testModeActive())return {match_id:String(matchId||''),note:String(note||'')};
    if(!activeTeam||!matchId||!canEdit())throw new Error('Coach access required');
    const payload={team_id:activeTeam.id,match_id:String(matchId),note:String(note||'').slice(0,4000),updated_by:session?.user?.id,updated_at:new Date().toISOString()};
    const {data}=await request('/rest/v1/coach_match_notes?on_conflict=team_id,match_id',{method:'POST',body:payload,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
    return Array.isArray(data)?data[0]:data;
  }
  async function listAnnouncements(){if(testModeActive())return [];const data=await rpc('list_announcements_for_me',{});return Array.isArray(data)?data:(Array.isArray(data?.data)?data.data:[]);}
  async function createAnnouncement({title,body,audience='whole_club',ageGroup=null,teamId=null,pinned=false,important=false,expiresAt=null}={}){return await rpc('create_club_announcement',{p_title:String(title||'').trim(),p_body:String(body||'').trim(),p_audience:audience,p_age_group:ageGroup==null?null:Number(ageGroup),p_team_id:teamId||null,p_pinned:!!pinned,p_important:!!important,p_expires_at:expiresAt||null});}
  async function markAnnouncementRead(id){return await rpc('mark_announcement_read',{p_announcement_id:id});}
  async function deleteAnnouncement(id){return await rpc('delete_club_announcement',{p_announcement_id:id});}
  async function listMatchAttendance(matchId){if(testModeActive())return [];if(!activeTeam||!matchId||!['admin','coach','assistant_coach'].includes(role()))return [];const {data}=await request(`/rest/v1/match_attendance?select=id,team_id,match_id,player_name,status,updated_at,updated_by&team_id=eq.${encodeURIComponent(activeTeam.id)}&match_id=eq.${encodeURIComponent(String(matchId))}&order=player_name.asc`);return Array.isArray(data)?data:[];}
  async function saveMatchAttendance(matchId,rows=[]){if(testModeActive())return rows||[];if(!activeTeam||!matchId||!canEdit())throw new Error('Coach access required');const payload=(rows||[]).filter(r=>r?.player_name&&r?.status).map(r=>({player_name:String(r.player_name),status:String(r.status)}));await rpc('save_match_attendance',{p_team_id:activeTeam.id,p_match_id:String(matchId),p_rows:payload});return payload;}

  async function getAvailabilitySettings(fixtureKey){
    if(testModeActive()||!activeTeam||!fixtureKey)return null;
    const {data}=await request(`/rest/v1/fixture_availability_settings?select=team_id,fixture_key,deadline,updated_at&team_id=eq.${encodeURIComponent(activeTeam.id)}&fixture_key=eq.${encodeURIComponent(String(fixtureKey))}&limit=1`);
    return Array.isArray(data)?(data[0]||null):null;
  }
  async function setAvailabilityDeadline(fixtureKey,deadline){
    if(testModeActive())return true;if(!activeTeam||!canEdit())throw new Error('Coach access required');
    return await rpc('set_availability_deadline',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey),p_deadline:deadline||null});
  }
  async function sendAvailabilityReminder(fixtureKey){
    if(testModeActive())return 0;if(!activeTeam||!canEdit())throw new Error('Coach access required');
    return Number(await rpc('send_availability_reminder',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey)})||0);
  }
  async function listNotifications(){if(testModeActive())return [];const data=await rpc('list_notifications_for_me',{});return Array.isArray(data)?data:(Array.isArray(data?.data)?data.data:[]);}
  async function markNotificationRead(id){if(testModeActive())return true;return await rpc('mark_notification_read',{p_notification_id:id});}
  async function notifyFixtureChange(fixtureKey,body){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_fixture_change',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey),p_body:String(body||'')})||0);}
  async function notifySelectedSquad(fixtureKey,playerNames=[]){if(testModeActive())return 0;if(!activeTeam||!canEdit())throw new Error('Coach access required');return Number(await rpc('notify_selected_squad',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey),p_player_names:playerNames})||0);}
  async function notifyMatchReport(matchId,opponent,score){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_match_report',{p_team_id:activeTeam.id,p_match_id:String(matchId||''),p_opponent:String(opponent||''),p_score:String(score||'')})||0);}
  async function notifyMatchReopened(matchId,opponent){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_match_reopened',{p_team_id:activeTeam.id,p_match_id:String(matchId||''),p_opponent:String(opponent||'')})||0);}
  async function listPlayerAppearanceStats(){if(testModeActive())return [];if(!activeTeam)return [];const data=await rpc('list_player_appearance_stats',{p_team_id:activeTeam.id});return Array.isArray(data)?data:[];}

  async function approveParent(userId){
    if(!['admin','coach','assistant_coach'].includes(role()))throw new Error('Coaching staff or Club Admin access required');
    return await rpc('approve_parent',{p_user_id:userId});
  }
  async function removeTeamMember(userId){
    if(!['admin','coach','assistant_coach'].includes(role()))throw new Error('Coaching staff or Club Admin access required');
    return await rpc('remove_team_member',{p_user_id:userId});
  }

  async function recordAuditEvent({teamId=null,action='change',entityType='record',entityId=null,summary='',before=null,after=null}={}){
    if(testModeActive()||!['admin','coach','assistant_coach'].includes(role()))return null;
    const target=teamId||activeTeam?.id||null;
    return await rpc('record_audit_event',{p_team_id:target,p_action:String(action||'change'),p_entity_type:String(entityType||'record'),p_entity_id:entityId==null?null:String(entityId),p_summary:String(summary||''),p_before:before??null,p_after:after??null});
  }
  async function listAuditHistory(teamId=null,limit=100){
    if(testModeActive()||!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_audit_history',{p_team_id:teamId||null,p_limit:Number(limit)||100});
    return Array.isArray(data)?data:[];
  }
  async function listSeasonArchives(teamId=null){
    if(testModeActive()||!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_season_archives',{p_team_id:teamId||null});
    return Array.isArray(data)?data:[];
  }
  async function getSeasonArchive(archiveId){
    if(testModeActive()||!archiveId)return null;
    return await rpc('get_season_archive',{p_archive_id:String(archiveId)});
  }
  async function archiveCurrentSeason(teamId=null){
    if(testModeActive())return 0;if(role()!=='admin')throw new Error('Club Admin access required');
    return Number(await rpc('archive_current_season',{p_team_id:teamId||null})||0);
  }
  async function rolloverClubSeason(newSeason){
    if(testModeActive())return {teams:0,new_season:String(newSeason||'')};if(role()!=='admin')throw new Error('Club Admin access required');
    const result=await rpc('rollover_club_season',{p_new_season:String(newSeason||'').trim()});
    visibleTeams=await listTeams();
    if(activeTeam){activeTeam=visibleTeams.find(t=>t.id===activeTeam.id)||activeTeam;}
    return result||{};
  }

  async function syncTeamDirectory(teams){
    if(!canAdmin())return 0;
    const payload=(teams||[]).map(t=>({name:t.teamName,age_group:Number(String(t.ageGroup||'').replace(/\D/g,''))||0,selkent_label:t.selkentName,league_name:t.leagueName})).filter(t=>t.name&&t.age_group&&t.selkent_label&&t.league_name);
    if(!payload.length)return 0;
    const result=await rpc('sync_team_directory',{p_teams:payload});
    visibleTeams=await listTeams();
    return Number(result?.count??result??payload.length);
  }
  function visibleTeamList(){return visibleTeams.map(oldShapeTeam);}
  function currentTeam(){return oldShapeTeam(activeTeam);}
  function inviteAccessActive(){
    return Boolean(session?.user?.user_metadata?.invite_access || /@access\.[^@]+\.app$/i.test(String(session?.user?.email||'')));
  }
  function inviteAccessLocked(){
    return localStorage.getItem(INVITE_LOCK_KEY)==='1';
  }
  function setInviteAccessLocked(locked){
    if(locked) localStorage.setItem(INVITE_LOCK_KEY,'1');
    else localStorage.removeItem(INVITE_LOCK_KEY);
  }
  function clearInviteAccess(){
    setInviteAccessLocked(false);
    saveSession(null);context=null;visibleTeams=[];activeTeam=null;localStorage.removeItem(INVITE_KEY);localStorage.removeItem(PENDING_PARENT_PIN_KEY);
  }

  function authIcon(name){
    const icons={
      mail:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6 8-6"/></svg>',
      lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
      user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4 3.2-6 7.5-6s6.7 2 7.5 6"/></svg>',
      code:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zm4 0h2v6h-6v-2h4z"/></svg>',
      club:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-5h8v5M8 10h2m4 0h2"/></svg>',
      league:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M6 6H3c0 4 2 6 5 6m10-6h3c0 4-2 6-5 6M12 12v5m-4 3h8"/></svg>'
    };return icons[name]||icons.user;
  }
  function authBrand(){
    return `<div class="auth-brand"><img src="pitchkind-wt_logo-primary.svg" alt="PitchKind — Organise, Connect, Play" class="auth-brand-lockup"/></div>`;
  }
  function authField({icon='user',id,type='text',placeholder='',autocomplete='',inputmode='',maxlength='',value='',extra=''}){
    return `<div class="auth-field"><span class="auth-field-icon">${authIcon(icon)}</span><input id="${id}" type="${type}" ${autocomplete?`autocomplete="${autocomplete}"`:''} ${inputmode?`inputmode="${inputmode}"`:''} ${maxlength?`maxlength="${maxlength}"`:''} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${extra}/></div>`;
  }
  function authMainScreen({screen='adult',tagline,heroNote='',title,copy,body,footer='COMMUNITY FUELS BRIGHTER FUTURES',back=false}){
    return `<div class="auth-showcase auth-${screen}">${back?'<button type="button" class="auth-back" id="auth-screen-back">‹ Back</button>':''}${authBrand()}<div class="auth-scene" aria-hidden="true"></div><div class="auth-main"><h1>${title}</h1><p class="auth-lead">${copy}</p>${body}</div><div class="auth-grass-footer"><span>${footer}</span></div></div>`;
  }
  function authSimple(title,copy,body,tagline='GRASSROOTS CLUB HUB'){
    return `<div class="auth-simple">${authBrand()}<div class="auth-simple-card"><h1>${title}</h1>${copy?`<p class="auth-lead">${copy}</p>`:''}${body}</div></div>`;
  }
  function bindPasswordToggle(inputId,buttonId){document.getElementById(buttonId)?.addEventListener('click',()=>{const input=document.getElementById(inputId);if(!input)return;input.type=input.type==='password'?'text':'password';});}

  function setGateHtml(mode='signin',message='',prefillEmail=''){
    const gate=document.getElementById('activation-gate');
    if(!gate)return;
    gate.classList.remove('hidden');gate.dataset.authMode=mode;gate.dataset.authDesign=AUTH_DESIGN_REVISION;
    document.body.classList.add('auth-open');
    document.querySelector('.app-shell')?.classList.add('account-locked');

    if(mode==='signin'){
      const body=`
        <div class="auth-fields">
          ${authField({icon:'mail',id:'cloud-email',type:'email',placeholder:'Email address',autocomplete:'username',value:prefillEmail})}
          <div class="auth-password-wrap">${authField({icon:'lock',id:'cloud-password',type:'password',placeholder:'Password',autocomplete:'current-password'})}<button type="button" class="auth-eye" id="cloud-password-toggle" aria-label="Show or hide password">◉</button></div>
        </div>
        <button type="button" class="auth-forgot" id="cloud-forgot-password">Forgot password?</button>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p>
        <button class="auth-primary" id="cloud-auth-submit">Log In <span>→</span></button>
        <button class="auth-secondary" id="cloud-player-login"><span class="auth-button-icon">${authIcon('user')}</span><span>Player Login</span></button>
        <button class="auth-link-strong" id="cloud-parent-signup">Parent Sign Up</button>
        <div class="auth-divider"></div>
        <p class="auth-caption">One login page for all adult users — you’ll be redirected to the right account after sign in.</p>`;
      gate.innerHTML=authMainScreen({screen:'adult',heroNote:'More<br/>Than<br/>A Game',title:'Welcome Back',copy:'Admins, Coaches and Parents sign in with email and password.',body});
      bindPasswordToggle('cloud-password','cloud-password-toggle');
      document.getElementById('cloud-forgot-password')?.addEventListener('click',()=>setGateHtml('forgot'));
      document.getElementById('cloud-player-login')?.addEventListener('click',()=>setGateHtml('playerlogin'));
      document.getElementById('cloud-parent-signup')?.addEventListener('click',()=>setGateHtml('parentsignup'));
      document.getElementById('cloud-auth-submit')?.addEventListener('click',async()=>{
        const email=document.getElementById('cloud-email')?.value?.trim()||'',password=document.getElementById('cloud-password')?.value||'';
        if(!email||!password)return authError('Enter your email and password.');
        const btn=document.getElementById('cloud-auth-submit');if(btn){btn.disabled=true;btn.innerHTML='Signing in…';}
        try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await signIn(email,password);await hydrateSessionUser();const signedContext=await getContext();if(!signedContext?.profile)throw new Error('Sign in succeeded, but no club access profile is attached to this account.');context=signedContext;hideGate();window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'signin'}}));}
        catch(e){const msg=e.message||String(e);if(/confirm|verified/i.test(msg)){localStorage.setItem(VERIFY_EMAIL_KEY,email);setGateHtml('verify','Your email still needs confirming.',email);}else authError(msg);if(btn){btn.disabled=false;btn.innerHTML='Log In <span>→</span>';}}
      });return;
    }

    if(mode==='parentsignup'){
      const body=`<div class="auth-fields">${authField({icon:'user',id:'cloud-parent-name',placeholder:'Parent / guardian name',autocomplete:'name'})}${authField({icon:'mail',id:'cloud-parent-email',type:'email',placeholder:'Email address',autocomplete:'username',value:prefillEmail})}${authField({icon:'lock',id:'cloud-parent-password',type:'password',placeholder:'Create password',autocomplete:'new-password'})}<div class="auth-field"><span class="auth-field-icon">${authIcon('club')}</span><select id="cloud-parent-club"><option value="">Loading clubs…</option></select></div><div class="auth-field"><span class="auth-field-icon">${authIcon('league')}</span><select id="cloud-parent-team"><option value="">Choose a club first</option></select></div>${authField({icon:'user',id:'cloud-parent-child',placeholder:'Child / player name',autocomplete:'off'})}</div><p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-parent-signup-submit">Request Parent Access <span>→</span></button><button class="auth-link-strong" id="cloud-parent-signup-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'adult',heroNote:'One<br/>Team<br/>Together',title:'Parent Sign Up',copy:'Create your account, choose your club and team, then submit your child’s name for coach approval.',body,back:true});
      populateParentSignupChoices();
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-parent-signup-back')?.addEventListener('click',back);
      document.getElementById('cloud-parent-signup-submit')?.addEventListener('click',async()=>{
        const name=document.getElementById('cloud-parent-name')?.value?.trim()||'',email=document.getElementById('cloud-parent-email')?.value?.trim()||'',password=document.getElementById('cloud-parent-password')?.value||'',teamId=document.getElementById('cloud-parent-team')?.value||'',child=document.getElementById('cloud-parent-child')?.value?.trim()||'';
        if(name.length<2)return authError('Enter your name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');if(!teamId)return authError('Choose your club and team.');if(child.length<2)return authError('Enter your child or player name.');
        const pending={team_id:teamId,child_name:child};localStorage.setItem(PENDING_PARENT_REQUEST_KEY,JSON.stringify(pending));const btn=document.getElementById('cloud-parent-signup-submit');if(btn){btn.disabled=true;btn.innerHTML='Creating…';}
        try{const data=await signUp(email,password,name,'',{parent_signup:true,requested_team_id:teamId,requested_child_name:child});if(data?.access_token){await requestParentAccess(teamId,child);localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);context=await getContext();setGateHtml('approval','Your request has been sent to the coaching staff for verification.');return;}setGateHtml('verify','Account created. Confirm your email, then your access request will be sent to the coaching staff.',email);}catch(e){authError(e.message||String(e));if(btn){btn.disabled=false;btn.innerHTML='Request Parent Access <span>→</span>';}}
      });return;
    }

    if(mode==='playerlogin'){
      const body=`<div class="auth-fields">${authField({icon:'user',id:'cloud-player-name',placeholder:'Player Name',autocomplete:'name',extra:'autocapitalize="words" spellcheck="false"'})}${authField({icon:'code',id:'cloud-player-code',placeholder:'Player Code',autocomplete:'off',extra:'autocapitalize="characters" spellcheck="false"'})}</div>
        <div class="auth-safe-note"><span>✓</span><p>Players sign in using their name and a reusable code provided by their coach or club.</p></div>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p>
        <button class="auth-primary" id="cloud-player-submit">Enter App <span>→</span></button><button class="auth-link-strong auth-back-link" id="cloud-player-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'player',heroNote:'Same<br/>Team<br/>Brighter<br/>Tomorrow',title:'Player Access',copy:'No email required.',body,footer:'A BRIGHTER TOMORROW TOGETHER',back:true});
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-player-back')?.addEventListener('click',back);
      document.getElementById('cloud-player-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-player-name')?.value?.trim()||'',code=document.getElementById('cloud-player-code')?.value?.trim()||'';if(name.length<2||code.length<6)return authError('Enter the player name and reusable player code.');const btn=document.getElementById('cloud-player-submit');if(btn){btn.disabled=true;btn.innerHTML='Checking…';}try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await playerCodeLogin(name,code);context=await getContext();if(context?.profile?.role!=='player'||Number(context?.team?.age_group||0)!==15){clearInviteAccess();throw new Error('This Player Access code is not assigned to an eligible U15 player account.');}clubConfiguration=await getClubConfiguration().catch(()=>null);hideGate();window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'player-code'}}));}catch(e){authError(e.message||String(e));if(btn){btn.disabled=false;btn.innerHTML='Enter App <span>→</span>';}}});return;
    }

    if(mode==='clubsignup'){
      const body=`<div class="auth-fields">${authField({icon:'club',id:'cloud-club-name',placeholder:'Club Name',autocomplete:'organization'})}${authField({icon:'mail',id:'cloud-club-email',type:'email',placeholder:'Email address',autocomplete:'username'})}<div class="auth-password-wrap">${authField({icon:'lock',id:'cloud-club-password',type:'password',placeholder:'Password',autocomplete:'new-password'})}<button type="button" class="auth-eye" id="cloud-club-password-toggle" aria-label="Show or hide password">◉</button></div><div class="auth-field"><span class="auth-field-icon">${authIcon('league')}</span><select id="cloud-club-league"><option value="selkent">Selkent Football League · automatic</option><option value="manual">Other County FA / League · manual setup</option></select></div></div>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p>
        <button class="auth-primary" id="cloud-club-create">Create Club <span>→</span></button><p class="auth-inline-login">Already have an account? <button id="cloud-club-login">Log In</button></p><div class="auth-info-note"><span>${authIcon('club')}</span><p>Clubs can create an account and manage access for the whole organisation.</p></div>`;
      gate.innerHTML=authMainScreen({screen:'club',heroNote:'Stronger<br/>Clubs<br/>Stronger<br/>Communities',title:'Create Club Account',copy:'Set up your club and start inviting coaches, parents and players.',body,footer:'GRASSROOTS TODAY · BRIGHTER TOMORROWS'});
      bindPasswordToggle('cloud-club-password','cloud-club-password-toggle');document.getElementById('cloud-club-login')?.addEventListener('click',()=>setGateHtml('signin'));
      document.getElementById('cloud-club-create')?.addEventListener('click',()=>{const club=document.getElementById('cloud-club-name')?.value?.trim()||'',email=document.getElementById('cloud-club-email')?.value?.trim()||'',password=document.getElementById('cloud-club-password')?.value||'',route=document.getElementById('cloud-club-league')?.value||'manual';if(club.length<3)return authError('Enter your club name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');window.UniversalOnboarding?.open?.({club_name:club,admin_email:email,admin_password:password,setup_mode:route==='selkent'?'auto':'manual',provider_search_query:club});});return;
    }

    if(mode==='adultsetup'){
      const body=`<p class="auth-caption auth-caption-top">Use the one-time staff or parent invitation from your club to create your email/password account.</p><div class="auth-fields">${authField({icon:'user',id:'cloud-setup-name',placeholder:'Your name',autocomplete:'name'})}${authField({icon:'mail',id:'cloud-setup-email',type:'email',placeholder:'Email address',autocomplete:'username',value:prefillEmail})}${authField({icon:'lock',id:'cloud-setup-password',type:'password',placeholder:'Create password',autocomplete:'new-password'})}${authField({icon:'code',id:'cloud-setup-invite',placeholder:'Club invite code',autocomplete:'one-time-code',extra:'autocapitalize="characters" spellcheck="false"'})}</div><p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-setup-submit">Create Account <span>→</span></button><button class="auth-link-strong" id="cloud-setup-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'adult',heroNote:'Welcome<br/>To<br/>The Club',title:'Set Up Your Account',copy:'Coaches and parents use email and password after setup.',body,back:true});
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-setup-back')?.addEventListener('click',back);
      document.getElementById('cloud-setup-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-setup-name')?.value?.trim()||'',email=document.getElementById('cloud-setup-email')?.value?.trim()||'',password=document.getElementById('cloud-setup-password')?.value||'',code=document.getElementById('cloud-setup-invite')?.value?.trim()||'';if(name.length<2)return authError('Enter your name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');if(!code)return authError('Enter the invitation from your club.');const btn=document.getElementById('cloud-setup-submit');if(btn){btn.disabled=true;btn.innerHTML='Creating…';}try{localStorage.setItem(INVITE_KEY,code);const data=await signUp(email,password,name,code);if(data?.access_token){await claimInvite(code);localStorage.removeItem(INVITE_KEY);location.reload();return;}setGateHtml('verify','Account created. Confirm your email to finish applying the club invitation.',email);}catch(e){authError(e.message||String(e));if(btn){btn.disabled=false;btn.innerHTML='Create Account <span>→</span>';}}});return;
    }

    if(mode==='pinlogin'){
      const body=`<p class="auth-caption auth-caption-top">Legacy access only. New adult accounts use email and password; new players use Player Access.</p><label>Club<select id="cloud-pin-club"><option value="">Loading clubs…</option></select></label><label>Team<select id="cloud-pin-team"><option value="">Choose a club first</option></select></label>${authField({icon:'user',id:'cloud-pin-name',placeholder:'Name'})}${authField({icon:'lock',id:'cloud-pin-login',type:'password',placeholder:'6-digit PIN',inputmode:'numeric',maxlength:'6'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-pin-login-submit">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-pin-back">Back to Main Login</button><button class="auth-legacy-link" id="cloud-use-old-invite">Use an old invite code</button>`;
      gate.innerHTML=authSimple('Existing PIN Access','For accounts created before the new login system.',body,'LEGACY ACCESS');populatePinClubChoices();
      document.getElementById('cloud-pin-back')?.addEventListener('click',()=>setGateHtml('signin'));document.getElementById('cloud-use-old-invite')?.addEventListener('click',()=>setGateHtml('join'));
      document.getElementById('cloud-pin-login-submit')?.addEventListener('click',async()=>{const club=document.getElementById('cloud-pin-club')?.value?.trim()||'',team=document.getElementById('cloud-pin-team')?.value?.trim()||'',name=document.getElementById('cloud-pin-name')?.value?.trim()||'',pin=document.getElementById('cloud-pin-login')?.value||'';if(club.length<2||team.length<2||name.length<2||!/^\d{6}$/.test(pin))return authError('Choose your club and team, then enter your name and 6-digit PIN.');try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await loginWithPin(club,team,name,pin);context=await getContext();clubConfiguration=await getClubConfiguration().catch(()=>null);hideGate();window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'pin'}}));}catch(e){authError(e.message||String(e));}});return;
    }

    if(mode==='join'){
      const body=`<p class="auth-caption auth-caption-top">Legacy one-time access. New coaches and parents should use the account setup route from the main login.</p>${authField({icon:'user',id:'cloud-join-name',placeholder:'Your name'})}${authField({icon:'code',id:'cloud-join-code',placeholder:'Invite code',autocomplete:'one-time-code',extra:'autocapitalize="characters" spellcheck="false"'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-join-submit">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-admin-signin">Back to Main Login</button>`;
      gate.innerHTML=authSimple('Existing Invite Access','Use only if your club gave you an older one-time invite.',body,'LEGACY ACCESS');document.getElementById('cloud-admin-signin')?.addEventListener('click',()=>setGateHtml('signin'));
      document.getElementById('cloud-join-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-join-name')?.value?.trim()||'',code=document.getElementById('cloud-join-code')?.value?.trim()||'';if(name.length<2)return authError('Enter your name.');if(!code)return authError('Enter your invite code.');try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await joinWithInvite(name,code);context=await getContext();if(context?.profile?.role==='pending_parent'){setGateHtml('approval','Your request is waiting for coach approval.');return;}hideGate();window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'invite'}}));}catch(e){authError(e.message||String(e));}});return;
    }

    if(mode==='approval'||context?.profile?.role==='pending_parent'){
      const body=`<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-check-approval">Check Approval <span>→</span></button><button class="auth-link-strong" id="cloud-reset-device">Back to Main Login</button>`;
      gate.innerHTML=authSimple('Waiting for Approval','Your parent account is set up. Team data will appear once a coach approves access.',body,'PARENT ACCESS');
      document.getElementById('cloud-check-approval')?.addEventListener('click',async()=>{try{context=await getContext();if(context?.profile?.role==='parent')location.reload();else showNotice('Still waiting for a coach to approve access.');}catch(e){authError(e.message||String(e));}});document.getElementById('cloud-reset-device')?.addEventListener('click',()=>{clearInviteAccess();setGateHtml('signin');});return;
    }

    if(mode==='revoked'||context?.profile?.role==='revoked'){
      gate.innerHTML=authSimple('Access Removed','This account no longer has club access.',`<button class="auth-primary" id="cloud-reset-device">Return to Login <span>→</span></button>`,'ACCOUNT ACCESS');document.getElementById('cloud-reset-device')?.addEventListener('click',e=>signOut(e));return;
    }

    if(mode==='verify'){
      const email=prefillEmail||localStorage.getItem(VERIFY_EMAIL_KEY)||'';const body=`${authField({icon:'mail',id:'cloud-verify-email',type:'email',placeholder:'Email address',value:email})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-resend-btn">Resend Email <span>→</span></button><button class="auth-link-strong" id="cloud-back-signin">Back to Login</button>`;gate.innerHTML=authSimple('Check Your Inbox','Tap the confirmation link in the email. It will return you to the app.',body,'VERIFY EMAIL');document.getElementById('cloud-resend-btn')?.addEventListener('click',async()=>{const addr=document.getElementById('cloud-verify-email')?.value?.trim();if(!addr)return authError('Enter your email address.');try{await resendSignup(addr);showNotice('Confirmation email sent.');}catch(e){authError(e.message||String(e));}});document.getElementById('cloud-back-signin')?.addEventListener('click',()=>setGateHtml('signin'));return;
    }

    if(mode==='forgot'){
      const body=`${authField({icon:'mail',id:'cloud-recover-email',type:'email',placeholder:'Email address',value:prefillEmail})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-recover-submit">Send Reset Email <span>→</span></button><button class="auth-link-strong" id="cloud-back-signin">Back to Login</button>`;gate.innerHTML=authSimple('Reset Password','We’ll send a secure password reset link to your email address.',body,'ACCOUNT RECOVERY');document.getElementById('cloud-recover-submit')?.addEventListener('click',async()=>{const email=document.getElementById('cloud-recover-email')?.value?.trim()||'';if(!email)return authError('Enter your email address.');try{await sendPasswordReset(email);showNotice('Password reset email sent. Open the link on this device.');}catch(e){authError(e.message||String(e));}});document.getElementById('cloud-back-signin')?.addEventListener('click',()=>setGateHtml('signin'));return;
    }

    if(mode==='newpassword'||mode==='pinsetup'||mode==='preapproval-pin'||mode==='resume'){
      if(mode==='newpassword'){
        const body=`${authField({icon:'lock',id:'cloud-new-password',type:'password',placeholder:'New password',autocomplete:'new-password'})}${authField({icon:'lock',id:'cloud-new-password2',type:'password',placeholder:'Repeat new password',autocomplete:'new-password'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error"></p><button class="auth-primary" id="cloud-password-save">Save Password <span>→</span></button>`;gate.innerHTML=authSimple('Choose New Password','Use at least 8 characters.',body,'ACCOUNT RECOVERY');document.getElementById('cloud-password-save')?.addEventListener('click',async()=>{const a=document.getElementById('cloud-new-password')?.value||'',b=document.getElementById('cloud-new-password2')?.value||'';if(a.length<8)return authError('Use at least 8 characters.');if(a!==b)return authError('The passwords do not match.');try{await updatePassword(a);location.reload();}catch(e){authError(e.message||String(e));}});return;
      }
      gate.innerHTML=authSimple('Legacy Access','This account uses the previous PIN/access method.',`<p class="auth-notice">${escapeHtml(message||'Continue using the existing access method or return to the main login.')}</p><button class="auth-primary" id="cloud-legacy-continue">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-legacy-main">Main Login</button>`,'LEGACY ACCESS');document.getElementById('cloud-legacy-continue')?.addEventListener('click',()=>setGateHtml('pinlogin'));document.getElementById('cloud-legacy-main')?.addEventListener('click',()=>setGateHtml('signin'));return;
    }

    setGateHtml('signin',message,prefillEmail);
  }
  function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function authError(msg){const el=document.getElementById('cloud-auth-error');if(el){el.textContent=msg;el.classList.remove('hidden');}const notice=document.getElementById('cloud-auth-notice');if(notice)notice.classList.add('hidden');}
  function showNotice(msg){const el=document.getElementById('cloud-auth-notice');if(el){el.textContent=msg;el.classList.remove('hidden');}const err=document.getElementById('cloud-auth-error');if(err)err.classList.add('hidden');}
  function hideGate(){document.getElementById('activation-gate')?.classList.add('hidden');document.body.classList.remove('auth-open');document.querySelector('.app-shell')?.classList.remove('account-locked');}
  async function signOut(event){
    try{event?.preventDefault?.();event?.stopPropagation?.();}catch{}
    const btn=event?.currentTarget instanceof HTMLElement?event.currentTarget:null;
    if(btn){btn.setAttribute('disabled','disabled');btn.textContent='Signing out…';}

    // Stop any account-specific work before clearing the active session.
    clearTimeout(saveTimer);saveTimer=null;pendingState=null;saving=false;
    clearInterval(pollTimer);pollTimer=null;
    try{if(window.__clubInboxTimer){clearInterval(window.__clubInboxTimer);window.__clubInboxTimer=null;}}catch{}
    try{if(window.__adminBackgroundTimer){clearInterval(window.__adminBackgroundTimer);window.__adminBackgroundTimer=null;}}catch{}
    try{if(window.__fixtureScanTimer){clearInterval(window.__fixtureScanTimer);window.__fixtureScanTimer=null;}}catch{}

    // Revoke the Supabase refresh session when possible. Local logout must still
    // complete if the device is offline or the server request fails.
    const accessToken=session?.access_token||'';
    if(accessToken){
      try{
        await fetch(base()+'/auth/v1/logout',{method:'POST',headers:authHeaders(accessToken)});
      }catch{}
    }

    localStorage.removeItem(TEST_MODE_KEY);
    clearInviteAccess();
    localStorage.removeItem(VERIFY_EMAIL_KEY);
    clearAccountLocalData();
    context=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';

    // Lock the existing app immediately so no team data remains visible while
    // the clean reload is being prepared.
    try{document.querySelectorAll('dialog[open]').forEach(d=>d.close());}catch{}
    setGateHtml('signin');
    window.dispatchEvent(new CustomEvent('clubhub-signed-out'));

    // Reload without any auth callback/query fragments so bootstrap cannot
    // restore the session we just cleared.
    setTimeout(()=>{
      try{
        const clean=location.href.split('#')[0].split('?')[0];
        location.replace(clean);
      }catch{location.reload();}
    },120);
  }

  function updateCloudPanel(){
    const panel=document.getElementById('access-panel');if(!panel||!configured()||!context)return;
    if(testModeActive()){
      panel.classList.add('cloud-access-panel');
      const summary=document.getElementById('access-summary');if(summary)summary.textContent='Test Coach · U9 Green · local debug session';
      let controls=document.getElementById('cloud-account-controls');if(!controls){controls=document.createElement('div');controls.id='cloud-account-controls';controls.className='cloud-account-controls';panel.querySelector('.settings-accordion-body')?.appendChild(controls)||panel.appendChild(controls);}
      controls.innerHTML='<div class="cloud-account-row"><span><strong>TEST MODE</strong><small>Cloud writes disabled</small></span><button class="text-button" id="cloud-exit-test" type="button">Exit test mode</button></div>';
      document.getElementById('cloud-exit-test')?.addEventListener('click',e=>signOut(e));document.body.classList.add('cloud-enabled');return;
    }
    panel.classList.add('cloud-access-panel');
    const profile=context.profile||{};const t=currentTeam();const inviteAccess=profile.access_method==='invite'||session?.user?.user_metadata?.invite_access;
    const summary=document.getElementById('access-summary');
    const label=role()==='admin'?'Club Admin':role()==='assistant_coach'?'Assistant Coach':role()==='coach'?'Coach':role()==='player'?'Player':'Parent';
    if(summary)summary.textContent=`${profile.full_name||'Account'} · ${label}${t?' · '+t.ageGroup+' '+t.teamName:''}`;
    let controls=document.getElementById('cloud-account-controls');
    if(!controls){controls=document.createElement('div');controls.id='cloud-account-controls';controls.className='cloud-account-controls';panel.querySelector('.settings-accordion-body')?.appendChild(controls)||panel.appendChild(controls);}
    controls.innerHTML=`<div class="cloud-account-row"><span><strong>${escapeHtml(inviteAccess?(profile.full_name||'Invite access'):(session?.user?.email||profile.full_name||''))}</strong></span><div class="cloud-account-actions">${inviteAccess?'':`<button class="secondary-button compact" id="cloud-change-password">Change password</button>`}<button class="text-button" id="cloud-signout-settings" type="button">Sign out</button></div></div>`;
    document.getElementById('cloud-change-password')?.addEventListener('click',()=>setGateHtml('newpassword'));
    document.getElementById('cloud-signout-settings')?.addEventListener('click',e=>signOut(e));
    document.body.classList.add('cloud-enabled');
  }

  async function bootstrap(options={}){
    hooks=options||{};
    if(!configured()){document.body.classList.add('cloud-not-configured');return {configured:false};}
    document.body.classList.add('cloud-enabled');
    if(!testModeActive()){document.body.classList.remove('debug-test-mode');document.getElementById('test-mode-banner')?.remove();}
    if(testModeActive()){
      clubConfiguration=await getClubConfiguration().catch(()=>TEST_CLUB_CONFIG);const teams=Array.isArray(clubConfiguration?.teams)&&clubConfiguration.teams.length?clubConfiguration.teams:[TEST_TEAM];
      const picked=teams.find(t=>Number(t.age_group)===9)||teams[0]||TEST_TEAM;
      context={profile:{user_id:'debug-user',club_id:clubConfiguration?.club?.id||picked.club_id||'debug-club',team_id:picked.id,full_name:'Test Coach',role:'coach',access_method:'debug'},team:picked,club:clubConfiguration?.club||{id:'debug-club',name:clubConfiguration?.settings?.display_name||'Demo Club'}};
      visibleTeams=teams;activeTeam=picked;activeRevision=-1;
      hideGate();document.body.classList.add('debug-test-mode');
      if(!document.getElementById('test-mode-banner')){const b=document.createElement('div');b.id='test-mode-banner';b.className='test-mode-banner';b.textContent='UNIVERSAL TEST MODE · '+(clubConfiguration?.settings?.display_name||'Demo club')+' · cloud writes disabled';document.body.prepend(b);}
      return {configured:true,role:'coach',profile:context.profile,club:context.club,configuration:clubConfiguration,team:oldShapeTeam(picked),teams:visibleTeamList(),email:''};
    }
    if(INITIAL_AUTH_CALLBACK&&!initialAuthCallbackHandled){initialAuthCallbackHandled=true;const callbackType=await handleAuthCallback(INITIAL_AUTH_CALLBACK,{duringBootstrap:true});if(['recovery','parentrequest','error'].includes(callbackType))return null;}
    const valid=await ensureFreshSession();
    if(!valid){clearAccountLocalData();setGateHtml('signin');return null;}
    const pendingAdultInvite=localStorage.getItem(INVITE_KEY)||'';
    if(pendingAdultInvite){
      try{await claimInvite(pendingAdultInvite);localStorage.removeItem(INVITE_KEY);}catch(e){setGateHtml('adultsetup','Your email account is signed in, but the invitation could not be applied. Check the invite code and try again.');return null;}
    }
    const teamCache=cachedTeams();
    let teamFetch=null;
    try{
      teamFetch=listTeams().catch(()=>teamCache);
      context=await getContext();
    }catch(e){saveSession(null);clearAccountLocalData();setGateHtml('signin','Your saved access expired. Sign in again.');return null;}
    if(!context?.profile){saveSession(null);clearAccountLocalData();setGateHtml('signin','No club access profile is attached to this account.');return null;}
    if(context.profile.role==='pending'){
      const pm=session?.user?.user_metadata||{},teamId=String(pm.requested_team_id||''),child=String(pm.requested_child_name||'').trim();
      if(pm.parent_signup&&teamId&&child){try{await requestParentAccess(teamId,child);context=await getContext();localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);}catch(e){setGateHtml('signin','Your account is verified, but the parent access request could not be submitted. '+(e.message||''));return null;}}
    }
    try{clubConfiguration=await getClubConfiguration();}catch{clubConfiguration=null;}
    if(context.profile.role==='pending_parent'){
      setGateHtml('approval','Your parent account is ready. Waiting for coach approval.');return null;
    }
    if(context.profile.role==='player'&&context.profile.access_method!=='player_code'&&!context.profile.pin_set_at){setGateHtml('pinsetup','This is a legacy player account. Create a 6-digit PIN to continue.');return null;}
    if(context.profile.role==='revoked'){clearAccountLocalData();setGateHtml('revoked');return null;}
    if(context.profile.role==='pending'){setGateHtml('adultsetup','This account has not been attached to a club yet. Enter the invitation supplied by your club.');return null;}
    if(teamCache.length){visibleTeams=teamCache;teamFetch?.then(rows=>{if(Array.isArray(rows)&&rows.length){visibleTeams=rows;}}).catch(()=>{});}else visibleTeams=await teamFetch;
    activeTeam=chooseActiveTeam(options.localState||null);
    if(!activeTeam){setGateHtml('join','No team is available to this account.');return null;}
    if(inviteAccessActive() && inviteAccessLocked()){setGateHtml('resume');return null;}
    hideGate();updateCloudPanel();
    return {configured:true,role:role(),profile:context.profile,club:context.club,configuration:clubConfiguration,team:oldShapeTeam(activeTeam),teams:visibleTeamList(),email:session?.user?.email||''};
  }

  async function loadInitialState(localState,seedFactory){
    if(testModeActive()){const seed=seedFactory?seedFactory(oldShapeTeam(activeTeam)):localState;return {state:seed,fromCloud:false,testMode:true};}
    if(!configured()||!activeTeam)return {state:localState,fromCloud:false};
    const activeAge=Number(activeTeam?.age_group||0);
    const sensitiveMini=activeAge>=7&&activeAge<=11;
    if(sensitiveMini)localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+activeTeam.id);
    const cached=sensitiveMini?null:cachedTeamState(activeTeam.id);
    if(cached?.state){
      activeRevision=Number(cached.revision??0);lastRemoteUpdatedAt=cached.updated_at||'';
      const cachedRevision=activeRevision;
      fetchTeamState(activeTeam.id).then(row=>{if(row?.state&&Number(row.revision)!==cachedRevision&&hooks.onRemoteState)hooks.onRemoteState(row.state,{reason:'background-refresh'});}).catch(()=>{});
      return {state:cached.state,fromCloud:true,cached:true,revision:activeRevision};
    }
    const row=await fetchTeamState(activeTeam.id);
    if(row?.state)return {state:row.state,fromCloud:true,revision:activeRevision};
    if(canEdit()){
      const seed=seedFactory?seedFactory(oldShapeTeam(activeTeam)):localState;
      activeRevision=-1;
      await saveTeamStateNow(seed);
      return {state:seed,fromCloud:false,created:true,revision:activeRevision};
    }
    return {state:localState,fromCloud:false};
  }
  function startPolling(){
    if(!configured()||!activeTeam)return;
    clearInterval(pollTimer);
    pollTimer=setInterval(()=>{if(document.visibilityState==='visible')pullLatest({quiet:true});},Math.max(15000,Number(cfg.syncIntervalMs||30000)));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullLatest({quiet:true});});
  }

  window.ClubHubCloud={
    configured,bootstrap,loadInitialState,queueStateSave,pullLatest,startPolling,
    role,canEdit,canAdmin,assignedTeam,currentTeam,coachTeam,hasDualCoachAccess,visibleTeamList,getClubConfiguration,listLoginClubs,listLoginTeams,createInvite,requestParentAccess,listPendingParentRequests,listTeamMembers,listClubCoaches,listClubAccessAccounts,removeClubCoach,listPublishedClubResults,listParentPlayerLinks,saveParentPlayerLinks,listPlayerAccountLinks,listMatchAvailability,saveMatchAvailability,listSelkentTeamDirectory,syncSelkentTeamDirectory,getCoachMatchNote,saveCoachMatchNote,listAnnouncements,createAnnouncement,markAnnouncementRead,deleteAnnouncement,listMatchAttendance,saveMatchAttendance,getAvailabilitySettings,setAvailabilityDeadline,sendAvailabilityReminder,listNotifications,markNotificationRead,notifyFixtureChange,notifySelectedSquad,notifyMatchReport,notifyMatchReopened,listPlayerAppearanceStats,recordAuditEvent,listAuditHistory,listSeasonArchives,getSeasonArchive,archiveCurrentSeason,rolloverClubSeason,resetParentPin,setAccessPin,approveParent,removeTeamMember,syncTeamDirectory,switchAdminTeam,getClubOverview,signOut,handleAuthCallback,listMessageContacts,listClubMessages,sendClubMessage,markClubMessagesRead,getClubComplianceStatus,setDisputeReviewers,setClubSafeguardingContacts,getConcernRouting,raiseClubConcern,listGeneralDisputes,listDisputeMessages,upsertU11SafeguardingInfo,exportU11SafeguardingPack,listSafeguardingExportAudit,requestClubCancellation,cancelClubCancellation,
    updateCloudPanel,
    get context(){return context;},get configuration(){return clubConfiguration;},get session(){return session;},get revision(){return activeRevision;},get testMode(){return testModeActive();}
  };
})();

// v2.0.19: reliable Android custom-scheme recovery callback and verified Club Admin sign-in handoff.
// v2.0.20: Club Admin oversight workflow and secure Admin ↔ Coach inbox API.
// v2.0.21: in-process login handoff, Assistant Coach role, all-role inbox and background-only sync UI.

// v2.0.25: club-wide access management RPC.

// v2.0.27: approved-parent PIN access, RSVP and secure coaching notes.
// v2.0.28: parent-player linking, RSVP-driven squad readiness, fixture change details and matchday dashboard.

// v2.0.30: club announcements, match attendance, grouped admin health and pre-approval parent PIN choice.
// v2.0.31: U15 player access, shared availability, Selkent opponent directory, notifications-only communication and appearance themes.
// v2.0.32: weekly-cycle deadlines, notifications, appearance stats, calendar handoff and debug quick-login.

// v2.0.33: U15-only player app access guard.
// v2.0.34: season archive/rollover, audit history and tournament mode.

// Universal Core v1: multi-club configuration, provider abstraction and club-aware PIN login.

// v2.2.4: approved mock-up exact UI acceptance target encoded in auth DOM/CSS.
