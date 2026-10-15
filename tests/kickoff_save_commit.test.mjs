import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf('async function saveFixtureConfirmation(){'),end=source.indexOf('\nfunction shareCardWrap',start);assert(start>=0&&end>start);
function setup(){
 let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const nodes=new Map([['next-match-confirm-time',{value:'10:30'}],['next-match-ground-select',{value:'0'}],['next-match-kit-choice',{value:'home'}],['fixture-confirm-details',{}]]);
 const fixture={date:'2099-10-14',opponent:'Fictional United'},ctx={__fixtureSaveBusy:false,__fixtureEditingKey:'',CLOUD_MODE:true,state:{selkent:{}},canConfirmFixtureDetails:()=>true,nextPublishedFixture:()=>fixture,document:{getElementById:id=>nodes.get(id)},groundOptionsForFixture:()=>[{name:'Example Fields',address:'Public ground'}],matchdayArrivalTime:()=>true,miniCupGroup:()=>null,fixtureKitSelectionKey:()=> 'fictional-fixture',fixtureOverviewContext:()=>({ownProfile:{}}),knownKit:()=>true,fixtureFingerprint:()=> 'fingerprint',fixtureStableKey:()=> 'fixture',persistLocalState:()=>{},renderAll:()=>{},renderFixtureConfirmationEditor:()=>{},renderNextMatch:()=>{},renderMatchPageNextFixture:()=>{},renderSelkentFixtures:()=>{},renderMatchdayDashboard:()=>{},refreshNotifications:()=>{},auditEvent:()=>ctx.audits++,toast:message=>ctx.messages.push(message),audits:0,messages:[],calls:0,team:'one'};
 ctx.window={ClubHubCloud:{currentTeam:()=>({id:ctx.team}),confirmStateSave:async()=>{ctx.calls++;return pending;}}};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);return {ctx,nodes,resolve,reject};
}
test('fixture save waits for cloud commit and prevents duplicate submission',async()=>{
 const {ctx,nodes,resolve}=setup();const saving=ctx.saveFixtureConfirmation();assert.equal(ctx.calls,1);assert.equal(ctx.audits,0);assert.equal(ctx.messages.length,0);assert(nodes.get('fixture-confirm-details').disabled);await ctx.saveFixtureConfirmation();assert.equal(ctx.calls,1);resolve({revision:1});await saving;assert.equal(ctx.audits,1);assert.deepEqual(ctx.messages,['Match details saved']);assert.equal(nodes.get('fixture-confirm-details').disabled,false);
});
test('failed save retains edits and editing context without success or queued-delivery claims',async()=>{
 const {ctx,reject}=setup();const saving=ctx.saveFixtureConfirmation();reject(Error('offline'));await saving;assert.equal(ctx.audits,0);assert.equal(ctx.state.selkent.fixtureOverrides['fictional-fixture'].time,'10:30');assert.equal(ctx.__fixtureEditingKey,'fictional-fixture');assert.match(ctx.messages[0],/Could not save/);assert.doesNotMatch(ctx.messages.join(''),/sent|queued|saved$/);
});
test('team switch during save does not update or audit the newly active team',async()=>{
 const {ctx,resolve}=setup();const saving=ctx.saveFixtureConfirmation();ctx.team='two';resolve({revision:1});await saving;assert.equal(ctx.audits,0);assert.equal(ctx.messages.length,0);
});
