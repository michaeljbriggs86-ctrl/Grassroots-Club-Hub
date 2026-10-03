#!/usr/bin/env node
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const app=fs.readFileSync("app/src/main/assets/app.js","utf8");
const overlay=fs.readFileSync("app/src/main/assets/static-feed-overlay.js","utf8");
const html=fs.readFileSync("app/src/main/assets/index.html","utf8");
const css=fs.readFileSync("app/src/main/assets/styles.css","utf8");
const norm=s=>String(s||"").toLowerCase().replace(/&amp;/g,"and").replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const plain=v=>JSON.parse(JSON.stringify(v));
const take=(source,from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a);
  assert.ok(a>=0&&b>a,`slice ${from} -> ${to} must exist`);
  return source.slice(a,b);
};

function staticAdapter(team,age="U10",division="Under 10D Navy"){
  const state={division:{name:division,teamName:team},meta:{ageGroup:age}};
  const body=take(overlay,"  function sameTeam(","  async function applyStaticFixtures(");
  return new Function("state","norm","window","ageCode",`${body}\nreturn adaptStaticFixtures;`)(
    state,norm,{isPublishedLeagueTeam:()=>true},()=>age
  );
}

const cup="U10 Selkent Cup Two - Round 1";
const groupFeed=[
  {date:"2026-10-04",division_name:cup,home:"Punjab United Red",away:"Shooters Hill AFC Vikings",provider_team_ids:["576","974"]},
  {date:"2026-10-04",division_name:cup,home:"Shooters Hill AFC Royals",away:"Punjab United Red",provider_team_ids:["973","576"]},
  {date:"2026-10-04",division_name:cup,home:"Shooters Hill AFC Vikings",away:"Shooters Hill AFC Royals",provider_team_ids:["974","973"]}
];

const vikings=staticAdapter("Shooters Hill AFC Vikings")({fixtures:groupFeed});
const royals=staticAdapter("Shooters Hill AFC Royals")({fixtures:groupFeed});
assert.deepEqual(vikings.map(f=>[f.opponent,f.venue,f.competition]),[
  ["Punjab United Red","A",cup],
  ["Shooters Hill AFC Royals","H",cup]
],"real static loader derives Vikings away/home correctly");
assert.deepEqual(royals.map(f=>[f.opponent,f.venue,f.competition]),[
  ["Punjab United Red","H",cup],
  ["Shooters Hill AFC Vikings","A",cup]
],"real static loader derives Royals home/away correctly");

function cardContext(team,fixtures,age){
  const ctx={
    state:{division:{teamName:team},meta:{teamName:team},selkent:{fixtures}},
    ageGroupNumber:()=>age,
    selkentNorm:norm,
    matchTeamLabel:s=>String(s||"").replace(/_/g," ").replace(/\s+/g," ").trim(),
    ownTeamDisplayName:()=>team,
    esc:s=>String(s||""),
    clubIdentityBadgeHtml:n=>`<i data-team="${n}"></i>`
  };
  vm.createContext(ctx);
  vm.runInContext(
    take(app,"function miniCupGroup(","function fixtureCompetitionLabel(")+
    take(app,"function homeFixtureTeamNames(","function canConfirmFixtureDetails()")+
    take(app,"function canonicalCardFixtureRows(","function canonicalMatchCardData("),
    ctx
  );
  return ctx;
}

const vctx=cardContext("Shooters Hill AFC Vikings",vikings,10);
const vdata=plain(vctx.canonicalCardRowData(vikings[0]));
assert.deepEqual(vdata.rows.map(r=>[r.label,r.home,r.away]),[
  ["Group game","Punjab United Red","Shooters Hill AFC Vikings"],
  ["Group game","Shooters Hill AFC Vikings","Shooters Hill AFC Royals"]
]);
const vhtml=vctx.canonicalMatchRowsHtml(vikings[0]);
assert.match(vhtml,/data-team="Punjab United Red"[\s\S]*<strong>Punjab United Red<\/strong>[\s\S]*<strong>Shooters Hill AFC Vikings<\/strong>[\s\S]*data-team="Shooters Hill AFC Vikings"/);
assert.match(vhtml,/data-team="Shooters Hill AFC Vikings"[\s\S]*<strong>Shooters Hill AFC Vikings<\/strong>[\s\S]*<strong>Shooters Hill AFC Royals<\/strong>[\s\S]*data-team="Shooters Hill AFC Royals"/);

const rctx=cardContext("Shooters Hill AFC Royals",royals,10);
const rdata=plain(rctx.canonicalCardRowData(royals[0]));
assert.deepEqual(rdata.rows.map(r=>[r.label,r.home,r.away]),[
  ["Group game","Shooters Hill AFC Royals","Punjab United Red"],
  ["Group game","Shooters Hill AFC Vikings","Shooters Hill AFC Royals"]
]);
assert.ok(vdata.rows.every(r=>r.label==="Group game")&&rdata.rows.every(r=>r.label==="Group game"));
assert.doesNotMatch(JSON.stringify([vdata,rdata]),/Fixture [12]/);

const defaults=vctx.cupFixtureDefaults(vikings[0]);
assert.equal(Object.prototype.hasOwnProperty.call(defaults,"time"),false,"Cup defaults must not contain a time key");
assert.equal(defaults.groundName,"Marathon Sports Ground");
assert.equal(defaults.address,"Shooters Hill");
assert.doesNotMatch(app,/14:00/,"app.js must not contain a hard-coded 14:00");

const timedFeed=groupFeed.map((row,index)=>index===0?{...row,time:"13:45"}:row);
const timed=staticAdapter("Shooters Hill AFC Vikings")({fixtures:timedFeed});
assert.equal(timed.find(f=>f.opponent==="Punjab United Red").time,"13:45","valid published HH:MM survives static adapter");
assert.equal({...timed[0],...plain(vctx.cupFixtureDefaults(timed[0]))}.time,"13:45","Cup defaults do not erase published time");
const invalidA=staticAdapter("Shooters Hill AFC Vikings")({fixtures:[{...groupFeed[0],time:"2pm"}]});
const invalidB=staticAdapter("Shooters Hill AFC Vikings")({fixtures:[{...groupFeed[0],time:"13:45:00"}]});
assert.equal(invalidA[0].time,"");
assert.equal(invalidB[0].time,"");

function model(canonical,fixture,base={}){
  const ctx={canonicalMatchCardFrameworkV11:()=>base,canonicalMatchCardData:()=>canonical};
  vm.createContext(ctx);
  vm.runInContext(take(app,"function canonicalMatchCardFrameworkV13Recovery","function canonicalUpcomingEventKeyV13"),ctx);
  return plain(ctx.canonicalMatchCardFrameworkV13Recovery(fixture));
}
const timedModel=model(
  {group:{},competition:cup,date:"2026-10-04",time:"13:45",ground:"Marathon Sports Ground",address:"Shooters Hill"},
  {...timed[0],time:"13:45"},
  {rows:"",time:"SHOULD NOT WIN",ground:"Marathon Sports Ground",address:"SHOULD NOT WIN"}
);
assert.equal(timedModel.time,"13:45");
assert.equal(timedModel.group,true);

const u14Feed={date:"2026-10-04",division_name:"U14 Selkent Cup Two - Prelim Round",home:"North Kent Wolves FC",away:"Shooters Hill AFC Lions",provider_team_ids:["391","978"]};
const u14=staticAdapter("Shooters Hill AFC Lions","U14","Under 14G Navy")({fixtures:[u14Feed]})[0];
assert.equal(u14.venue,"A");
const u14ctx=cardContext("Shooters Hill AFC Lions",[u14],14);
const u14row=plain(u14ctx.canonicalCardRowData(u14)).rows[0];
assert.deepEqual([u14row.label,u14row.home,u14row.away],["Match","North Kent Wolves FC","Shooters Hill AFC Lions"]);
const u14Unconfirmed=model(
  {group:null,competition:u14.competition,date:u14.date,time:"",ground:"Venue TBC",address:""},
  u14,
  {rows:"",time:"SHOULD NOT WIN",ground:"Marathon Sports Ground",address:"SHOULD NOT WIN"}
);
assert.equal(u14Unconfirmed.group,false);
assert.equal(u14Unconfirmed.time,"");
assert.equal(u14Unconfirmed.ground,"Venue TBC");
assert.equal(u14Unconfirmed.address,"");
const u14Confirmed=model(
  {group:null,competition:u14.competition,date:u14.date,time:"09:30",ground:"Haberdashers' Aske's Crayford",address:"Iron Mill Lane, Crayford, Kent, DA1 4RS"},
  u14,{rows:""}
);
assert.equal(u14Confirmed.time,"09:30");
assert.equal(u14Confirmed.ground,"Haberdashers' Aske's Crayford");

const romansFeed={date:"2026-10-04",division_name:"Under 15D Silver",home:"Greenwich Peninsula Lions",away:"Shooters Hill AFC Romans",provider_team_ids:["x","y"]};
const romans=staticAdapter("Shooters Hill AFC Romans","U15","Under 15D Silver")({fixtures:[romansFeed]})[0];
assert.equal(romans.venue,"A");
assert.equal(romans.competition,"League");
const romansCtx=cardContext("Shooters Hill AFC Romans",[romans],15);
const romansRow=plain(romansCtx.canonicalCardRowData(romans)).rows[0];
assert.deepEqual([romansRow.label,romansRow.home,romansRow.away],["Match","Greenwich Peninsula Lions","Shooters Hill AFC Romans"]);
const romansConfirmed=model(
  {group:null,competition:"Under 15D Silver",date:romans.date,time:"14:30",ground:"Meridian Sports Ground",address:"Charlton Park Lane, Charlton, SE7 8QS"},
  romans,{rows:""}
);
assert.equal(romansConfirmed.time,"14:30");

const selkentNamed={date:"2026-10-04",competition:"Selkent League",opponent:"Example FC",venue:"H"};
const selkentCtx=cardContext("Shooters Hill AFC Example",[selkentNamed],10);
selkentCtx.fixtureCompetitionLabel=f=>f.competition;
selkentCtx.formatDate=s=>s;
selkentCtx.parentCupGroupDetails=()=>null;
vm.runInContext(take(app,"function canonicalMatchCardFrameworkV11","function applyCanonicalMatchCardFrameworkV11"),selkentCtx);
const selkentV11=plain(selkentCtx.canonicalMatchCardFrameworkV11(selkentNamed));
assert.equal(selkentV11.time,"");
assert.equal(selkentV11.ground,"Venue TBC");
assert.match(selkentV11.rows,/>Match</);

vctx.fixtureCompetitionLabel=f=>f.competition;
vctx.formatDate=s=>s;
vctx.parentCupGroupDetails=()=>({groundName:"Marathon Sports Ground",address:"Shooters Hill"});
vctx.clubIdentityBadgeHtml=()=>"";
vm.runInContext(take(app,"function canonicalMatchCardFrameworkV11","function applyCanonicalMatchCardFrameworkV11"),vctx);
const emptyBadges=vctx.canonicalMatchCardFrameworkV11(vikings[0]);
assert.match(emptyBadges.rows,/<span class="canonical-v11-badge"><\/span>/);
vctx.canonicalMatchCardData=f=>({group:vctx.miniCupGroup(f),competition:f.competition,date:f.date,time:f.time||"",ground:"Marathon Sports Ground",address:"Shooters Hill"});
vm.runInContext(take(app,"function canonicalMatchCardFrameworkV13Recovery","function canonicalUpcomingEventKeyV13"),vctx);
assert.match(vctx.canonicalMatchCardFrameworkV13Recovery(vikings[0]).rows,/Badge pending/);

function classes(initial=[]){
  const set=new Set(initial);
  return {
    add:n=>set.add(n),remove:n=>set.delete(n),contains:n=>set.has(n),
    toggle(n,force){if(force===undefined){set.has(n)?set.delete(n):set.add(n);return set.has(n)}force?set.add(n):set.delete(n);return !!force;}
  };
}
function frame(){
  return {dataset:{},_src:"",set src(v){this._src=v},get src(){return this._src},removeAttribute(n){if(n==="src")this._src="";}};
}
function mapHarness(){
  const f=frame();
  const wrap={classList:classes(["hidden"]),hidden:false,style:{},querySelector:s=>s==="iframe"?f:null};
  const outer={classList:classes(["hidden"]),hidden:true,style:{},href:"",removeAttribute(n){if(n==="href")this.href="";}};
  const document={getElementById:id=>id.endsWith("-map-preview")?wrap:id.endsWith("-map-frame")?f:id.endsWith("-map")?outer:null};
  const ctx={document};
  vm.createContext(ctx);
  vm.runInContext(take(app,"function setMapPreview(","function renderFixtureOverview(")+take(app,"function revealCanonicalMapV12(","function applyCanonicalDashboardV12("),ctx);
  return {ctx,wrap,f,outer};
}
let mh=mapHarness();
mh.ctx.setMapPreview("next-match-map-preview","next-match-map-frame","");
assert.equal(mh.wrap.classList.contains("hidden"),true);
mh.ctx.revealCanonicalMapV12("next-match","Venue TBC","");
assert.equal(mh.wrap.classList.contains("hidden"),true,"V12 preserves legacy hidden state");

mh=mapHarness();
const crayford="https://www.google.com/maps?q=Haberdashers%27%20Aske%27s%20Crayford&output=embed";
mh.ctx.setMapPreview("next-match-map-preview","next-match-map-frame",crayford);
assert.equal(mh.wrap.classList.contains("hidden"),false);
mh.ctx.revealCanonicalMapV12("next-match","Venue TBC","");
assert.equal(mh.f.src,crayford,"V12 leaves confirmed legacy map untouched");

mh=mapHarness();
const meridian="https://www.google.com/maps?q=Meridian%20Sports%20Ground&output=embed";
mh.ctx.setMapPreview("next-match-map-preview","next-match-map-frame",meridian);
mh.ctx.revealCanonicalMapV12("next-match","Venue TBC","");
assert.equal(mh.f.src,meridian,"Romans confirmed legacy map stays visible");

function finalizerHarness(modelValue){
  let mapCalls=0;
  const card={classList:classes()};
  const host={innerHTML:"",closest:()=>card};
  const date={textContent:""},ground={textContent:""},address={textContent:""};
  const map={classList:classes(["hidden"]),href:"",removeAttribute(n){if(n==="href")this.href="";}};
  const ids={
    "next-match-home-teams":host,"next-match-home-date":date,"next-match-ground":ground,"next-match-address":address,
    "match-detail-versus":host,"match-detail-when":date,"match-detail-ground":ground,"match-detail-address":address,
    "matches-next-fixture":card,"matches-next-versus":host,"matches-next-when":date,"matches-next-ground":ground,"matches-next-address":address,"matches-next-map":map
  };
  const ctx={
    document:{getElementById:id=>ids[id]||null},
    canonicalMatchCardFrameworkV13Recovery:()=>modelValue,
    setStableHtml:(el,markup)=>{el.innerHTML=markup;},
    mapsHref:(g,a)=>`share:${g}|${a}`,mapsEmbedHref:(g,a)=>`embed:${g}|${a}`,
    setMapPreview:()=>{mapCalls++;},
    removeOpponentKitRowsV13:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(take(app,"function applyCanonicalRecoveryV13","function canonicalRecoveryNextEventV13"),ctx);
  return {ctx,card,date,map,get mapCalls(){return mapCalls}};
}
const groupModel={group:true,rows:"<b>rows</b>",date:"4 Oct",time:"13:45",ground:"Marathon Sports Ground",address:"Shooters Hill",competition:cup};
let fh=finalizerHarness(groupModel);
fh.ctx.applyCanonicalRecoveryV13("next-match",{});
assert.equal(fh.mapCalls,0,"V14 finalizer does not own next-match map");
fh=finalizerHarness(groupModel);
fh.ctx.applyCanonicalRecoveryV13("match-detail",{});
assert.equal(fh.mapCalls,0,"V14 finalizer does not own match-detail map");
fh=finalizerHarness(groupModel);
fh.ctx.applyCanonicalRecoveryV13("matches-next",{});
assert.equal(fh.mapCalls,1,"V14 finalizer owns Matches map");
assert.equal(fh.card.classList.contains("canonical-v14-cup-group"),true);
assert.equal(fh.date.textContent,"4 Oct · Group starts 13:45");
assert.equal(fh.map.href,"share:Marathon Sports Ground|Shooters Hill");
fh.ctx.canonicalMatchCardFrameworkV13Recovery=()=>({group:false,rows:"x",date:"5 Oct",time:"10:45",ground:"Weigall Road Sports Ground",address:"Birchdene Drive",competition:"League"});
fh.ctx.applyCanonicalRecoveryV13("matches-next",{});
assert.equal(fh.card.classList.contains("canonical-v14-cup-group"),false);
assert.equal(fh.date.textContent,"5 Oct · Kick-off 10:45");
fh.ctx.applyCanonicalRecoveryV13("matches-next",null);
assert.equal(fh.card.classList.contains("canonical-v14-cup-group"),false);
assert.equal(fh.map.classList.contains("hidden"),true);
assert.equal(fh.map.href,"");

assert.equal((html.match(/id="matches-next-map"/g)||[]).length,1);
const hostMatch=html.match(/<div class="fixture-map-preview hidden" id="matches-next-map-preview">([\s\S]*?)<\/div>/);
assert.ok(hostMatch);
assert.match(hostMatch[1],/id="matches-next-map-frame"/);
assert.match(hostMatch[1],/id="matches-next-map"/);
assert.match(css,/#matches-next-fixture\.canonical-v14-cup-group \.panel-heading h3\{display:none\}/);
const finalizer=take(app,"function applyCanonicalRecoveryV13","function canonicalRecoveryNextEventV13");
assert.doesNotMatch(finalizer,/revealCanonicalMapV12/);

console.log("PASS V14 reviewed canonical finalizer, Cup timing, map ownership and home-away semantics");
