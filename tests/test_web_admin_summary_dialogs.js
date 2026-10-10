// Legacy filename retained; Club Admin summaries now use navigable pages.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const start=app.indexOf('function openAdminSummary(kind){'),end=app.indexOf('let __divisionEntryMode=false;',start);
assert(start>=0&&end>start,'current summary handler is present');
const scrollHelper=app.match(/function preferredScrollBehavior\(\)\{[^\n]+/);
assert(scrollHelper,'production reduced-motion helper is present');
let overview=true,reducedMotion=false;
const navigations=[],scrolls=[],focuses=[];
const ids=Object.fromEntries(['admin-home-age-select','admin-attention-panel'].map(id=>[id,{
  scrollIntoView:options=>scrolls.push({id,...options}),focus:options=>focuses.push({id,...options})
}]));
const c={document:{getElementById:id=>ids[id]||null},isClubOverviewMode:()=>overview,
  window:{matchMedia:()=>({matches:reducedMotion})},navigate:target=>navigations.push(target)};
vm.createContext(c);
vm.runInContext(`${scrollHelper[0]}\n${app.slice(start,end)}`,c);
c.openAdminSummary('fixtures');c.openAdminSummary('results');
assert.deepEqual(navigations,['club-fixtures','club-results'],'summaries enter existing routed pages');
assert.equal(scrolls.length,0,'fixture/results navigation does not scroll overview controls');
c.openAdminSummary('teams');
reducedMotion=true;c.openAdminSummary('attention');
assert.deepEqual(scrolls,[{id:'admin-home-age-select',behavior:'smooth',block:'start'},
  {id:'admin-attention-panel',behavior:'auto',block:'start'}]);
assert.deepEqual(focuses,[{id:'admin-home-age-select',preventScroll:true},
  {id:'admin-attention-panel',preventScroll:true}]);
delete ids['admin-attention-panel'];c.openAdminSummary('attention');
assert.equal(focuses.length,2,'missing targets are harmless');
overview=false;
for(const kind of ['fixtures','results','teams','attention'])c.openAdminSummary(kind);
assert.equal(navigations.length,2,'non-overview roles cannot open club-wide summaries');
assert.equal(scrolls.length,2);
assert.equal(focuses.length,2);
for(const kind of ['fixtures','results']){
  assert.match(html,new RegExp(`data-admin-summary="${kind}"`));
  assert.match(html,new RegExp(`id="club-${kind}-panel"`));
}
console.log('PASS Club Admin summary page navigation, focus, role gate and reduced-motion scrolling');
