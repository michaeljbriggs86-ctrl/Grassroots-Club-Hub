const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8'),html=fs.readFileSync('app/src/main/assets/index.html','utf8');
let coach=true,closed=0;
const nodes={};
function node(id){return nodes[id]??={dataset:{},textContent:'',value:'',classList:{hidden:false,toggle(name,value){if(name==='hidden')this.hidden=value;},add(name){if(name==='hidden')this.hidden=true;},remove(name){if(name==='hidden')this.hidden=false;}},showModal(){},close(){closed++;}};}
const context=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[]},state:{matches:[]},
 isCoach:()=>coach,isPlayedMatch:m=>(m.status||'played')==='played',isLeagueMatch:m=>m.competition==='League',isDivisionMatch:m=>m.competition==='Division',
 isProviderOwnedMatch:m=>m.source==='selkent',matchStatus:m=>m.status||'played',matchDayReached:m=>m.date<='2026-10-10',
 resetMatchReportMode(){},formatDate:s=>s,esc:s=>s,matchScoreText:()=>'',statusLabel:()=>'',renderMatchOverview(){},detailPlayerInputs(){},detailBookingInputs(){},renderAwardFields(){},
 refreshMatchOverviewDirectory(){},loadCoachMatchNote(){},loadMatchAttendance(){},requireCoach:()=>coach,navigate(){throw Error('navigation reached');}});
vm.runInContext(src.slice(src.indexOf('function configureMatchDetailActions('),src.indexOf('function openMatchReportReview(')),context);
const scheduled={id:'s1',competition:'Friendly',status:'scheduled',date:'2026-10-10'};
function open(m){context.state.matches=[m];context.openMatchDetails(m.id);}
open(scheduled);
assert.equal(node('edit-match-detail').textContent,'Edit fixture');
assert.equal(node('edit-match-detail').dataset.editMatch,'s1');
assert.equal(node('delete-match-detail').dataset.deleteMatch,'s1');
assert.equal(node('play-match-detail').dataset.matchPlayed,'s1');
open({...scheduled,id:'future',date:'2026-10-11'});
assert.equal(node('play-match-detail').classList.hidden,true,'report action stays behind the match-day guard');
assert.equal(node('play-match-detail').dataset.matchPlayed,'');
open({...scheduled,id:'played',status:'played'});
assert.equal(node('edit-match-detail').textContent,'Edit result');
assert.equal(node('play-match-detail').classList.hidden,true);
open({...scheduled,id:'league',competition:'League',source:'selkent',status:'played'});
assert.equal(node('edit-match-detail').classList.hidden,true,'provider league result keeps its edit restriction');
assert.equal(node('delete-match-detail').classList.hidden,true,'provider fixture cannot be removed');
coach=false;open(scheduled);
for(const id of ['edit-match-detail','delete-match-detail','play-match-detail'])assert.equal(node(id).classList.hidden,true,'non-coaches get no management actions');
coach=true;open(scheduled);
Object.assign(context,{matchReportStepDefinitions:()=>[],cupProgressKey:()=>'',cupNameAndRound:()=>({name:'Friendly',round:''}),matchTeamLabel:String,
 loadCoachMatchNote:()=>Promise.resolve(),loadMatchAttendance:()=>Promise.resolve(),applyMatchReportStep(){}});
vm.runInContext(src.slice(src.indexOf('function openMatchReport('),src.indexOf('function linkedFixtureForMatch(')),context);
context.openMatchReport('s1');
for(const id of ['edit-match-detail','delete-match-detail','play-match-detail'])assert.equal(node(id).classList.hidden,true,'report mode clears management actions');
// Editing from the dialog closes it before navigating to the existing editor.
vm.runInContext(src.slice(src.indexOf('function editMatch('),src.indexOf('let __matchSubmissionInFlight=')),context);
assert.throws(()=>context.editMatch('s1'),/navigation reached/);
assert.equal(closed,1,'editor navigation is not covered by the open details modal');
assert.match(html,/id="edit-match-detail" data-edit-match=""/);
assert.match(html,/id="play-match-detail" data-match-played=""/);
assert.match(html,/id="delete-match-detail" data-delete-match="">Remove/);
console.log('PASS Details edit/remove/report actions, date and role/provider guards, stale-state reset and editor transition');
