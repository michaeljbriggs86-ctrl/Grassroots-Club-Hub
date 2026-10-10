#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const take=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert(a>=0&&b>a);return source.slice(a,b);};
const nodes=new Map();
const node=()=>({attrs:{},type:'password',value:'',textContent:'',disabled:false,listeners:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;}});
const gate=node();gate.dataset={};
Object.defineProperty(gate,'innerHTML',{get(){return this.markup;},set(markup){this.markup=markup;nodes.clear();for(const [,id] of markup.matchAll(/id="([^"]+)"/g))nodes.set(id,node());}});
const errors=[],calls=[];
const env={AUTH_DESIGN_REVISION:'test',TEST_MODE_KEY:'test',VERIFY_EMAIL_KEY:'verify',session:null,context:null,
  document:{getElementById:id=>id==='activation-gate'?gate:nodes.get(id)||null,body:{classList:{add(){}}},querySelector:()=>({classList:{add(){}}})},
  localStorage:{removeItem(){},setItem(){}},window:{dispatchEvent(){}},CustomEvent:class{},setInviteAccessLocked(){},authIcon:()=>'',
  signIn:async()=>{calls.push('signIn');throw Error('Invalid login credentials');},hydrateSessionUser:async()=>{},getContext:async()=>{},authError:msg=>errors.push(msg)};
vm.createContext(env);
vm.runInContext(take('  function authBrand(',"  function setGateHtml(mode='signin'")+take("  function setGateHtml(mode='signin'",'  function authError('),env);
env.setGateHtml('signin');
assert.match(gate.innerHTML,/<label class="auth-field-label" for="cloud-email">Email address<\/label>/);
assert.match(gate.innerHTML,/<label class="auth-field-label" for="cloud-password">Password<\/label>/);
assert.match(gate.innerHTML,/name="cloud-email" type="email" autocomplete="username"/);
assert.match(gate.innerHTML,/name="cloud-password" type="password" autocomplete="current-password"/);
const field=env.authField({id:'example',label:'Parent <name>',value:'" already filled'});
assert.match(field,/Parent &lt;name&gt;/);assert.match(field,/value="&quot; already filled"/,'prefilled content cannot escape the field');
const password=nodes.get('cloud-password'),button=nodes.get('cloud-password-toggle');password.value='synthetic-secret';
button.listeners.click();assert.equal(password.type,'text');assert.equal(password.value,'synthetic-secret');assert.equal(button.textContent,'Hide');assert.equal(button.attrs['aria-label'],'Hide password');assert.equal(button.attrs['aria-pressed'],'true');
button.listeners.click();assert.equal(password.type,'password');assert.equal(password.value,'synthetic-secret');assert.equal(button.textContent,'Show');assert.equal(button.attrs['aria-label'],'Show password');assert.equal(button.attrs['aria-pressed'],'false');
nodes.get('cloud-parent-login').listeners.click();
assert.equal(gate.dataset.authMode,'parentsignin');
assert(gate.innerHTML.indexOf('class="auth-main"')<gate.innerHTML.indexOf('id="auth-screen-back"'),'Back lives with the form, outside the brand header');
assert.equal((gate.innerHTML.match(/>‹ Back<\/button>/g)||[]).length,1,'one Back action on the Parent form');
nodes.get('auth-screen-back').listeners.click();assert.equal(gate.dataset.authMode,'signin');
(async()=>{
  const submit=()=>nodes.get('cloud-signin-form').listeners.submit({preventDefault(){}});
  await submit();assert.equal(calls.length,0,'missing credentials never reach auth');assert.equal(errors.at(-1),'Enter your email and password.');
  nodes.get('cloud-email').value='synthetic@example.test';nodes.get('cloud-password').value='synthetic-secret';
  await submit();assert.equal(calls.length,1);assert.equal(nodes.get('cloud-auth-submit').disabled,false,'failed sign-in permits retry');assert.equal(errors.at(-1),'Invalid login credentials');
  assert.equal(nodes.get('cloud-email').value,'synthetic@example.test');assert.equal(nodes.get('cloud-password').value,'synthetic-secret');
  await submit();assert.equal(calls.length,2,'retry uses the same native form route');
  console.log('PASS login labels/escaping/autofill, reveal state/value, parent Back, missing credentials and failed-sign-in retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
