#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=app.indexOf('let __announcementRows=[],');
const end=app.indexOf('async function refreshAnnouncements(',start);
assert(start>0&&end>start);
const panel={hidden:false,classList:{toggle(_name,hidden){panel.hidden=hidden;}},querySelector:()=>heading};
const heading={textContent:''},list={innerHTML:''},badge={textContent:'',classList:{toggle(){}}};
const nodes={'home-club-notices':panel,'home-club-notices-list':list,'home-notices-unread':badge};
const ctx={CLOUD_MODE:true,currentRole:'parent',document:{getElementById:id=>nodes[id]||null},
  isClubOverviewMode:()=>false,isAdmin:()=>false,renderNotificationCenter:()=>{},
  announcementAudienceLabel:()=> 'Team',esc:x=>String(x),window:{ClubHubCloud:{visibleTeamList:()=>[]}},Date};
vm.createContext(ctx);
vm.runInContext(app.slice(start,end),ctx);
vm.runInContext(`__announcementRows=[
  {id:'one',title:'Training plan',body:'Bring boots',created_at:'2026-09-29T12:00:00Z',important:false,read_at:null},
  {id:'two',title:'Venue change',body:'New ground',created_at:'2026-09-30T12:00:00Z',important:true,read_at:null}
];`,ctx);
ctx.renderAnnouncements();
assert.equal(panel.hidden,false);
assert.equal(heading.textContent,'Team updates');
assert.match(list.innerHTML,/Training plan/);
assert.match(list.innerHTML,/Venue change/);
ctx.currentRole='coach';ctx.renderAnnouncements();
assert.doesNotMatch(list.innerHTML,/Training plan/);
assert.match(list.innerHTML,/Venue change/);
console.log('PASS parent home includes ordinary updates while staff notice priority stays intact');
