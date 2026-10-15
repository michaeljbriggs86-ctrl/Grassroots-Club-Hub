import webpush from 'npm:web-push@3.6.7';
import { dispatchBatch } from './delivery.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve({port:Number(env('PORT')||8000)},async request=>{
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const token=(request.headers.get('Authorization')||'').match(/^Bearer ([0-9a-f]{64})$/)?.[1];
 if(!token)return json({error:'Unauthorised'},401);
 async function rpc(name:string,body:unknown){
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!key||!env('SUPABASE_URL'))throw Error('Runtime unavailable');
  const response=await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Dispatcher database request failed');return response.status===204?null:response.json();
 }
 try{
  let config=await rpc('kickoff_dispatch_configuration',{p_token:token});
  if(!config)return json({error:'Unauthorised'},401);
  if(config.needs_key){
   await rpc('install_kickoff_signing',{p_token:token,p_credentials:{...webpush.generateVAPIDKeys(),subject:'mailto:secretary@shootershillfc.com'}});
   config=await rpc('kickoff_dispatch_configuration',{p_token:token});
  }
  webpush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
  return json(await dispatchBatch({rpc,origin:'https://shootershillafc.app',sendPush:(...args:Parameters<typeof webpush.sendNotification>)=>webpush.sendNotification(...args),sendEmail:async(row:{id:string,claim_token:string})=>{
   const response=await fetch('https://shootershillafc.app/__kickoff_mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,claim_token:row.claim_token}),signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   return {status:response.status===403?'cancelled':result.status};
  }}));
 }catch(_){return json({error:'Delivery run incomplete; queued updates will retry'},503);}
});
