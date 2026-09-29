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
const env={
  profileRole:'parent',session:null,context:null,
  AUTH_DESIGN_REVISION:'test',TEST_MODE_KEY:'test',VERIFY_EMAIL_KEY:'verify',
  document:{body:{classList:{add(){}}},getElementById:id=>id==='activation-gate'?gate:nodes.get(id)||null,querySelector:()=>({classList:{add(){}}})},
  window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  localStorage:{removeItem:key=>storage.delete(key),setItem:(key,value)=>storage.set(key,value)},
  authField:({id})=>`<input id="${id}">`,authIcon:()=>'',escapeHtml:s=>String(s),
  authMainScreen:({title,body,back})=>`<h1>${title}</h1>${back?'<button id="auth-screen-back"></button>':''}${body}`,
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
  assert.match(gate.innerHTML,/Parent Sign In/,'main login offers an explicit parent route');
  nodes.get('cloud-parent-login').listeners.click();
  assert.equal(gate.dataset.authMode,'parentsignin');
  assert.match(gate.innerHTML,/<h1>Parent Sign In<\/h1>/);
  assert.match(gate.innerHTML,/Parent Sign Up/);
  nodes.get('cloud-email').value='parent@example.test';nodes.get('cloud-password').value='password';
  env.profileRole='coach';
  await nodes.get('cloud-auth-submit').listeners.click();
  assert.deepEqual(calls,['signIn','logout','clear','clearData']);
  assert.equal(env.session,null,'a staff account is discarded from the parent route');
  assert.equal(events.length,0,'staff sign-in cannot be counted as a parent test');
  assert.match(errors.at(-1),/approved Parent access/);

  env.profileRole='parent';calls.length=0;
  await nodes.get('cloud-auth-submit').listeners.click();
  assert.deepEqual(calls,['signIn','openApp']);
  assert.equal(events[0].detail.source,'parent-signin');
  env.openGate('signin');env.profileRole='coach';calls.length=0;
  nodes.get('cloud-email').value='coach@example.test';nodes.get('cloud-password').value='password';
  await nodes.get('cloud-auth-submit').listeners.click();
  assert.deepEqual(calls,['signIn','openApp'],'the shared adult login still accepts a coach');
  assert.equal(events.at(-1).detail.source,'signin');
  console.log('PASS dedicated parent sign-in rejects staff and accepts approved parent');
})().catch(err=>{console.error(err);process.exitCode=1;});
