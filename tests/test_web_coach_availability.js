#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const cloud=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const start=cloud.indexOf('  async function saveCoachMatchAvailability(');
const end=cloud.indexOf('  async function listSelkentTeamDirectory(',start);
assert.ok(start>0&&end>start,'coach availability API must be exported');
const calls=[];
const ctx={canEdit:()=>true,activeTeam:{id:'team-one'},session:{user:{id:'staff-one'}},request:async(...args)=>{calls.push(args);return {data:[{status:'available'}]}}};
vm.runInNewContext(cloud.slice(start,end),ctx);

(async()=>{
  await ctx.saveCoachMatchAvailability({fixtureKey:'fixture-one',playerName:' A Player ',status:'available'});
  assert.equal(calls.length,1);
  assert.equal(calls[0][1].body.team_id,'team-one');
  assert.equal(calls[0][1].body.player_name,'A Player');
  assert.equal(calls[0][1].body.parent_user_id,'staff-one');
  ctx.canEdit=()=>false;
  await assert.rejects(ctx.saveCoachMatchAvailability({fixtureKey:'fixture-one',playerName:'A Player',status:'available'}),/Coach access required/);
  assert.equal(calls.length,1,'parent or read-only admin must never reach API');
  ctx.canEdit=()=>true;
  await assert.rejects(ctx.saveCoachMatchAvailability({fixtureKey:'fixture-one',playerName:'A Player',status:'attended'}),/Choose a player status/);
  assert.equal(calls.length,1,'actual attendance is not an availability value');
  const migration=fs.readFileSync('backend_migrations_applied/20260927_coach_match_availability.sql','utf8');
  assert.match(migration,/can_edit_team\(team_id\)/);
  assert.match(migration,/before insert or update on public\.match_availability/);
  assert.match(migration,/new\.response_source :=/);
  console.log('PASS coach can record availability with team permissions and server-stamped source');
})().catch(err=>{console.error(err);process.exitCode=1});
