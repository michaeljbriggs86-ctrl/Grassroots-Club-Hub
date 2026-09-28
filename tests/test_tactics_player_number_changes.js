const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const helper=source.slice(source.indexOf('let __tacticsSelected=null;'),source.indexOf('const TACTICS_FORMATIONS=',source.indexOf('let __tacticsSelected=null;')));
const editStart=source.indexOf('function removePlayerFromSquad(){');
const editing=source.slice(editStart,source.indexOf('function openAwardDialog(){',editStart));
assert.ok(helper.includes('function updateTacticsPlayerReferences(')&&editing.includes('function savePlayer(e){'));
const tactics={
  lineup:['p1','p2'],positions:{p1:{x:31,y:45}},
  lineupByFixture:{first:['p1','p2'],second:['p2','p1']},
  positionsByFixture:{first:{p1:{x:31,y:45}},second:{p1:{x:70,y:25}}},
  matchdaySelections:{first:['p1','p2'],second:['p1']},matchdayAutoPrepared:{first:true,second:true}
};
const state={squad:[{number:1,name:'Albie',status:'active',role:'goalkeeper'},{number:2,name:'Oscar',status:'active',role:'outfield'}],meta:{ageGroup:'U9'},tactics};
const fields={'player-original-number':{value:'1'},'player-number':{value:'9'},'player-name':{value:'Albie'},'player-role':{value:'goalkeeper'},'player-status':{value:'active'},'player-dialog':{close(){}}};
const context={state,document:{getElementById:id=>fields[id]},requireCoach:()=>true,
  footballFormat:()=>({registered:10,format:'5v5'}),confirm:()=>true,
  saveState:()=>{},auditEvent:()=>{},toast:()=>{},alert:msg=>{throw Error(msg);}};
vm.createContext(context);vm.runInContext(helper+editing,context);
context.savePlayer({preventDefault(){}});
assert.deepEqual(Array.from(tactics.lineup),['p9','p2']);
assert.deepEqual(Array.from(tactics.lineupByFixture.second),['p2','p9'],'previous fixture order follows the player');
assert.equal(tactics.positionsByFixture.first.p9.x,31);
assert.equal(tactics.positionsByFixture.second.p9.x,70,'each fixture position stays with the player');
assert.deepEqual(Array.from(tactics.matchdaySelections.second),['p9'],'matchday selections follow the player');
assert.equal(tactics.positionsByFixture.second.p1,undefined);
assert.equal(tactics.matchdayAutoPrepared.second,true);
fields['player-original-number'].value='9';
context.removePlayerFromSquad();
assert.deepEqual(Array.from(tactics.lineupByFixture.first),['p2']);
assert.deepEqual(Array.from(tactics.lineupByFixture.second),['p2']);
assert.deepEqual(Array.from(tactics.matchdaySelections.second),[]);
assert.equal(tactics.positionsByFixture.second.p9,undefined,'reusing shirt 9 cannot inherit old positions');
assert.equal(tactics.matchdayAutoPrepared.second,true,'removal does not turn an explicit selection into an automatic one');
console.log('Tactics shirt number and removal checks passed');
