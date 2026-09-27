const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const open=app.slice(app.indexOf('function openAdminClubList(kind){'),app.indexOf('let __divisionEntryMode=false;'));
const close=app.slice(app.indexOf("for(const kind of ['fixtures','results']){"),app.indexOf("document.getElementById('squad-list-tab')",app.indexOf("for(const kind of ['fixtures','results']){")));
assert.ok(open.startsWith('function openAdminClubList')&&close.startsWith("for(const kind of ['fixtures','results'])"));

function element(id){
  const classes=new Set(['hidden']);
  return {id,children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
    appendChild(node){if(node.parent)node.parent.children=node.parent.children.filter(x=>x!==node);this.children.push(node);node.parent=this;},
    scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;}};
}
const ids={};
for(const kind of ['fixtures','results']){
  ids[`club-${kind}-panel`]=element(`club-${kind}-panel`);
  ids[`club-${kind}-slot`]=element(`club-${kind}-slot`);
  ids[`admin-${kind}-dialog-content`]=element(`admin-${kind}-dialog-content`);
  ids[`club-${kind}-slot`].appendChild(ids[`club-${kind}-panel`]);
  const dialog=ids[`admin-${kind}-dialog`]=element(`admin-${kind}-dialog`);
  dialog.open=false;
  dialog.listeners={};
  dialog.showModal=function(){this.open=true;};
  dialog.addEventListener=function(name,callback){this.listeners[name]=callback;};
  dialog.close=function(){this.open=false;this.listeners.close();};
}
ids['club-results-age']=element('club-results-age');ids['admin-home-age-select']=element('admin-home-age-select');ids['admin-attention-panel']=element('admin-attention-panel');
let admin=true,fixtures=0,results=0,clubTabs=0;
const run=new Function('document','isClubOverviewMode','refreshAdminFixtures','refreshClubResults','setClubTab',`
  const CLOUD_MODE=true;
  let __clubResultsAge='9',__clubResultsCompetition='all',__clubResultsPage=4,__clubTab='overview',currentView='club';
  ${open}
  ${close}
  return {openAdminClubList,openAdminSummary,getFilters:()=>[__clubResultsAge,__clubResultsCompetition,__clubResultsPage]};
`)({getElementById:id=>ids[id]||null},()=>admin,()=>{fixtures++;},()=>{results++;},()=>{clubTabs++;});

run.openAdminSummary('fixtures');
assert.equal(ids['admin-fixtures-dialog'].open,true);
assert.equal(ids['club-fixtures-panel'].parent,ids['admin-fixtures-dialog-content']);
assert.equal(ids['club-fixtures-panel'].classList.contains('hidden'),false);
assert.equal(fixtures,1);
ids['admin-fixtures-dialog'].close();
assert.equal(ids['club-fixtures-panel'].parent,ids['club-fixtures-slot']);
assert.equal(ids['club-fixtures-panel'].classList.contains('hidden'),true);

run.openAdminSummary('results');
assert.equal(ids['admin-results-dialog'].open,true);
assert.equal(ids['club-results-panel'].parent,ids['admin-results-dialog-content']);
assert.deepEqual(run.getFilters(),['all','league',0]);
assert.equal(results,1);
ids['admin-results-dialog'].close();
assert.equal(ids['club-results-panel'].parent,ids['club-results-slot']);
assert.equal(clubTabs,2);

run.openAdminSummary('teams');run.openAdminSummary('attention');
assert.equal(ids['admin-home-age-select'].focused,true);
assert.equal(ids['admin-attention-panel'].scrolled,true);
admin=false;
run.openAdminSummary('results');
assert.equal(results,1,'coach mode cannot open a club-wide results dialog');
assert.match(html,/data-admin-summary="results"[^>]*aria-controls="admin-results-dialog"/);
assert.doesNotMatch(html,/data-nav="club-fixtures"/);
process.stdout.write('Club Admin summary dialogs and coach result panel restoration: OK\n');
