#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
function constants(location){
  const start=source.indexOf("const AUTH_REDIRECT =");
  const end=source.indexOf('let initialAuthCallbackHandled',start);
  const ctx={location,URLSearchParams};
  vm.runInNewContext(source.slice(start,end)+'globalThis.result={AUTH_REDIRECT,INITIAL_AUTH_CALLBACK};',ctx);
  return ctx.result;
}
async function main(){
  const location={protocol:'https:',origin:'https://test.pitchkind.com',pathname:'/',search:'',hash:'#access_token=abc&refresh_token=refresh&type=signup',href:'https://test.pitchkind.com/#access_token=abc&refresh_token=refresh&type=signup'};
  assert.equal(constants(location).AUTH_REDIRECT,'https://test.pitchkind.com/');
  assert.equal(constants(location).INITIAL_AUTH_CALLBACK,location.href);
  const newDomain={...location,origin:'https://shootershillafc.app',href:'https://shootershillafc.app/'+location.hash};
  assert.equal(constants(newDomain).AUTH_REDIRECT,'https://shootershillafc.app/');
  assert.equal(constants(newDomain).INITIAL_AUTH_CALLBACK,newDomain.href);
  assert.equal(constants({protocol:'file:',origin:'null',pathname:'/index.html',search:'',hash:'',href:'file:///android_asset/index.html'}).AUTH_REDIRECT,'grassrootsclubhub://auth-callback');

  const {harness,response}=require('./helpers/cloud_client_harness');
  const h=harness(r=>{
    if(r.path==='/auth/v1/user')return response(200,{id:'parent',user_metadata:{parent_signup:true,requested_team_id:'team-a',requested_child_name:'Alex'}});
    if(r.path.endsWith('request_parent_access'))return response(200,{});
    if(r.path.endsWith('get_my_context'))return response(200,{profile:{user_id:'parent',role:'pending_parent'}});
  });
  assert.equal(await h.api.handleAuthCallback(location.href,{duringBootstrap:true}),'parentrequest');
  assert.deepEqual(h.requests.find(r=>r.path.endsWith('request_parent_access')).body,{p_team_id:'team-a',p_child_name:'Alex'});
  assert.equal(h.api.session.access_token,'abc');assert.equal(h.events.find(e=>e.type==='history').url,'/');
  assert.equal(h.node('activation-gate').dataset.authMode,'approval');
  assert.equal(await h.api.handleAuthCallback('https://test.pitchkind.com/#error=access_denied',{duringBootstrap:true}),'error');
  assert.equal(h.node('activation-gate').dataset.authMode,'signin');
  console.log('PASS browser verification return restores a parent request and clears callback tokens; Android keeps its scheme');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
