const fs=require('fs'),assert=require('assert');
const d=__dirname+'/../';
const app=fs.readFileSync(d+'app/src/main/assets/app.js','utf8'),cloud=fs.readFileSync(d+'app/src/main/assets/cloud.js','utf8'),html=fs.readFileSync(d+'app/src/main/assets/index.html','utf8'),sql=fs.readFileSync(d+'web/db-drafts/012_multi_team_coaching.sql','utf8');
assert.ok(/id="hero-team-switch"/.test(html)&&/class="hero-profile-button hero-team-select hidden"/.test(html),'switcher exists and starts hidden');
assert.ok(/listMyCoachTeams,switchMyCoachTeam,/.test(cloud),'client exports both calls');
assert.ok(/rpc\('switch_my_active_team',\{p_team_id:/.test(cloud)&&/clearAccountLocalData\(\);\/\/ nothing from the previous team/.test(cloud),'switching clears local team data');
assert.ok(/try\{const data=await rpc\('list_my_coach_teams',\{\}\);return Array\.isArray\(data\)\?data:\[\];\}catch\{return \[\];\}/.test(cloud),'missing database function hides the switcher instead of erroring');
assert.ok(/__coachTeams\.length>1&&!preview/.test(app),'only shows with more than one team');
// the draft never widens who may see anything: reads stay with the person and Club Admins of the same club
assert.ok(/enable row level security/.test(sql)&&/revoke all on table public\.coach_team_assignments from anon, authenticated/.test(sql));
assert.ok(/You are not assigned to that team/.test(sql)&&/Club Admin access required/.test(sql));
assert.ok(!/alter table public\.profiles/.test(sql),'no profile table change');
console.log('multi-team coaching OK');
