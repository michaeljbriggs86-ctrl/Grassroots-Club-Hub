// Coach sign up (Mike, 10 Oct 2026): email and password, request, Club Admin approves. No invite code for adults.
const fs=require('fs'),assert=require('assert');
const cloud=fs.readFileSync(__dirname+'/../app/src/main/assets/cloud.js','utf8'),app=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8'),html=fs.readFileSync(__dirname+'/../app/src/main/assets/index.html','utf8');
assert.ok(/id="cloud-staff-signup">Coach Sign Up</.test(cloud),'main login offers Coach Sign Up');
assert.ok(!/Staff Sign Up With Invite/.test(cloud),'invite wording gone from the main login');
assert.ok(/setGateHtml\('coachsignup'\)/.test(cloud));
assert.ok(/rpc\('request_coach_access',\{p_team_id:String\(teamId\|\|''\),p_role:/.test(cloud),'uses the live request RPC');
assert.ok(/rpc\('list_pending_coach_requests'/.test(cloud)&&/rpc\('review_coach_request',\{p_request_id:req,p_approve:approve===true\}/.test(cloud));
// no invite code field and only coach roles can be requested
const screen=cloud.slice(cloud.indexOf("if(mode==='coachsignup'){"),cloud.indexOf("if(mode==='coachapproval'"));
assert.ok(!/invite/i.test(screen.replace(/Staff|invite-style/g,'')),'coach sign up screen has no invite code');
assert.ok(/value="coach">Coach<\/option><option value="assistant_coach">/.test(screen)&&!/club_admin/.test(screen),'only Coach or Assistant Coach can be requested');
assert.ok(/coach_signup:true,requested_team_id:teamId,requested_role:roleName/.test(screen));
// after email confirmation, sign in and bootstrap all resume the request
assert.ok((cloud.match(/resumeCoachSignupRequestFromMetadata\(\)/g)||[]).length>=4);
assert.ok(/role==='pending_coach'/.test(cloud)&&/mode==='coachapproval'/.test(cloud));
// admin side: club admin only
assert.ok(/if\(role\(\)!=='admin'\)return \[\];\s*const data=await rpc\('list_pending_coach_requests'/.test(cloud));
assert.ok(/currentRole!=='admin'/.test(app)&&/id="coach-requests"/.test(html));
// exports
assert.ok(/role,requestCoachAccess,listPendingCoachRequests,reviewCoachRequest,/.test(cloud));
console.log('coach sign up flow OK');
