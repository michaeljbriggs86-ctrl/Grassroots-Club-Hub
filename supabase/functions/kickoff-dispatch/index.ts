import webpush from 'npm:web-push@3.6.7';
import nodemailer from 'npm:nodemailer@10.1.1';
import { dispatchBatch } from './delivery.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function equalSecret(a:string,b:string){
 const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [x,y]=await Promise.all([hash(a),hash(b)]);return x.reduce((v,n,i)=>v|(n^y[i]),0)===0;
}
Deno.serve({port:Number(env('PORT')||8000)},async request=>{
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=env('KICKOFF_DISPATCH_TOKEN');
 if(!secret||secret.length<32)return json({error:'Dispatcher not configured'},503);
 if(!await equalSecret(request.headers.get('Authorization')||'',`Bearer ${secret}`))return json({error:'Unauthorised'},401);
 // Only trusted server configuration selects transports or origins. No client payload is used.
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','SMTP_HOST','SMTP_PORT','SMTP_USERNAME','SMTP_PASSWORD','SMTP_FROM'];
 if(names.some(name=>!env(name)))return json({error:'Delivery configuration incomplete'},503);
 const port=Number(env('SMTP_PORT'));if(port!==465)return json({error:'SMTP configuration invalid'},503);
 const smtp=nodemailer.createTransport({host:env('SMTP_HOST'),port,secure:true,requireTLS:true,auth:{user:env('SMTP_USERNAME'),pass:env('SMTP_PASSWORD')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
 webpush.setVapidDetails(env('VAPID_SUBJECT'),env('VAPID_PUBLIC_KEY'),env('VAPID_PRIVATE_KEY'));
 async function rpc(name:string,body:unknown){
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const response=await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Dispatcher database request failed');return response.status===204?null:response.json();
 }
 try{return json(await dispatchBatch({rpc,origin:'https://shootershillafc.app',sendPush:(...args:Parameters<typeof webpush.sendNotification>)=>webpush.sendNotification(...args),sendEmail:(message:object)=>smtp.sendMail({from:env('SMTP_FROM'),...message})}));}
 catch(_){return json({error:'Delivery run incomplete; queued updates will retry'},503);}
 finally{smtp.close();}
});
