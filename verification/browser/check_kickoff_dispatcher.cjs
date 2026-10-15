// Real Deno entrypoint, fake localhost PostgREST, zero external recipients.
const assert=require('node:assert/strict'),http=require('node:http'),net=require('node:net'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const webpush=require(process.env.KICKOFF_NODE_MODULES?process.env.KICKOFF_NODE_MODULES+'/web-push':'web-push');
(async()=>{
 const requests=[],secret=crypto.randomBytes(32).toString('hex'),keys=webpush.generateVAPIDKeys();let installed=null;
 const api=http.createServer(async(req,res)=>{
  let raw='';for await(const c of req)raw+=c;const data=JSON.parse(raw);requests.push({url:req.url,auth:req.headers.authorization});let result=[];
  if(req.url.endsWith('kickoff_dispatch_configuration'))result=data.p_token===secret?(installed||{needs_key:true}):null;
  if(req.url.endsWith('install_kickoff_signing')){assert.equal(data.p_token,secret);assert.equal(data.p_credentials.subject,'mailto:secretary@shootershillfc.com');assert.equal(data.p_credentials.publicKey.length,87);assert.equal(data.p_credentials.privateKey.length,43);installed=data.p_credentials;result=true;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 });await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const worker=spawn(process.argv[2],['run','--no-lock','--node-modules-dir=manual','--allow-env','--allow-net=127.0.0.1,0.0.0.0','--allow-read','supabase/functions/kickoff-dispatch/index.ts'],{env:{...process.env,PORT:String(port),SUPABASE_URL:'http://127.0.0.1:'+api.address().port,SUPABASE_SERVICE_ROLE_KEY:'fictional-service-key'},stdio:['ignore','pipe','pipe']});
 let errors='';worker.stderr.on('data',b=>errors+=b);const origin='http://127.0.0.1:'+port;let ready=false;
 try{
  for(let n=0;n<100&&!ready;n++){try{await fetch(origin);ready=true;}catch(_){await new Promise(r=>setTimeout(r,50));}}
  assert(ready,'dispatcher started: '+errors.replaceAll(secret,'[redacted]').replaceAll(keys.privateKey,'[redacted]'));
  assert.equal((await fetch(origin)).status,405);
  assert.equal((await fetch(origin,{method:'POST',headers:{Authorization:'Bearer fictional-user-jwt'}})).status,401);assert.equal(requests.length,0,'user JWT never reaches service RPC');
  assert.equal((await fetch(origin,{method:'POST',headers:{Authorization:secret}})).status,401,'Bearer scheme required');
  assert.equal((await fetch(origin,{method:'POST',headers:{Authorization:'Bearer '+('0'.repeat(64))}})).status,401);assert.equal(requests.length,1,'wrong well-formed token reaches only configuration guard');
  const response=await fetch(origin,{method:'POST',headers:{Authorization:'Bearer '+secret}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{claimed:0,sent:0,retrying:0,failed:0,cancelled:0,expired:0});
  assert.deepEqual(requests.map(r=>r.url),['/rest/v1/rpc/kickoff_dispatch_configuration','/rest/v1/rpc/kickoff_dispatch_configuration','/rest/v1/rpc/install_kickoff_signing','/rest/v1/rpc/kickoff_dispatch_configuration','/rest/v1/rpc/claim_kickoff_deliveries']);assert(requests.every(r=>r.auth==='Bearer fictional-service-key'));
  console.log('PASS real Deno dispatcher: bearer boundary, Vault token guard, in-runtime key bootstrap, service-only RPC and empty queue, zero external sends.');
 }finally{worker.kill('SIGTERM');await new Promise(r=>api.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
