const assert=require('node:assert/strict');
const fs=require('node:fs');
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const state={division:{name:'Under 14G Navy',teamName:'Shooters Hill AFC Lions'},meta:{ageGroup:'U14'}};
const source=fs.readFileSync('app/src/main/assets/static-feed-overlay.js','utf8');
const body=source.slice(source.indexOf('  function sameTeam('),source.indexOf('  async function applyStaticFixtures('));
assert.ok(body.includes('function isSelkentLeagueDivision('));
const {adapt,leagueHeading}=new Function('state','norm','window',body+'\nreturn {adapt:adaptStaticFixtures,leagueHeading:isSelkentLeagueDivision};')(state,norm,{isPublishedLeagueTeam:()=>true});
const directory=JSON.parse(fs.readFileSync('data/directory.json','utf8'));
for(const entry of directory.leagues)assert.ok(leagueHeading(entry.division_name),entry.division_name+' must be recognised as a league division');
const base={date:'2099-10-04',home:'North Kent Wolves FC',away:'Shooters Hill AFC Lions',provider_team_ids:['391','978']};
const headings=['U14 Selkent Cup Two - Prelim Round','U14 Kent Plate','U14 Friendly','U14 Shield'];
const fixtures=[
  ...headings.map((division_name,index)=>({...base,home:index?`Other Opponent ${index}`:base.home,division_name})),
  {...base,division_name:'Under 14G Navy',home:'League Opponent'},
  {...base,division_name:'Under 14D Navy',home:'Other Division'},
  {...base,division_name:'U14 Friendly',away:'Shooters Hill AFC Lions White'}
];
const selected=adapt({fixtures});
assert.equal(selected.length,5);
for(const [index,name] of headings.entries())assert.equal(selected.find(x=>x.competition===name)?.opponent,index?`Other Opponent ${index}`:'North Kent Wolves FC',name);
assert.equal(selected.find(x=>x.opponent==='League Opponent')?.competition,'League');
assert.ok(!selected.some(x=>x.opponent==='Other Division'));
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const adminBody=app.slice(app.indexOf('function adminFixtureHasResult(st,team,fixture,feed){'),app.indexOf('function renderAdminFixtures(){'));
const admin=new Function('selkentNorm','normalizeTeamKey','fixtureAckState','fixtureKitSelectionKey','fixtureStableKey','matchStatus','publishedClubTeamData','verifiedClubResultsFeed',adminBody+'\nreturn buildAdminFixtureRows;')(
  norm,norm,()=>({status:'awaiting'}),()=>'',()=>'',m=>m.status||'scheduled',()=>({results:[]}),()=>null);
const team={id:'lions',ageGroup:'U14',teamName:'Lions',leagueName:'Shooters Hill AFC Lions',division:'Under 14G Navy'};
const rows=admin([{team,state:{division:{name:team.division},matches:[]}}],{age_groups:[{age_group:'U14',fixtures,standings:[]}]});
assert.equal(rows.length,5);
for(const name of headings)assert.ok(rows.some(x=>x.competition===name),name+' appears in Club Admin');
console.log('All currently published Selkent competition fixture checks passed');
