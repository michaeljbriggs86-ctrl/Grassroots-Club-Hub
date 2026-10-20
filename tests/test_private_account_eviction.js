#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
function actualFunction(name){const start=source.indexOf('async function '+name+'(');assert(start>=0,name);const tail=source.slice(start),next=/\n(?:async function |function |let |const |document\.|window\.)/.exec(tail);assert(next,name+' boundary');return tail.slice(0,next.index);}
const helpers=source.slice(source.indexOf('function privateAccountViewScope(){'),source.indexOf('let __appearanceStats=[];'));
const cases=[
 ['refreshAppearanceStats','listPlayerAppearanceStats',[true],'__appearanceStats',[]],
 ['refreshSeasonHistory','listSeasonArchives',[false],'__seasonArchives',[]],
 ['openSeasonArchive','getSeasonArchive',[],null,null],
 ['refreshAuditHistory','listAuditHistory',[false],'__auditRows',[]],
 ['refreshCompliancePanel','getClubComplianceStatus',[],'__complianceStatus',null],
 ['refreshDisputeReviewerPanel','listGeneralDisputes',[],null,null],
 ['loadRetainedThread','listDisputeMessages',[],null,null],
 ['loadComplianceAccountChoices','listClubAccessAccounts',[],null,null],
 ['openParentLinkDialog','listParentPlayerLinks',['parent-a','Fictional Parent A'],null,null],
];
(async()=>{
 for(const [name,method,args,state,initial]of cases){
  let resolve,opened=0,renders=0;const pending=new Promise(r=>resolve=r),nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:['season-history-select','reviewer-thread-id'].includes(id)?'fictional-id':'',innerHTML:'',textContent:'',classList:{add(){},toggle(){}},showModal(){opened++;}});return nodes.get(id);};
  const cloud={context:{profile:{user_id:'a',club_id:'club'}},session:{user:{id:'a'}},currentTeam:()=>({id:'one'}),[method]:()=>pending};
  const ctx={CLOUD_MODE:true,currentRole:'admin',window:{ClubHubCloud:cloud},document:{getElementById:node,activeElement:null},Date,Set,
   __seasonHistoryLoad:0,__auditHistoryLoad:0,__complianceLoad:0,
   personProfileContextKey:()=>[cloud.session?.user?.id,cloud.context?.profile?.club_id,cloud.currentTeam()?.id,ctx.currentRole].join('|'),
   __appearanceStamp:0,__appearanceStats:[],__seasonArchives:[],__auditRows:[],__complianceStatus:name==='refreshDisputeReviewerPanel'?{is_current_user_reviewer:true}:null,
   isAdmin:()=>ctx.currentRole==='admin',isClubOverviewMode:()=>true,isAdminTeamPreviewMode:()=>false,isAdminCoachMode:()=>false,requireCoach:()=>true,
   renderSeasonPlayerStats:()=>renders++,renderSeasonHistory:()=>renders++,renderAuditHistory:()=>renders++,activePlayers:()=>[{name:'Fictional Child A',number:1}],
   toast(){},alert(){},esc:x=>String(x),miniJerseyHTML:()=>'',accessRoleLabel:r=>r,
   archiveStatsFromState:()=>({played:1,wins:1,draws:0,losses:0,gf:1,ga:0,topScorer:'Old private data'}),clubListingHtml:x=>x,matchScoreText:()=>'',formatDate:x=>x,
  };
  vm.createContext(ctx);vm.runInContext(helpers+(['refreshSeasonHistory','refreshAuditHistory'].includes(name)?source.slice(source.indexOf('let __historyIdentity='),source.indexOf('function archiveStatsFromState')):'')+(['refreshCompliancePanel','loadComplianceAccountChoices'].includes(name)?source.slice(source.indexOf('const COMPLIANCE_FIELDS='),source.indexOf('async function refreshCompliancePanel()')):'')+actualFunction(name),ctx,{filename:'actual-app-private-reader.js'});
  const work=ctx[name](...args);await Promise.resolve();const rendersBeforeReply=renders;
  cloud.session={user:{id:'b'}};cloud.context={profile:{user_id:'b',club_id:'club'}};ctx.currentRole='parent';
  const reply=name==='refreshCompliancePanel'?{privateMarker:'Old private data'}:name==='openSeasonArchive'?{season:'2025/26',age_group:12,team_name:'Old private data',snapshot:{team_state:{matches:[],goals:[]}}}:[{privateMarker:'Old private data',player_name:'Fictional Child A',body:'Old private data',role:'parent',full_name:'Old private data',user_id:'old'}];
  resolve(reply);
  await work;
  assert.equal(opened,0,name+' cannot reopen a former private dialog');assert.equal(renders,rendersBeforeReply,name+' cannot render the prior account result');
  if(state)assert.deepEqual(JSON.parse(JSON.stringify(ctx[state])),initial,name+' cannot store the prior account result');
  for(const el of nodes.values())assert(!String(el.innerHTML).includes('Old private data'),name+' cannot repopulate cleared output');
  console.log('PASS '+name+' rejects an already-requested prior-account reply');
 }
 console.log('PASS '+cases.length+' actual private reader eviction scenarios');
})().catch(e=>{console.error(e);process.exitCode=1;});
