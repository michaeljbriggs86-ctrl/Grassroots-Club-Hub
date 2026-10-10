const assert=require('node:assert/strict');
const fs=require('node:fs');
let clock=Date.parse('2026-10-01T12:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}

const norm=value=>String(value||'').toLowerCase().replace(/&amp;/g,'and').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const state={division:{name:'Under 14G Navy',teamName:'Shooters Hill AFC Lions'},meta:{ageGroup:'U14'},selkent:{fixtures:[]},matches:[]};
const overlay=fs.readFileSync('app/src/main/assets/static-feed-overlay.js','utf8');
const adapter=overlay.slice(overlay.indexOf('  function sameTeam('),overlay.indexOf('  async function applyStaticFixtures('));
assert.ok(adapter.startsWith('  function sameTeam(')&&adapter.includes('function adaptStaticFixtures('),'static fixture adapter found');
const adapt=new Function('state','norm','window','ageCode',`${adapter}\nreturn adaptStaticFixtures;`)(state,norm,{isPublishedLeagueTeam:()=>true},()=> 'U14');

const cup={date:'2026-10-04',division_name:'U14 Selkent Cup Two - Prelim Round',home:'North Kent Wolves FC',away:'Shooters Hill AFC Lions',provider_team_ids:['391','978']};
const wrongSide={...cup,away:'Shooters Hill AFC Lions White'};
const wrongLeague={...cup,division_name:'Under 14D Navy',home:'Other FC'};
const league={...cup,division_name:'Under 14G Navy',home:'League FC'};
const fixtures=adapt({fixtures:[cup,wrongSide,wrongLeague,league]});
assert.equal(fixtures.length,2,'own cup and league fixtures are included, other teams and divisions excluded');
assert.deepEqual(fixtures.find(f=>f.opponent==='North Kent Wolves FC'),{
  date:'2026-10-04',time:'',opponent:'North Kent Wolves FC',venue:'A',
  competition:'U14 Selkent Cup Two - Prelim Round',providerTeamIds:['391','978'],
  raw:'North Kent Wolves FC v Shooters Hill AFC Lions',source:'selkent-static'
});
assert.equal(fixtures.find(f=>f.opponent==='League FC').competition,'League');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const body=app.slice(app.indexOf('function adminFixtureHasResult(st,team,fixture,feed){'),app.indexOf('function renderAdminFixtures(){'));
assert.ok(body.startsWith('function adminFixtureHasResult(')&&body.includes('function buildAdminFixtureRows('),'admin fixture builder found');
const admin=new Function('selkentNorm','normalizeTeamKey','fixtureAckState','fixtureKitSelectionKey','fixtureStableKey','matchStatus','publishedClubTeamData','verifiedClubResultsFeed','Date',`${body}\nreturn buildAdminFixtureRows;`)(
  norm,norm,()=>({status:'awaiting'}),()=>'',()=>'',m=>m.status||'scheduled',()=>({results:[]}),()=>null,Clock
);
const team={id:'u14-lions',ageGroup:'U14',teamName:'Lions',leagueName:'Shooters Hill AFC Lions',division:'Under 14G Navy'};
const rows=admin([{team,state:{division:{name:'Under 14G Navy'},matches:[]}}],{age_groups:[{age_group:'U14',fixtures:[cup,wrongSide,wrongLeague,league],standings:[]}]});
assert.equal(rows.length,2,'admin schedule includes the correct cup and league fixtures');
assert.equal(rows.find(f=>f.opponent==='North Kent Wolves FC').competition,'U14 Selkent Cup Two - Prelim Round');
assert.equal(rows.find(f=>f.opponent==='North Kent Wolves FC').venue,'A');
const schedule=[{team,state:{division:{name:team.division},matches:[]}}];
const feed={age_groups:[{age_group:'U14',fixtures:[cup,league,{...cup,date:'2026-09-28'}],standings:[]}]};
assert.equal(admin(schedule,feed).length,2,'past fixtures are excluded before the cup day');
clock=Date.parse('2026-10-04T12:00:00Z');
assert.equal(admin(schedule,feed).length,2,'today\'s fixtures are retained');
clock=Date.parse('2026-10-05T12:00:00Z');
assert.equal(admin(schedule,feed).length,0,'elapsed fixtures leave the upcoming admin schedule');
console.log('Selkent cup fixture checks passed');
