#!/usr/bin/env node
// Exercise the production navigation policy across every active profile mode.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=app.indexOf('// Linked pages keep'),end=app.indexOf('function setCommunicationsTab(',start);
assert(start>=0&&end>start);
const routes=['home','matches','squad','add','league','club','club-matches','club-fixtures','club-results','club-coaches','inbox','more','person'];
const classes=()=>{const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),toggle(x,on){if(on)s.add(x);else s.delete(x);},[Symbol.iterator]:()=>s[Symbol.iterator]()};};
// Expected destinations are the product's role contract, including redirects from forbidden deep links.
const profiles=[
  ['Coach','coach','team',['home','matches','squad','add','league','club:results','club:results','club:results','club:results','club:results','inbox','more','person']],
  ['Assistant Coach','assistant_coach','team',['home','matches','squad','add','league','club:results','club:results','club:results','club:results','club:results','inbox','more','person']],
  ['Parent','parent','team',['home','matches','home','home','home','home','home','home','home','home','inbox','more','person']],
  ['Player','player','team',['home','matches','squad','home','league','home','home','home','home','home','home','more','person']],
  ['Club Admin','admin','club',['club:overview','club:overview','club:overview','club:overview','club:overview','club:overview','club:fixtures','club:fixtures','club:results','club:coaches','inbox','more','person']],
  ['Admin Coach','admin','coach',['home','matches','squad','add','league','club:overview','club:fixtures','club:fixtures','club:results','club:coaches','inbox','more','person']],
  ['Admin team preview','admin','preview',['home','matches','squad','home','league','club:overview','club:fixtures','club:fixtures','club:results','club:coaches','inbox','more','person']],
];
const linked=['contacts','club-teams','coach-documents','app-access','staff-requests','team-access','rules','season-history','audit-history','raise-concern'];
const permitted={
  Coach:['contacts','team-access','rules','season-history','raise-concern'],
  'Assistant Coach':['contacts','team-access','rules','season-history','raise-concern'],
  Parent:['contacts','raise-concern'],Player:[],
  'Club Admin':linked.filter(v=>v!=='team-access'),
  'Admin Coach':['contacts','team-access','rules','season-history','raise-concern'],
  'Admin team preview':['contacts','team-access','rules','season-history','raise-concern'],
};
let checks=0;
for(const [label,role,mode,expected] of profiles){
  for(const [index,route] of [...routes,...linked].entries()){
    const views=['home','matches','squad','add','league','club','inbox','more','person',...linked].map(view=>({dataset:{view},classList:classes()}));
    const env={URL,CLOUD_MODE:true,currentRole:role,currentView:'home',adminUiMode:mode,__clubTab:'overview',__squadPage:0,__communicationsTab:'inbox',__booting:false,
      window:{location:{href:'https://example.test/?keep=1#auth_callback'},history:{pushState(){},replaceState(){}},addEventListener(){},scrollTo(){}},
      document:{body:{classList:classes()},querySelector:()=>null,querySelectorAll:q=>q==='.view'?views:[],getElementById:id=>id==='match-id'?{value:''}:null},
      isAdmin:()=>role==='admin',isCoach:()=>['coach','assistant_coach'].includes(role)||(role==='admin'&&env.adminUiMode==='coach'),
      isClubOverviewMode:()=>role==='admin'&&env.adminUiMode==='club',isPublishedLeagueTeam:()=>true,
      localStorage:{setItem(){}},ADMIN_UI_MODE_KEY:'mode',setDefaultDate(){},renderTeamIdentity(){},applyAccessMode(){},syncMobileNavigation(){},applyMiniResultVisibility(){},setCommunicationsTab(){},refreshInbox(){},toast(){},syncContactDirectoryContext(){},refreshContactDirectory(){},refreshAdminClubOverview(){},refreshAdminAccessManagement(){},refreshCoachRequests(){},refreshTeamMembers(){},refreshSeasonHistory(){},refreshAuditHistory(){},renderUniversalClubConfiguration(){},setClubTab:tab=>{env.__clubTab=tab;}};
    vm.runInNewContext(app.slice(start,end),env);
    env.navigate(route,false);
    const actual=env.currentView==='club'?`club:${env.__clubTab}`:env.currentView;
    const destination=index<routes.length?expected[index]:permitted[label].includes(route)?route:label==='Club Admin'?'club:overview':'home';
    assert.equal(actual,destination,`${label}: ${route}`);
    assert.deepEqual(views.filter(v=>[...v.classList].includes('active')).map(v=>v.dataset.view),[env.currentView],`${label}: exactly one active screen`);
    checks++;
  }
}
console.log(`PASS ${checks} screen/profile routes across ${profiles.length} active profile modes`);
