const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const nodes=new Map();function node(id){if(!nodes.has(id)){const hidden=new Set();nodes.set(id,{value:'',disabled:false,textContent:'',innerHTML:'',dataset:{},open:true,classList:{toggle(k,on){on?hidden.add(k):hidden.delete(k)},add:k=>hidden.add(k),remove:k=>hidden.delete(k),contains:k=>hidden.has(k)},focus(){},scrollTo(){}});}return nodes.get(id);}
const original={id:'f',date:'2026-10-25',opponent:'Example Rangers',venue:'A',competition:'Friendly',status:'scheduled',gf:0,ga:0};
const state={matches:[{...original}],goals:[{matchId:'other',goals:2}],assists:[],bookings:[],awards:[],cupProgress:{retain:true}};
let failure=false,saved=null,outcome=null,audits=[];
const context={state,CLOUD_MODE:true,currentRole:'coach',document:{getElementById:node,querySelectorAll:()=>[]},window:{ClubHubCloud:{confirmStateSave:async s=>{if(failure)throw Error('Offline');saved=structuredClone(s);},saveMatchAttendance:async()=>{},saveCoachMatchNote:async()=>{}}},__matchReportSaveBusy:false,__matchDetailEpoch:1,__matchNoteLoaded:false,__matchAttendanceLoaded:false,requireCoach:()=>true,matchDetailContext:()=> 'same',sameMatchDetail:()=>true,saveState(){},showMatchReportOutcome:p=>outcome=p,renderNextMatch(){},featureEnabled:()=>true,saveAwardFields:()=>{throw Error('Abandoned must not write awards')},auditEvent:(...args)=>audits.push(args),ageGroupNumber:()=>9,competitionBucket:()=>'',toast:()=>{throw Error('Unexpected score validation')},normaliseCupProgress:v=>v,refreshAppearanceStats:async()=>{},isFinalCupGameOfRound:()=>true,miniResultsRestrictedView:()=>false};
vm.createContext(context);
vm.runInContext(take('function matchStatus(', 'function resultForNamedTeam(')+take('function reportMatchStatus(', 'function updateReportClubScore(')+take('let __matchReportMode=', 'function isFinalCupGameOfRound(')+take('function matchReportStepDefinitions(', 'function applyMatchReportStep(')+take('async function saveMatchDetails(', '// Confirmed destructive match actions:'),context);
node('match-detail-id').value='f';node('match-report-status').value='abandoned';node('match-report-abandoned-reason').value='Weather';
vm.runInContext('__matchReportMode=true;__matchReportSteps=matchReportStepDefinitions(state.matches[0]);',context);
context.applyMatchReportStep=()=>{};
context.updateReportMatchStatus();
assert.equal(node('match-report-final-score').classList.contains('hidden'),true);assert.equal(node('match-report-gf').disabled,true);
assert.deepEqual(Array.from(context.matchReportStepDefinitions(original,true),x=>x.key),['score','attendance','notes']);
(async()=>{
failure=true;await context.saveMatchDetails({preventDefault(){}});assert.equal(outcome[0].status,'not saved');assert.equal(node('match-report-abandoned-reason').value,'Weather');assert.equal(saved,null);
failure=false;await context.saveMatchDetails({preventDefault(){}});assert.equal(outcome[0].status,'saved');assert.equal(saved.matches[0].status,'abandoned');assert.equal(saved.matches[0].abandonmentReason,'Weather');assert.equal(saved.matches[0].gf,0);assert.deepEqual(state.goals,[{matchId:'other',goals:2}]);assert.equal(state.cupProgress.retain,true);assert.equal(context.isPlayedMatch(saved.matches[0]),false);assert.equal(context.resultOf(saved.matches[0]),'ABD');assert.equal(context.matchScoreText(saved.matches[0]),'Abandoned');
context.miniResultsRestrictedView=()=>true;assert.equal(context.matchScoreText(saved.matches[0]),'Abandoned');
node('match-report-status').value='played';context.updateReportMatchStatus();assert.equal(node('match-report-gf').disabled,false);assert.equal(node('match-report-final-score').classList.contains('hidden'),false);assert(context.matchReportStepDefinitions(original,false).some(x=>x.key==='goals'));
console.log('PASS abandoned report: optional weather reason, no final score or performance/cup mutation, confirmed-save retry, parent-safe label and played switch');
})().catch(e=>{console.error(e);process.exitCode=1});
