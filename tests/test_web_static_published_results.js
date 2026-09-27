const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const overlay = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/static-feed-overlay.js'), 'utf8');
const state = {meta:{ageGroup:'U12X'},division:{name:'Under12X A Navy',teamName:'Parkwood Rangers Rebels'},selkent:{}};
const feed = {
  schema_version:2,provider:'Selkent',last_updated:'2026-09-27T12:20:00Z',
  age_groups:[{age_group:'U12X',standings:[{provider_division_id:4242,division_name:'Under12X A Navy',rows:[]}],
    published_results_status:'verified_scored_rows_v1',
    published_results:[{provider_division_id:4242,date:'2026-09-27',home:'Parkwood Rangers Rebels',away:'Eversley Rangers',homeGoals:9,awayGoals:1},
      {provider_division_id:4243,date:'2026-09-27',home:'Other Home',away:'Other Away',homeGoals:2,awayGoals:0}]}]
};
const requested = [],matched = [];
const localStorage = {getItem(){return null;},setItem(){}};
const window = {
  providerType:()=> 'manual',currentAgeCode:()=> 'U12X',
  nativeHttp:async url=>{requested.push(url);return {body:JSON.stringify(feed)};},
  syncOwnLeagueMatchesFromSelkent:(rows,source)=>matched.push({rows,source}),
  persistLocalState:()=>{}
};
const context = {window,state,localStorage,document:{},Promise,Date,console};
vm.runInNewContext(overlay,context);

(async()=>{
  const rows=await window.ClubHubStaticSelkent.applyStaticPublishedResults(true);
  assert.equal(rows.length,1);
  assert.equal(rows[0].homeGoals,9);
  assert.equal(rows[0].source,'selkent-static');
  assert.equal(state.selkent.resultSource,'github-static-results-v2');
  assert.equal(matched[0].source,'selkent-static');
  assert.match(requested[0],/data\/results\.json\?v=\d+/);
  const older = {...feed,age_groups:[{age_group:'U9',standings:null,published_results:null,published_results_status:'not_publicly_published'}]};
  feed.age_groups=older.age_groups;
  window.currentAgeCode=()=> 'U9';
  assert.equal((await window.ClubHubStaticSelkent.applyStaticPublishedResults(true)).length,0);
  assert.equal(state.selkent.results.length,0);
  console.log('Static published results: verified division and U9 boundary');
})().catch(err=>{console.error(err);process.exitCode=1;});
