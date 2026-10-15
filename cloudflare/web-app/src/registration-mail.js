// One-use service-issued ticket; no caller-supplied destination, content or URL.
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function registrationMail(request,env){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(Number(request.headers.get('content-length')||0)>512)return reply({error:'Invalid delivery ticket'},400);
 let ticket;try{const body=await request.text();if(body.length>512)throw Error();ticket=JSON.parse(body).ticket;}catch{return reply({error:'Invalid delivery ticket'},400);}
 if(!/^[0-9a-f]{64}$/.test(ticket||''))return reply({error:'Invalid delivery ticket'},400);
 if(!env.REGISTRATION_EMAIL?.send)return reply({error:'Invitation email is unavailable'},503);
 const rpc=async(action,id,data)=>{
  const r=await fetch(env.REGISTRATION_SUPABASE_URL+'/rest/v1/rpc/registration_delivery',{method:'POST',headers:{apikey:env.REGISTRATION_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_id:id,p_data:data}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Delivery unavailable');return r.json();
 };
 let job;try{job=await rpc('redeem',null,{ticket});}catch{return reply({error:'Delivery unavailable'},403);}
 if(!job?.ok||!/^[0-9a-f]{64}$/.test(job.token)||!/^[0-9a-f]{64}$/.test(job.ack)||typeof job.email!=='string'||/[\r\n]/.test(job.email))return reply({error:'Delivery unavailable'},503);
 const link='https://shootershillafc.app/register.html#invite='+job.token;
 // Same club identity, immutable supplied badge, and existing sender; no child details.
 const subject='Register your child with Shooters Hill AFC';
 const text=`Shooters Hill AFC\n\nThe club has invited you to complete a player registration. Open this secure link, create or sign into your account using this email address, and complete the form.\n\n${link}\n\nThis invitation expires in seven days. It does not grant team access. The club will review your application first. Payment and league registration are checked separately.\n\nIf you were not expecting this invitation, ignore it or contact secretary@shootershillfc.com.`;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#F3F6F4;color:#111715;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;max-width:600px;margin:24px auto;background:white;border-radius:18px"><tr><td style="padding:28px;background:#064526;color:white"><img src="https://shootershillafc.app/shooters-hill-logo.png" width="64" height="64" alt="Shooters Hill AFC club badge"><p style="font-size:12px;letter-spacing:1px">SHOOTERS HILL AFC</p><h1 style="font-size:28px">Register your child</h1></td></tr><tr><td style="padding:28px;line-height:1.6"><p>The club has invited you to complete a player registration.</p><p>Create or sign into your account using this email address, then complete your child’s form.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:14px 24px;background:#0B5D35;border-radius:12px;color:white;text-decoration:none;font-weight:bold">Start registration</a></p><p>This link expires in seven days. Team access follows the club’s review. Payment and league registration are checked separately.</p><p>If you were not expecting this invitation, you can ignore it.</p><p><a href="mailto:secretary@shootershillfc.com" style="color:#0B5D35">Contact the club secretary</a></p></td></tr></table></body></html>`;
 let status='sent',receipt='',error_code='';
 try{const result=await env.REGISTRATION_EMAIL.send({from:{email:'Hello@pitchkind.com',name:'Shooters Hill AFC'},to:job.email,replyTo:'secretary@shootershillfc.com',subject,text,html});receipt=String(result?.messageId||'');if(!receipt){status='uncertain';error_code='NO_RECEIPT';}}
 catch(error){error_code=/^E_[A-Z_]{1,60}$/.test(error?.code||'')?error.code:'DELIVERY_UNCERTAIN';status=error_code==='DELIVERY_UNCERTAIN'?'uncertain':'failed';}
 try{await rpc('ack',job.id,{ack:job.ack,status,receipt,error_code});}catch{return reply({ok:false,status:'uncertain'},503);}
 return reply({ok:status==='sent',status},status==='sent'?200:503);
}
