'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const response=(status,data)=>({status,ok:status>=200&&status<300,headers:{},text:async()=>JSON.stringify(data),json:async()=>data,blob:async()=>data});
const session=(id='a')=>({access_token:'token-'+id,refresh_token:'refresh-'+id,user:{id,email:id+'@example.invalid',user_metadata:{}},expires_at:Math.floor(Date.now()/1000)+3600});
function harness(handler=null){
 const store=new Map(),sessionStore=new Map(),events=[],requests=[],updates=[],listeners={},timers=new Map(),nodes=new Map();let seq=0;
 const node=id=>{if(!nodes.has(id)){const flags=new Set();const el={id,dataset:{},disabled:false,value:'',textContent:'',remove(){},listeners:{},classList:{add:x=>flags.add(x),remove:x=>flags.delete(x),contains:x=>flags.has(x)},setAttribute(){},addEventListener:(k,fn)=>{el.listeners[k]=fn;},querySelector:()=>null,appendChild(){}};Object.defineProperty(el,'innerHTML',{get:()=>el.markup||'',set:html=>{el.markup=html;for(const [,x]of html.matchAll(/id="([^"]+)"/g))node(x);}});nodes.set(id,el);}return nodes.get(id);};
 const localStorage={getItem:k=>store.get(k)||null,setItem(k,v){store.set(k,String(v));this[k]=String(v);},removeItem(k){store.delete(k);delete this[k];}};
 const location={protocol:'https:',origin:'https://fictional.test',pathname:'/',search:'',hash:'',href:'https://fictional.test/',replace:x=>events.push({type:'reload',url:x}),reload:()=>events.push({type:'reload'})};
 const window={CLUB_HUB_CLOUD:{url:'https://fictional.supabase.co',anonKey:'a'.repeat(60)},addEventListener:(k,fn)=>{(listeners[k]||=[]).push(fn);},dispatchEvent:e=>{events.push(e);for(const fn of listeners[e.type]||[])fn(e);}};
 const document={getElementById:node,body:node('body'),querySelector:()=>node('shell'),querySelectorAll:()=>[]};
 const fetch=async(url,options={})=>{const r={url,path:new URL(url).pathname+new URL(url).search,options,body:options.body?JSON.parse(options.body):null};requests.push(r);if(handler){const v=await handler(r,h);if(v!==undefined)return v;}
  const uid=String(options.headers?.Authorization||'Bearer token-a').replace('Bearer token-','');
  if(r.path==='/auth/v1/user')return response(200,session(uid).user);
  if(r.path.includes('/auth/v1/token?grant_type=password'))return response(200,session(r.body.email.split('@')[0]));
  if(r.path.includes('/auth/v1/token?grant_type=refresh_token'))return response(200,{...session(r.body.refresh_token.replace('refresh-','')),expires_in:3600});
  if(r.path==='/rest/v1/rpc/get_my_context')return response(200,{profile:{user_id:uid,role:uid==='b'?'parent':'club_admin',club_id:'club',coach_team_id:'one'},real_role:uid==='b'?'parent':'club_admin',team:{id:'one',age_group:12,name:'One',club_id:'club'}});
  if(r.path.startsWith('/rest/v1/teams?'))return response(200,h.teams);
  if(r.path==='/rest/v1/rpc/get_my_club_configuration')return response(200,{settings:{slug:'fictional'},teams:h.teams});
  if(r.path==='/rest/v1/rpc/get_team_state_for_me')return response(200,{team_id:r.body.p_team_id,state:{meta:{teamName:r.body.p_team_id},matches:[],squad:[]},revision:r.body.p_team_id==='one'?2:7,updated_at:'now'});
  if(r.path==='/rest/v1/rpc/save_team_state')return response(200,{revision:3});
  if(r.path==='/auth/v1/logout'||r.path==='/rest/v1/rpc/unregister_kickoff_push')return response(200,{});
  if(r.path==='/auth/v1/signup')return response(200,session('new'));
  if(r.path==='/functions/v1/pin-login'||r.path==='/functions/v1/join-team'||r.path==='/functions/v1/player-access')return response(200,{session:session('new')});
  throw Error('Unexpected request '+r.path);
 };
 const env={window,document,localStorage,sessionStorage:{getItem:k=>sessionStore.get(k)||null,setItem:(k,v)=>sessionStore.set(k,String(v)),removeItem:k=>sessionStore.delete(k)},location,history:{replaceState:(a,b,url)=>events.push({type:'history',url})},URL,URLSearchParams,AbortController,fetch,Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},HTMLElement:class{},setTimeout:(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval(){},console};
 const expose=`window.__test={initialize(s,roleName='club_admin'){saveSession(s);activeTeam={id:'one',age_group:12,name:'One',club_id:'club'};visibleTeams=[activeTeam,{id:'two',age_group:13,name:'Two',club_id:'club'}];context={profile:{user_id:s.user.id,role:roleName,club_id:'club',coach_team_id:'one'},team:activeTeam,real_role:roleName};activeRevision=1;accountReady=true;hooks={onRemoteState:(state,meta)=>window.__updates.push({state,meta})};},request,signIn,signUp,loginWithPin,playerCodeLogin,joinWithInvite,cacheTeamState,cachedTeamState,clearAccountLocalData,beginAuthAttempt,debug:()=>({pendingState,unsyncedState,saving,confirmingState,activeRevision,accountReady,accountGeneration,authAttempt}),setFlags(v){({pendingState=pendingState,unsyncedState=unsyncedState,saving=saving,confirmingState=confirmingState}=v);},ready(){accountReady=true;},getTeam:()=>activeTeam,setTeam:v=>{activeTeam=v;},clearSession:()=>saveSession(null)};\n  window.ClubHubCloud={`;
 window.__updates=updates;
 const source=fs.readFileSync(path.join(__dirname,'../../app/src/main/assets/cloud.js'),'utf8');vm.runInNewContext(source.replace('  window.ClubHubCloud={',expose),env,{filename:'cloud.js'});
 const h={sessionStore,api:window.ClubHubCloud,test:window.__test,window,store,localStorage,events,requests,updates,timers,nodes,node,location,teams:[{id:'one',age_group:12,name:'One',club_id:'club'},{id:'two',age_group:13,name:'Two',club_id:'club'}],fire:async delay=>{for(const[id,t]of[...timers])if(t.delay===delay){timers.delete(id);t.fn();}await tick();},storage:(value,eventValue=value)=>{if(value)localStorage.setItem('grassroots_hub_cloud_session_v1',JSON.stringify(value));else localStorage.removeItem('grassroots_hub_cloud_session_v1');for(const fn of listeners.storage||[])fn({key:'grassroots_hub_cloud_session_v1',newValue:eventValue?JSON.stringify(eventValue):null});}};
 h.test.initialize(session());events.length=0;return h;
}
module.exports={harness,session,response,deferred,tick,copy};
