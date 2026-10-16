const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emailMessage(row,origin='https://shootershillafc.app'){
 const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password)throw Error('Invalid app origin');
 const link=new URL('/',base);link.searchParams.set('kickoff_update',row.update_id);
 const title=String(row.title||'Kick-off details updated').replace(/[\r\n]/g,' ').slice(0,160);
 const body=String(row.body||'');
 return {subject:`Shooters Hill AFC: ${title}`,text:`Shooters Hill AFC\n\n${title}\n\n${body}\n\nReview and respond: ${link.href}\n\nSign in to confirm you have seen these details or respond with your child’s availability. Opening this email does not acknowledge the update.`,
 html:`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#F3F6F4;font-family:Inter,Arial,sans-serif;color:#111715"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#FFFFFF;border:1px solid #D8E0DA;border-radius:20px"><tr><td style="padding:24px"><img src="${escape(new URL('/shooters-hill-logo.png',base).href)}" width="56" height="56" alt="Shooters Hill AFC"><h1 style="font-size:20px;line-height:1.4">Shooters Hill AFC</h1><h2 style="font-size:24px;line-height:1.3">${escape(title)}</h2><p style="font-size:16px;line-height:1.5">${escape(body).replace(/\n/g,'<br>')}</p><p style="padding:12px 0"><a href="${escape(link.href)}" style="display:block;padding:16px;background:#064526;color:#FFFFFF;text-align:center;border-radius:12px;text-decoration:none;font-size:16px;font-weight:bold">Review and respond</a></p><p style="font-size:14px;line-height:1.5;color:#4F5F55">Sign in to confirm you have seen these details or respond with your child’s availability. Opening this email does not acknowledge the update.</p></td></tr></table></td></tr></table></body></html>`};
}
export function validPushEndpoint(endpoint){
 try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].concat(/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname)?[u.hostname]:[]).includes(u.hostname)&&endpoint.length<=2048;}catch(_){return false;}
}
export function failureOutcome(error,channel){
 const status=Number(error?.statusCode||error?.responseCode||0);
 if(channel==='push'&&(status===404||status===410))return 'expired';
 if(!status||channel==='push'&&(status===429||status>=500&&status<600)||channel==='email'&&status>=400&&status<500)return 'retrying';
 return 'failed';
}
export async function dispatchBatch({rpc,sendPush,sendEmail,origin}){
 const rows=await rpc('claim_kickoff_deliveries',{p_limit:5}),counts={claimed:rows.length,sent:0,retrying:0,failed:0,cancelled:0,expired:0};
 for(const row of rows){
  let outcome='cancelled';
  if(await rpc('validate_kickoff_delivery',{p_id:row.id,p_claim_token:row.claim_token})){
   try{
    if(row.channel==='push'){
     if(!validPushEndpoint(row.subscription?.endpoint))throw {statusCode:400};
     await sendPush(row.subscription,JSON.stringify({update_id:row.update_id}),{TTL:3600,timeout:10000});
    }else{
     if(!row.email||/[\r\n]/.test(row.email))throw {responseCode:550};
     const result=await sendEmail(row);
     if(result?.status==='cancelled'){outcome='cancelled';await rpc('finish_kickoff_delivery',{p_id:row.id,p_claim_token:row.claim_token,p_outcome:outcome});counts.cancelled++;continue;}
     if(result?.status!=='sent')throw {responseCode:result?.status==='failed'?550:450};
    }
    outcome='sent';
   }catch(error){outcome=failureOutcome(error,row.channel);}
  }
  await rpc('finish_kickoff_delivery',{p_id:row.id,p_claim_token:row.claim_token,p_outcome:outcome});counts[outcome]++;
 }
 return counts;
}
