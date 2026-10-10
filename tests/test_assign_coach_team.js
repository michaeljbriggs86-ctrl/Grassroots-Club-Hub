#!/usr/bin/env node
const assert=require('node:assert/strict');const fs=require('node:fs');
const d='app/src/main/assets/';
const html=fs.readFileSync(d+'index.html','utf8'),app=fs.readFileSync(d+'app.js','utf8'),cloud=fs.readFileSync(d+'cloud.js','utf8');
for(const id of ['assign-coach-person','assign-coach-team','assign-coach-button'])assert(html.includes(`id="${id}"`),id);
assert(cloud.includes("rpc('assign_coach_team'")&&cloud.includes("rpc('unassign_coach_team'"));
assert(/assignCoachTeam,unassignCoachTeam/.test(cloud),'exported');
assert(app.includes('function assignCoachToTeam')&&app.includes('function unassignCoachFromTeam')&&app.includes('data-unassign-coach-team'));
// People with several teams get a per-team unassign; people with one team keep Remove.
assert(app.includes("several?'Unassign from this team'"));
// Admin-only guards on the client
assert(/async function assignCoachTeam[\s\S]{0,120}Club Admin access required/.test(cloud));
console.log('PASS assign coach to team UI');
