#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=app.indexOf('async function reviewParentAccessNotification(');
const end=app.indexOf('function renderUniversalClubConfiguration(',start);
assert(start>=0&&end>start);
const requestId='c5923081-a980-4a55-ad7b-cf2e826152df';
const review=[],messages=[];
const panel={classList:{remove:()=>{}},scrollIntoView:()=>{},open:false};
const ctx={
  __appNotifications:[{id:'notification',type:'parent_access_request',team_id:'team',entity_key:'parent-access-request:'+requestId}],
  __pendingParentRequests:[],__teamMembersStamp:10,
  window:{ClubHubCloud:{currentTeam:()=>({id:'team'})}},
  document:{getElementById:id=>id==='team-access-settings'?panel:{close:()=>{}}},
  isAdmin:()=>false,navigate:()=>{},applyAccessMode:()=>{},
  refreshTeamMembers:async()=>0,
  openParentRequestReview:id=>review.push(id),
  toast:message=>messages.push(message),alert:message=>{throw new Error(message)}
};
vm.runInNewContext(app.slice(start,end),ctx);
(async()=>{
  await ctx.reviewParentAccessNotification('notification');
  assert.equal(review.length,0);
  assert.match(messages[0],/no longer pending/);
  ctx.__pendingParentRequests=[{request_id:requestId}];
  ctx.refreshTeamMembers=async()=>1;
  await ctx.reviewParentAccessNotification('notification');
  assert.deepEqual(review,[requestId]);
  console.log('PASS resolved request opens no empty review, pending notification opens its matching request');
})().catch(error=>{console.error(error);process.exitCode=1;});
