'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deferred}=require('./helpers/cloud_client_harness');const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function fixture(){
 const nodes={};for(const id of ['season-history-select','season-history-summary','audit-history-list','compliance-status','club-cancel-status','compliance-primary-reviewer','compliance-backup-reviewer','compliance-welfare-name','compliance-welfare-contact','compliance-county-fa','compliance-county-contact','compliance-fallback','safeguarding-export-audit'])nodes[id]={value:'b',innerHTML:'',textContent:'',checked:false};
 const requests={};const cloud={context:{profile:{club_id:"club-a"}}};for(const method of ['listSeasonArchives','listAuditHistory','getClubComplianceStatus','listSafeguardingExportAudit']){requests[method]=[];cloud[method]=()=>{const d=deferred();requests[method].push(d);return d.promise;};}
 let key='account|club|team|admin';const toasts=[];const c={CLOUD_MODE:true,currentRole:'admin',personProfileContextKey:()=>key,window:{ClubHubCloud:cloud},document:{getElementById:id=>nodes[id],activeElement:null},privateAccountViewScope:()=>({key,cloud:c.window.ClubHubCloud}),privateAccountViewCurrent:s=>s.key===key&&s.cloud===c.window.ClubHubCloud,isAdmin:()=>true,isClubOverviewMode:()=>true,isAdminTeamPreviewMode:()=>false,isAdminCoachMode:()=>false,esc:String,toast:x=>toasts.push(x),Date,refreshDisputeReviewerPanel:async()=>{}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('let __seasonArchives=[];'),app.indexOf('function configuredAwardTypes()')),c);vm.runInContext(app.slice(app.indexOf('let __complianceStatus=null'),app.indexOf('async function refreshDisputeReviewerPanel()')),c);
 return {c,nodes,requests,toasts,context:v=>key=v,state:expr=>vm.runInContext(expr,c)};
}
const archive=id=>({id,season:'2025/26',age_group:12,team_name:id});const audit=id=>({id,summary:id,created_at:'2026-10-01'});const compliance=id=>({club_id:'club-a',primary_reviewer_name:'Primary',primary_reviewer_user_id:null,backup_reviewer_name:'Backup',backup_reviewer_user_id:null,fallback_to_county_fa:false,welfare_officer_name:id,welfare_officer_contact:'contact@example.invalid',county_fa_name:'London FA',county_fa_safeguarding_contact:'County contact',cancellation_requested_at:null,deletion_due_at:id==='new'?'2026-11-01':null});
async function tick(){await Promise.resolve();await Promise.resolve();}
(async()=>{
 for(const [fn,method,row,state]of [['refreshSeasonHistory','listSeasonArchives',archive,'__seasonArchives'],['refreshAuditHistory','listAuditHistory',audit,'__auditRows']]){
  for(const outcome of ['resolve','reject']){
   const f=fixture(),a=f.c[fn](false),b=f.c[fn](false);f.requests[method][1].resolve([row('new')]);await b;f.requests[method][0][outcome](outcome==='resolve'?[row('old')]:Error('late error'));await a;assert.equal(f.state(state)[0].id,'new',fn+' latest response wins');assert.deepEqual(f.toasts,[]);
  }
  for(const change of ['account','club','team','role','cloud']){
   const f=fixture(),p=f.c[fn](false);if(change==='cloud')f.c.window.ClubHubCloud={};else f.context(change);f.requests[method][0].resolve([row('private-old')]);await p;assert.equal(f.state(state).length,0);
  }
 }
 for(const outcome of ['resolve','reject']){
  const f=fixture(),a=f.c.refreshCompliancePanel(),b=f.c.refreshCompliancePanel();f.requests.getClubComplianceStatus[1].resolve(compliance('new'));await tick();f.requests.listSafeguardingExportAudit[0].resolve([]);await b;f.requests.getClubComplianceStatus[0][outcome](outcome==='resolve'?compliance('old'):Error('late'));await a;assert.equal(f.nodes['compliance-welfare-name'].value,'new');assert.match(f.nodes['club-cancel-status'].textContent,/Deletion scheduled/);assert.doesNotMatch(f.nodes['compliance-status'].textContent,/Could not load/);
 }
 // Old export sub-read must not replace the exports from a later status read.
 const f=fixture(),a=f.c.refreshCompliancePanel();f.requests.getClubComplianceStatus[0].resolve(compliance('old'));await tick();const b=f.c.refreshCompliancePanel();f.requests.getClubComplianceStatus[1].resolve(compliance('new'));await tick();f.requests.listSafeguardingExportAudit[1].resolve([{exported_at:'2026-10-01',team_name:'New export'}]);await b;f.requests.listSafeguardingExportAudit[0].resolve([{exported_at:'2026-10-01',team_name:'Old export'}]);await a;assert.match(f.nodes['safeguarding-export-audit'].innerHTML,/New export/);assert.doesNotMatch(f.nodes['safeguarding-export-audit'].innerHTML,/Old export/);
 console.log('PASS Admin history/compliance read order: reverse success/error, nested export race and account/club/team/role/cloud boundaries; zero writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
