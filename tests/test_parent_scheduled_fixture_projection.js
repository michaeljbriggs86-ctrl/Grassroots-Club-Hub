const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(a,b)=>{const x=source.indexOf(a),y=source.indexOf(b,x);assert(x>=0&&y>x);return source.slice(x,y);};
const context={CLOUD_MODE:true,currentRole:'parent',Date,state:{selkent:{fixtures:[]}},
  miniCupGroup:()=>null,parentMatchdayEnded:()=>false,resolvedFixture:f=>f,
  normalizeTeamKey:s=>String(s||'').toLowerCase(),matchStatus:m=>m.status||'played',
  isProviderOwnedMatch:m=>/selkent|github-static|static-fixture/i.test(m.source||''),
  fixtureIsReported:()=>{throw Error('Parent consulted staff completion');}};
vm.createContext(context);
vm.runInContext(take('function scheduledFixtureProjection(', 'function normalizeAwardTypes(')+take('function upcomingFixtures(){','function miniCupGroup('),context);
const record={id:'friendly',status:'scheduled',source:'manual',date:'2099-10-04',time:'10:00',opponent:'Example Opponent',venue:'H',competition:'Friendly',groundName:'Example Ground',address:'Example Road',gf:91,ga:87,notes:'PRIVATE_NOTE',players:['PRIVATE_CHILD'],medical:{value:'PRIVATE_MEDICAL'}};
const rows=context.scheduledFixtureProjection([record,{...record,id:'played',status:'played'},{...record,id:'provider',source:'selkent-fixture'}]);
assert.equal(rows.length,1);
assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_|\bgf\b|\bga\b|medical|players|notes/);
assert.equal(record.notes,'PRIVATE_NOTE','projection never mutates the authorized input');
assert.equal(context.scheduledFixtureProjection([{...record,address:{secret:'PRIVATE_NESTED'}}])[0].address,undefined,'nested data cannot enter fixture fields');
context.state.selkent.scheduledFixtures=rows;
Object.defineProperty(context.state,'matches',{get(){throw Error('Parent read staff match records');},configurable:true});
const fixture=context.nextPublishedFixture();
assert.equal(fixture.id,'friendly');assert.equal(fixture.time,'10:00');assert.equal(fixture.groundName,'Example Ground');assert.equal(fixture.address,'Example Road');
context.state.selkent.fixtures=[{date:record.date,opponent:record.opponent,venue:record.venue,competition:'Division'}];
assert.equal(context.upcomingFixtures().length,1,'provider fixture still wins duplicate identity');
assert(source.includes('scheduledFixtures: scheduledFixtureProjection(data.matches)'),'normalization derives the schedule from current authorized state, never cached schedule input');
console.log('PASS parent scheduled friendlies retain timing/venue through a score-free projection without staff record reads');
