/*
 * PitchKind - Selkent static-feed integration overlay
 *
 * Static authorities:
 *   directory/division membership -> data/directory.json
 *   fixtures (all ages)           -> data/results.json schema v2
 *   U12+ standings                  -> data/results.json schema v2
 *
 * Temporary live Selkent fallback remains ONLY for:
 *   published match results
 */
(function(){
  'use strict';

  const STATIC_DIRECTORY_URL='https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/directory.json';
  const STATIC_RESULTS_URL='https://raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json';
  const DIRECTORY_CACHE_KEY='grassrootsHub_static_directory_v1';
  const RESULTS_CACHE_KEY='grassrootsHub_static_results_v2';
  const DIRECTORY_SOURCE='github-static-directory-v1';
  const TABLE_SOURCE='github-static-results-v2';
  const FIXTURE_SOURCE='github-static-fixtures-v2';

  const original={
    syncProviderClubTeams: typeof window.syncProviderClubTeams==='function'?window.syncProviderClubTeams:null,
    syncSelkentDivision: typeof window.syncSelkentDivision==='function'?window.syncSelkentDivision:null,
    syncSelkentLeagueTable: typeof window.syncSelkentLeagueTable==='function'?window.syncSelkentLeagueTable:null,
    syncSelkent: typeof window.syncSelkent==='function'?window.syncSelkent:null,
    refreshPublishedLeagueAges: typeof window.refreshPublishedLeagueAges==='function'?window.refreshPublishedLeagueAges:null,
    parseSelkentHtml: typeof window.parseSelkentHtml==='function'?window.parseSelkentHtml:null,
    applySelkentTeamDiscovery: typeof window.applySelkentTeamDiscovery==='function'?window.applySelkentTeamDiscovery:null,
    renderLeagueTable: typeof window.renderLeagueTable==='function'?window.renderLeagueTable:null
  };

  const memoryCache={directory:null,results:null};

  function norm(value=''){
    return String(value||'').toLowerCase().replace(/&amp;/g,'and').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function ageCode(){
    if(typeof window.currentAgeCode==='function')return window.currentAgeCode();
    const raw=String(state?.meta?.ageGroup||'').trim().toUpperCase().replace(/\s+/g,'');
    if(/^U\d{1,2}X?$/.test(raw))return raw;
    const m=raw.match(/(\d{1,2})/);return m?`U${Number(m[1])}`:'';
  }

  function isSelkentProvider(){
    try{return typeof window.providerType!=='function'||window.providerType()==='selkent';}catch{return true;}
  }

  function safeJsonParse(raw,label){
    try{return JSON.parse(raw);}catch{throw new Error(`${label} returned invalid JSON`);}
  }

  function validateDirectory(data){
    if(!data||!Array.isArray(data.clubs)||!Array.isArray(data.leagues)||!Array.isArray(data.team_club_links))throw new Error('Static Selkent directory has an unsupported shape');
    return data;
  }

  function validateResults(data){
    if(!data||Number(data.schema_version)!==2||String(data.provider||'').toLowerCase()!=='selkent'||!Array.isArray(data.age_groups))throw new Error('Static Selkent results feed is not schema v2');
    return data;
  }

  function readCached(key,validator){
    try{const raw=localStorage.getItem(key);return raw?validator(JSON.parse(raw)):null;}catch{return null;}
  }

  function writeCached(key,data){
    try{localStorage.setItem(key,JSON.stringify(data));}catch(_){/* app state remains the last-known-good fallback */}
  }

  async function fetchStaticFeed(url,key,validator,force=false){
    const slot=key===DIRECTORY_CACHE_KEY?'directory':'results';
    if(!force&&memoryCache[slot])return memoryCache[slot];
    try{
      if(typeof window.nativeHttp!=='function')throw new Error('Native HTTP bridge unavailable');
      const response=await window.nativeHttp(url,'GET','');
      const data=validator(safeJsonParse(response.body,'Static Selkent feed'));
      memoryCache[slot]=data;writeCached(key,data);return data;
    }catch(err){
      const cached=readCached(key,validator);
      if(cached){memoryCache[slot]=cached;return cached;}
      throw err;
    }
  }

  function loadDirectory(force=false){return fetchStaticFeed(STATIC_DIRECTORY_URL,DIRECTORY_CACHE_KEY,validateDirectory,force);}
  function loadResults(force=false){return fetchStaticFeed(STATIC_RESULTS_URL,RESULTS_CACHE_KEY,validateResults,force);}

  function persistWithoutRender(){
    try{if(typeof window.persistLocalState==='function')window.persistLocalState();else if(typeof state!=='undefined'&&state)localStorage.setItem('grassrootsHub_team_state_v1',JSON.stringify(state));}catch(_){ }
  }

  function saveAndRender(){
    if(typeof window.saveState==='function')window.saveState();else{persistWithoutRender();if(typeof window.renderAll==='function')window.renderAll();}
  }

  function providerClubIdFromState(){
    const candidates=[
      state?.selkent?.clubUrl,
      STARTER_DATA?.selkent?.clubUrl
    ];
    for(const raw of candidates){const m=String(raw||'').match(/\/clubs\/(\d+)/i);if(m)return Number(m[1]);}
    return null;
  }

  function resolveClubId(directory){
    const fromUrl=providerClubIdFromState();
    if(fromUrl&&directory.clubs.some(c=>Number(c.club_id)===fromUrl))return fromUrl;

    const currentTeam=norm(state?.division?.teamName||'');
    if(currentTeam){
      const exact=directory.team_club_links.find(link=>norm(link.team_name)===currentTeam);
      if(exact)return Number(exact.club_id);
    }

    const display=norm(typeof window.clubSettings==='function'?window.clubSettings()?.display_name:'');
    if(display){
      const clean=s=>norm(s).replace(/\b(football club|association football club|afc|fc)\b/g,'').replace(/\s+/g,' ').trim();
      const wanted=clean(display);
      const matches=directory.clubs.filter(c=>clean(c.club_name)===wanted);
      if(matches.length===1)return Number(matches[0].club_id);
    }
    return null;
  }

  function shortTeamName(providerTeam,clubName){
    const team=String(providerTeam||'').trim(),club=String(clubName||'').trim();
    if(!team)return'';
    if(club&&norm(team).startsWith(norm(club))){
      const prefixWords=club.split(/\s+/).length;
      const reduced=team.split(/\s+/).slice(prefixWords).join(' ').trim();
      if(reduced)return reduced;
    }
    return team;
  }

  function buildClubTeams(directory){
    const clubId=resolveClubId(directory);
    if(!clubId)throw new Error('Current Selkent club could not be matched in the static directory');
    const linkByTeam=new Map();
    directory.team_club_links.filter(x=>Number(x.club_id)===clubId).forEach(x=>linkByTeam.set(norm(x.team_name),x));
    const rows=[];const seen=new Set();
    for(const league of directory.leagues){
      for(const team of (league.teams||[])){
        const link=linkByTeam.get(norm(team));if(!link)continue;
        const key=`${String(league.age_group).toUpperCase()}|${norm(team)}|${norm(league.division_name)}`;
        if(seen.has(key))continue;seen.add(key);
        const short=shortTeamName(team,link.club_name);
        rows.push({
          selkentName:`${league.age_group} ${team}`,
          ageGroup:String(league.age_group||'').toUpperCase(),
          teamName:short,
          leagueName:team,
          division:league.division_name||'',
          season:state?.meta?.season||'',
          providerClubId:clubId
        });
      }
    }
    return rows.sort((a,b)=>Number(a.ageGroup.replace(/\D/g,''))-Number(b.ageGroup.replace(/\D/g,''))||a.teamName.localeCompare(b.teamName));
  }

  function findDirectoryLeague(directory){
    const age=ageCode();
    const team=norm(state?.division?.teamName||'');
    const division=norm(state?.division?.name||'');
    let candidates=directory.leagues.filter(l=>String(l.age_group||'').toUpperCase()===age);
    if(division){
      const exact=candidates.find(l=>norm(l.division_name)===division&&(team?l.teams.some(t=>norm(t)===team):true));
      if(exact)return exact;
    }
    if(team){
      const teamMatches=candidates.filter(l=>(l.teams||[]).some(t=>norm(t)===team));
      if(teamMatches.length===1)return teamMatches[0];
      if(teamMatches.length>1&&division)return teamMatches.find(l=>norm(l.division_name).includes(division)||division.includes(norm(l.division_name)))||null;
    }
    return null;
  }

  async function applyStaticDivision(silent=true,force=false){
    if(!isSelkentProvider())return null;
    const directory=await loadDirectory(force);
    const league=findDirectoryLeague(directory);
    if(!league)throw new Error(`No ${ageCode()||'current-age'} static Selkent division found for ${state?.division?.teamName||state?.meta?.teamName||'this team'}`);
    state.selkent=state.selkent||{};
    state.division=state.division||{};
    state.division.name=league.division_name||'';
    const teams=[...new Set((league.teams||[]).map(x=>String(x).trim()).filter(Boolean))];
    if(teams.length<2)throw new Error(`${league.division_name||'Division'} has no safe static team list`);
    state.division.teams=teams;
    state.selkent.directorySource=DIRECTORY_SOURCE;
    state.selkent.directoryGeneratedAt=directory.last_updated||'';
    state.selkent.lastDivisionSync=directory.last_updated||new Date().toISOString();
    if(typeof window.updateCurrentClubTeamDivision==='function')window.updateCurrentClubTeamDivision(state.division.name);
    persistWithoutRender();
    if(!silent&&typeof window.toast==='function')window.toast(`${state.division.name} loaded from Selkent feed`);
    return league;
  }

  function findResultsAge(results){
    const age=ageCode();return results.age_groups.find(a=>String(a.age_group||'').toUpperCase()===age)||null;
  }

  function findStandingTable(ageEntry){
    if(!ageEntry||!Array.isArray(ageEntry.standings))return null;
    const division=norm(state?.division?.name||'');
    const team=norm(state?.division?.teamName||'');
    if(division){const exact=ageEntry.standings.find(s=>norm(s.division_name)===division);if(exact)return exact;}
    if(team){
      const matches=ageEntry.standings.filter(s=>(s.rows||[]).some(r=>norm(r.team_name)===team));
      if(matches.length===1)return matches[0];
    }
    return null;
  }

  function adaptStandingRows(table){
    return [...(table.rows||[])].sort((a,b)=>Number(a.row_order||0)-Number(b.row_order||0)).map(row=>({
      team:String(row.team_name||''),
      p:Number(row.played||0),w:Number(row.won||0),d:Number(row.drawn||0),l:Number(row.lost||0),
      gf:Number(row.gf||0),ga:Number(row.ga||0),gd:Number(row.gf||0)-Number(row.ga||0),pts:Number(row.points||0),
      sourceOrder:Number(row.row_order||0)||null,
      providerTeamId:row.provider_team_id??null
    }));
  }

  async function applyStaticStandings(silent=true,force=false){
    state.selkent=state.selkent||{};
    if(typeof window.leagueTableEnabled==='function'&&!window.leagueTableEnabled()){
      state.selkent.table=[];
      state.selkent.tableSource=TABLE_SOURCE;
      persistWithoutRender();
      return[];
    }
    const results=await loadResults(force);
    const ageEntry=findResultsAge(results);
    if(!ageEntry)throw new Error(`No ${ageCode()} entry in static Selkent results feed`);
    if(ageEntry.standings===null||ageEntry.published_results_status==='not_publicly_published'){
      state.selkent.table=[];state.selkent.tableSource=TABLE_SOURCE;persistWithoutRender();return[];
    }
    const table=findStandingTable(ageEntry);
    if(!table)throw new Error(`No static standings found for ${state?.division?.name||'current division'}`);
    const rows=adaptStandingRows(table);
    if(!rows.length)throw new Error(`Static standings for ${table.division_name||'current division'} contain no teams`);
    state.selkent.table=rows;
    state.selkent.tableSource=TABLE_SOURCE;
    state.selkent.tableProviderDivisionId=table.provider_division_id??null;
    state.selkent.tableSourceDisclaimer=table.source_disclaimer||'';
    state.selkent.tableSourceOrderAuthoritativeForTies=false;
    state.selkent.resultsGeneratedAt=results.last_updated||'';
    state.selkent.lastTableSync=results.last_updated||new Date().toISOString();
    persistWithoutRender();
    if(!silent&&typeof window.toast==='function')window.toast('League standings loaded from static Selkent feed');
    return rows;
  }

  async function staticPublishedAges(force=false){
    const results=await loadResults(force);
    return results.age_groups.filter(a=>Array.isArray(a.standings)).map(a=>String(a.age_group||'')).filter(Boolean);
  }

  function sameTeam(a='',b=''){
    const x=norm(a),y=norm(b);if(!x||!y)return false;
    return x===y||(x.length>8&&y.includes(x))||(y.length>8&&x.includes(y));
  }

  function adaptStaticFixtures(ageEntry){
    if(!ageEntry||!Array.isArray(ageEntry.fixtures))throw new Error(`No ${ageCode()} fixtures array in static Selkent feed`);
    const division=norm(state?.division?.name||''),self=String(state?.division?.teamName||state?.meta?.teamName||'').trim();
    if(!self)throw new Error('Current team identity is missing');
    const rows=[];
    for(const row of ageEntry.fixtures){
      if(division&&norm(row?.division_name||'')!==division)continue;
      const home=String(row?.home||'').trim(),away=String(row?.away||'').trim();
      const ownHome=sameTeam(home,self),ownAway=sameTeam(away,self);
      if(ownHome===ownAway)continue;
      const opponent=ownHome?away:home;
      if(!opponent)continue;
      rows.push({
        date:String(row?.date||''),time:'',opponent,venue:ownHome?'H':'A',
        competition:(typeof window.isPublishedLeagueTeam==='function'&&window.isPublishedLeagueTeam())?'League':'Division',
        providerTeamIds:Array.isArray(row?.provider_team_ids)?row.provider_team_ids.map(String):[],
        raw:`${home} v ${away}`,source:'selkent-static'
      });
    }
    return rows.sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||(a.opponent||'').localeCompare(b.opponent||''));
  }

  async function applyStaticFixtures(silent=true,force=false){
    state.selkent=state.selkent||{};
    const results=await loadResults(force),ageEntry=findResultsAge(results);
    if(!ageEntry)throw new Error(`No ${ageCode()} entry in static Selkent results feed`);
    const previous=(typeof window.nextPublishedFixture==='function')?window.nextPublishedFixture():null;
    const rows=adaptStaticFixtures(ageEntry);
    state.selkent.fixtures=rows;
    state.selkent.fixtureSource=FIXTURE_SOURCE;
    state.selkent.fixturesGeneratedAt=results.last_updated||'';
    state.selkent.lastFixtureScan=new Date().toISOString();
    const next=(typeof window.nextPublishedFixture==='function')?window.nextPublishedFixture():(rows[0]||null);
    try{if(next&&typeof window.ensureFixtureKitColours==='function')await window.ensureFixtureKitColours(next);}catch(_){ }
    try{if(typeof window.updateFixtureTracking==='function')window.updateFixtureTracking(previous,next);}catch(_){ }
    persistWithoutRender();
    if(!silent&&typeof window.toast==='function')window.toast(`${rows.length} team fixture${rows.length===1?'':'s'} loaded from Selkent feed`);
    return rows;
  }

  async function liveFixtureFallback(){
    const sk=state.selkent||{};
    const choices=[state?.meta?.ageGroup,state?.division?.name].filter(Boolean);
    const page=await window.fetchSelkentSelected(sk.fixturesUrl||STARTER_DATA?.selkent?.fixturesUrl,choices);
    const parsed=original.parseSelkentHtml?original.parseSelkentHtml(page.html,page.url):window.parseSelkentHtml(page.html,page.url);
    return parsed||{fixtures:[],teams:[]};
  }

  async function liveResultFallback(){
    if(typeof window.leagueTableEnabled==='function'&&!window.leagueTableEnabled())return{results:[],teams:[]};
    const sk=state.selkent||{};
    const choices=[state?.meta?.ageGroup,state?.division?.name].filter(Boolean);
    const page=await window.fetchSelkentSelected(sk.resultsUrl||STARTER_DATA?.selkent?.resultsUrl,choices);
    const parsed=original.parseSelkentHtml?original.parseSelkentHtml(page.html,page.url):window.parseSelkentHtml(page.html,page.url);
    return{results:Array.isArray(parsed?.results)?parsed.results:[],teams:Array.isArray(parsed?.teams)?parsed.teams:[]};
  }

  window.syncProviderClubTeams=async function(silent=true){
    if(!isSelkentProvider()&&original.syncProviderClubTeams)return original.syncProviderClubTeams(silent);
    try{
      const directory=await loadDirectory(false),teams=buildClubTeams(directory);
      if(!teams.length)throw new Error('No current-club teams found in static Selkent directory');
      state.selkent=state.selkent||{};
      state.selkent.clubTeams=teams;
      state.selkent.directorySource=DIRECTORY_SOURCE;
      state.selkent.directoryGeneratedAt=directory.last_updated||'';
      state.selkent.lastClubSync=directory.last_updated||new Date().toISOString();
      persistWithoutRender();
      if((typeof CLOUD_MODE!=='undefined'&&CLOUD_MODE)&&typeof window.isAdmin==='function'&&window.isAdmin())window.ClubHubCloud?.syncTeamDirectory?.(teams).catch(()=>{});
      if(typeof window.renderClubTeamOptions==='function')window.renderClubTeamOptions();
      if(!silent&&typeof window.toast==='function')window.toast(`${teams.length} club teams loaded from Selkent feed`);
      return teams;
    }catch(err){
      if(typeof window.renderClubTeamOptions==='function')window.renderClubTeamOptions();
      if(!silent&&typeof window.toast==='function')window.toast('Using last saved club team list');
      if(Array.isArray(state?.selkent?.clubTeams)&&state.selkent.clubTeams.length)return state.selkent.clubTeams;
      throw err;
    }
  };

  window.syncSelkentDivision=async function(silent=false){
    return applyStaticDivision(silent,false);
  };

  window.refreshPublishedLeagueAges=async function(silent=true){
    state.selkent=state.selkent||{};
    if(!isSelkentProvider()&&original.refreshPublishedLeagueAges)return original.refreshPublishedLeagueAges(silent);
    try{
      const ages=await staticPublishedAges(false);
      if(!ages.length)throw new Error('Static feed contains no published standings ages');
      state.selkent.publishedLeagueAges=ages;
      state.selkent.competitionMode=ages.map(x=>String(x).toUpperCase()).includes(ageCode())?'league':'no-league';
      state.selkent.lastCompetitionCheck=new Date().toISOString();
      try{localStorage.setItem('grassrootsHub_published_league_ages_v1',JSON.stringify(ages));}catch(_){ }
      persistWithoutRender();
      return ages;
    }catch(err){
      if(Array.isArray(state.selkent.publishedLeagueAges)&&state.selkent.publishedLeagueAges.length)return state.selkent.publishedLeagueAges;
      throw err;
    }
  };

  window.syncSelkentLeagueTable=async function(silent=false){
    const btn=document.getElementById('sync-league-table');if(btn)btn.disabled=true;
    try{
      await window.refreshPublishedLeagueAges(true);
      if(typeof window.leagueTableEnabled==='function'&&!window.leagueTableEnabled()){
        state.selkent.table=[];state.selkent.results=[];persistWithoutRender();
        if(!silent&&typeof window.toast==='function')window.toast('Selkent does not publish a league table for this age group.');
        return false;
      }
      await applyStaticDivision(true,false);
      await applyStaticStandings(true,false);
      try{
        const live=await liveResultFallback();
        state.selkent.results=live.results;
        if(typeof window.syncOwnLeagueMatchesFromSelkent==='function')window.syncOwnLeagueMatchesFromSelkent(live.results);
      }catch(_){/* published-result fallback is allowed to fail independently of static standings */}
      state.selkent.lastSync=new Date().toISOString();
      state.selkent.status='Standings loaded from validated static Selkent feed';
      saveAndRender();
      if(!silent&&typeof window.toast==='function')window.toast('League standings synced');
      return true;
    }catch(err){
      state.selkent=state.selkent||{};
      state.selkent.status=`Static standings unavailable: ${err.message||err}`;
      persistWithoutRender();if(typeof window.renderSelkentSettings==='function')window.renderSelkentSettings();
      if(!silent&&typeof window.toast==='function')window.toast('League table sync failed');
      return false;
    }finally{if(btn)btn.disabled=false;}
  };

  window.syncSelkent=async function(silent=false){
    const dot=document.getElementById('selkent-sync-dot'),status=document.getElementById('selkent-sync-status');
    if(dot)dot.className='sync-dot busy';if(status)status.textContent='Syncing Selkent feeds…';
    if(!silent&&typeof window.toast==='function')window.toast('Syncing with Selkent…');
    try{
      await window.syncProviderClubTeams(true);
      await applyStaticDivision(true,false);
      await window.refreshPublishedLeagueAges(true);
      if(typeof window.leagueTableEnabled!=='function'||window.leagueTableEnabled())await applyStaticStandings(true,false);else{state.selkent.table=[];state.selkent.tableSource=TABLE_SOURCE;}

      try{
        await applyStaticFixtures(true,false);
      }catch(_){
        /* Migration-only safety fallback. A validated static fixture feed is authoritative. */
        try{const fixtureData=await liveFixtureFallback();state.selkent.fixtures=fixtureData.fixtures||[];state.selkent.fixtureSource='selkent-live-fallback';state.selkent.lastFixtureScan=new Date().toISOString();}catch(__){/* keep last-known-good fixtures */}
      }

      if(typeof window.leagueTableEnabled!=='function'||window.leagueTableEnabled()){
        try{const live=await liveResultFallback();state.selkent.results=live.results||[];if(typeof window.syncOwnLeagueMatchesFromSelkent==='function')window.syncOwnLeagueMatchesFromSelkent(state.selkent.results);}catch(_){/* keep last-known-good published results */}
      }else state.selkent.results=[];

      state.selkent.lastSync=new Date().toISOString();
      const bits=[];
      if(state.selkent.fixtures?.length)bits.push(`${state.selkent.fixtures.length} fixture${state.selkent.fixtures.length===1?'':'s'}`);
      if(state.selkent.table?.length)bits.push(`${state.selkent.table.length} standings teams`);
      if(state.selkent.results?.length)bits.push(`${state.selkent.results.length} results`);
      state.selkent.status=bits.length?`Synced: ${bits.join(' · ')}`:'Static Selkent directory connected; no live fixtures/results currently published.';
      saveAndRender();
      if(!silent&&typeof window.toast==='function')window.toast('Selkent sync complete');
      return true;
    }catch(err){
      state.selkent=state.selkent||{};
      state.selkent.status=`Sync failed: ${err.message||err}`;
      persistWithoutRender();if(typeof window.renderSelkentSettings==='function')window.renderSelkentSettings();
      if(!silent&&typeof window.toast==='function')window.toast('Selkent sync failed');
      return false;
    }
  };

  /* Defence in depth: if any legacy caller still reaches the old HTML parser,
     its live league-table output can never replace static standings. */
  if(original.parseSelkentHtml){
    window.parseSelkentHtml=function(html,url){
      const parsed=original.parseSelkentHtml(html,url)||{};
      parsed.table=(state?.selkent?.tableSource===TABLE_SOURCE&&Array.isArray(state.selkent.table))?state.selkent.table:[];
      return parsed;
    };
  }

  if(original.applySelkentTeamDiscovery){
    window.applySelkentTeamDiscovery=function(teams){
      if(state?.selkent?.directorySource===DIRECTORY_SOURCE)return;
      return original.applySelkentTeamDiscovery(teams);
    };
  }

  /* Static standings are source-ordered, not official positions. Never fall
     back to a locally calculated/tiebroken public table when static data is
     missing. */
  window.renderLeagueTable=function(){
    const enabled=typeof window.leagueTableEnabled==='function'?window.leagueTableEnabled():false;
    const panel=document.getElementById('league-table-panel'),matchPanel=document.getElementById('matches-league-table-panel');
    [panel,matchPanel].forEach(el=>{if(el)el.classList.toggle('hidden',!enabled);});
    if(!enabled)return;
    const remote=(state?.selkent?.tableSource===TABLE_SOURCE&&Array.isArray(state.selkent.table))?state.selkent.table:[];
    const self=norm(state?.division?.teamName||state?.meta?.teamName||'');
    const rows=remote.map(r=>`<tr class="${norm(r.team)===self?'our-team-row':''}"><td class="pos">${r.sourceOrder??'—'}</td><td class="team-cell">${typeof window.esc==='function'?window.esc(r.team):String(r.team||'')}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd>0?'+':''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`).join('');
    document.querySelectorAll('[data-league-table-body]').forEach(tb=>tb.innerHTML=rows||'<tr><td colspan="10" class="table-empty">Standings feed unavailable</td></tr>');
    document.querySelectorAll('[data-league-table-title]').forEach(el=>el.textContent=state?.division?.name||'League table');
    document.querySelectorAll('.league-table thead th:first-child').forEach(el=>el.textContent=remote.length?'Row':'#');
    document.querySelectorAll('[data-league-table-meta]').forEach(el=>el.textContent=remote.length?`Selkent source order · ${remote.length} teams · tied-team order is not an official position`:'Validated static standings have not been loaded for this division.');
  };

  async function primeStaticFeeds(){
    if(!isSelkentProvider())return;
    try{
      await window.syncProviderClubTeams(true);
      await applyStaticDivision(true,false);
      await window.refreshPublishedLeagueAges(true);
      await applyStaticFixtures(true,false);
      if(typeof window.leagueTableEnabled!=='function'||window.leagueTableEnabled())await applyStaticStandings(true,false);else{state.selkent.table=[];state.selkent.tableSource=TABLE_SOURCE;}
      persistWithoutRender();if(typeof window.renderAll==='function')window.renderAll();
    }catch(_){/* retain last-known-good app state; normal sync can retry */}
  }

  window.ClubHubStaticSelkent={
    DIRECTORY_URL:STATIC_DIRECTORY_URL,
    RESULTS_URL:STATIC_RESULTS_URL,
    loadDirectory,loadResults,applyStaticDivision,applyStaticFixtures,applyStaticStandings,prime:primeStaticFeeds
  };

  /* Start before the existing delayed automatic Selkent sync fires. */
  Promise.resolve().then(primeStaticFeeds);
})();
