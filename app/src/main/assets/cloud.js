(function(){
  'use strict';

  const cfg = window.CLUB_HUB_CLOUD || {};
  const SESSION_KEY = 'grassroots_hub_cloud_session_v1';
  const INVITE_KEY = 'grassroots_hub_pending_invite_v1';
  const ACTIVE_TEAM_KEY = 'grassroots_hub_admin_active_team_v1';
  const VERIFY_EMAIL_KEY = 'grassroots_hub_verify_email_v1';
  const PARENT_SIGNIN_AFTER_LOGOUT_KEY = 'pitchkind_parent_signin_after_logout_v1';
  const TEAM_DIRECTORY_CACHE_KEY = 'grassroots_hub_team_directory_cache_v1';
  const TEAM_STATE_CACHE_PREFIX = 'grassroots_hub_team_state_cache_v1_';
  const INVITE_LOCK_KEY = 'grassroots_hub_invite_lock_v1';
  const PENDING_PARENT_PIN_KEY = 'grassroots_hub_pending_parent_pin_v1';
  const PENDING_PARENT_REQUEST_KEY = 'pitchkind_pending_parent_request_v1';
  const TEST_MODE_KEY = 'grassroots_hub_debug_test_mode_v1';
  const TEST_CLUB_KEY = 'grassroots_hub_debug_club_v1';
  const LOGIN_CLUB_KEY = 'grassroots_hub_login_club_v1';
  const APP_STATE_STORAGE_KEY = 'grassrootsHub_team_state_v1';
  const AUTH_REDIRECT = location.protocol==='file:'?'grassrootsclubhub://auth-callback':location.origin+'/';
  const AUTH_DESIGN_REVISION = 'approved-app-ui-2026-09-21-v1.4-pitchkind+figma-login-2026-10-13';
  const INITIAL_AUTH_CALLBACK = new URLSearchParams(location.search).get('auth_callback') ||
    (/^(?:#)(?:.*&)?(?:access_token|error|error_code)=/.test(location.hash)?location.href:'');
  let initialAuthCallbackHandled = false;
  let session = null;
  let sessionRefresh = null;
  let context = null;
  let clubConfiguration = null;
  let visibleTeams = [];
  let activeTeam = null;
  let activeRevision = -1;
  let lastRemoteUpdatedAt = '';
  let saveTimer = null;
  let saving = false;
  let pendingState = null;
  let unsyncedState = false;
  let confirmingState = false;
  let pollTimer = null;
  let hooks = {};
  let accountGeneration=0,teamReadGeneration=0,authAttempt=0,readyBootstrap=null,accountReady=false,pendingBootstrapContext=null,suspendedDraft=null,activeSaveDraft=null,verifiedAccountUser='',authAttemptOwner='';
  const accountRequests=new Set();
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
    const previous=session?.user?.id||loadSession()?.user?.id||verifiedAccountUser||context?.profile?.user_id||'',next=s?.user?.id||'';
    if(next&&previous!==next){clearAccountLocalData();context=null;clubConfiguration=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';}
    session=s||null;if(next){verifiedAccountUser=next;authAttemptOwner=next;}
    if(session) localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  function loadSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
  }
  function cachedTeams(){try{const x=JSON.parse(localStorage.getItem(TEAM_DIRECTORY_CACHE_KEY)||'null');return Array.isArray(x?.rows)?x.rows:[];}catch{return [];}}
  function cacheTeams(rows){try{localStorage.setItem(TEAM_DIRECTORY_CACHE_KEY,JSON.stringify({savedAt:Date.now(),rows:Array.isArray(rows)?rows:[]}));}catch{}}
  function teamCacheOwner(){return [session?.user?.id||'',context?.profile?.club_id||'',role(),actingAsParent()?'parent':'staff'].join('|');}
  function mayCacheTeamState(teamId){const age=Number((visibleTeams.find(t=>t.id===teamId)||activeTeam)?.age_group||0);return !!session?.user?.id&&['admin','coach','assistant_coach'].includes(role())&&!actingAsParent()&&age>=12;}
  function cachedTeamState(teamId){try{const x=JSON.parse(localStorage.getItem(TEAM_STATE_CACHE_PREFIX+teamId)||'null');if(mayCacheTeamState(teamId)&&x?.owner===teamCacheOwner()&&x.state)return x;localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+teamId);}catch{}return null;}
  function cacheTeamState(teamId,row){if(!teamId||!row?.state)return;try{if(!mayCacheTeamState(teamId)){localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+teamId);return;}localStorage.setItem(TEAM_STATE_CACHE_PREFIX+teamId,JSON.stringify({owner:teamCacheOwner(),state:row.state,revision:Number(row.revision??0),updated_at:row.updated_at||'',savedAt:Date.now()}));}catch{}}
  function accountContextChanged(){const error=new Error('The account or team changed. Sign in again or reopen the correct team.');error.code='AUTH_CONTEXT_CHANGED';return error;}
  function lockGate(){try{document.querySelectorAll?.('dialog[open]').forEach(d=>d.close());}catch{}document.getElementById('activation-gate')?.classList.remove('hidden');document.body?.classList.add('auth-open');document.querySelector?.('.app-shell')?.classList.add('account-locked');}
  function stopAccountBackgroundWork(){clearTimeout(saveTimer);saveTimer=null;clearInterval(pollTimer);pollTimer=null;for(const key of ['__clubInboxTimer','__clubNoticeTimer','__adminBackgroundTimer','__fixtureScanTimer']){try{if(window[key]){clearInterval(window[key]);window[key]=null;}}catch{}}}
  function draftOwner(scope){return [scope.uid,scope.club,scope.team?.id||'',scope.role,scope.parent?'parent':'staff'].join('|');}
  function invalidateAccountWork({discardDrafts=false}={}){
    if(!discardDrafts&&(pendingState||activeSaveDraft?.state)&&session?.user?.id&&activeTeam){const scope=captureTeamStateScope();suspendedDraft={owner:draftOwner(scope),state:JSON.parse(JSON.stringify(pendingState||activeSaveDraft.state)),revision:activeRevision,resume:!!pendingState&&!saving&&!confirmingState&&!currentMatchActionBarrier()};}
    ++accountGeneration;++teamReadGeneration;readyBootstrap=null;pendingBootstrapContext=null;accountReady=false;sessionRefresh=null;stopAccountBackgroundWork();for(const cancel of [...accountRequests])cancel();saving=false;confirmingState=false;activeSaveDraft=null;pendingState=null;
    if(discardDrafts){suspendedDraft=null;unsyncedState=false;}
  }
  async function awaitAccountWork(work,scope){let cancel;const cancelled=new Promise((_,reject)=>{cancel=()=>reject(accountContextChanged());accountRequests.add(cancel);});try{const value=await Promise.race([work,cancelled]);if(scope.generation!==accountGeneration||scope.attempt!==authAttempt)throw accountContextChanged();return value;}finally{accountRequests.delete(cancel);}}
  async function awaitAuthWork(work,attempt){try{const value=await awaitAccountWork(work,{generation:accountGeneration,attempt});assertAuthAttempt(attempt);return value;}catch(error){assertAuthAttempt(attempt);throw error;}}
  function beginAuthAttempt(){++authAttempt;authAttemptOwner=String(loadSession()?.user?.id||'');invalidateAccountWork();lockGate();return authAttempt;}
  function assertAuthAttempt(attempt){if(attempt!==authAttempt||String(loadSession()?.user?.id||'')!==authAttemptOwner)throw accountContextChanged();}
  function captureAccountRequest(){return {generation:accountGeneration,attempt:authAttempt,uid:session?.user?.id||loadSession()?.user?.id||''};}
  function assertAccountRequest(scope,{unloaded=false}={}){if(scope.generation!==accountGeneration||scope.attempt!==authAttempt||String(loadSession()?.user?.id||'')!==scope.uid||(!unloaded&&String(session?.user?.id||'')!==scope.uid))throw accountContextChanged();}
  function captureTeamStateScope(){return {...captureAccountRequest(),context,team:activeTeam,teamGeneration:teamReadGeneration,club:String(context?.profile?.club_id||''),role:role(),parent:actingAsParent(),mutation:window.matchActionMutationEpoch?.()||0};}
  function assertTeamStateScope(scope,{passive=false}={}){assertAccountRequest(scope);if(scope.context!==context||scope.team!==activeTeam||scope.teamGeneration!==teamReadGeneration||scope.club!==String(context?.profile?.club_id||'')||scope.role!==role()||scope.parent!==actingAsParent()||(passive&&(scope.mutation!==(window.matchActionMutationEpoch?.()||0)||currentMatchActionBarrier()||saving||pendingState||confirmingState||unsyncedState)))throw accountContextChanged();}
  function acceptTeamStateRead(row,scope,{reason='',passive=false}={}){assertTeamStateScope(scope,{passive});activeRevision=row?Number(row.revision||0):-1;lastRemoteUpdatedAt=row?.updated_at||'';if(row?.state)cacheTeamState(activeTeam?.id,row);if(reason&&row?.state&&hooks.onRemoteState)hooks.onRemoteState(row.state,{reason});return row;}
  function clearAccountLocalData({preserveUser=''}={}){
    invalidateAccountWork({discardDrafts:true});verifiedAccountUser='';
    context=null;clubConfiguration=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';
    window.dispatchEvent(new Event('clubhub-contacts-clear'));
    window.dispatchEvent(new Event('clubhub-account-cleared'));
    try{
      localStorage.removeItem(APP_STATE_STORAGE_KEY);
      localStorage.removeItem('grassrootsHub_account_v1');
      localStorage.removeItem('grassrootsHub_role_v1');
      localStorage.removeItem(ACTIVE_TEAM_KEY);
      localStorage.removeItem(TEAM_DIRECTORY_CACHE_KEY);
      Object.keys(localStorage).forEach(k=>{
        if(k.startsWith(TEAM_STATE_CACHE_PREFIX)){let owner='';try{owner=JSON.parse(localStorage.getItem(k)||'null')?.owner?.split('|')[0]||'';}catch{}if(!preserveUser||owner!==preserveUser)localStorage.removeItem(k);}
        if(k.startsWith('grassrootsHub_tournament_action_v1:')){
          try{
            const intent=JSON.parse(localStorage.getItem(k)||'null'),validIds=ids=>Array.isArray(ids)&&ids.every(id=>typeof id==='string'&&id.length>0&&id.length<=200)&&new Set(ids).size===ids.length;
            if(preserveUser&&intent?.scope?.split('|')[0]===preserveUser&&intent.version===1&&k==='grassrootsHub_tournament_action_v1:'+encodeURIComponent(intent.scope)&&['save','delete'].includes(intent.action)&&typeof intent.tournamentId==='string'&&intent.tournamentId.length>0&&intent.tournamentId.length<=200&&validIds(intent.gameIds)&&validIds(intent.attendanceCleared)&&validIds(intent.noteCleared)&&typeof intent.stateConfirmed==='boolean'&&[...intent.attendanceCleared,...intent.noteCleared].every(id=>intent.gameIds.includes(id))&&(intent.action==='delete'||(intent.candidate?.id===intent.tournamentId&&(!intent.baseline||intent.baseline.id===intent.tournamentId))))return;
            const keys=['version','scope','action','tournamentId','gameIds','stateConfirmed','attendanceCleared','noteCleared','attempted'];
            const minimal=intent?.version===1&&intent.action==='delete'&&typeof intent.scope==='string'&&!!intent.scope&&
              k==='grassrootsHub_tournament_action_v1:'+encodeURIComponent(intent.scope)&&typeof intent.tournamentId==='string'&&intent.tournamentId.length>0&&intent.tournamentId.length<=200&&
              typeof intent.stateConfirmed==='boolean'&&(intent.attempted===undefined||typeof intent.attempted==='boolean')&&Object.keys(intent).every(key=>keys.includes(key))&&
              validIds(intent.gameIds)&&validIds(intent.attendanceCleared)&&validIds(intent.noteCleared)&&[...intent.attendanceCleared,...intent.noteCleared].every(id=>intent.gameIds.includes(id));
            if(!minimal)localStorage.removeItem(k);
          }
          catch{localStorage.removeItem(k);}
        }
      });
    }catch{}
  }
  function authHeaders(accessToken){
    const h={'apikey':cfg.anonKey,'Content-Type':'application/json'};
    if(accessToken)h['Authorization']='Bearer '+accessToken;
    return h;
  }
  async function request(path,{method='GET',body=null,token=true,headers={},signal}={}){
    const scope=token?captureAccountRequest():null,controller=token&&typeof AbortController==='function'?new AbortController():null;
    let cancel;
    const cancelled=token?new Promise((_,reject)=>{cancel=()=>{controller?.abort();reject(accountContextChanged());};accountRequests.add(cancel);}):null;
    const check=()=>{if(scope)assertAccountRequest(scope);};
    try{
      const work=(async()=>{
        if(scope)assertAccountRequest(scope,{unloaded:true});
        if(token&&!await ensureFreshSession())throw new Error('Your session has expired. Sign in again before saving; your edits remain on this page.');
        check();
        const send=async()=>{
          check();const usedToken=token?session?.access_token:null;
          const res=await fetch(base()+path,{method,headers:{...authHeaders(usedToken),...headers},body:body==null?undefined:JSON.stringify(body),...((signal||controller?.signal)?{signal:signal||controller.signal}:{})});check();
          const text=await res.text();check();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
          return {res,text,data,usedToken};
        };
        let {res,text,data,usedToken}=await send();check();
        if(token&&res.status===401&&/(?:jwt|token).{0,30}expir|expir.{0,30}(?:jwt|token)/i.test(String(data?.message||data?.msg||data?.error_description||text||''))){
          const latest=loadSession();check();
          if(latest?.access_token&&latest.access_token!==usedToken)session=latest;
          else if(!await refreshSession())throw new Error('Your session has expired. Sign in again before saving; your edits remain on this page.');
          check();({res,text,data}=await send());
        }
        check();
        if(!res.ok){const msg=(data&&typeof data==='object'&&(data.msg||data.message||data.error_description||data.hint||data.details||data.error))||text||('HTTP '+res.status);const err=new Error(msg);err.status=res.status;err.data=data;throw err;}
        return {data,headers:res.headers,status:res.status};
      })();
      return await (cancelled?Promise.race([work,cancelled]):work);
    }finally{if(cancel)accountRequests.delete(cancel);}
  }
  async function refreshSession(){
    if(sessionRefresh)return sessionRefresh;
    if(!session?.refresh_token)return false;
    const refreshToken=session.refresh_token,refreshUser=session?.user?.id;
    const running=(async()=>{
      try{
        const res=await fetch(base()+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:authHeaders(),body:JSON.stringify({refresh_token:refreshToken})});
        const data=await res.json();
        // A response for an older login must not replace or clear a newer one.
        const latest=loadSession();
        if(latest?.refresh_token!==refreshToken||latest?.user?.id!==refreshUser){session=latest;return !!latest?.access_token;}
        if(!res.ok||!data.access_token){if(res.status===400||res.status===401)saveSession(null);return false;}
        data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
        saveSession(data);return true;
      }catch{return false;}
    })();
    sessionRefresh=running;
    try{return await running;}finally{if(sessionRefresh===running)sessionRefresh=null;}
  }
  async function ensureFreshSession(){
    if(sessionRefresh)return await sessionRefresh;
    session=loadSession();
    if(!session?.access_token)return false;
    const exp=Number(session.expires_at||0);
    if(!exp||exp < Math.floor(Date.now()/1000)+90)return await refreshSession();
    return true;
  }
  async function signIn(email,password){
    const attempt=beginAuthAttempt();
    const normalizedEmail=String(email||'').trim().toLowerCase();
    let res;
    try{
      res=await awaitAuthWork(fetch(base()+'/auth/v1/token?grant_type=password',{method:'POST',headers:authHeaders(),body:JSON.stringify({email:normalizedEmail,password:String(password||'')})}),attempt);
    }catch(e){
      assertAuthAttempt(attempt);throw new Error('Could not reach the sign-in service. Check your internet connection and try again.');
    }
    assertAuthAttempt(attempt);const text=await awaitAuthWork(res.text(),attempt);
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
    const attempt=beginAuthAttempt();
    const url=base()+'/auth/v1/signup?redirect_to='+encodeURIComponent(AUTH_REDIRECT);
    const res=await awaitAuthWork(fetch(url,{method:'POST',headers:authHeaders(),body:JSON.stringify({email,password,data:{full_name:fullName||'',...(metadata||{})}})}),attempt);
    assertAuthAttempt(attempt);const data=await awaitAuthWork(res.json(),attempt);assertAuthAttempt(attempt);
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
    const attempt=beginAuthAttempt();
    const res=await awaitAuthWork(fetch(base()+'/functions/v1/join-team',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({name:String(name||'').trim(),invite_code:String(inviteCode||'').trim()})}),attempt);
    const data=await awaitAuthWork(res.json(),attempt).catch(()=>({}));
    assertAuthAttempt(attempt);if(!res.ok||!data?.session?.access_token)throw new Error(data?.error||data?.message||'Could not join the team');
    const next=data.session;
    if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);
    saveSession(next);
    return data;
  }

  async function playerAccessRequest(action,payload={},useSession=false,attempt=null){
    if(useSession){const {data}=await request('/functions/v1/player-access',{method:'POST',body:{action,...payload}});if(data?.error)throw new Error(data.error);return data;}
    const headers={'apikey':cfg.anonKey,'Content-Type':'application/json'};
    let res;
    try{
      res=await awaitAuthWork(fetch(base()+'/functions/v1/player-access',{method:'POST',headers,body:JSON.stringify({action,...payload})}),attempt);
    }catch(error){
      if(attempt!==null)assertAuthAttempt(attempt);throw new Error('Could not reach Player Access. Check your internet connection and try again.');
    }
    const text=await awaitAuthWork(res.text(),attempt);let data={};try{data=text?JSON.parse(text):{};}catch{data={error:text};}
    if(!res.ok||data?.error)throw new Error(data?.error||data?.message||'Player Access is unavailable.');
    return data;
  }
  async function playerCodeLogin(name,code){
    const attempt=beginAuthAttempt();
    const data=await playerAccessRequest('login',{name:String(name||'').trim(),code:String(code||'').trim().toUpperCase()},false,attempt);
    assertAuthAttempt(attempt);if(!data?.session?.access_token)throw new Error('Player Access did not return a sign-in session.');
    const next={...data.session};if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);saveSession(next);return data;
  }
  async function issuePlayerAccessCode(teamId,playerName){
    if(!session?.access_token)throw new Error('Sign in first.');
    return await playerAccessRequest('issue',{team_id:String(teamId||''),player_name:String(playerName||'').trim()},true);
  }

  async function loginWithPin(club,team,name,pin){
    const attempt=beginAuthAttempt();
    const res=await awaitAuthWork(fetch(base()+'/functions/v1/pin-login',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({club:String(club||'').trim(),team:String(team||'').trim(),name:String(name||'').trim(),pin:String(pin||'').trim()})}),attempt);
    const data=await awaitAuthWork(res.json(),attempt).catch(()=>({}));
    assertAuthAttempt(attempt);if(!res.ok||!data?.session?.access_token)throw new Error(data?.error||data?.message||'Could not sign in with PIN');
    const next=data.session;if(!next.expires_at)next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);saveSession(next);return data;
  }
  async function pinAdmin(action,payload={}){
    const {data}=await request('/functions/v1/pin-admin',{method:'POST',body:{action,...payload}});return data;
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
    }catch(error){if(error?.code==='AUTH_CONTEXT_CHANGED')throw error;}
  }
  async function handleAuthCallback(uri,{duringBootstrap=false}={}){
    if(!uri)return null;
    const attempt=beginAuthAttempt();setGateHtml('signin');const checking=document.getElementById('cloud-auth-submit');if(checking){checking.disabled=true;checking.textContent='Signing in…';}
    try{
      const u=new URL(uri),hash=new URLSearchParams((u.hash||'').replace(/^#/,'')),query=u.searchParams;
      const get=k=>hash.get(k)||query.get(k)||'';
      const clean=new URL(location.href);for(const key of ['auth_callback','access_token','refresh_token','expires_in','expires_at','token_type','type','error','error_code','error_description'])clean.searchParams.delete(key);if(/(?:access_token|refresh_token|error|type)=/.test(clean.hash))clean.hash='';history.replaceState(null,'',clean.pathname+clean.search+clean.hash);
      const error=get('error_description')||get('error'),errorCode=get('error_code');
      if(error){setGateHtml('signin',error.replace(/\+/g,' ')+(errorCode?' ('+errorCode+')':''));return 'error';}
      const accessToken=get('access_token'),refreshToken=get('refresh_token'),type=get('type');
      if(!accessToken||!refreshToken)throw new Error('The email link did not return a verified session. Request a fresh email and try again.');
      const controller=typeof AbortController==='function'?new AbortController():null;let timer;
      const verification=request('/auth/v1/user',{token:false,headers:authHeaders(accessToken),signal:controller?.signal});
      const verified=await awaitAuthWork(Promise.race([verification,new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(new Error('The email link could not be verified. Try again.'));},15000);})]).finally(()=>clearTimeout(timer)),attempt);
      assertAuthAttempt(attempt);const user=verified.data;
      if(!user?.id)throw new Error('The email link did not return a verified account.');
      const previous=session?.user?.id||loadSession()?.user?.id||verifiedAccountUser||context?.profile?.user_id||'';
      if(!previous||previous!==user.id){clearAccountLocalData();context=null;clubConfiguration=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';}
      const expiresIn=Number(get('expires_in')||3600);
      saveSession({access_token:accessToken,refresh_token:refreshToken,token_type:get('token_type')||'bearer',expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,user});
      localStorage.removeItem(VERIFY_EMAIL_KEY);
      if(type==='recovery'){setGateHtml('newpassword','Password reset verified. Choose your new password below.');return 'recovery';}
      const parentMeta=user.user_metadata||{},metaTeam=String(parentMeta.requested_team_id||''),metaChild=String(parentMeta.requested_child_name||'').trim();
      if(parentMeta.parent_signup&&metaTeam&&metaChild){await requestParentAccess(metaTeam,metaChild);assertAuthAttempt(attempt);localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);context=await getContext();assertAuthAttempt(attempt);setGateHtml('approval','Your email is confirmed. Your parent access request is waiting for coach approval.');return 'parentrequest';}
      if(parentMeta.coach_signup&&metaTeam){const sent=await resumeCoachSignupRequestFromMetadata();assertAuthAttempt(attempt);if(!sent)throw new Error('The request was not recorded. Sign in again to retry.');setGateHtml('coachapproval','Your email is confirmed. Your request is waiting for the Club Admin.');return 'coachrequest';}
      if(!duringBootstrap)location.reload();return type||'auth';
    }catch(e){if(attempt!==authAttempt||e?.code==='AUTH_CONTEXT_CHANGED')return 'error';setGateHtml('signin','The email link could not be opened in the app. '+(e.message||''));return 'error';}
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
  async function populateParentSignupChoices(clubId='cloud-parent-club',teamId='cloud-parent-team'){
    const clubSel=document.getElementById(clubId),teamSel=document.getElementById(teamId);if(!clubSel||!teamSel)return;
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
  // Coach and assistant coach access (Mike, 10 Oct 2026): email and password sign-up, then a request the Club Admin approves. No invite codes.
  async function requestCoachAccess(teamId,roleName){return await rpc('request_coach_access',{p_team_id:String(teamId||''),p_role:String(roleName||'coach')});}
  async function resumeCoachSignupRequestFromMetadata(){
    // The email confirmation link calls this before any context is loaded, so fetch it first.
    if(!context?.profile)context=await getContext();
    if(context?.profile?.role!=='pending')return false;
    const metadata=session?.user?.user_metadata||{};
    if(!(metadata.coach_signup===true||metadata.coach_signup==='true'))return false;
    const teamId=String(metadata.requested_team_id||'').trim(),roleName=['assistant_coach','club_admin'].includes(metadata.requested_role)?metadata.requested_role:'coach';
    if(!teamId)throw new Error('The saved coach sign up is missing the selected team.');
    await requestCoachAccess(teamId,roleName);
    context=await getContext();
    return context?.profile?.role==='pending_coach';
  }
  async function listPendingCoachRequests(){
    if(role()!=='admin')return [];
    const data=await rpc('list_pending_coach_requests',{});
    return Array.isArray(data)?data:[];
  }
  async function reviewCoachRequest(requestId,approve){
    if(role()!=='admin')throw new Error('Club Admin access required');
    const req=String(requestId||'').trim();if(!req)throw new Error('Choose a coach request');
    return await rpc('review_coach_request',{p_request_id:req,p_approve:approve===true});
  }
  async function resumeParentSignupRequestFromMetadata(){
    if(context?.profile?.role!=='pending')return false;
    const metadata=session?.user?.user_metadata||{};
    let local={};try{local=JSON.parse(localStorage.getItem(PENDING_PARENT_REQUEST_KEY)||'{}')||{};}catch{}
    const teamId=String(metadata.requested_team_id||local.team_id||'').trim();
    const child=String(metadata.requested_child_name||local.child_name||'').trim();
    const isParentSignup=metadata.parent_signup===true||metadata.parent_signup==='true'||!!(local.team_id&&local.child_name);
    if(!isParentSignup)return false;
    if(!teamId||child.length<2)throw new Error('The saved parent signup is missing the selected team or child name.');
    await requestParentAccess(teamId,child);
    localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);
    context=await getContext();
    return context?.profile?.role==='pending_parent';
  }
  async function listPendingParentRequests(teamId=null){
    if(!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_pending_parent_requests',{p_team_id:teamId||null});
    return Array.isArray(data)?data:[];
  }
  async function listTeams(){
    if(testModeActive())return [TEST_TEAM];const scope=captureAccountRequest();
    const {data}=await request('/rest/v1/teams?select=id,club_id,name,age_group,division,season,selkent_label,league_name,active&active=eq.true&order=age_group.asc,name.asc');
    assertAccountRequest(scope);const rows=Array.isArray(data)?data:[];if(rows.length)cacheTeams(rows);return rows;
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
   const t=role()==='parent'?(activeTeam||context?.team||null):(context?.team||null);
   return oldShapeTeam(t);
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
  function canEditPermission(){
    if(testModeActive())return true;
    const r=role();
    if(r==='coach'||r==='assistant_coach')return !!activeTeam&&context?.team?.id===activeTeam.id;
    if(r==='admin')return !!activeTeam&&!!context?.profile?.coach_team_id&&context.profile.coach_team_id===activeTeam.id;
    return false;
  }
  function canEdit(){return accountReady&&canEditPermission();}
  function canAdmin(){return accountReady&&!testModeActive()&&role()==='admin';}
  function teamMatchesState(team,state){
    const stateName=String(state?.division?.teamName||state?.meta?.teamName||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const teamName=String(team?.league_name||team?.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return stateName && teamName && (stateName===teamName || stateName.includes(teamName) || teamName.includes(stateName));
  }
  function chooseActiveTeam(localState){
   if(!visibleTeams.length)return null;
   const own=context?.team;
   const stored=localStorage.getItem(ACTIVE_TEAM_KEY);
   let found=null;
   if(role()==='parent')found=visibleTeams.find(t=>t.id===stored)||null;
   if(!found&&own)found=visibleTeams.find(t=>t.id===own.id)||(role()==='parent'?null:own);
   if(!found)found=visibleTeams.find(t=>t.id===stored);
   if(!found)found=visibleTeams.find(t=>teamMatchesState(t,localState));
   if(!found)found=visibleTeams[0];
   localStorage.setItem(ACTIVE_TEAM_KEY,found.id);return found;
 }
  function sanitizeMiniSoccerParentStateClient(input,age,profileRole=context?.profile?.role||''){
    const restricted=(!Number.isFinite(Number(age))||Number(age)<=11)&&['parent','player'].includes(String(profileRole||''));
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
  async function fetchTeamState(teamId,scope=captureTeamStateScope()){
    assertTeamStateScope(scope);
    const data=await rpc('get_team_state_for_me',{p_team_id:teamId});assertTeamStateScope(scope);
    const row=Array.isArray(data)?data[0]:data;
    if(row&&(row.team_id!=null&&String(row.team_id)!==String(teamId)))throw new Error('Team information is not available. Please try again.');
    if(row?.state&&(!row.state||typeof row.state!=='object'||Array.isArray(row.state)))throw new Error('Team information is not available. Please try again.');
    if(row?.state){const age=Number((visibleTeams.find(t=>t.id===teamId)||scope.team)?.age_group||0);row.state=sanitizeMiniSoccerParentStateClient(row.state,age,scope.role);}
    return row||null;
  }
  async function getClubOverview(){
    if(!canAdmin())return [];
    const data=await rpc('get_club_overview_for_me',{});
    if(!Array.isArray(data))throw new Error('Club teams could not be loaded. Try again.');
    const rows=data;
    const byTeam=new Map(rows.map(row=>[row.team_id,row]));
    return visibleTeams.map(t=>{
      const row=byTeam.get(t.id)||{};
      return {team:oldShapeTeam(t),state:row.state||{},revision:Number(row.revision||0),updatedAt:row.updated_at||''};
    });
  }
  function requireAdminOnboardingTeam(teamId){
    if(!canAdmin()||!session)throw new Error('Club Admin access required');
    const team=visibleTeams.find(t=>t.id===String(teamId||'')&&t.active!==false&&t.club_id===context?.profile?.club_id);
    if(!team)throw new Error('Choose an active team in this club');
    return team;
  }
  function adminOnboardingIdentity(){return [session?.user?.id,context?.profile?.club_id,role()].join('|');}
  async function loadAdminPlayerOnboarding(teamId){
    const team=requireAdminOnboardingTeam(teamId),identity=adminOnboardingIdentity();
    const [states,requests,links]=await Promise.all([
      rpc('get_team_state_for_me',{p_team_id:team.id}),
      rpc('list_pending_parent_requests',{p_team_id:team.id}),
      rpc('list_parent_player_links',{p_parent_user_id:null,p_team_id:team.id})
    ]);
    if(!canAdmin()||identity!==adminOnboardingIdentity())throw new Error('Account access changed. Reopen onboarding.');
    const row=Array.isArray(states)?states[0]:states,age=Number(team.age_group);
    const rules=clubConfiguration?.rules||[],rule=rules.find(r=>Number(r.age_group)===age);
    return {team:oldShapeTeam(team),players:Array.isArray(row?.state?.squad)?row.state.squad:[],requests:Array.isArray(requests)?requests:[],links:Array.isArray(links)?links:[],limit:Number(rule?.max_registered)||null};
  }
  async function onboardAdminPlayer({teamId,name,number,role:playerRole,parentRequestId=null}={}){
    const team=requireAdminOnboardingTeam(teamId),identity=adminOnboardingIdentity();
    if(activeTeam?.id===team.id&&(saving||pendingState||unsyncedState||confirmingState))throw new Error('Finish syncing this team’s existing edits before onboarding a player.');
    const clean=String(name||'').trim(),shirt=Number(number);
    if(clean.length<2||clean.length>80||!Number.isInteger(shirt)||shirt<1||shirt>99||!['outfield','goalkeeper'].includes(playerRole))throw new Error('Check the player name, shirt number and position.');
    const result=await rpc('admin_onboard_player',{p_team_id:team.id,p_player_name:clean,p_shirt_number:shirt,p_player_role:playerRole,p_parent_request_id:parentRequestId||null});
    if(!canAdmin()||identity!==adminOnboardingIdentity())throw new Error('Account access changed. Check the squad after signing in again.');
    if(!result?.ok)throw new Error('The cloud did not confirm this parent onboarding.');
    // Refresh only the already-active team; onboarding never switches a team/context.
    if(activeTeam?.id===team.id){
      try{const scope=captureTeamStateScope(),saved=await fetchTeamState(team.id,scope);assertTeamStateScope(scope,{passive:true});if(identity===adminOnboardingIdentity())acceptTeamStateRead(saved,scope,{passive:true,reason:'player-onboarded'});}
      catch(_){emitStatus('Player saved. Refresh this team to see the new squad.','warn');}
    }
    return result;
  }
  async function saveTeamStateNow(nextState,{force=false,preserveOnConflict=false,bootstrapScope=null}={}){
    if(!configured()||!session||!activeTeam||(!canEdit()&&!(bootstrapScope&&canEditPermission())))return null;
    if(bootstrapScope)assertTeamStateScope(bootstrapScope);
    if(holdMatchActionDraft(nextState))throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    if(saving){pendingState=nextState;return null;}
    const scope=captureTeamStateScope(),teamId=activeTeam.id,revision=activeRevision;
    const current=()=>{try{assertTeamStateScope(scope);return true;}catch{return false;}};
    const attemptedDraft={state:JSON.parse(JSON.stringify(nextState)),scope};activeSaveDraft=attemptedDraft;
    saving=true;emitStatus('Saving…','working');
    try{
      const data=await rpc('save_team_state',{p_team_id:teamId,p_state:nextState,p_expected_revision:force?-2:revision});assertTeamStateScope(scope);
      const row=Array.isArray(data)?data[0]:data;
      if(!row&&preserveOnConflict)throw new Error('The cloud did not confirm these changes.');
      const saved=await fetchTeamState(teamId,scope);assertTeamStateScope(scope);acceptTeamStateRead(saved,scope);
      unsyncedState=false;if(suspendedDraft?.owner===draftOwner(scope))suspendedDraft=null;
      if(saved?.state&&!pendingState&&!confirmingState&&hooks.onRemoteState)hooks.onRemoteState(saved.state,{reason:'save-normalized'});
      emitStatus('Cloud synced','ok');return row;
    }catch(err){
      if(!current())throw accountContextChanged();
      if(String(err.message||'').includes('STALE_STATE')){
        emitStatus('Newer cloud changes found — local edits need retrying','warn');
        const row=await fetchTeamState(teamId,scope);assertTeamStateScope(scope);acceptTeamStateRead(row,scope);
        if(!preserveOnConflict&&!pendingState&&!confirmingState&&row?.state&&hooks.onRemoteState)hooks.onRemoteState(row.state,{reason:'conflict'});
      }else emitStatus('Sync failed: '+(err.message||err),'error');
      if(preserveOnConflict)unsyncedState=true;throw err;
    }finally{
      if(current()){if(activeSaveDraft===attemptedDraft)activeSaveDraft=null;saving=false;if(pendingState){const p=pendingState;pendingState=null;queueStateSave(p);}}
    }
  }
  function queueStateSave(nextState){
    if(!configured()||!canEdit()||!activeTeam)return;
    if(holdMatchActionDraft(nextState))return;
    pendingState=JSON.parse(JSON.stringify(nextState));
    unsyncedState=true;
    emitStatus('Changes queued…','working');
    clearTimeout(saveTimer);
    const scope=captureTeamStateScope();
    saveTimer=setTimeout(()=>{try{assertTeamStateScope(scope);}catch{return;}const p=pendingState;pendingState=null;if(p)saveTeamStateNow(p,{preserveOnConflict:true}).catch(()=>{});},700);
  }
  async function confirmStateSave(nextState){
    if(holdMatchActionDraft(nextState))throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    // A local match report must stay protected from background pulls until a write is confirmed.
    unsyncedState=true;
    if(!configured()||!activeTeam||!canEdit()){
      throw new Error('This team is not available for editing. Your match is still on this device; reopen your team before saving.');
    }
    if(!session)throw new Error('Your session has expired. Sign in again before saving; your edits remain on this page.');
    const scope=captureTeamStateScope(),teamId=activeTeam.id;
    const snapshot=JSON.parse(JSON.stringify(nextState));
    confirmingState=true;
    try{
      clearTimeout(saveTimer);pendingState=null;
      // An earlier queued save may still be reading back its normalized state.
      while(saving){await new Promise(resolve=>setTimeout(resolve,40));assertTeamStateScope(scope);}
      if(!activeTeam||activeTeam.id!==teamId||!canEdit()){
        throw new Error('The active team changed while saving. Your match is still on this device; reopen the correct team and save again.');
      }
      const saved=await saveTeamStateNow(snapshot,{preserveOnConflict:true});
      if(!saved){
        unsyncedState=true;
        throw new Error('The cloud did not confirm these changes. Your match is still on this device; tap Save again.');
      }
      return saved;
    }catch(err){try{assertTeamStateScope(scope);unsyncedState=true;}catch{}throw err;}
    finally{try{assertTeamStateScope(scope);confirmingState=false;}catch{}}
  }
  async function pullLatest({quiet=false}={}){
    if(!configured()||!session||!activeTeam||!accountReady)return null;
    if(currentMatchActionBarrier()||saving||pendingState||confirmingState||unsyncedState)return null;
    const scope=captureTeamStateScope(),teamId=activeTeam.id,before=activeRevision;
    if(!quiet)emitStatus('Checking cloud…','working');
    try{const row=await fetchTeamState(teamId,scope);assertTeamStateScope(scope,{passive:true});acceptTeamStateRead(row,scope,{passive:true,reason:row?.state&&Number(row.revision)!==before?'pull':''});if(!quiet)emitStatus('Cloud synced','ok');return row;}
    catch(err){if(err?.code!=='AUTH_CONTEXT_CHANGED'&&!quiet)emitStatus('Sync failed: '+(err.message||err),'error');return null;}
  }
  // Destructive match actions use a detached candidate and a captured identity.
  // A full-state background draft must never replay over a confirmed removal.
  let matchActionLease=null,matchActionQuarantine=null;
  function matchActionError(code){
    const messages={MATCH_ACTION_CONFLICT:'The match changed in the cloud. Review the latest match before confirming again.',MATCH_ACTION_SYNC_BUSY:'Finish syncing existing team changes, or review the latest club data before continuing.',MATCH_ACTION_CONTEXT_CHANGED:'The account or team changed. Reopen the match in the correct team.'};
    const error=new Error(messages[code]||'The cloud did not confirm this match action.');error.code=code;return error;
  }
  function matchActionScopeMatches(scope){
    return !!scope&&session?.user?.id===scope.uid&&loadSession()?.user?.id===scope.uid&&context===scope.context&&activeTeam===scope.team&&activeTeam.id===scope.teamId&&
      String(context?.profile?.club_id||'')===scope.club&&role()===scope.role&&actingAsParent()===scope.parent&&
      window.ClubHubCloud===scope.cloud&&canEdit()&&!actingAsParent();
  }
  function assertMatchActionScope(scope){
    if(!matchActionScopeMatches(scope)||scope.guard()!==true)throw matchActionError('MATCH_ACTION_CONTEXT_CHANGED');
  }
  function captureMatchActionScope(guard){
    if(typeof guard!=='function'||!configured()||!session?.user?.id||!activeTeam||!canEdit()||actingAsParent())throw matchActionError('MATCH_ACTION_CONTEXT_CHANGED');
    const scope={uid:session.user.id,club:String(context?.profile?.club_id||''),context,team:activeTeam,teamId:activeTeam.id,role:role(),parent:actingAsParent(),cloud:window.ClubHubCloud,guard};
    assertMatchActionScope(scope);return scope;
  }
  function currentMatchActionBarrier(){
    return [matchActionLease,matchActionQuarantine].find(record=>record&&matchActionScopeMatches(record.scope))||null;
  }
  function holdMatchActionDraft(nextState){
    const barrier=currentMatchActionBarrier();if(!barrier)return false;
    pendingState=JSON.parse(JSON.stringify(nextState));unsyncedState=true;barrier.interfered=true;
    clearTimeout(saveTimer);saveTimer=null;return true;
  }
  async function beginMatchAction(guard,{discardQueuedChanges=false}={}){
    const scope=captureMatchActionScope(guard);
    if(matchActionLease)throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    if(!discardQueuedChanges&&currentMatchActionBarrier())throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    // Let an ordinary in-flight/debounced save finish, without discarding its draft.
    for(let attempts=0;saving||confirmingState||(!discardQueuedChanges&&pendingState);attempts++){
      if(attempts>=75)throw matchActionError('MATCH_ACTION_SYNC_BUSY');
      await new Promise(resolve=>setTimeout(resolve,40));assertMatchActionScope(scope);
    }
    if(!discardQueuedChanges&&unsyncedState)throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    assertMatchActionScope(scope);
    const lease={scope,interfered:false,mayHaveApplied:!!(discardQueuedChanges&&currentMatchActionBarrier()),discardQueuedChanges};
    matchActionLease=lease;
    if(discardQueuedChanges){clearTimeout(saveTimer);saveTimer=null;}
    return lease;
  }
  function finishMatchAction(lease){
    if(matchActionLease!==lease)return;
    matchActionLease=null;
    if(!matchActionScopeMatches(lease.scope))return;
    if(lease.interfered&&lease.mayHaveApplied){matchActionQuarantine=lease;return;}
    if(lease.interfered&&pendingState){const draft=pendingState;pendingState=null;queueStateSave(draft);}
  }
  function assertMatchActionClean(lease){
    assertMatchActionScope(lease.scope);
    if(lease.interfered)throw matchActionError('MATCH_ACTION_SYNC_BUSY');
  }
  async function matchActionRequest(scope,path,options={},lease=null){
    const check=()=>{assertMatchActionScope(scope);if(lease)assertMatchActionClean(lease);};
    check();
    const controller=typeof AbortController==='function'?new AbortController():null;
    let timedOut=false,timer;
    const timeout=()=>new Error('The club did not confirm this request in time. Check your connection and retry.');
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller?.abort();reject(timeout());},15000);});
    try{
      return await Promise.race([deadline,(async()=>{
        const fresh=await ensureFreshSession();check();
        // A timed-out refresh must never start a late destructive request.
        if(timedOut)throw timeout();
        if(!fresh)throw new Error('Your session has expired. Sign in again before retrying.');
        // token:false avoids the ordinary request's cross-session 401 replay.
        const token=session.access_token;
        const result=await request(path,{...options,token:false,signal:controller?.signal,headers:{...authHeaders(token),...(options.headers||{})}});
        check();return result;
      })()]);
    }catch(error){check();throw error;}
    finally{clearTimeout(timer);}
  }
  async function readMatchActionState(scope,lease){
    const {data}=await matchActionRequest(scope,'/rest/v1/rpc/get_team_state_for_me',{method:'POST',body:{p_team_id:scope.teamId}},lease);
    const row=Array.isArray(data)?data[0]:data,revision=row?.revision;
    if(!row?.state||typeof row.state!=='object'||Array.isArray(row.state)||!Array.isArray(row.state.matches)||!Number.isSafeInteger(revision)||revision<0)throw new Error('The cloud did not confirm the latest team state.');
    const state=sanitizeMiniSoccerParentStateClient(JSON.parse(JSON.stringify(row.state)),Number(scope.team.age_group||0),scope.context?.profile?.role||'');
    return {state,revision,updatedAt:row.updated_at||''};
  }
  function matchActionCore(match){
    const core={};
    for(const key of ['status','date','opponent','competition','venue','source','gf','ga'])core[key]=key==='gf'||key==='ga'?Number(match?.[key]||0):String(match?.[key]||(key==='status'?'played':''));
    return JSON.stringify(core);
  }
  function matchActionDesired(state,action,matchId){
    const match=state.matches.find(row=>String(row.id)===matchId);
    const linked=['goals','assists','bookings','awards'].some(key=>(Array.isArray(state[key])?state[key]:[]).some(row=>String(row.matchId)===matchId));
    return !linked&&(action==='delete'?!match:!!match&&match.status==='scheduled'&&Number(match.gf||0)===0&&Number(match.ga||0)===0);
  }
  function acceptMatchActionState(lease,row){
    assertMatchActionClean(lease);activeRevision=row.revision;lastRemoteUpdatedAt=row.updatedAt;
    try{localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+lease.scope.teamId);}catch{}
    // These helpers never persist identity/performance data in device caches.
  }
  async function commitMatchAction({action,matchId,expectedMatch}={},guard){
    if(!['undo','delete'].includes(action)||!String(matchId||''))throw matchActionError('MATCH_ACTION_CONFLICT');
    matchId=String(matchId);const lease=await beginMatchAction(guard);
    try{
      const fresh=await readMatchActionState(lease.scope,lease);
      if(matchActionDesired(fresh.state,action,matchId)){
        lease.mayHaveApplied=true;acceptMatchActionState(lease,fresh);return {...fresh,alreadyApplied:true};
      }
      assertMatchActionClean(lease);
      const match=fresh.state.matches.find(row=>String(row.id)===matchId);
      if(!expectedMatch||!match||matchActionCore(match)!==matchActionCore(expectedMatch)||(action==='delete'&&/selkent|github-static|static-fixture/i.test(String(match.source||''))))throw matchActionError('MATCH_ACTION_CONFLICT');
      const candidate=JSON.parse(JSON.stringify(fresh.state));
      if(action==='delete')candidate.matches=candidate.matches.filter(row=>String(row.id)!==matchId);
      else Object.assign(candidate.matches.find(row=>String(row.id)===matchId),{status:'scheduled',gf:0,ga:0});
      for(const key of ['goals','assists','bookings','awards'])candidate[key]=(Array.isArray(candidate[key])?candidate[key]:[]).filter(row=>String(row.matchId)!==matchId);
      assertMatchActionClean(lease);
      // Once sent, even a lost response may have applied the compare-and-swap.
      lease.mayHaveApplied=true;
      const {data}=await matchActionRequest(lease.scope,'/rest/v1/rpc/save_team_state',{method:'POST',body:{p_team_id:lease.scope.teamId,p_state:candidate,p_expected_revision:fresh.revision}},lease);
      const saved=Array.isArray(data)?data[0]:data;
      if(!saved||!Number.isSafeInteger(saved.revision)||saved.revision<=fresh.revision)throw new Error('The cloud did not confirm this match action.');
      assertMatchActionClean(lease);
      const confirmed=await readMatchActionState(lease.scope,lease);
      if(confirmed.revision!==Number(saved.revision)||!matchActionDesired(confirmed.state,action,matchId))throw matchActionError('MATCH_ACTION_CONFLICT');
      acceptMatchActionState(lease,confirmed);return {...confirmed,alreadyApplied:false};
    }catch(error){
      if(String(error.message||'').includes('STALE_STATE'))throw matchActionError('MATCH_ACTION_CONFLICT');
      throw error;
    }finally{finishMatchAction(lease);}
  }
  function tournamentActionStable(value){
    return JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row);
  }
  function tournamentActionEvent(row){
    if(!row||typeof row!=='object'||Array.isArray(row))return null;
    return {id:String(row.id||''),name:String(row.name||'').trim(),date:String(row.date||''),location:String(row.location||'').trim(),format:String(row.format||'group_knockout'),playerNames:(Array.isArray(row.playerNames)?row.playerNames:[]).map(String)};
  }
  function tournamentActionEventKey(row){
    return tournamentActionStable(tournamentActionEvent(row));
  }
  function tournamentActionIds(ids){
    if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(ids).size!==ids.length)throw matchActionError('MATCH_ACTION_CONFLICT');
    return [...ids].sort();
  }
  function tournamentActionGame(row,tournamentId){
    if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id)throw matchActionError('MATCH_ACTION_CONFLICT');
    const status=String(row.status||'').toLowerCase();
    return {...row,tournamentId,status:['scheduled','postponed','abandoned','played'].includes(status)?status:'played'};
  }
  function tournamentActionTarget(state,tournamentId){
    if(!Array.isArray(state.matches)||(state.tournaments!=null&&!Array.isArray(state.tournaments)))throw matchActionError('MATCH_ACTION_CONFLICT');
    const events=state.tournaments||[],raw=events.filter(row=>String(row?.id||'')===tournamentId);
    if(raw.length>1)throw matchActionError('MATCH_ACTION_CONFLICT');
    // Project the existing legacy display rule without materializing other groups.
    const groups=new Map();
    for(const match of state.matches){
      if(!match||match.tournamentId||!/tournament/i.test(String(match.competition||match.type||'')))continue;
      const key=`${match.date||''}|${String(match.competition||'Tournament').toLowerCase()}`;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(match);
    }
    const inferred=[];
    for(const [key,games]of groups){
      const first=games[0],existing=events.filter(row=>row?.date===(first.date||'')&&String(row.name||'').toLowerCase()===String(first.competition||'Tournament').toLowerCase());
      const id=existing[0]?.id||`tlegacy_${key.replace(/[^a-z0-9]+/gi,'_')}`;
      if(String(id)!==tournamentId){
        if(existing.length>1&&existing.some(row=>String(row?.id||'')===tournamentId))throw matchActionError('MATCH_ACTION_CONFLICT');
        continue;
      }
      if(existing.length>1||(raw.length&&raw[0]!==existing[0]))throw matchActionError('MATCH_ACTION_CONFLICT');
      inferred.push({games,event:existing[0]||{id,name:first.competition||'Tournament',date:first.date||'',location:'',format:'group_knockout',playerNames:[]}});
    }
    if(inferred.length>1)throw matchActionError('MATCH_ACTION_CONFLICT');
    const inferredGames=inferred[0]?.games||[],inferredIds=tournamentActionIds(inferredGames.map(row=>row.id));
    const games=state.matches.filter(row=>row&&(String(row.tournamentId||'')===tournamentId||inferredGames.includes(row)));
    const ids=tournamentActionIds(games.map(row=>row.id));
    if(ids.some(id=>state.matches.filter(row=>String(row?.id||'')===id).length!==1))throw matchActionError('MATCH_ACTION_CONFLICT');
    return {raw:raw[0]||null,event:raw[0]||inferred[0]?.event||null,games:games.map(row=>tournamentActionGame(row,tournamentId)),ids,inferredIds};
  }
  function tournamentActionGamesKey(games,tournamentId){
    if(!Array.isArray(games))throw matchActionError('MATCH_ACTION_CONFLICT');
    return tournamentActionStable(games.map(row=>{
      if(row?.tournamentId&&String(row.tournamentId)!==tournamentId)throw matchActionError('MATCH_ACTION_CONFLICT');
      return tournamentActionGame(row,tournamentId);
    }).sort((a,b)=>a.id.localeCompare(b.id)));
  }
  function tournamentActionDesired(state,target,action,tournamentId,tournament,gameIds){
    if(action==='save')return !!target.raw&&tournamentActionEventKey(target.raw)===tournamentActionEventKey(tournament)&&
      tournamentActionStable(target.ids)===tournamentActionStable(gameIds)&&gameIds.every(id=>state.matches.some(row=>row.id===id&&row.tournamentId===tournamentId));
    const ids=new Set(gameIds);
    if(target.event||target.games.length||state.matches.some(row=>ids.has(String(row?.id))))return false;
    for(const key of ['goals','assists','bookings','awards']){
      if(state[key]!=null&&!Array.isArray(state[key]))throw matchActionError('MATCH_ACTION_CONFLICT');
      if((state[key]||[]).some(row=>ids.has(String(row?.matchId))))return false;
    }
    return true;
  }
  async function commitTournamentAction(payload={},guard){
    // Detach the entire intent before the first await, including its baseline.
    const intent=JSON.parse(JSON.stringify(payload)),{action,tournamentId,expectedTournament,expectedGames}=intent;
    if(!['save','delete'].includes(action)||typeof tournamentId!=='string'||!tournamentId||tournamentId.length>200)throw matchActionError('MATCH_ACTION_CONFLICT');
    const expectedIds=Array.isArray(expectedGames)?tournamentActionIds(expectedGames.map(row=>row?.id)):null;
    const gameIds=tournamentActionIds(intent.gameIds??expectedIds);
    if(expectedIds&&tournamentActionStable(expectedIds)!==tournamentActionStable(gameIds))throw matchActionError('MATCH_ACTION_CONFLICT');
    if(expectedTournament!=null&&tournamentActionEvent(expectedTournament)?.id!==tournamentId)throw matchActionError('MATCH_ACTION_CONFLICT');
    const tournament=action==='save'?tournamentActionEvent(intent.tournament):null;
    if(action==='save'){
      const stamp=Date.parse(String(tournament?.date)+'T00:00:00Z');
      if(!tournament||tournament.id!==tournamentId||!tournament.name||tournament.name.length>100||tournament.location.length>160||!Array.isArray(intent.tournament?.playerNames)||
        !/^\d{4}-\d{2}-\d{2}$/.test(tournament.date)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==tournament.date||
        !['group_knockout','round_robin','knockout','festival'].includes(tournament.format)||new Set(tournament.playerNames).size!==tournament.playerNames.length)throw new Error('Check the tournament name, date, format and squad.');
    }
    const lease=await beginMatchAction(guard);
    // A retry may be verifying an earlier lost response. Never replay a queued
    // full-state draft merely because it interrupted this initial read.
    lease.mayHaveApplied=true;
    try{
      const fresh=await readMatchActionState(lease.scope,lease),target=tournamentActionTarget(fresh.state,tournamentId);
      if(tournamentActionDesired(fresh.state,target,action,tournamentId,tournament,gameIds)){
        lease.mayHaveApplied=true;acceptMatchActionState(lease,fresh);return {...fresh,alreadyApplied:true};
      }
      assertMatchActionClean(lease);
      if(expectedTournament===undefined||!Array.isArray(expectedGames)||tournamentActionEventKey(target.event)!==tournamentActionEventKey(expectedTournament)||
        tournamentActionGamesKey(target.games,tournamentId)!==tournamentActionGamesKey(expectedGames,tournamentId))throw matchActionError('MATCH_ACTION_CONFLICT');
      if(action==='delete'&&(!target.event||target.games.some(row=>/selkent|(?:github|cloudflare)-static|static-fixture/i.test(String(row.source||'')))))throw matchActionError('MATCH_ACTION_CONFLICT');
      if(action==='save'){
        if(target.games.some(row=>target.inferredIds.includes(row.id)&&/selkent|(?:github|cloudflare)-static|static-fixture/i.test(String(row.source||''))))throw matchActionError('MATCH_ACTION_CONFLICT');
        const activeNames=new Set((Array.isArray(fresh.state.squad)?fresh.state.squad:[]).filter(row=>row&&row.status!=='inactive'&&String(row.name||'').trim()).map(row=>String(row.name).trim()));
        if(tournament.playerNames.some(name=>!activeNames.has(name)))throw Object.assign(new Error('The tournament squad changed. Review the latest active players before saving.'),{code:'MATCH_ACTION_CONFLICT'});
      }
      const candidate=JSON.parse(JSON.stringify(fresh.state)),ids=new Set(gameIds);
      if(action==='save'){
        candidate.tournaments=Array.isArray(candidate.tournaments)?candidate.tournaments:[];
        const index=candidate.tournaments.findIndex(row=>String(row?.id||'')===tournamentId);
        if(index<0)candidate.tournaments.push({...target.event,...tournament});
        else candidate.tournaments[index]={...candidate.tournaments[index],...tournament};
        const inferred=new Set(target.inferredIds);
        candidate.matches=candidate.matches.map(row=>inferred.has(row?.id)?{...row,tournamentId}:row);
      }else{
        if(Array.isArray(candidate.tournaments))candidate.tournaments=candidate.tournaments.filter(row=>String(row?.id||'')!==tournamentId);
        candidate.matches=candidate.matches.filter(row=>!ids.has(String(row?.id)));
        for(const key of ['goals','assists','bookings','awards']){
          if(candidate[key]!=null&&!Array.isArray(candidate[key]))throw matchActionError('MATCH_ACTION_CONFLICT');
          if(Array.isArray(candidate[key]))candidate[key]=candidate[key].filter(row=>!ids.has(String(row?.matchId)));
        }
      }
      // A rename/create must not implicitly adopt an unconfirmed legacy group.
      const candidateTarget=tournamentActionTarget(candidate,tournamentId);
      if(!tournamentActionDesired(candidate,candidateTarget,action,tournamentId,tournament,gameIds))throw matchActionError('MATCH_ACTION_CONFLICT');
      assertMatchActionClean(lease);lease.mayHaveApplied=true;
      const {data}=await matchActionRequest(lease.scope,'/rest/v1/rpc/save_team_state',{method:'POST',body:{p_team_id:lease.scope.teamId,p_state:candidate,p_expected_revision:fresh.revision}},lease);
      const saved=Array.isArray(data)?data[0]:data;
      if(!saved||!Number.isSafeInteger(saved.revision)||saved.revision<=fresh.revision)throw new Error('The cloud did not confirm this tournament change.');
      const confirmed=await readMatchActionState(lease.scope,lease),confirmedTarget=tournamentActionTarget(confirmed.state,tournamentId);
      if(confirmed.revision!==saved.revision||!tournamentActionDesired(confirmed.state,confirmedTarget,action,tournamentId,tournament,gameIds))throw matchActionError('MATCH_ACTION_CONFLICT');
      acceptMatchActionState(lease,confirmed);return {...confirmed,alreadyApplied:false};
    }catch(error){
      if(String(error.message||'').includes('STALE_STATE'))throw matchActionError('MATCH_ACTION_CONFLICT');
      throw error;
    }finally{finishMatchAction(lease);}
  }
  async function reviewMatchActionState(guard,{discardQueuedChanges=false}={}){
    const lease=await beginMatchAction(guard,{discardQueuedChanges:discardQueuedChanges===true});
    try{
      const fresh=await readMatchActionState(lease.scope,lease);assertMatchActionClean(lease);
      if(discardQueuedChanges===true){
        // The caller obtained explicit consent; keep the draft until this read succeeds.
        pendingState=null;unsyncedState=false;clearTimeout(saveTimer);saveTimer=null;
        matchActionQuarantine=null;lease.interfered=false;
      }
      acceptMatchActionState(lease,fresh);return fresh;
    }finally{finishMatchAction(lease);}
  }
  async function clearMatchActionAttendance(matchId,guard){
    if(!String(matchId||''))throw matchActionError('MATCH_ACTION_CONFLICT');
    const lease=await beginMatchAction(guard);lease.mayHaveApplied=true;
    try{
      const {data}=await matchActionRequest(lease.scope,'/rest/v1/rpc/save_match_attendance',{method:'POST',body:{p_team_id:lease.scope.teamId,p_match_id:String(matchId),p_rows:[]}},lease);
      assertMatchActionClean(lease);
      if(data!==0)throw new Error('The cloud did not confirm the cleared match attendance.');
      return {cleared:true};
    }finally{finishMatchAction(lease);}
  }
  async function clearMatchActionNote(matchId,guard){
    if(!String(matchId||''))throw matchActionError('MATCH_ACTION_CONFLICT');
    const lease=await beginMatchAction(guard);lease.mayHaveApplied=true;
    try{
      const {data}=await matchActionRequest(lease.scope,'/rest/v1/coach_match_notes?on_conflict=team_id,match_id',{method:'POST',body:{team_id:lease.scope.teamId,match_id:String(matchId),note:'',updated_by:lease.scope.uid,updated_at:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=representation'}},lease);
      assertMatchActionClean(lease);const row=Array.isArray(data)?data[0]:data;
      if(!row||row.team_id!==lease.scope.teamId||String(row.match_id)!==String(matchId)||row.note!=='')throw new Error('The cloud did not confirm the cleared match note.');
      return {cleared:true};
    }finally{finishMatchAction(lease);}
  }
  async function switchAdminTeam(teamId,seedFactory,bootContext=null){
    if(!canAdmin()&&!(bootContext&&bootContext===pendingBootstrapContext&&role()==='admin'))throw new Error('Club Admin access required');
    const team=visibleTeams.find(t=>t.id===teamId);if(!team)throw new Error('Team not found');
    if(saving||confirmingState||currentMatchActionBarrier()||(unsyncedState&&!pendingState))throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    if(pendingState&&canEdit()){const scope=captureTeamStateScope(),draft=pendingState;pendingState=null;try{const saved=await saveTeamStateNow(draft,{preserveOnConflict:true});assertTeamStateScope(scope);if(!saved)throw matchActionError('MATCH_ACTION_SYNC_BUSY');}catch(error){try{assertTeamStateScope(scope);if(!pendingState)pendingState=draft;unsyncedState=true;}catch{}throw error;}}
    ++teamReadGeneration;readyBootstrap=null;const scope=captureTeamStateScope();
    window.dispatchEvent(new Event('clubhub-contacts-clear'));
    const cached=cachedTeamState(team.id);
    let row=cached||await fetchTeamState(team.id,scope);assertTeamStateScope(scope);
    if(!row?.state&&seedFactory)row={state:seedFactory(oldShapeTeam(team)),revision:0,updated_at:''};
    if(!row?.state)throw new Error('Team information is not available');
    activeTeam=team;localStorage.setItem(ACTIVE_TEAM_KEY,team.id);
    const selected=captureTeamStateScope();acceptTeamStateRead(row,selected,{reason:cached?'switch-cache':'switch'});updateCloudPanel();
    if(cached)fetchTeamState(team.id,selected).then(fresh=>{assertTeamStateScope(selected,{passive:true});acceptTeamStateRead(fresh,selected,{passive:true,reason:fresh?.state&&Number(fresh.revision)!==Number(cached.revision)?'switch-refresh':''});}).catch(()=>{});
    return oldShapeTeam(team);
  }
  async function switchParentTeam(teamId){
    if(role()!=='parent')throw new Error('Parent access required');
    const team=visibleTeams.find(t=>String(t.id)===String(teamId));if(!team)throw new Error('This team is not linked to your parent account');
    ++teamReadGeneration;readyBootstrap=null;const scope=captureTeamStateScope();
    const row=await fetchTeamState(team.id,scope);assertTeamStateScope(scope);
    if(!row?.state)throw new Error('Team information is not available');
    activeTeam=team;context={...(context||{}),team};window.dispatchEvent(new Event('clubhub-contacts-clear'));localStorage.setItem(ACTIVE_TEAM_KEY,team.id);
    acceptTeamStateRead(row,captureTeamStateScope(),{reason:'parent-team-switch'});updateCloudPanel();return oldShapeTeam(team);
  }

 async function listCurrentClubLoginTeams(){
   if(role()!=='parent'&&!isStaffAccount())return [];
   const slug=String(clubConfiguration?.settings?.slug||'').trim();
   if(!slug)return [];
   return await listLoginTeams(slug);
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
  async function listCoachQualifications(){
    if(role()!=='admin'||actingAsParent())throw new Error('Club Admin access required');
    return await rpc('list_coach_qualifications',{});
  }
  async function getCoachQualifications(userId){
    if(!['admin','coach','assistant_coach'].includes(role())||actingAsParent())throw new Error('Staff access required');
    return await rpc('get_coach_qualifications',{p_user_id:String(userId||'')});
  }
  async function saveCoachQualifications(userId,records,revision){
    if(role()!=='admin'||actingAsParent())throw new Error('Club Admin access required');
    if(!Array.isArray(records)||!Number.isSafeInteger(revision)||revision<0)throw new Error('Reload this coach profile');
    return await rpc('save_coach_qualifications',{p_user_id:String(userId||''),p_records:records,p_expected_revision:revision});
  }
  async function listClubCoaches(){
    if(role()!=='admin')return [];
    const data=await rpc('list_club_coaches',{});
    if(!Array.isArray(data))throw new Error('Coaching staff unavailable');return data;
  }
  // Several coaching teams for one person (draft 012): list the teams I am assigned to and switch the one I am working on.
  async function listMyCoachTeams(strict=false){
    if(!['admin','coach','assistant_coach'].includes(role()))return [];
    try{const data=await rpc('list_my_coach_teams',{});return Array.isArray(data)?data:[];}catch(err){if(strict)throw err;return [];}
  }
  async function switchMyCoachTeam(teamId){
    if(saving||confirmingState||pendingState||unsyncedState||currentMatchActionBarrier())throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    await rpc('switch_my_active_team',{p_team_id:String(teamId||'')});
    lockGate();clearAccountLocalData();// nothing from the previous team stays in this browser
    return true;
  }
  // One login, two capacities (draft 015): coaching staff and Club Admins who are also parents.
  const STAFF_ROLES=['club_admin','coach','assistant_coach'];
  function realRole(){return context?.real_role||context?.profile?.role||'';}
  function isStaffAccount(){return !!context?.real_role&&STAFF_ROLES.includes(context.real_role);}// real_role only exists once draft 015 is live, so nothing shows before then
  function actingAsParent(){return !!(context?.acting_as_parent&&isStaffAccount());}
  async function setMyCapacity(asParent){
    if(!isStaffAccount())throw new Error('Only coaching staff and Club Admins have two capacities');
    if(saving||confirmingState||pendingState||unsyncedState||currentMatchActionBarrier())throw matchActionError('MATCH_ACTION_SYNC_BUSY');
    await rpc('set_my_capacity',{p_parent:!!asParent});
    lockGate();clearAccountLocalData();
    return true;
  }
  async function requestChildLink(teamId,childName){
    if(!isStaffAccount())throw new Error('Only coaching staff and Club Admins can use this');
    return await rpc('request_child_link',{p_team_id:String(teamId||''),p_child_name:String(childName||'').trim()});
  }
  // Club Admin gives a coach (or a Club Admin who coaches) another team, or takes one away (draft 012 RPCs).
  async function assignCoachTeam(userId,teamId){
    if(role()!=='admin')throw new Error('Club Admin access required');
    return await rpc('assign_coach_team',{p_user_id:userId,p_team_id:teamId});
  }
  async function unassignCoachTeam(userId,teamId){
    if(role()!=='admin')throw new Error('Club Admin access required');
    return await rpc('unassign_coach_team',{p_user_id:userId,p_team_id:teamId});
  }
  async function listClubAccessAccounts(){
    if(role()!=='admin')return [];
    const data=await rpc('list_club_access_accounts',{});
    if(!Array.isArray(data))throw new Error('Club accounts unavailable');return data;
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
  async function listContactDirectory(teamId=null){
    if(testModeActive()||!['admin','coach','assistant_coach','parent'].includes(role()))throw new Error('Approved adult access required');
    return await rpc('list_contact_directory',{p_team_id:teamId||null});
  }
  async function saveMemberContactDetails({userId,email='',phone=''}={}){
    if(testModeActive()||!['admin','coach','assistant_coach','parent'].includes(role()))throw new Error('Approved adult access required');
    if(!userId)throw new Error('Choose a contact');
    return await rpc('save_member_contact_details',{p_user_id:userId,p_email:String(email).trim(),p_phone:String(phone).trim()});
  }
  async function importMemberContactDetails(rows){
    if(testModeActive()||role()!=='admin')throw new Error('Club Admin access required');
    if(!Array.isArray(rows)||!rows.length||rows.length>500)throw new Error('Import between 1 and 500 contacts');
    return await rpc('import_member_contact_details',{p_rows:rows});
  }
  async function listClubMessages(){
    if(!['admin','coach','assistant_coach','parent'].includes(role()))return [];
    const data=await rpc('list_active_messages',{});
    const rows=Array.isArray(data)?data:[];
    return rows.map(r=>({...r,id:r.message_id||r.id,created_at:r.sent_at||r.created_at}))
      .sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||String(a.id).localeCompare(String(b.id)));
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
  async function listSafeguardingExportAudit(){if(role()!=='admin')return [];const d=await rpc('list_safeguarding_export_audit',{});if(!Array.isArray(d))throw new Error('Export history unavailable');return d;}
  async function requestClubCancellation(){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('request_club_cancellation',{});}
  async function cancelClubCancellation(){if(role()!=='admin')throw new Error('Club Admin access required');return await rpc('cancel_club_cancellation',{});}

  async function listParentPlayerLinks(parentUserId=null,teamId=null){
    if(testModeActive())return [];
    const target=teamId||activeTeam?.id,r=role();
    if(!target||!['admin','coach','assistant_coach','parent'].includes(r))return [];
    // Only Club Admin may explicitly inspect another team. The existing RPC
    // still verifies club, role and parent/child access on the server.
    if(r!=='admin'&&target!==activeTeam?.id)throw new Error('Use your current team to view player links');
    const data=await rpc('list_parent_player_links',{p_parent_user_id:parentUserId||null,p_team_id:target});
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
    const q=`/rest/v1/match_availability?select=id,team_id,fixture_key,player_name,status,response_source,updated_at&team_id=eq.${encodeURIComponent(activeTeam.id)}&fixture_key=eq.${encodeURIComponent(fixtureKey)}&order=updated_at.desc`;
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
  async function saveCoachMatchAvailability({fixtureKey,playerName,status}={}){
    if(!canEdit())throw new Error('Coach access required');
    if(!activeTeam||!session?.user?.id)throw new Error('Team session is not ready');
    if(!fixtureKey||!['available','unavailable','unsure'].includes(status))throw new Error('Choose a player status');
    const name=String(playerName||'').trim().slice(0,80);if(!name)throw new Error('Choose a player');
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
  async function listAnnouncements(){if(testModeActive())return [];const data=await rpc('list_announcements_for_me',{});if(Array.isArray(data))return data;if(Array.isArray(data?.data))return data.data;throw new Error('Club notices could not be loaded. Try again.');}
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
  async function listNotifications(){
    if(testModeActive())return [];
    const data=await rpc('list_notifications_for_me',{});
    const ordinary=(Array.isArray(data)?data:(Array.isArray(data?.data)?data.data:[])).filter(n=>n.type!=='kickoff_update');
    let updates=[];
    try{updates=await rpc('list_kickoff_updates_for_me',{});}catch(e){if(!/PGRST202|Could not find the function|does not exist/.test(String(e.message||e)))throw e;}
    return [...ordinary,...(Array.isArray(updates)?updates:[])];
  }
  async function acknowledgeKickoffUpdate(id){return rpc('acknowledge_kickoff_update',{p_update_id:id,p_confirm_seen:true});}
  async function acknowledgeKickoffAsCoach(id){return rpc('acknowledge_kickoff_as_coach',{p_update_id:id});}
  async function respondKickoffParentAvailability(id,parentLinkId,status){return rpc('respond_kickoff_parent_availability',{p_update_id:id,p_parent_link_id:parentLinkId,p_status:status});}
  async function listKickoffUpdatesForAdmin(teamId=null){if(testModeActive()||!canAdmin()||actingAsParent())return [];return rpc('list_kickoff_updates_for_admin',{p_team_id:teamId});}
  async function getKickoffPushSettings(endpoint=''){return rpc('get_kickoff_push_settings',{p_endpoint:endpoint});}
  async function registerKickoffPush(sub){return rpc('register_kickoff_push',{p_endpoint:sub.endpoint,p_p256dh:sub.keys?.p256dh||'',p_auth:sub.keys?.auth||''});}
  async function unregisterKickoffPush(endpoint){return rpc('unregister_kickoff_push',{p_endpoint:endpoint});}
  async function markNotificationRead(id){if(testModeActive())return true;return await rpc('mark_notification_read',{p_notification_id:id});}
  async function notifyFixtureChange(fixtureKey,body){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_fixture_change',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey),p_body:String(body||'')})||0);}
  async function notifySelectedSquad(fixtureKey,playerNames=[]){if(testModeActive())return 0;if(!activeTeam||!canEdit())throw new Error('Coach access required');return Number(await rpc('notify_selected_squad',{p_team_id:activeTeam.id,p_fixture_key:String(fixtureKey),p_player_names:playerNames})||0);}
  async function notifyMatchReport(matchId,opponent,score){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_match_report',{p_team_id:activeTeam.id,p_match_id:String(matchId||''),p_opponent:String(opponent||''),p_score:String(score||'')})||0);}
  async function notifyMatchReopened(matchId,opponent){if(testModeActive())return 0;if(!activeTeam||!canEdit())return 0;return Number(await rpc('notify_match_reopened',{p_team_id:activeTeam.id,p_match_id:String(matchId||''),p_opponent:String(opponent||'')})||0);}
  async function listPlayerAppearanceStats(){if(testModeActive())return [];if(!activeTeam)return [];const data=await rpc('list_player_appearance_stats',{p_team_id:activeTeam.id});return Array.isArray(data)?data:[];}
  async function approveParentRequest(requestId,playerName){
   if(!['admin','coach','assistant_coach'].includes(role()))throw new Error('Coaching staff or Club Admin access required');
   const req=String(requestId||'').trim(),player=String(playerName||'').trim();
   if(!req)throw new Error('Choose a parent request');
   if(!player)throw new Error('Select the verified squad player first');
   return await rpc('approve_parent_request',{p_request_id:req,p_player_name:player});
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
    if(testModeActive()||role()!=='admin')return [];
    const data=await rpc('list_audit_history',{p_team_id:teamId||null,p_limit:Number(limit)||100});
    if(!Array.isArray(data))throw new Error('Audit history unavailable');return data;
  }
  async function listSeasonArchives(teamId=null){
    if(testModeActive()||!['admin','coach','assistant_coach'].includes(role()))return [];
    const data=await rpc('list_season_archives',{p_team_id:teamId||null});
    if(!Array.isArray(data))throw new Error('Season history unavailable');return data;
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
    return `<div class="auth-brand"><img src="shooters-hill-logo.png" alt="Shooters Hill AFC club badge" class="auth-brand-lockup" width="88" height="88"/><p class="auth-club-name">SHOOTERS HILL AFC</p></div>`;
  }
  function authField({icon='user',id,type='text',placeholder='',label=placeholder,autocomplete='',inputmode='',maxlength='',value='',extra=''}){
    return `<div class="auth-field-group"><label class="auth-field-label" for="${id}">${escapeHtml(label)}</label><div class="auth-field"><span class="auth-field-icon" aria-hidden="true">${authIcon(icon)}</span><input id="${id}" name="${id}" type="${type}" ${autocomplete?`autocomplete="${autocomplete}"`:''} ${inputmode?`inputmode="${inputmode}"`:''} ${maxlength?`maxlength="${maxlength}"`:''} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${extra}/></div></div>`;
  }
  function authMainScreen({screen='adult',title,copy,body,after='',footer='Your club, together.',back=false}){
    return `<div class="auth-showcase auth-${screen} auth-redesign"><div class="auth-welcome">${authBrand()}<h2 class="auth-story-heading">Your club.<br/>All together.</h2><p class="auth-story-copy">Fixtures, team updates and club life.<br/>One place to stay connected.</p></div><div class="auth-content"><div class="auth-main">${back?'<button type="button" class="auth-back" id="auth-screen-back">‹ Back</button>':''}<div class="auth-heading-copy"><h1>${title}</h1><p class="auth-lead">${copy}</p></div>${body}</div>${after}<p class="auth-login-footer">${footer}</p></div></div>`;
  }
  function authSimple(title,copy,body){
    return authMainScreen({screen:'simple',title,copy,body});
  }
  function bindPasswordToggle(inputId,buttonId){
    const button=document.getElementById(buttonId);
    button?.addEventListener('click',()=>{
      const input=document.getElementById(inputId);if(!input)return;
      const reveal=input.type==='password';input.type=reveal?'text':'password';
      button.textContent=reveal?'Hide':'Show';
      button.setAttribute('aria-label',reveal?'Hide password':'Show password');
      button.setAttribute('aria-pressed',String(reveal));
    });
  }

  function setGateHtml(mode='signin',message='',prefillEmail=''){
    const gate=document.getElementById('activation-gate');
    if(!gate)return;
    gate.classList.remove('hidden');gate.dataset.authMode=mode;gate.dataset.authDesign=AUTH_DESIGN_REVISION;
    document.body.classList.add('auth-open');
    document.querySelector('.app-shell')?.classList.add('account-locked');

    if(mode==='signin'||mode==='parentsignin'){
      const parentOnly=mode==='parentsignin';
      const body=`
        <form id="cloud-signin-form" novalidate>
        <div class="auth-fields">
          ${authField({icon:'mail',id:'cloud-email',type:'email',placeholder:'you@example.com',label:'Email address',autocomplete:'username',value:prefillEmail})}
          <div class="auth-password-wrap">${authField({icon:'lock',id:'cloud-password',type:'password',placeholder:'Enter your password',label:'Password',autocomplete:'current-password'})}<button type="button" class="auth-eye" id="cloud-password-toggle" aria-label="Show password" aria-controls="cloud-password" aria-pressed="false">Show</button></div>
        </div>
        <button type="button" class="auth-forgot" id="cloud-forgot-password">Forgot password?</button>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p>
        <button type="submit" class="auth-primary" id="cloud-auth-submit">${parentOnly?'Sign in as parent':'Sign in'}</button>
        </form>
        `;
      const after=`<button type="button" class="auth-link-strong" id="cloud-parent-signup">New to the club? Create account</button>${parentOnly?'':`<div class="auth-other-options"><div class="auth-alternate-routes" role="group" aria-label="Other sign-in options"><button type="button" class="auth-secondary" id="cloud-parent-login">Parent sign in</button><button type="button" class="auth-secondary" id="cloud-player-login">Player access</button></div><p class="auth-player-eligibility">Player access is for eligible U15 players.</p></div>`}`;
      gate.innerHTML=authMainScreen({screen:'adult',title:parentOnly?'Parent sign in':'Welcome back',copy:parentOnly?'Use your approved parent email and password.':'Sign in to your club.',body,after,back:parentOnly});
      bindPasswordToggle('cloud-password','cloud-password-toggle');
      document.getElementById('cloud-forgot-password')?.addEventListener('click',()=>setGateHtml('forgot'));
      document.getElementById('cloud-parent-login')?.addEventListener('click',()=>setGateHtml('parentsignin'));
      document.getElementById('auth-screen-back')?.addEventListener('click',()=>setGateHtml('signin'));
      document.getElementById('cloud-player-login')?.addEventListener('click',()=>setGateHtml('playerlogin'));
      document.getElementById('cloud-parent-signup')?.addEventListener('click',()=>setGateHtml('signup'));
      document.getElementById('cloud-signin-form')?.addEventListener('submit',async event=>{
        event.preventDefault();
        if(document.getElementById('cloud-auth-submit')?.disabled)return;
        const email=document.getElementById('cloud-email')?.value?.trim()||'',password=document.getElementById('cloud-password')?.value||'';
        if(!email||!password)return authError('Enter your email and password.');
        const btn=document.getElementById('cloud-auth-submit');if(btn){btn.disabled=true;btn.innerHTML='Signing in…';}
        try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await signIn(email,password);await hydrateSessionUser();context=await getContext();if(!context?.profile)throw new Error('Sign in succeeded, but no club access profile is attached to this account.');if(context.profile.role==='pending'){await resumeParentSignupRequestFromMetadata();}if(context.profile.role==='pending'){await resumeCoachSignupRequestFromMetadata();}if(context?.profile?.role==='pending_coach'){setGateHtml('coachapproval','Your request has been sent to the Club Admin for approval.');return;}if(context?.profile?.role==='pending_parent'){setGateHtml('approval','Your parent access request has been sent to the coaching staff for verification.');return;}if(parentOnly&&context.profile.role!=='parent'){
          const token=session?.access_token||'';if(token){try{await fetch(base()+'/auth/v1/logout',{method:'POST',headers:authHeaders(token)});}catch{}}
          clearInviteAccess();clearAccountLocalData();
          throw new Error('This account does not have approved Parent access. Use an approved parent account.');
        }window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:parentOnly?'parent-signin':'signin'}}));}
        catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;const msg=e.message||String(e);if(/confirm|verified/i.test(msg)){localStorage.setItem(VERIFY_EMAIL_KEY,email);setGateHtml('verify','Your email still needs confirming.',email);}else authError(msg);if(btn){btn.disabled=false;btn.innerHTML=(parentOnly?'Sign In as Parent':'Log In')+' <span>→</span>';}}
      });return;
    }

    if(mode==='signup'||mode==='parentsignup'||mode==='coachsignup'){
      // One sign-up screen (Mike, 10 Oct 2026): the account type decides which fields appear. Adults sign up with email and password only.
      const startType=mode==='coachsignup'?'coach':'parent';
      const typeOpts=[['parent','Parent / guardian'],['coach','Coach'],['assistant_coach','Assistant Coach'],['club_admin','Club Admin']];
      const body=`<div class="auth-fields"><div class="auth-field"><span class="auth-field-icon">${authIcon('user')}</span><select id="cloud-signup-type" aria-label="Account type">${typeOpts.map(o=>`<option value="${o[0]}"${o[0]===startType?' selected':''}>${o[1]}</option>`).join('')}</select></div>${authField({icon:'user',id:'cloud-signup-name',placeholder:'Your name',autocomplete:'name'})}${authField({icon:'mail',id:'cloud-signup-email',type:'email',placeholder:'Email address',autocomplete:'username',value:prefillEmail})}${authField({icon:'lock',id:'cloud-signup-password',type:'password',placeholder:'Create password',autocomplete:'new-password'})}<div class="auth-field"><span class="auth-field-icon">${authIcon('club')}</span><select id="cloud-signup-club" aria-label="Club"><option value="">Loading clubs…</option></select></div><div class="auth-field"><span class="auth-field-icon">${authIcon('league')}</span><select id="cloud-signup-team" aria-label="Team"><option value="">Choose a club first</option></select></div><div id="cloud-signup-child-wrap">${authField({icon:'user',id:'cloud-signup-child',placeholder:'Child / player name',autocomplete:'off'})}</div></div><p class="auth-notice" id="cloud-signup-help"></p><p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-signup-submit">Create Account <span>→</span></button><button class="auth-link-strong" id="cloud-signup-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'adult',heroNote:'Welcome<br/>To<br/>The Club',title:'Create Account',copy:'Choose your account type, then fill in the details shown.',body,back:true});
      populateParentSignupChoices('cloud-signup-club','cloud-signup-team');
      const typeSel=document.getElementById('cloud-signup-type'),childWrap=document.getElementById('cloud-signup-child-wrap'),helpEl=document.getElementById('cloud-signup-help'),submitBtn=document.getElementById('cloud-signup-submit'),teamSel=document.getElementById('cloud-signup-team');
      const HELP={parent:'Enter your child’s name. A coach checks it before you see anything. You only ever see your own children.',coach:'Your Club Admin approves your request before you see team data.',assistant_coach:'Your Club Admin approves your request before you see team data.',club_admin:'The club owner approves Club Admin requests. Pick the team you work with.'};
      const LABEL={parent:'Request Parent Access',coach:'Request Coach Access',assistant_coach:'Request Assistant Coach Access',club_admin:'Request Club Admin Access'};
      const applyType=()=>{const t=typeSel.value;childWrap.classList.toggle('hidden',t!=='parent');helpEl.textContent=HELP[t]||'';submitBtn.innerHTML=(LABEL[t]||'Create Account')+' <span>→</span>';};
      typeSel.addEventListener('change',applyType);applyType();
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-signup-back')?.addEventListener('click',back);
      submitBtn.addEventListener('click',async()=>{
        const t=typeSel.value,name=document.getElementById('cloud-signup-name')?.value?.trim()||'',email=document.getElementById('cloud-signup-email')?.value?.trim()||'',password=document.getElementById('cloud-signup-password')?.value||'',teamId=teamSel?.value||'',child=document.getElementById('cloud-signup-child')?.value?.trim()||'';
        if(name.length<2)return authError('Enter your name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');if(!teamId)return authError('Choose your club and team.');
        if(t==='parent'&&child.length<2)return authError('Enter your child or player name.');
        const btn=submitBtn,label=btn.innerHTML;btn.disabled=true;btn.innerHTML='Creating…';
        try{
          if(t==='parent'){
            localStorage.setItem(PENDING_PARENT_REQUEST_KEY,JSON.stringify({team_id:teamId,child_name:child}));
            const data=await signUp(email,password,name,'',{parent_signup:true,requested_team_id:teamId,requested_child_name:child});
            if(data?.access_token){await requestParentAccess(teamId,child);localStorage.removeItem(PENDING_PARENT_REQUEST_KEY);context=await getContext();setGateHtml('approval','Your request has been sent to the coaching staff for verification.');return;}
            setGateHtml('verify','Account created. Confirm your email, then your access request will be sent to the coaching staff.',email);return;
          }
          const data=await signUp(email,password,name,'',{coach_signup:true,requested_team_id:teamId,requested_role:t});
          if(data?.access_token){await hydrateSessionUser();context=await getContext();await requestCoachAccess(teamId,t);context=await getContext();setGateHtml('coachapproval',t==='club_admin'?'Your request has been sent to the club owner for approval.':'Your request has been sent to the Club Admin for approval.');return;}
          setGateHtml('verify','Account created. Confirm your email, then sign in and your request goes for approval.',email);
        }catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));btn.disabled=false;btn.innerHTML=label;}
      });return;
    }

    if(mode==='coachapproval'||context?.profile?.role==='pending_coach'){
      const body=`<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-check-coach-approval">Check Approval <span>→</span></button><button class="auth-link-strong" id="cloud-reset-device">Back to Main Login</button>`;
      gate.innerHTML=authSimple('Waiting for Approval','Your account is set up. Team data appears once your Club Admin approves your access.',body,'STAFF ACCESS');
      document.getElementById('cloud-check-coach-approval')?.addEventListener('click',async()=>{try{context=await getContext();if(['coach','assistant_coach','club_admin'].includes(context?.profile?.role))location.reload();else showNotice('Still waiting for the Club Admin to approve access.');}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});document.getElementById('cloud-reset-device')?.addEventListener('click',()=>{clearInviteAccess();setGateHtml('signin');});return;
    }

    if(mode==='playerlogin'){
      const body=`<div class="auth-fields">${authField({icon:'user',id:'cloud-player-name',placeholder:'Player Name',autocomplete:'name',extra:'autocapitalize="words" spellcheck="false"'})}${authField({icon:'code',id:'cloud-player-code',placeholder:'Player Code',autocomplete:'off',extra:'autocapitalize="characters" spellcheck="false"'})}</div>
        <div class="auth-safe-note"><span>✓</span><p>Players sign in using their name and a reusable code provided by their coach or club.</p></div>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p>
        <button class="auth-primary" id="cloud-player-submit">Enter App <span>→</span></button><button class="auth-link-strong auth-back-link" id="cloud-player-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'player',heroNote:'Same<br/>Team<br/>Brighter<br/>Tomorrow',title:'Player Access',copy:'No email required.',body,footer:'A BRIGHTER TOMORROW TOGETHER',back:true});
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-player-back')?.addEventListener('click',back);
      document.getElementById('cloud-player-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-player-name')?.value?.trim()||'',code=document.getElementById('cloud-player-code')?.value?.trim()||'';if(name.length<2||code.length<6)return authError('Enter the player name and reusable player code.');const btn=document.getElementById('cloud-player-submit');if(btn){btn.disabled=true;btn.innerHTML='Checking…';}try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await playerCodeLogin(name,code);context=await getContext();if(context?.profile?.role!=='player'||Number(context?.team?.age_group||0)!==15){clearInviteAccess();throw new Error('This Player Access code is not assigned to an eligible U15 player account.');}clubConfiguration=await getClubConfiguration().catch(()=>null);window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'player-code'}}));}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));if(btn){btn.disabled=false;btn.innerHTML='Enter App <span>→</span>';}}});return;
    }

    if(mode==='clubsignup'){
      const body=`<div class="auth-fields">${authField({icon:'club',id:'cloud-club-name',placeholder:'Club Name',autocomplete:'organization'})}${authField({icon:'mail',id:'cloud-club-email',type:'email',placeholder:'Email address',autocomplete:'username'})}<div class="auth-password-wrap">${authField({icon:'lock',id:'cloud-club-password',type:'password',placeholder:'Password',autocomplete:'new-password'})}<button type="button" class="auth-eye" id="cloud-club-password-toggle" aria-label="Show or hide password">◉</button></div><div class="auth-field"><span class="auth-field-icon">${authIcon('league')}</span><select id="cloud-club-league" aria-label="League"><option value="selkent">Selkent Football League · automatic</option><option value="manual">Other County FA / League · manual setup</option></select></div></div>
        <p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p>
        <button class="auth-primary" id="cloud-club-create">Create Club <span>→</span></button><p class="auth-inline-login">Already have an account? <button id="cloud-club-login">Log In</button></p><div class="auth-info-note"><span>${authIcon('club')}</span><p>Clubs can create an account and manage access for the whole organisation.</p></div>`;
      gate.innerHTML=authMainScreen({screen:'club',heroNote:'Stronger<br/>Clubs<br/>Stronger<br/>Communities',title:'Create Club Account',copy:'Set up your club and start inviting coaches, parents and players.',body,footer:'GRASSROOTS TODAY · BRIGHTER TOMORROWS'});
      bindPasswordToggle('cloud-club-password','cloud-club-password-toggle');document.getElementById('cloud-club-login')?.addEventListener('click',()=>setGateHtml('signin'));
      document.getElementById('cloud-club-create')?.addEventListener('click',()=>{const club=document.getElementById('cloud-club-name')?.value?.trim()||'',email=document.getElementById('cloud-club-email')?.value?.trim()||'',password=document.getElementById('cloud-club-password')?.value||'',route=document.getElementById('cloud-club-league')?.value||'manual';if(club.length<3)return authError('Enter your club name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');window.UniversalOnboarding?.open?.({club_name:club,admin_email:email,admin_password:password,setup_mode:route==='selkent'?'auto':'manual',provider_search_query:club});});return;
    }

    if(mode==='adultsetup'){
      const body=`<p class="auth-caption auth-caption-top">Use a one-time staff invitation from your club to create an email and password account. Then sign in through the main login.</p><div class="auth-fields">${authField({icon:'user',id:'cloud-setup-name',placeholder:'Your name',autocomplete:'name'})}${authField({icon:'mail',id:'cloud-setup-email',type:'email',placeholder:'Email address',autocomplete:'username',value:prefillEmail})}${authField({icon:'lock',id:'cloud-setup-password',type:'password',placeholder:'Create password',autocomplete:'new-password'})}${authField({icon:'code',id:'cloud-setup-invite',placeholder:'Staff invite code',autocomplete:'one-time-code',extra:'autocapitalize="characters" spellcheck="false"'})}</div><p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-setup-submit">Create Account <span>→</span></button><button class="auth-link-strong" id="cloud-setup-back">Back to Main Login</button>`;
      gate.innerHTML=authMainScreen({screen:'adult',heroNote:'Welcome<br/>To<br/>The Club',title:'Set Up Your Account',copy:'Staff members use email and password after setup.',body,back:true});
      const back=()=>setGateHtml('signin');document.getElementById('auth-screen-back')?.addEventListener('click',back);document.getElementById('cloud-setup-back')?.addEventListener('click',back);
      document.getElementById('cloud-setup-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-setup-name')?.value?.trim()||'',email=document.getElementById('cloud-setup-email')?.value?.trim()||'',password=document.getElementById('cloud-setup-password')?.value||'',code=document.getElementById('cloud-setup-invite')?.value?.trim()||'';if(name.length<2)return authError('Enter your name.');if(!/^\S+@\S+\.\S+$/.test(email))return authError('Enter a valid email address.');if(password.length<8)return authError('Use at least 8 characters for the password.');if(!code)return authError('Enter the invitation from your club.');const btn=document.getElementById('cloud-setup-submit');if(btn){btn.disabled=true;btn.innerHTML='Creating…';}try{localStorage.setItem(INVITE_KEY,code);const data=await signUp(email,password,name,code);if(data?.access_token){await claimInvite(code);localStorage.removeItem(INVITE_KEY);location.reload();return;}setGateHtml('verify','Account created. Confirm your email to finish applying the club invitation.',email);}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));if(btn){btn.disabled=false;btn.innerHTML='Create Account <span>→</span>';}}});return;
    }

    if(mode==='pinlogin'){
      const body=`<p class="auth-caption auth-caption-top">Legacy access only. New adult accounts use email and password; new players use Player Access.</p><label>Club<select id="cloud-pin-club"><option value="">Loading clubs…</option></select></label><label>Team<select id="cloud-pin-team"><option value="">Choose a club first</option></select></label>${authField({icon:'user',id:'cloud-pin-name',placeholder:'Name'})}${authField({icon:'lock',id:'cloud-pin-login',type:'password',placeholder:'6-digit PIN',inputmode:'numeric',maxlength:'6'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-pin-login-submit">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-pin-back">Back to Main Login</button><button class="auth-legacy-link" id="cloud-use-old-invite">Use an old invite code</button>`;
      gate.innerHTML=authSimple('Existing PIN Access','For accounts created before the new login system.',body,'LEGACY ACCESS');populatePinClubChoices();
      document.getElementById('cloud-pin-back')?.addEventListener('click',()=>setGateHtml('signin'));document.getElementById('cloud-use-old-invite')?.addEventListener('click',()=>setGateHtml('join'));
      document.getElementById('cloud-pin-login-submit')?.addEventListener('click',async()=>{const club=document.getElementById('cloud-pin-club')?.value?.trim()||'',team=document.getElementById('cloud-pin-team')?.value?.trim()||'',name=document.getElementById('cloud-pin-name')?.value?.trim()||'',pin=document.getElementById('cloud-pin-login')?.value||'';if(club.length<2||team.length<2||name.length<2||!/^\d{6}$/.test(pin))return authError('Choose your club and team, then enter your name and 6-digit PIN.');try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await loginWithPin(club,team,name,pin);context=await getContext();clubConfiguration=await getClubConfiguration().catch(()=>null);window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'pin'}}));}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});return;
    }

    if(mode==='join'){
      const body=`<p class="auth-caption auth-caption-top">Legacy one-time access. New coaches and parents should use the account setup route from the main login.</p>${authField({icon:'user',id:'cloud-join-name',placeholder:'Your name'})}${authField({icon:'code',id:'cloud-join-code',placeholder:'Invite code',autocomplete:'one-time-code',extra:'autocapitalize="characters" spellcheck="false"'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-join-submit">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-admin-signin">Back to Main Login</button>`;
      gate.innerHTML=authSimple('Existing Invite Access','Use only if your club gave you an older one-time invite.',body,'LEGACY ACCESS');document.getElementById('cloud-admin-signin')?.addEventListener('click',()=>setGateHtml('signin'));
      document.getElementById('cloud-join-submit')?.addEventListener('click',async()=>{const name=document.getElementById('cloud-join-name')?.value?.trim()||'',code=document.getElementById('cloud-join-code')?.value?.trim()||'';if(name.length<2)return authError('Enter your name.');if(!code)return authError('Enter your invite code.');try{localStorage.removeItem(TEST_MODE_KEY);setInviteAccessLocked(false);await joinWithInvite(name,code);context=await getContext();if(context?.profile?.role==='pending_parent'){setGateHtml('approval','Your request is waiting for coach approval.');return;}window.dispatchEvent(new CustomEvent('clubhub-authenticated',{detail:{source:'invite'}}));}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});return;
    }

    if(mode==='approval'||context?.profile?.role==='pending_parent'){
      const body=`<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-link-strong" id="cloud-continue-registration">Continue registration</button><button class="auth-primary" id="cloud-check-approval">Check Approval <span>→</span></button><button class="auth-link-strong" id="cloud-reset-device">Back to Main Login</button>`;
      gate.innerHTML=authSimple('Waiting for Approval','Your parent account is set up. Complete your registration or wait for the club to review access.',body,'PARENT ACCESS');
      document.getElementById('cloud-continue-registration')?.addEventListener('click',()=>location.href='register.html');
      document.getElementById('cloud-check-approval')?.addEventListener('click',async()=>{try{context=await getContext();if(context?.profile?.role==='parent')location.reload();else showNotice('Still waiting for the club to approve access.');}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});document.getElementById('cloud-reset-device')?.addEventListener('click',()=>{clearInviteAccess();setGateHtml('signin');});return;
    }

    if(mode==='revoked'||context?.profile?.role==='revoked'){
      gate.innerHTML=authSimple('Access Removed','This account no longer has club access.',`<button class="auth-primary" id="cloud-reset-device">Return to Login <span>→</span></button>`,'ACCOUNT ACCESS');document.getElementById('cloud-reset-device')?.addEventListener('click',e=>signOut(e));return;
    }

    if(mode==='verify'){
      const email=prefillEmail||localStorage.getItem(VERIFY_EMAIL_KEY)||'';const body=`${authField({icon:'mail',id:'cloud-verify-email',type:'email',placeholder:'Email address',value:email})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-verify-continue">I’ve Verified My Email <span>→</span></button><button class="auth-link-strong" id="cloud-resend-btn">Resend confirmation email</button><button class="auth-link-strong" id="cloud-back-signin">Back to Login</button>`;const instructions=location.protocol==='file:'?'Tap the confirmation link, then return to Shooters Hill AFC. If the browser does not reopen the app automatically, come back here and continue.':'Open the confirmation link in your email. It will return you to Shooters Hill AFC in your browser; sign in if prompted.';gate.innerHTML=authSimple('Check Your Inbox',instructions,body,'VERIFY EMAIL');document.getElementById('cloud-verify-continue')?.addEventListener('click',()=>{const addr=document.getElementById('cloud-verify-email')?.value?.trim()||email;setGateHtml('signin',localStorage.getItem(INVITE_KEY)?'Sign in to finish applying your club invitation.':'Sign in to finish sending your parent access request.',addr);});document.getElementById('cloud-resend-btn')?.addEventListener('click',async()=>{const addr=document.getElementById('cloud-verify-email')?.value?.trim();if(!addr)return authError('Enter your email address.');try{await resendSignup(addr);showNotice('Confirmation email sent. After confirming, return to Shooters Hill AFC and continue.');}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});document.getElementById('cloud-back-signin')?.addEventListener('click',()=>setGateHtml('signin','',email));return;
    }

    if(mode==='forgot'){
      const body=`${authField({icon:'mail',id:'cloud-recover-email',type:'email',placeholder:'Email address',value:prefillEmail})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-recover-submit">Send Reset Email <span>→</span></button><button class="auth-link-strong" id="cloud-back-signin">Back to Login</button>`;gate.innerHTML=authSimple('Reset Password','We’ll send a secure password reset link to your email address.',body,'ACCOUNT RECOVERY');document.getElementById('cloud-recover-submit')?.addEventListener('click',async()=>{const email=document.getElementById('cloud-recover-email')?.value?.trim()||'';if(!email)return authError('Enter your email address.');try{await sendPasswordReset(email);showNotice('Password reset email sent. Open the link on this device.');}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});document.getElementById('cloud-back-signin')?.addEventListener('click',()=>setGateHtml('signin'));return;
    }

    if(mode==='newpassword'||mode==='pinsetup'||mode==='preapproval-pin'||mode==='resume'){
      if(mode==='newpassword'){
        const body=`${authField({icon:'lock',id:'cloud-new-password',type:'password',placeholder:'New password',autocomplete:'new-password'})}${authField({icon:'lock',id:'cloud-new-password2',type:'password',placeholder:'Repeat new password',autocomplete:'new-password'})}<p class="auth-notice ${message?'':'hidden'}" id="cloud-auth-notice">${escapeHtml(message)}</p><p class="activation-error hidden" id="cloud-auth-error" role="alert"></p><button class="auth-primary" id="cloud-password-save">Save Password <span>→</span></button>`;gate.innerHTML=authSimple('Choose New Password','Use at least 8 characters.',body,'ACCOUNT RECOVERY');document.getElementById('cloud-password-save')?.addEventListener('click',async()=>{const a=document.getElementById('cloud-new-password')?.value||'',b=document.getElementById('cloud-new-password2')?.value||'';if(a.length<8)return authError('Use at least 8 characters.');if(a!==b)return authError('The passwords do not match.');try{await updatePassword(a);location.reload();}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')return;authError(e.message||String(e));}});return;
      }
      gate.innerHTML=authSimple('Legacy Access','This account uses the previous PIN/access method.',`<p class="auth-notice">${escapeHtml(message||'Continue using the existing access method or return to the main login.')}</p><button class="auth-primary" id="cloud-legacy-continue">Continue <span>→</span></button><button class="auth-link-strong" id="cloud-legacy-main">Main Login</button>`,'LEGACY ACCESS');document.getElementById('cloud-legacy-continue')?.addEventListener('click',()=>setGateHtml('pinlogin'));document.getElementById('cloud-legacy-main')?.addEventListener('click',()=>setGateHtml('signin'));return;
    }

    setGateHtml('signin',message,prefillEmail);
  }
  function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function authError(msg){const el=document.getElementById('cloud-auth-error');if(el){el.textContent=msg;el.classList.remove('hidden');}const notice=document.getElementById('cloud-auth-notice');if(notice)notice.classList.add('hidden');}
  function showNotice(msg){const el=document.getElementById('cloud-auth-notice');if(el){el.textContent=msg;el.classList.remove('hidden');}const err=document.getElementById('cloud-auth-error');if(err)err.classList.add('hidden');}
  function hideGate(){document.getElementById('activation-gate')?.classList.add('hidden');document.body.classList.remove('auth-open');document.querySelector('.app-shell')?.classList.remove('account-locked');}
  async function signOut(event,nextMode='signin'){
    try{event?.preventDefault?.();event?.stopPropagation?.();}catch{}
    const oldSession=session||loadSession(),accessToken=oldSession?.access_token||'',attempt=++authAttempt;
    lockGate();clearInviteAccess();clearAccountLocalData();localStorage.removeItem(TEST_MODE_KEY);localStorage.removeItem(VERIFY_EMAIL_KEY);
    context=null;clubConfiguration=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';
    try{if(nextMode==='parentsignin')sessionStorage.setItem(PARENT_SIGNIN_AFTER_LOGOUT_KEY,'1');else sessionStorage.removeItem(PARENT_SIGNIN_AFTER_LOGOUT_KEY);}catch{}
    try{document.querySelectorAll('dialog[open]').forEach(d=>d.close());}catch{}
    setGateHtml(nextMode==='parentsignin'?'parentsignin':'signin');window.dispatchEvent(new CustomEvent('clubhub-signed-out'));
    const current=()=>attempt===authAttempt&&!loadSession()?.access_token;
    const controllers=new Set();
    const cleanupRequest=(path,body)=>{const controller=typeof AbortController==='function'?new AbortController():null;if(controller)controllers.add(controller);return fetch(base()+path,{method:'POST',headers:authHeaders(accessToken),...(body?{body:JSON.stringify(body)}:{}),keepalive:true,...(controller?{signal:controller.signal}:{})}).finally(()=>controllers.delete(controller));};
    const reload=()=>{for(const controller of controllers)controller.abort();if(!current())return;try{location.replace(location.href.split('#')[0].split('?')[0]);}catch{location.reload();}};
    const deadline=setTimeout(reload,1500);
    const cleanup=[];
    try{cleanup.push(Promise.resolve(window.ClubHubKickoffUpdates?.disableForLogout?.({isCurrent:current,unregister:endpoint=>accessToken?cleanupRequest('/rest/v1/rpc/unregister_kickoff_push',{p_endpoint:endpoint}):Promise.resolve()})));}catch{}
    if(accessToken)cleanup.push(cleanupRequest('/auth/v1/logout'));
    Promise.allSettled(cleanup).then(()=>{clearTimeout(deadline);if(current())setTimeout(reload,120);});
  }
  function switchToParentSignIn(){return signOut(null,'parentsignin');}

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
    document.body.classList.add('cloud-enabled');accountReady=false;readyBootstrap=null;pendingBootstrapContext=null;lockGate();if(!document.getElementById('activation-gate')?.dataset?.authMode){setGateHtml('signin');const checking=document.getElementById('cloud-auth-submit');if(checking){checking.disabled=true;checking.textContent='Signing in…';}}
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
    const bootScope=captureAccountRequest();
    const valid=await awaitAccountWork(ensureFreshSession(),bootScope);if(valid)assertAccountRequest(bootScope);else if(bootScope.generation!==accountGeneration||bootScope.attempt!==authAttempt)throw accountContextChanged();
    if(!valid){
      clearAccountLocalData();
      let parentSignIn=false;
      try{parentSignIn=sessionStorage.getItem(PARENT_SIGNIN_AFTER_LOGOUT_KEY)==='1';sessionStorage.removeItem(PARENT_SIGNIN_AFTER_LOGOUT_KEY);}catch{}
      const coachInvitation=/(?:[?&])signup=coach(?:&|$)/.test(String(window.location?.search||''));
      setGateHtml(coachInvitation?'coachsignup':parentSignIn?'parentsignin':'signin');return null;
    }
    try{sessionStorage.removeItem(PARENT_SIGNIN_AFTER_LOGOUT_KEY);}catch{}
    const pendingAdultInvite=localStorage.getItem(INVITE_KEY)||'';
    if(pendingAdultInvite){
      try{await claimInvite(pendingAdultInvite);localStorage.removeItem(INVITE_KEY);}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')throw e;setGateHtml('adultsetup','Your email account is signed in, but the invitation could not be applied. Check the invite code and try again.');return null;}
    }
    const teamCache=cachedTeams();
    let teamFetch=null;
    try{
      teamFetch=listTeams().catch(()=>null);
      const nextContext=await getContext();assertAccountRequest(bootScope);context=nextContext;if(context?.profile?.user_id===session?.user?.id)verifiedAccountUser=session.user.id;
    }catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')throw e;saveSession(null);clearAccountLocalData();setGateHtml('signin','Your saved access expired. Sign in again.');return null;}
    if(!context?.profile){saveSession(null);clearAccountLocalData();setGateHtml('signin','No club access profile is attached to this account.');return null;}
    if(context.profile.role==='pending'){
      try{await resumeCoachSignupRequestFromMetadata();}catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')throw e;setGateHtml('signin','Your account is verified, but the coach access request could not be submitted. '+(e.message||''),session?.user?.email||'');return null;}
    }
    if(context.profile.role==='pending_coach'){setGateHtml('coachapproval','Your account is ready. Waiting for the Club Admin to approve access.');return null;}
    if(context.profile.role==='pending'){
      try{await resumeParentSignupRequestFromMetadata();}
      catch(e){if(e?.code==='AUTH_CONTEXT_CHANGED')throw e;setGateHtml('signin','Your account is verified, but the parent access request could not be submitted. '+(e.message||''),session?.user?.email||'');return null;}
    }
    try{const configuration=await getClubConfiguration();assertAccountRequest(bootScope);clubConfiguration=configuration;}catch(error){if(error?.code==='AUTH_CONTEXT_CHANGED')throw error;clubConfiguration=null;}
    if(context.profile.role==='pending_parent'){
      setGateHtml('approval','Your parent account is ready. Waiting for coach approval.');return null;
    }
    if(context.profile.role==='player'&&context.profile.access_method!=='player_code'&&!context.profile.pin_set_at){setGateHtml('pinsetup','This is a legacy player account. Create a 6-digit PIN to continue.');return null;}
    if(context.profile.role==='revoked'){clearAccountLocalData();setGateHtml('revoked');return null;}
    if(context.profile.role==='pending'){setGateHtml('signup','This account is not attached to a club yet. Choose your account type and team to request access.');return null;}
    if(!['club_admin','coach','assistant_coach','parent','player'].includes(context.profile.role)||context.profile.user_id!==session?.user?.id){clearAccountLocalData();setGateHtml('signin','No club access profile is attached to this account.');return null;}
    if(context.profile.role==='player'&&Number(context.team?.age_group)!==15){clearAccountLocalData();setGateHtml('signin','This Player Access code is not assigned to an eligible U15 player account.');return null;}
    if(context.profile.role==='parent'){
      const linked=await teamFetch;assertAccountRequest(bootScope);
      if(!Array.isArray(linked)){setGateHtml('signin','Could not verify linked teams. Please try again.');return null;}
      visibleTeams=linked;
    }else if(teamCache.length){visibleTeams=teamCache;teamFetch?.then(rows=>{assertAccountRequest(bootScope);if(Array.isArray(rows)&&rows.length){visibleTeams=rows;}}).catch(()=>{});}else{const rows=await teamFetch;assertAccountRequest(bootScope);visibleTeams=rows||[];}
    activeTeam=chooseActiveTeam(options.localState||null);
    if(!activeTeam){setGateHtml('join','No team is available to this account.');return null;}
    if(inviteAccessActive() && inviteAccessLocked()){setGateHtml('resume');return null;}
    updateCloudPanel();
    const result={configured:true,role:role(),profile:context.profile,club:context.club,configuration:clubConfiguration,team:oldShapeTeam(activeTeam),teams:visibleTeamList(),email:session?.user?.email||''};pendingBootstrapContext=result;return result;
  }

  function bootstrapResult(value,scope,refresh=null){readyBootstrap={value,scope,refresh};return value;}
  function completeBootstrap(loaded,render){
    const ready=readyBootstrap;if(!ready||ready.value!==loaded)throw accountContextChanged();assertTeamStateScope(ready.scope);
    accountReady=true;
    try{if(render)render();assertTeamStateScope(ready.scope);readyBootstrap=null;pendingBootstrapContext=null;hideGate();updateCloudPanel();if(ready.refresh)ready.refresh();return true;}
    catch(error){accountReady=false;lockGate();throw error;}
  }
  function failBootstrap(error,loaded){if(error?.code==='AUTH_CONTEXT_CHANGED')return;if(loaded&&readyBootstrap?.value!==loaded)return;readyBootstrap=null;lockGate();setGateHtml('signin',error?.message||'Team information is not available. Please try again.');}
  async function loadInitialState(localState,seedFactory){
    if(testModeActive()){const seed=seedFactory?seedFactory(oldShapeTeam(activeTeam)):localState;return bootstrapResult({state:seed,fromCloud:false,testMode:true},captureTeamStateScope());}
    if(!configured())return {state:localState,fromCloud:false};
    if(!activeTeam)throw new Error('Team information is not available. Please try again.');
    const scope=captureTeamStateScope(),teamId=activeTeam.id,cached=cachedTeamState(teamId);
    if(cached?.state&&!(suspendedDraft&&suspendedDraft.owner===draftOwner(scope))){
      acceptTeamStateRead(cached,scope);
      const refresh=()=>fetchTeamState(teamId,scope).then(row=>{assertTeamStateScope(scope,{passive:true});acceptTeamStateRead(row,scope,{passive:true,reason:row?.state&&Number(row.revision)!==Number(cached.revision)?'background-refresh':''});}).catch(()=>{});
      return bootstrapResult({state:cached.state,fromCloud:true,cached:true,revision:activeRevision},scope,refresh);
    }
    const row=await fetchTeamState(teamId,scope);assertTeamStateScope(scope);
    if(row?.state){
      acceptTeamStateRead(row,scope);
      const draft=suspendedDraft;
      if(draft&&draft.owner===draftOwner(scope)){
        activeRevision=draft.revision;unsyncedState=true;
        const resume=draft.resume?()=>{assertTeamStateScope(scope);if(suspendedDraft!==draft)return;suspendedDraft=null;queueStateSave(draft.state);}:null;
        return bootstrapResult({state:JSON.parse(JSON.stringify(draft.state)),fromCloud:false,unsynced:true,revision:activeRevision},scope,resume);
      }
      return bootstrapResult({state:row.state,fromCloud:true,revision:activeRevision},scope);
    }
    if(canEditPermission()){
      const seed=seedFactory?seedFactory(oldShapeTeam(activeTeam)):null;if(!seed)throw new Error('Team information is not available. Please try again.');
      activeRevision=-1;await saveTeamStateNow(seed,{bootstrapScope:scope});assertTeamStateScope(scope);
      return bootstrapResult({state:seed,fromCloud:false,created:true,revision:activeRevision},scope);
    }
    throw new Error('Team information is not available. Please try again.');
  }
  function startPolling(){
    if(!configured()||!activeTeam)return;
    clearInterval(pollTimer);
    pollTimer=setInterval(()=>{if(document.visibilityState==='visible')pullLatest({quiet:true});},Math.max(15000,Number(cfg.syncIntervalMs||30000)));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullLatest({quiet:true});});
  }

  async function getRegistrationContactConduct({teamId,playerName,season}){return rpc('get_registration_contact_conduct',{p_team_id:teamId,p_player_name:playerName,p_season:season});}
  async function submitRegistrationContactConduct({teamId,playerName,season,mobile,documentVersion,agree}){return rpc('submit_registration_contact_conduct',{p_team_id:teamId,p_player_name:playerName,p_season:season,p_mobile:mobile,p_document_version:documentVersion,p_agree:agree===true});}
  async function readRegistrationConductDocument({teamId,playerName,season}){
    const scope=captureAccountRequest();if(!await ensureFreshSession())throw Error('Sign in first');assertAccountRequest(scope);
    const url=new URL('/__registration_document',location.href);url.searchParams.set('team',teamId);url.searchParams.set('player',playerName);url.searchParams.set('season',season);
    const response=await fetch(url,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
    assertAccountRequest(scope);if(!response.ok)throw Error('Code of conduct unavailable');const blob=await response.blob();assertAccountRequest(scope);return blob;
  }
  window.addEventListener?.('storage',event=>{
    if(event.key!==SESSION_KEY)return;
    const next=loadSession();
    const oldUser=session?.user?.id||verifiedAccountUser||context?.profile?.user_id||'',nextUser=next?.user?.id||'';
    if(oldUser&&oldUser===nextUser){session=next;return;}
    const attempt=++authAttempt;lockGate();clearAccountLocalData({preserveUser:nextUser});session=next;verifiedAccountUser=nextUser;authAttemptOwner=nextUser;context=null;clubConfiguration=null;visibleTeams=[];activeTeam=null;activeRevision=-1;lastRemoteUpdatedAt='';
    setGateHtml('signin');setTimeout(()=>{if(attempt!==authAttempt||String(loadSession()?.user?.id||'')!==nextUser)return;try{location.replace(location.href.split('#')[0].split('?')[0]);}catch{location.reload();}},120);
  });
  window.ClubHubCloud={
    getRegistrationContactConduct,submitRegistrationContactConduct,readRegistrationConductDocument,listContactDirectory,saveMemberContactDetails,importMemberContactDetails,loadAdminPlayerOnboarding,onboardAdminPlayer,
    configured,bootstrap,loadInitialState,completeBootstrap,failBootstrap,queueStateSave,confirmStateSave,pullLatest,startPolling,commitMatchAction,commitTournamentAction,reviewMatchActionState,clearMatchActionAttendance,clearMatchActionNote,
    role,requestCoachAccess,listPendingCoachRequests,reviewCoachRequest,listMyCoachTeams,switchMyCoachTeam,setMyCapacity,requestChildLink,realRole,isStaffAccount,actingAsParent,assignCoachTeam,unassignCoachTeam,canEdit,canAdmin,assignedTeam,currentTeam,coachTeam,hasDualCoachAccess,visibleTeamList,getClubConfiguration,listLoginClubs,listLoginTeams,listCurrentClubLoginTeams,createInvite,requestParentAccess,listPendingParentRequests,listTeamMembers,listClubCoaches,listCoachQualifications,getCoachQualifications,saveCoachQualifications,listClubAccessAccounts,removeClubCoach,listPublishedClubResults,listParentPlayerLinks,saveParentPlayerLinks,listPlayerAccountLinks,listMatchAvailability,saveMatchAvailability,saveCoachMatchAvailability,listSelkentTeamDirectory,syncSelkentTeamDirectory,getCoachMatchNote,saveCoachMatchNote,listAnnouncements,createAnnouncement,markAnnouncementRead,deleteAnnouncement,listMatchAttendance,saveMatchAttendance,getAvailabilitySettings,setAvailabilityDeadline,sendAvailabilityReminder,listNotifications,acknowledgeKickoffUpdate,acknowledgeKickoffAsCoach,respondKickoffParentAvailability,listKickoffUpdatesForAdmin,getKickoffPushSettings,registerKickoffPush,unregisterKickoffPush,markNotificationRead,notifyFixtureChange,notifySelectedSquad,notifyMatchReport,notifyMatchReopened,listPlayerAppearanceStats,recordAuditEvent,listAuditHistory,listSeasonArchives,getSeasonArchive,archiveCurrentSeason,rolloverClubSeason,resetParentPin,setAccessPin,approveParentRequest,removeTeamMember,syncTeamDirectory,switchAdminTeam,switchParentTeam,getClubOverview,signOut,switchToParentSignIn,handleAuthCallback,listMessageContacts,listClubMessages,sendClubMessage,markClubMessagesRead,getClubComplianceStatus,setDisputeReviewers,setClubSafeguardingContacts,getConcernRouting,raiseClubConcern,listGeneralDisputes,listDisputeMessages,upsertU11SafeguardingInfo,exportU11SafeguardingPack,listSafeguardingExportAudit,requestClubCancellation,cancelClubCancellation,
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
