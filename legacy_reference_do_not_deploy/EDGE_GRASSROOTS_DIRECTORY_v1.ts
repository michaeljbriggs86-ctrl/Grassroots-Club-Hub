// AI COLLABORATION PROTOCOL NOTE — 2026-09-19
// STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
// Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
const db=()=>createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const FT='https://fulltime.thefa.com';
const SEARCH=FT+'/home/search.html';
const UA={'User-Agent':'Mozilla/5.0 (compatible; GrassrootsClubHub-Directory/1.0)','Accept':'text/html,application/xhtml+xml'};

function decode(s:string){return String(s||'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&#x27;/gi,"'").replace(/&quot;/gi,'"').replace(/&ndash;/gi,'–').replace(/&mdash;/gi,'—');}
function clean(s:string){return decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function norm(s:unknown){return String(s??'').toLowerCase().normalize('NFKD').replace(/&/g,' and ').replace(/\bfootball club\b|\bfc\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function abs(url:string,base:string){try{return new URL(url,base).toString();}catch{return url;}}
async function html(url:string,opts:RequestInit={}){const r=await fetch(url,{...opts,headers:{...UA,...(opts.headers||{})},redirect:'follow'});const text=await r.text();if(!r.ok)throw new Error(`FA source returned HTTP ${r.status}`);return{html:text,url:r.url};}
function attr(tag:string,name:string){return (tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`,'i'))||[])[1]||'';}
function formSpecs(page:string,baseUrl:string){const forms:any[]=[];for(const m of page.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)){const open='<form '+m[1]+'>',body=m[2],fields:any[]=[];for(const x of body.matchAll(/<input\b[^>]*>/gi)){const tag=x[0],name=attr(tag,'name'),type=(attr(tag,'type')||'text').toLowerCase(),value=decode(attr(tag,'value'));if(name)fields.push({name,type,value,label:clean(tag)});}for(const x of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)){const tag='<button '+x[1]+'>',name=attr(tag,'name'),value=decode(attr(tag,'value')||clean(x[2]));fields.push({name,type:'submit',value,label:clean(x[2])});}forms.push({action:abs(attr(open,'action')||baseUrl,baseUrl),method:(attr(open,'method')||'get').toLowerCase(),text:clean(body),fields});}return forms;}
function clubLinks(page:string,baseUrl:string){const out:any[]=[];const seen=new Set<string>();for(const m of page.matchAll(/<a\b[^>]*href=["']([^"']*\/home\/club\/(\d+)\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){const id=m[2],name=clean(m[3]);if(!name||seen.has(id))continue;seen.add(id);out.push({id,name,url:abs(m[1],baseUrl)});}return out;}
async function remoteClubSearch(query:string){
  const base=await html(SEARCH);const forms=formSpecs(base.html,base.url);const candidates=forms.filter(f=>/search clubs?/i.test(f.text)).concat(forms.filter(f=>!/search clubs?/i.test(f.text)));
  for(const f of candidates){const inputs=f.fields.filter((x:any)=>['text','search',''].includes(x.type));if(!inputs.length)continue;const submits=f.fields.filter((x:any)=>x.type==='submit');const click=submits.find((x:any)=>/club/i.test(x.label+' '+x.value))||submits[0];for(const ti of inputs){const p=new URLSearchParams();for(const x of f.fields)if(x.type==='hidden'&&x.name)p.set(x.name,x.value||'');p.set(ti.name,query);if(click?.name)p.set(click.name,click.value||'Search Clubs');try{const r=f.method==='post'?await html(f.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()}):await html(f.action+(f.action.includes('?')?'&':'?')+p.toString());const rows=clubLinks(r.html,r.url);if(rows.length)return rows;}catch{}}
  }
  for(const [field,button] of [['partLeagueOrClubNameSearchFilter','searchClubs'],['partLeagueOrClubNameSearchFilter','clubSearch'],['partClubNameSearchFilter','']]){try{const p=new URLSearchParams();p.set(field,query);if(button)p.set(button,'Search Clubs');const r=await html(SEARCH+'?'+p.toString());const rows=clubLinks(r.html,r.url);if(rows.length)return rows;}catch{}}
  return [];
}
function ageFrom(s:string){const m=s.match(/\bU\s*([5-9]|1[0-9]|2[01])\b/i)||s.match(/\bUnder\s*([5-9]|1[0-9]|2[01])\b/i);return m?Number(m[1]):null;}
function shortTeam(club:string,external:string,age:number|null){let s=external.trim();const ck=norm(club),parts=s.split(/\s+/);if(ck&&norm(s).startsWith(ck)){const clubWords=club.trim().split(/\s+/).length;s=parts.slice(clubWords).join(' ').trim();}if(age)s=s.replace(new RegExp(`^(?:U\\s*${age}|Under\\s*${age})\\s*`,'i'),'').trim();return s||external.trim();}
function teamIdFromUrl(url:string){try{const u=new URL(url);return u.searchParams.get('teamID')||u.searchParams.get('teamId')||u.searchParams.get('team')||'';}catch{return'';}}
function leagueIdFromUrl(url:string){try{const u=new URL(url);return u.searchParams.get('league')||'';}catch{return'';}}
function parseClubTeams(page:string,clubName:string,baseUrl:string){const map=new Map<string,any>();for(const m of page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const label=clean(m[2]);if(!/League Name\s*:/i.test(label))continue;const href=abs(m[1],baseUrl),bits=label.split(/League Name\s*:/i),external=(bits[0]||'').trim(),league=(bits.slice(1).join('League Name:')||'').trim();if(!external)continue;const tid=teamIdFromUrl(href);const key=tid||norm(external);let row=map.get(key);if(!row){const age=ageFrom(external);row={provider_team_id:tid,external_name:external,name:shortTeam(clubName,external,age),age_group:age,source_url:href,leagues:[]};map.set(key,row);}if(league&&!row.leagues.some((x:any)=>norm(x.name)===norm(league)))row.leagues.push({name:league,provider_league_id:leagueIdFromUrl(href)});}
  return [...map.values()].sort((a,b)=>(a.age_group??99)-(b.age_group??99)||a.name.localeCompare(b.name));
}
async function remoteClub(id:string,url=''){const target=url||`${FT}/home/club/${encodeURIComponent(id)}.html`;const r=await html(target);const heading=(r.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)||r.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i));const name=clean(heading?.[1]||'').replace(/^['“”]|['“”]$/g,'').trim();if(!name)throw new Error('Could not read the club name from FA Full-Time');const clubId=id||((r.url.match(/\/club\/(\d+)\.html/)||[])[1]||'');return{id:clubId,name,url:r.url,teams:parseClubTeams(r.html,name,r.url)};}

const countyAliases:[string,string[]][]=[
 ['Amateur Football Alliance',['amateur football alliance']],['Bedfordshire FA',['bedfordshire']],['Berks & Bucks FA',['berks bucks','berkshire','buckinghamshire']],['Birmingham FA',['birmingham']],['Cambridgeshire FA',['cambridgeshire','cambridge']],['Cheshire FA',['cheshire']],['Cornwall FA',['cornwall']],['Cumberland FA',['cumberland']],['Derbyshire FA',['derbyshire']],['Devon FA',['devon']],['Dorset FA',['dorset']],['Durham FA',['durham']],['East Riding FA',['east riding']],['Essex FA',['essex']],['Gloucestershire FA',['gloucestershire']],['Hampshire FA',['hampshire']],['Herefordshire FA',['herefordshire']],['Hertfordshire FA',['hertfordshire','herts']],['Huntingdonshire FA',['huntingdonshire']],['Kent FA',['kent']],['Lancashire FA',['lancashire']],['Leicestershire & Rutland FA',['leicestershire','rutland']],['Lincolnshire FA',['lincolnshire']],['Liverpool FA',['liverpool county fa']],['London FA',['london fa','london county']],['Manchester FA',['manchester fa','greater manchester']],['Middlesex FA',['middlesex']],['Norfolk FA',['norfolk']],['Northamptonshire FA',['northamptonshire']],['North Riding FA',['north riding']],['Northumberland FA',['northumberland']],['Nottinghamshire FA',['nottinghamshire']],['Oxfordshire FA',['oxfordshire']],['Sheffield & Hallamshire FA',['sheffield hallamshire']],['Shropshire FA',['shropshire']],['Somerset FA',['somerset']],['Staffordshire FA',['staffordshire']],['Suffolk FA',['suffolk']],['Surrey FA',['surrey']],['Sussex FA',['sussex']],['Westmorland FA',['westmorland']],['West Riding FA',['west riding']],['Wiltshire FA',['wiltshire']],['Worcestershire FA',['worcestershire']]
];
function inferCounty(teams:any[]){const hay=norm(teams.flatMap(t=>t.leagues.map((l:any)=>l.name)).join(' '));let best='';let bestLen=0;for(const [name,aliases] of countyAliases){for(const a of aliases){const n=norm(a);if(n.length>bestLen&&hay.includes(n)){best=name;bestLen=n.length;}}}return best;}
async function countyId(client:any,name:string){if(!name)return null;const {data}=await client.from('directory_county_fas').select('id').eq('name',name).maybeSingle();return data?.id||null;}
async function ensureLeague(client:any,league:any,county_fa_id:string|null){const lname=String(league?.name||'').trim();if(!lname)return null;const normalized=norm(lname);const pid=String(league?.provider_league_id||'');let q=client.from('directory_leagues').select('id').eq('provider_key','fulltime');q=pid?q.eq('provider_league_id',pid):q.eq('normalized_name',normalized);const {data:existing}=await q.maybeSingle();const payload={canonical_name:lname,normalized_name:normalized,provider_key:'fulltime',provider_league_id:pid||null,county_fa_id,website:null,source_url:null,active:true,metadata:{source:'fa_fulltime'},last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(existing?.id){await client.from('directory_leagues').update(payload).eq('id',existing.id);return existing.id;}const {data,error}=await client.from('directory_leagues').insert(payload).select('id').single();if(error)throw error;return data.id;}
async function cacheRemoteClub(client:any,remote:any){
  const countyName=inferCounty(remote.teams),cfid=await countyId(client,countyName);const normalized=norm(remote.name),now=new Date().toISOString();
  const {data:existing}=await client.from('directory_clubs').select('id').eq('provider_key','fulltime').eq('provider_club_id',remote.id).maybeSingle();
  const cp={canonical_name:remote.name,normalized_name:normalized,provider_key:'fulltime',provider_club_id:remote.id,county_fa_id:cfid,source_url:remote.url,active:true,metadata:{source:'fa_fulltime',county_inferred:!!countyName},last_seen_at:now,updated_at:now};
  let clubId:string;if(existing?.id){clubId=existing.id;await client.from('directory_clubs').update(cp).eq('id',clubId);}else{const {data,error}=await client.from('directory_clubs').insert(cp).select('id').single();if(error)throw error;clubId=data.id;}
  await client.from('directory_aliases').upsert({entity_type:'club',entity_id:clubId,alias:remote.name,normalized_alias:normalized,source:'fa_fulltime'},{onConflict:'entity_type,entity_id,normalized_alias'});
  for(const t of remote.teams){const primary=(t.leagues||[]).find((l:any)=>!/county cups?/i.test(l.name))||(t.leagues||[])[0]||null;const leagueId=await ensureLeague(client,primary,cfid);const tnorm=norm(t.name||t.external_name),tid=String(t.provider_team_id||'');let q=client.from('directory_teams').select('id').eq('provider_key','fulltime');q=tid?q.eq('provider_team_id',tid):q.eq('club_id',clubId).eq('normalized_name',tnorm);const {data:te}=await q.maybeSingle();const tp={club_id:clubId,league_id:leagueId,canonical_name:t.name||t.external_name,normalized_name:tnorm,provider_key:'fulltime',provider_team_id:tid||null,age_group:t.age_group||null,age_label:t.age_group?`U${t.age_group}`:null,division:null,season:null,source_url:t.source_url||remote.url,active:true,metadata:{external_name:t.external_name,leagues:t.leagues||[]},last_seen_at:now,updated_at:now};let teamId:string;if(te?.id){teamId=te.id;await client.from('directory_teams').update(tp).eq('id',teamId);}else{const {data,error}=await client.from('directory_teams').insert(tp).select('id').single();if(error)throw error;teamId=data.id;}const aliases=[t.name,t.external_name].filter(Boolean);for(const alias of aliases)await client.from('directory_aliases').upsert({entity_type:'team',entity_id:teamId,alias,normalized_alias:norm(alias),source:'fa_fulltime'},{onConflict:'entity_type,entity_id,normalized_alias'});
  }
  return clubId;
}
async function dbSearch(client:any,q:string,county:string|null,limit=30){const {data,error}=await client.rpc('search_directory_clubs',{p_query:q,p_county_fa:county||null,p_limit:limit});if(error)throw error;return data||[];}
async function clubRecord(client:any,id:string){const {data,error}=await client.rpc('get_directory_club',{p_club_id:id});if(error)throw error;return data;}
async function searchAndCache(client:any,q:string,county:string|null){let rows=await dbSearch(client,q,county,30);const exactish=rows.some((r:any)=>Number(r.rank||0)>.9&&Number(r.team_count||0)>0);if(exactish||q.length<3)return{rows,remote_checked:false};let links:any[]=[];try{links=await remoteClubSearch(q);}catch{return{rows,remote_checked:true};}for(const link of links.slice(0,12)){try{const remote=await remoteClub(link.id,link.url);await cacheRemoteClub(client,remote);}catch{}}
  rows=await dbSearch(client,q,county,30);return{rows,remote_checked:true};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);if(!SUPABASE_URL||!SERVICE)return reply({error:'Directory service is not configured'},500);
  let body:any={};try{body=await req.json();}catch{return reply({error:'Invalid request'},400);}const action=String(body?.action||'search');const client=db();
  try{
    if(action==='search'){
      const q=String(body?.query||'').trim(),county=String(body?.county_fa||'').trim()||null;if(q.length<2)return reply({error:'Type at least 2 letters of the club name'},400);
      const result=await searchAndCache(client,q,county);return reply({clubs:result.rows,remote_checked:result.remote_checked,source:'master_directory'});
    }
    if(action==='club'){
      const id=String(body?.club_id||'').trim();if(!id)return reply({error:'Choose a club'},400);let record=await clubRecord(client,id);let teamCount=Array.isArray(record?.teams)?record.teams.length:0;
      const club=record?.club||{};if((!teamCount||body?.refresh===true)&&club.provider_key==='fulltime'&&club.provider_club_id){try{const remote=await remoteClub(String(club.provider_club_id),String(club.source_url||''));await cacheRemoteClub(client,remote);record=await clubRecord(client,id);teamCount=Array.isArray(record?.teams)?record.teams.length:0;}catch{}}
      return reply({...record,team_count:teamCount,source:'master_directory'});
    }
    if(action==='stats'){
      const [c,l,t,f]=await Promise.all([client.from('directory_clubs').select('*',{count:'exact',head:true}),client.from('directory_leagues').select('*',{count:'exact',head:true}),client.from('directory_teams').select('*',{count:'exact',head:true}),client.from('directory_county_fas').select('*',{count:'exact',head:true})]);
      return reply({counties:f.count||0,leagues:l.count||0,clubs:c.count||0,teams:t.count||0});
    }
    return reply({error:'Unsupported action'},400);
  }catch(e){return reply({error:e instanceof Error?e.message:String(e)},502);}
});
