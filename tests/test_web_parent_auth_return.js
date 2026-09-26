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
  assert.equal(constants({protocol:'file:',origin:'null',pathname:'/index.html',search:'',hash:'',href:'file:///android_asset/index.html'}).AUTH_REDIRECT,'grassrootsclubhub://auth-callback');

  const start=source.indexOf('async function handleAuthCallback(');
  const end=source.indexOf('async function rpc(',start);
  const saved=[],requested=[],screens=[],history=[];
  const context={location,history:{replaceState:(...args)=>history.push(args)},URL,URLSearchParams,Date,
    session:null,context:null,PENDING_PARENT_REQUEST_KEY:'parent',VERIFY_EMAIL_KEY:'email',
    localStorage:{removeItem:key=>saved.push('removed:'+key)},
    saveSession(value){saved.push(value);context.session=value;},
    async hydrateSessionUser(){context.session.user={user_metadata:{parent_signup:true,requested_team_id:'team-a',requested_child_name:'Alex'}};},
    async requestParentAccess(team,child){requested.push({team,child});},
    async getContext(){return {profile:{role:'pending_parent'}};},
    setGateHtml:(...args)=>screens.push(args)};
  vm.runInNewContext(source.slice(start,end),context);
  assert.equal(await context.handleAuthCallback(location.href,{duringBootstrap:true}),'parentrequest');
  assert.deepEqual(requested,[{team:'team-a',child:'Alex'}]);
  assert.equal(saved[0].access_token,'abc');
  assert.deepEqual(history[0],[null,'','/']);
  assert.equal(screens.at(-1)[0],'approval');
  assert.equal(await context.handleAuthCallback('https://test.pitchkind.com/#error=access_denied',{duringBootstrap:true}),'error');
  assert.equal(screens.at(-1)[0],'signin');
  console.log('PASS browser verification return restores a parent request and clears callback tokens; Android keeps its scheme');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
