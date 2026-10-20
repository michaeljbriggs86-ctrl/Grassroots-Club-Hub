'use strict';
const assert=require('node:assert/strict');
const {harness,session,response}=require('./helpers/cloud_client_harness');
(async()=>{
 const h=harness(r=>{
  if(r.path.endsWith('/list_parent_player_links')){
   if(r.body.p_team_id==='foreign')return response(403,{message:'Team not available'});
   return response(200,[{parent_user_id:r.body.p_parent_user_id,team_id:r.body.p_team_id,player_name:'Invented child'}]);
  }
 });
 let rows=await h.api.listParentPlayerLinks('parent-b','two');
 assert.equal(h.requests.at(-1).body.p_team_id,'two');assert.equal(rows[0].team_id,'two');
 assert.equal(h.api.currentTeam().id,'one','read never changes the viewer workspace');
 await h.api.listParentPlayerLinks('parent-a');assert.equal(h.requests.at(-1).body.p_team_id,'one','existing callers retain current-team behaviour');
 h.test.setTeam(null);await h.api.listParentPlayerLinks('parent-b','two');assert.equal(h.requests.at(-1).body.p_team_id,'two','Club Admin lookup does not require a remembered active team');
 await assert.rejects(h.api.listParentPlayerLinks('parent-b','foreign'),/Team not available/,'server denial stays an error');
 for(const role of ['coach','assistant_coach','parent']){
  h.test.initialize(session('a'),role);const count=h.requests.length;
  await assert.rejects(h.api.listParentPlayerLinks('parent-b','two'),/current team/);
  assert.equal(h.requests.length,count,'off-team non-Admin read is blocked before RPC');
  await h.api.listParentPlayerLinks('parent-a');assert.equal(h.requests.at(-1).body.p_team_id,'one');
 }
 h.test.initialize(session('a'),'player');const count=h.requests.length;
 await h.api.listParentPlayerLinks('parent-a','one');assert.equal(h.requests.length,count);
 console.log('PASS parent-link wrapper: explicit Admin subject team, default-team compatibility, no workspace mutation, denied reads and non-Admin scope');
})().catch(e=>{console.error(e);process.exitCode=1;});
