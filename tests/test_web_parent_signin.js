#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const start=source.indexOf("  function setGateHtml(mode='signin'");
const end=source.indexOf('  function escapeHtml(',start);
assert(start>=0&&end>start);
const nodes=new Map();
const element=()=>({value:'',disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){}},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
const gate=element();gate.dataset={};
Object.defineProperty(gate,'innerHTML',{get(){return this.markup||''},set(markup){this.markup=markup;nodes.clear();for(const [,id] of markup.matchAll(/id="([^"]+)"/g))nodes.set(id,element());}});
nodes.set('activation-gate',gate);
const events=[],errors=[],calls=[];
const storage=new Map();
let prevented=0;
const submit=()=>nodes.get('cloud-signin-form').listeners.submit({preventDefault(){prevented++;}});
const env={
  profileRole:'parent',session:null,context:null,
  AUTH_DESIGN_REVISION:'test',TEST_MODE_KEY:'test',VERIFY_EMAIL_KEY:'verify',
  document:{body:{classList:{add(){}}},getElementById:id=>id==='activation-gate'?gate:nodes.get(id)||null,querySelector:()=>({classList:{add(){}}})},
  window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  localStorage:{removeItem:key=>storage.delete(key),setItem:(key,value)=>storage.set(key,value)},
  authField:({id})=>`<input id="${id}">`,authIcon:()=>'',escapeHtml:s=>String(s),
  authMainScreen:({title,body,after='',back})=>`<h1>${title}</h1>${back?'<button id="auth-screen-back"></button>':''}${body}${after}`,
  bindPasswordToggle(){},setInviteAccessLocked(){},
  signIn:async()=>{calls.push('signIn');env.session={access_token:'fake-token'};},
  hydrateSessionUser:async()=>{},getContext:async()=>({profile:{role:env.profileRole}}),
  resumeParentSignupRequestFromMetadata:async()=>{},
  clearInviteAccess:()=>{calls.push('clear');env.session=null;env.context=null;},
  clearAccountLocalData:()=>calls.push('clearData'),
  fetch:async()=>{calls.push('logout');return{ok:true};},base:()=> 'https://example.supabase.co',authHeaders:()=>({}),
  hideGate:()=>calls.push('openApp'),authError:message=>errors.push(message)
};
vm.runInNewContext(`${source.slice(start,end)}\nthis.openGate=setGateHtml;`,env);

(async()=>{
  env.openGate('signin');
  assert.match(gate.innerHTML,/<form id="cloud-signin-form" novalidate>/);
  assert.match(gate.innerHTML,/<button type="submit" class="auth-primary" id="cloud-auth-submit">/);
  assert.ok(nodes.get('cloud-signin-form').listeners.submit,'Enter and the submit button use native form submission');
  assert.match(gate.innerHTML,/Parent sign in/i,'main login offers an explicit parent route');
  nodes.get('cloud-parent-login').listeners.click();
  assert.equal(gate.dataset.authMode,'parentsignin');
  assert.match(gate.innerHTML,/<h1>Parent sign in<\/h1>/i);
  assert.match(gate.innerHTML,/Create account/i);
  nodes.get('cloud-email').value='parent@example.test';nodes.get('cloud-password').value='password';
  env.profileRole='coach';
  await submit();
  assert.deepEqual(calls,['signIn','logout','clear','clearData']);
  assert.equal(env.session,null,'a staff account is discarded from the parent route');
  assert.equal(events.length,0,'staff sign-in cannot be counted as a parent test');
  assert.match(errors.at(-1),/approved Parent access/);

  env.profileRole='parent';calls.length=0;
  await submit();
  assert.deepEqual(calls,['signIn']);
  assert.equal(events[0].detail.source,'parent-signin');
  env.openGate('signin');env.profileRole='coach';calls.length=0;
  nodes.get('cloud-email').value='coach@example.test';nodes.get('cloud-password').value='password';
  await submit();
  assert.deepEqual(calls,['signIn'],'the shared adult login still accepts a coach');
  assert.equal(events.at(-1).detail.source,'signin');
  await submit();
  assert.deepEqual(calls,['signIn'],'repeated submission is ignored while signing in');
  assert.equal(prevented,4,'form submission never reloads the page');
  const {harness}=require('./helpers/cloud_client_harness');
  const h=harness();await h.api.switchToParentSignIn();
  assert.equal(h.api.session,null);assert.equal(h.api.context,null);assert.equal(h.api.currentTeam(),null);
  assert.equal(h.node('activation-gate').dataset.authMode,'parentsignin');
  assert(h.node('shell').classList.contains('account-locked'),'parent sign-in transition retains gate');
  assert.equal(h.sessionStore.get('pitchkind_parent_signin_after_logout_v1'),'1');
  await h.api.bootstrap();
  assert.equal(h.node('activation-gate').dataset.authMode,'parentsignin','clean bootstrap restores the intended parent route');
  assert.equal(h.sessionStore.has('pitchkind_parent_signin_after_logout_v1'),false,'parent route intent is consumed once');
  await h.api.bootstrap();
  assert.equal(h.node('activation-gate').dataset.authMode,'signin','later clean visits return to shared adult sign-in');
  console.log('PASS parent route rejects staff, shared adult login accepts coach, and clean bootstrap consumes parent intent once');
})().catch(err=>{console.error(err);process.exitCode=1;});
