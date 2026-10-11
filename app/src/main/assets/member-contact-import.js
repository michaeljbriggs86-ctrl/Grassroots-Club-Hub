/* CSV contact imports: local preview, admin-only atomic save, no persistence. */
(function(root){
  'use strict';
  const MAX_ROWS=500,MAX_BYTES=1024*1024;
  const norm=value=>String(value||'').trim().replace(/^'/,'').replace(/\s+/g,' ').toLowerCase();
  function parseCsv(text){
    if(typeof text!=='string'||text.length>MAX_BYTES)throw new Error('Use a CSV smaller than 1 MB.');
    text=text.replace(/^\uFEFF/,'');
    const rows=[];let row=[],cell='',quoted=false,closed=false;
    const pushCell=()=>{row.push(cell.trim());cell='';closed=false;};
    const pushRow=()=>{pushCell();if(row.some(Boolean))rows.push(row);row=[];if(rows.length>MAX_ROWS+1)throw new Error('Import up to 500 rows at a time.');};
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
      if(ch===','){pushCell();continue;}
      if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
      if(ch==='"'){if(cell||closed)throw new Error('Invalid CSV quotes. Export the sheet as CSV again.');quoted=true;continue;}
      if(closed){if(ch===' '||ch==='\t')continue;throw new Error('Invalid CSV after a quoted cell.');}
      cell+=ch;
    }
    if(quoted)throw new Error('Unclosed CSV quotes. Export the sheet as CSV again.');
    if(cell||row.length||closed)pushRow();
    if(rows.length<2)throw new Error('Add a header and at least one contact row.');
    const headers=rows.shift().map(h=>norm(h).replace(/ /g,'_'));
    const allowed=['user_id','full_name','team','role','email','phone'];
    if(new Set(headers).size!==headers.length||headers.some(h=>!allowed.includes(h)))throw new Error('Use only user_id, full_name, team, role, email and phone columns. Addresses are not imported.');
    if(!headers.includes('user_id')&&!headers.includes('full_name'))throw new Error('Include a user_id or full_name column.');
    if(!headers.includes('email')&&!headers.includes('phone'))throw new Error('Include an email or phone column.');
    return rows.map((cells,i)=>{
      if(cells.length!==headers.length)throw new Error(`Row ${i+2}: the number of cells does not match the header.`);
      return {row:i+2,...Object.fromEntries(headers.map((h,j)=>[h,cells[j]]))};
    });
  }
  function planImport(text,directory){
    const contacts=directory.contacts||[],self=directory.self;
    const accounts=new Map();
    for(const c of [...contacts,...(self?[{...self,role:'club_admin'}]:[])]){
      if(!c.user_id)continue;
      if(!accounts.has(c.user_id))accounts.set(c.user_id,{...c,teams:new Set(),roles:new Set()});
      const a=accounts.get(c.user_id);if(c.team_name)a.teams.add(norm(c.team_name));a.roles.add(norm(c.role));
    }
    const updates=[],errors=[],preview=[],seen=new Set();let skipped=0;
    for(const r of parseCsv(text)){
      const fail=message=>errors.push(`Row ${r.row}: ${message}`);
      const email=String(r.email||'').trim(),phone=String(r.phone||'').trim();
      if(!email&&!phone){skipped++;continue;}
      let candidates=[...accounts.values()].filter(a=>r.user_id?a.user_id.toLowerCase()===norm(r.user_id):norm(a.full_name)===norm(r.full_name));
      if(r.full_name)candidates=candidates.filter(a=>norm(a.full_name)===norm(r.full_name));
      if(r.team)candidates=candidates.filter(a=>a.teams.has(norm(r.team)));
      if(r.role)candidates=candidates.filter(a=>a.roles.has(norm(r.role).replace(/ /g,'_')));
      if(candidates.length!==1){fail(candidates.length?'Name matches more than one member. Use their user_id from the template.':'No matching approved club member. Check the name/team or use the template.');continue;}
      const a=candidates[0];
      if(seen.has(a.user_id)){fail('This member appears more than once. Use one row per person.');continue;}
      seen.add(a.user_id);
      if(email&&email!=='[CLEAR]'&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))){fail('Enter a valid email.');continue;}
      if(phone&&phone!=='[CLEAR]'&&(phone.length>40||!/^\+?[0-9() .-]+$/.test(phone)||phone.replace(/\D/g,'').length<6)){fail('Enter a valid phone number; keep leading zeroes by formatting the sheet column as text.');continue;}
      const update={user_id:a.user_id};
      if(email)update.email=email==='[CLEAR]'?'':email;
      if(phone)update.phone=phone==='[CLEAR]'?'':phone;
      updates.push(update);preview.push({full_name:a.full_name,email:update.email===undefined?'Keep existing':update.email||'Clear email',phone:update.phone===undefined?'Keep existing':update.phone||'Clear phone'});
    }
    return {updates,errors,preview,skipped};
  }
  function templateCsv(directory){
    const people=new Map();
    for(const c of [...(directory.contacts||[]),...(directory.self?[directory.self]:[])])if(!people.has(c.user_id))people.set(c.user_id,c);
    // Prefix spreadsheet formula characters in descriptive names; no contact values exported.
    const quote=v=>'"'+String(v||'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    return '\uFEFFuser_id,full_name,email,phone\r\n'+[...people.values()].map(c=>[c.user_id,c.full_name,'',''].map(quote).join(',')).join('\r\n')+'\r\n';
  }
  const api={parseCsv,planImport,templateCsv,MAX_ROWS,MAX_BYTES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  let options,epoch=0,plan=null,planKey='',busy=false,enabled=false;
  const el=id=>root.document.getElementById('contact-import-'+id);
  const allowed=()=>enabled&&options?.isAdmin()&&!!options.contextKey();
  const controls=()=>{for(const id of ['file','preview','template','cancel']){const n=el(id);if(n)n.disabled=!allowed()||busy;}const save=el('save');if(save)save.disabled=!allowed()||busy||!plan?.updates.length||!!plan.errors.length;};
  api.configure=value=>{options=value;};
  api.reset=()=>{epoch++;plan=null;planKey='';busy=false;enabled=false;const file=el('file');if(file)file.value='';for(const id of ['status','results']){const n=el(id);if(n){n.textContent='';n.innerHTML='';}}el('panel')?.classList.add('hidden');controls();};
  api.show=value=>{enabled=!!value;el('panel')?.classList.toggle('hidden',!allowed());controls();};
  const start=()=>{if(!allowed()||busy)return null;busy=true;controls();const version=epoch,key=options.contextKey(),cloud=options.cloud();return{cloud,key,valid:()=>version===epoch&&allowed()&&key===options.contextKey()&&cloud===options.cloud()};};
  api.preview=async()=>{
    const op=start();if(!op)return;
    plan=null;planKey='';el('results').innerHTML='';el('status').textContent='Checking spreadsheet…';
    try{
      const file=el('file').files?.[0];if(!file)throw new Error('Choose a CSV exported from your spreadsheet.');
      if(!/\.csv$/i.test(file.name))throw new Error('Save the Excel or Google Sheets file as CSV first.');
      if(file.size>MAX_BYTES)throw new Error('Use a CSV smaller than 1 MB.');
      const text=await file.text();if(!op.valid())return;
      const data=await op.cloud.listContactDirectory(null);if(!op.valid())return;
      if(data?.can_manage!==true||data.self?.user_id!==op.cloud.context?.profile?.user_id)throw new Error('Club Admin access required.');
      plan=planImport(text,data);planKey=op.key;
      const esc=options.escape;
      el('results').innerHTML=plan.errors.length?'<ul>'+plan.errors.map(e=>`<li>${esc(e)}</li>`).join('')+'</ul>':plan.preview.map(c=>`<article class="member-contact-card"><h4>${esc(c.full_name)}</h4><p>${esc(c.email)}</p><p>${esc(c.phone)}</p></article>`).join('');
      el('status').textContent=plan.errors.length?`${plan.errors.length} error(s). Nothing has been saved. Correct the spreadsheet and preview again.`:`${plan.updates.length} contact(s) ready to import; ${plan.skipped} blank row(s) skipped. Review the changes, then Import contacts.`;
    }catch(e){if(op.valid()){plan=null;el('status').textContent=e.message||'Could not preview the spreadsheet.';}}
    finally{if(op.valid()){busy=false;controls();}}
  };
  api.save=async()=>{
    if(!plan?.updates.length||plan.errors.length||planKey!==options?.contextKey())return;
    const op=start();if(!op)return;
    el('status').textContent='Importing contacts…';
    try{
      const result=await op.cloud.importMemberContactDetails(plan.updates);if(!op.valid())return;
      if(result?.ok!==true||result.imported!==plan.updates.length)throw new Error('Could not confirm the import. Refresh contacts before retrying.');
      const count=result.imported;api.reset();await options.onImported(count);
    }catch(e){if(op.valid()){el('status').textContent=e.message||'Could not import contacts.';}}
    finally{if(op.valid()){busy=false;controls();}}
  };
  api.downloadTemplate=async()=>{
    const op=start();if(!op)return;
    try{
      const data=await op.cloud.listContactDirectory(null);if(!op.valid())return;
      if(data?.can_manage!==true||data.self?.user_id!==op.cloud.context?.profile?.user_id)throw new Error('Club Admin access required.');
      const url=root.URL.createObjectURL(new root.Blob([templateCsv(data)],{type:'text/csv;charset=utf-8'}));
      const link=root.document.createElement('a');link.href=url;link.download='club-contact-template.csv';link.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);
      el('status').textContent='Template downloaded. Fill email and phone, keep phone cells as text, then save as CSV.';
    }catch(e){if(op.valid())el('status').textContent=e.message||'Could not download the template.';}
    finally{if(op.valid()){busy=false;controls();}}
  };
  el('file')?.addEventListener('change',()=>{epoch++;plan=null;planKey='';busy=false;el('results').innerHTML='';el('status').textContent='';controls();});
  el('preview')?.addEventListener('click',api.preview);
  el('save')?.addEventListener('click',api.save);
  el('template')?.addEventListener('click',api.downloadTemplate);
  el('cancel')?.addEventListener('click',()=>{api.reset();api.show(options?.isAdmin());});
  root.ClubHubContactImport=api;
})(typeof window!=='undefined'?window:globalThis);
