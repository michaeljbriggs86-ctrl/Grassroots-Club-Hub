#!/usr/bin/env node
// Regression: real stored Club Admin roles must pass the share guard, not just normalised test profiles.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const originalTest=fs.readFileSync('tests/test_admin_weekend_share.js','utf8');
const harness=originalTest.slice(0,originalTest.indexOf('(async()=>{')).replace(/^#![^\n]*\n/,'');
const {c,node,row,fixture,confirm,feedFor,notices,shares,copies}=new Function('require',harness+'\nreturn {c,node,row,fixture,confirm,feedFor,notices,shares,copies};')(require);
const app=fs.readFileSync('app/src/main/assets/app.js','utf8'),cloudSource=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const roleStart=cloudSource.indexOf('  function role(){'),roleEnd=cloudSource.indexOf('  function assignedTeam(){',roleStart);
assert(roleStart>=0&&roleEnd>roleStart);
const auth={context:null,testModeActive:()=>false};vm.createContext(auth);
vm.runInContext(cloudSource.slice(roleStart,roleEnd),auth);
// Exercise the actual overview-mode predicate alongside the cloud role normaliser.
const overviewLine=app.split('\n').find(line=>line.startsWith('function isClubOverviewMode(){'));
const adminLine=app.split('\n').find(line=>line.startsWith('function isAdmin(){'));
vm.runInContext('let currentRole="pending",adminUiMode="club";'+adminLine+overviewLine,c);
const profileContext={club:{id:'club-a'},profile:{club_id:'club-a',user_id:'admin-a',role:'club_admin'}};
auth.context=profileContext;
const cloud={role:()=>auth.role(),get context(){return auth.context;}};
c.window.ClubHubCloud=cloud;
const syncRole=()=>{c.nextRole=cloud.role();vm.runInContext('currentRole=nextRole;',c);};
const f=fixture('Visiting United'),r=row('team-a','Lions',12,[f]);confirm(r,f);
let reads=0;cloud.getClubOverview=async()=>{reads++;return [r];};
c.window.ClubHubStaticSelkent={loadResults:async()=>feedFor([r])};
(async()=>{
 syncRole();assert.equal(cloud.role(),'admin');assert.equal(c.isClubOverviewMode(),true);
 assert.equal(c.adminWeekendShareIdentity(),'club-a|admin-a','stored club_admin role has the same share access as the visible Club Admin profile');
 await c.openAdminWeekendShare();assert.equal(node('admin-weekend-share-dialog').open,true);assert.equal(reads,1);
 assert.equal(c.adminWeekendShareReady(),true);await c.shareAdminWeekend();await c.copyAdminWeekend();assert.equal(shares.length,1);assert.equal(copies.length,1);
 for(const role of ['parent','coach','assistant_coach','player','pending_parent','revoked','unknown','']){
  profileContext.profile.role=role;syncRole();assert.equal(c.adminWeekendShareIdentity(),'');assert.equal(c.adminWeekendShareReady(),false,role);
  const before=reads;await c.openAdminWeekendShare();assert.equal(reads,before,'denied roles never fetch club data');
 }
 profileContext.profile.role='admin';syncRole();assert.equal(c.adminWeekendShareIdentity(),'club-a|admin-a','legacy admin profiles remain supported');
 profileContext.profile.role='club_admin';syncRole();vm.runInContext('adminUiMode="coach";',c);assert.equal(c.adminWeekendShareIdentity(),'','dual-role coach mode does not allow a club-wide export');vm.runInContext('adminUiMode="club";',c);
 const user=profileContext.profile.user_id;delete profileContext.profile.user_id;assert.equal(c.adminWeekendShareIdentity(),'');profileContext.profile.user_id=user;
 profileContext.club.id='club-b';assert.equal(c.adminWeekendShareReady(),false,'changing clubs invalidates the ready payload');profileContext.club.id='club-a';
 profileContext.profile.user_id='admin-b';assert.equal(c.adminWeekendShareReady(),false,'changing users invalidates the ready payload');profileContext.profile.user_id=user;
 auth.context=null;assert.equal(c.adminWeekendShareIdentity(),'','sign-out does not retain access');
 console.log('PASS weekend profile regression: production role mapping/overview mode, stored club_admin, legacy admin, chooser/copy, denied roles, coach mode and account/club/sign-out guards');
})().catch(error=>{console.error(error);process.exitCode=1;});
