const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/styles.css'),'utf8');
const start=app.indexOf('function renderSquadMatchPrep(){'),end=app.indexOf('function renderSquad(){',start);
assert.ok(start>0&&end>start);
const ids=['squad-match-prep','squad-match-prep-title','squad-match-prep-date','squad-prep-selected','squad-prep-available'];
const nodes=Object.fromEntries(ids.map(id=>[id,{textContent:'',hidden:false,classList:{toggle(name,hidden){this.hidden=hidden;}}}]));
const state={tactics:{matchdaySelections:{first:['p1','p2']}}};
let fixture={id:'first',opponent:'Phoenix Sports Panthers',date:'2026-10-04'},coach=true,availabilityKey='first';
const context={state,document:{getElementById:id=>nodes[id]},isCoach:()=>coach,featureEnabled:()=>true,
  ensureTacticsState:()=>{},nextPublishedFixture:()=>fixture,currentTacticsFixtureKey:()=>fixture?.id||'general',
  footballFormat:()=>({matchday:7}),matchTeamLabel:x=>x,formatDate:x=>x,fixtureStableKey:f=>f.id,
  availabilityCounts:()=>({available:5}),get __availabilityFixture(){return availabilityKey;}};
vm.createContext(context);vm.runInContext(app.slice(start,end),context);
context.renderSquadMatchPrep();
assert.equal(nodes['squad-match-prep'].classList.hidden,false);
assert.equal(nodes['squad-match-prep-title'].textContent,'Next: Phoenix Sports Panthers');
assert.equal(nodes['squad-prep-selected'].textContent,'2 / 7');
assert.equal(nodes['squad-prep-available'].textContent,'5 available');
availabilityKey='other';context.renderSquadMatchPrep();
assert.equal(nodes['squad-prep-available'].textContent,'Awaiting replies','stale availability is not shown for a new fixture');
coach=false;context.renderSquadMatchPrep();
assert.equal(nodes['squad-match-prep'].classList.hidden,true,'matchday planning is coach only');
assert.ok(html.includes('id="squad-open-plan"'));
assert.ok(app.includes("document.getElementById('squad-open-plan')?.addEventListener('click',()=>setSquadPage(1))"));
assert.ok(css.includes('.squad-prep-stats'));
console.log('Squad preparation card checks passed');
