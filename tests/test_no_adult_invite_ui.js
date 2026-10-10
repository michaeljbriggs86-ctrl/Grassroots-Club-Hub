const fs=require('fs'),assert=require('assert');
const d=__dirname+'/../app/src/main/assets/';
const app=fs.readFileSync(d+'app.js','utf8'),html=fs.readFileSync(d+'index.html','utf8');
assert.ok(!/create-club-admin-invite|club-admin-invite-code/.test(html),'no Club Admin invite form');
assert.ok(!/createClubAdminInvite|copyClubAdminInvite|generateAssignmentCode/.test(app),'no adult invite code creators');
assert.ok(!/createInvite\(\{[^}]*role:'(club_admin|coach|assistant_coach|parent)'/.test(app),'no client call creates adult invites');
console.log('no adult invite UI OK');
