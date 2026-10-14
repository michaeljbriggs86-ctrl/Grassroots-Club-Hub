// Real Deno entrypoint, mocked localhost PostgREST, no message recipients or external network.
const assert=require('node:assert/strict'),http=require('node:http'),net=require('node:net'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const webpush=require(process.env.KICKOFF_NODE_MODULES?process.env.KICKOFF_NODE_MODULES+'/web-push':'web-push');
(async()=>{
 const requests=[];const api=http.createServer((req,res)=>{requests.push(req.url);res.setHeader('Content-Type','application/json');res.end('[]');});await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const secret=crypto.randomBytes(32).toString('base64url'),keys=webpush.generateVAPIDKeys();
 const worker=spawn(process.argv[2],['run','--no-lock','--node-modules-dir=manual','--allow-env','--allow-net=127.0.0.1,0.0.0.0','--allow-read','supabase/functions/kickoff-dispatch/index.ts'],{env:{...process.env,PORT:String(port),KICKOFF_DISPATCH_TOKEN:secret,SUPABASE_URL:'http://127.0.0.1:'+api.address().port,SUPABASE_SERVICE_ROLE_KEY:'fictional-service-key',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:fictional@example.invalid',SMTP_HOST:'fictional.invalid',SMTP_PORT:'465',SMTP_USERNAME:'fictional',SMTP_PASSWORD:'fictional',SMTP_FROM:'fictional@example.invalid'},stdio:['ignore','pipe','pipe']});
 let errors='';worker.stderr.on('data',b=>errors+=b);const origin='http://127.0.0.1:'+port;let ready=false;
 try{
  for(let n=0;n<100&&!ready;n++){try{await fetch(origin);ready=true;}catch(_){await new Promise(r=>setTimeout(r,50));}}
  assert(ready,'dispatcher started: '+errors.replaceAll(secret,'[redacted]').replaceAll(keys.privateKey,'[redacted]'));
  let r=await fetch(origin,{method:'GET'});assert.equal(r.status,405);
  r=await fetch(origin,{method:'POST',headers:{Authorization:'Bearer fictional-user-jwt'}});assert.equal(r.status,401);assert.equal(requests.length,0,'user JWT cannot reach outbox');
  r=await fetch(origin,{method:'POST',headers:{Authorization:'Bearer '+secret}});assert.equal(r.status,200);assert.deepEqual(await r.json(),{claimed:0,sent:0,retrying:0,failed:0,cancelled:0,expired:0});assert.deepEqual(requests,['/rest/v1/rpc/claim_kickoff_deliveries']);
  console.log('PASS real Deno dispatcher: method/authentication boundary, service-only RPC and empty queue, zero external sends.');
 }finally{worker.kill('SIGTERM');await new Promise(r=>api.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
