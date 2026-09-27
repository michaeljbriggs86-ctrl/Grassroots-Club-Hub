const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/cloud.js'),'utf8');
const start=source.indexOf('  function authHeaders(');
const end=source.indexOf('  async function signIn(',start);
assert.ok(start>=0&&end>start);
const auth=source.slice(start,end);

function harness(initial,fetch){
  let stored={...initial};
  return new Function('fetch','getStored','setStored',`
    const cfg={anonKey:'public-key'};
    const base=()=> 'https://example.supabase.co';
    let session=getStored(),sessionRefresh=null;
    const loadSession=()=>getStored();
    const saveSession=x=>{session=x;setStored(x);};
    ${auth}
    return {request,ensureFreshSession,getSession:()=>session};
  `)(fetch,()=>stored,x=>{stored=x;});
}
function response(status,data){return {status,ok:status>=200&&status<300,headers:{},text:async()=>JSON.stringify(data),json:async()=>data};}

async function main(){
  let refreshes=0,writes=0;
  let api=harness({access_token:'expired',refresh_token:'refresh-old',expires_at:1},async(url,options)=>{
    if(url.includes('/auth/v1/token')){refreshes++;return response(200,{access_token:'new',refresh_token:'refresh-new',expires_in:3600});}
    writes++;assert.equal(options.headers.Authorization,'Bearer new');return response(200,{saved:true});
  });
  const values=await Promise.all(Array.from({length:5},()=>api.request('/rest/v1/rpc/save_team_state',{method:'POST',body:{result:1}})));
  assert.equal(refreshes,1,'parallel saves share one rotating refresh token');
  assert.equal(writes,5);
  assert.ok(values.every(v=>v.data.saved));

  refreshes=0;writes=0;
  api=harness({access_token:'apparently-valid',refresh_token:'refresh-old',expires_at:Math.floor(Date.now()/1000)+1000},async(url,options)=>{
    if(url.includes('/auth/v1/token')){refreshes++;return response(200,{access_token:'new',refresh_token:'refresh-new',expires_in:3600});}
    writes++;
    return options.headers.Authorization==='Bearer new'?response(200,{saved:true}):response(401,{message:'JWT expired'});
  });
  assert.deepEqual((await api.request('/rest/v1/rpc/save_team_state',{method:'POST',body:{result:2}})).data,{saved:true});
  assert.equal(refreshes,1);assert.equal(writes,2,'retry a rejected expired JWT exactly once');

  refreshes=0;writes=0;
  api=harness({access_token:'valid',refresh_token:'refresh-old',expires_at:Math.floor(Date.now()/1000)+1000},async(url)=>{
    if(url.includes('/auth/v1/token'))refreshes++;
    writes++;return response(401,{message:'Permission denied'});
  });
  await assert.rejects(api.request('/rest/v1/rpc/save_team_state',{method:'POST'}),/Permission denied/);
  assert.equal(refreshes,0);assert.equal(writes,1,'do not retry unrelated authorization failures');

  api=harness({access_token:'expired',refresh_token:'refresh-old',expires_at:1},async()=>{throw Error('Offline');});
  await assert.rejects(api.request('/rest/v1/rpc/save_team_state',{method:'POST'}),/session has expired/);
  assert.equal(api.getSession().refresh_token,'refresh-old','retain refresh token after temporary network failure');
  process.stdout.write('Auth refresh and match save retries: OK\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
