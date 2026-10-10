#!/usr/bin/env node
const assert=require('node:assert/strict');const fs=require('node:fs');
const d='app/src/main/assets/';
const app=fs.readFileSync(d+'app.js','utf8'),cloud=fs.readFileSync(d+'cloud.js','utf8'),css=fs.readFileSync(d+'styles.css','utf8');
assert(cloud.includes("rpc('set_my_capacity'")&&cloud.includes("rpc('request_child_link'"));
assert(/setMyCapacity,requestChildLink/.test(cloud),'exported');
assert(/async function setMyCapacity[\s\S]{0,140}Only coaching staff and Club Admins/.test(cloud));
assert(css.includes('.mode-pill[data-mode="parent"]'));
assert(app.includes("'Parent view'")&&app.includes("dataset.mode=acting?'parent'"));
// Behaviour: slice capacityContexts and run it
const start=app.indexOf('const cloudStaff='),end=app.indexOf('function availableAccountContexts');
assert(start>0&&end>start);
const run=(ctx,staff,acting)=>{
  const src='const CLOUD_MODE=true;const adminTitleLabel=t=>t?`${t} · Admin`:"Club Admin";const window={ClubHubCloud:{context:'+JSON.stringify(ctx)+',isStaffAccount:()=>'+staff+',actingAsParent:()=>'+acting+',realRole:()=>'+JSON.stringify(ctx.real_role||'')+'}};'+app.slice(start,end)+';return capacityContexts();';
  return new Function(src)();
};
let r=run({real_role:'coach',has_children:true,profile:{}},true,false);
assert.deepEqual(r.map(x=>x.kind),['capacity-parent']);
r=run({real_role:'coach',has_children:false,profile:{}},true,false);
assert.deepEqual(r.map(x=>x.kind),['add-child']);
r=run({real_role:'club_admin',acting_as_parent:true,has_children:true,profile:{club_title:'Secretary'}},true,true);
assert.deepEqual(r.map(x=>x.kind),['capacity-staff','add-child']);
assert.equal(r[0].title,'Back to Secretary · Admin');
r=run({real_role:'parent',profile:{}},false,false);
assert.deepEqual(r,[]);
// An ordinary parent never gets the add-child-as-staff path
assert(app.includes("cloudStaff()?'Request sent."));
console.log('PASS two capacities app side');
