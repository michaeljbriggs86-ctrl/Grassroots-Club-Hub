-- Reviewed in Figma 222:5414 and 348:6674. No real applications or pack content seeded.
create table private.registration_packs (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 season text not null, version text not null, documents jsonb not null,
 enabled boolean not null default false, created_at timestamptz not null default now(),
 unique(club_id,season,version), check(jsonb_typeof(documents)='object')
);
create table private.registration_pack_teams (
 pack_id uuid references private.registration_packs(id) on delete cascade, team_id uuid references public.teams(id) on delete cascade,
 primary key(pack_id,team_id)
);
create table private.registration_applications (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade, pack_id uuid not null references private.registration_packs(id) on delete cascade,
 email text not null, applicant_id uuid references public.profiles(user_id) on delete cascade, creator_id uuid references public.profiles(user_id) on delete set null,
 request_key uuid not null, token_hash text, expires_at timestamptz not null default now()+interval '7 days',
 status text not null default 'invited' check(status in ('invited','draft','submitted','corrections','approved','declined','cancelled')),
 answers jsonb not null default '{}', revision bigint not null default 0,
 feedback text not null default '', player_name text, parent_request_id uuid references public.parent_access_requests(id) on delete set null, reviewed_by uuid references public.profiles(user_id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(creator_id,request_key), check(jsonb_typeof(answers)='object')
);
create unique index registration_unclaimed_email_team on private.registration_applications(team_id,email) where status='invited';
create index registration_own on private.registration_applications(applicant_id,updated_at);
create index registration_club on private.registration_applications(club_id,updated_at);
create table private.registration_submissions (
 application_id uuid references private.registration_applications(id) on delete cascade, revision bigint,
 answers jsonb not null, applicant_id uuid not null references public.profiles(user_id) on delete cascade,
 email text not null, pack_id uuid not null references private.registration_packs(id) on delete cascade,
 document_hashes jsonb not null, submitted_at timestamptz not null default clock_timestamp(),
 primary key(application_id,revision)
);
create table private.registration_document_reads (
 application_id uuid references private.registration_applications(id) on delete cascade, user_id uuid references public.profiles(user_id) on delete cascade,
 kind text, sha256 text not null, read_at timestamptz not null default clock_timestamp(),
 primary key(application_id,user_id,kind,sha256)
);
create table private.registration_delivery_jobs (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references private.registration_applications(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','uncertain','cancelled')),
 ticket_hash text, ack_hash text, leased_at timestamptz, redeemed_at timestamptz,
 receipt text, error_code text, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index registration_one_delivery on private.registration_delivery_jobs(application_id) where status in ('queued','sending');
alter table private.registration_packs enable row level security;
alter table private.registration_pack_teams enable row level security;
alter table private.registration_applications enable row level security;
alter table private.registration_submissions enable row level security;
alter table private.registration_document_reads enable row level security;
alter table private.registration_delivery_jobs enable row level security;
revoke all on private.registration_packs,private.registration_pack_teams,private.registration_applications,
 private.registration_submissions,private.registration_document_reads,private.registration_delivery_jobs from public,anon,authenticated;

create function private.registration_hash(p_text text) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(p_text,'UTF8')),'hex')
$$;
create function private.registration_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='registration_packs' and tg_op='UPDATE' and
 (to_jsonb(new)-'enabled')=(to_jsonb(old)-'enabled') then return new; end if;
 raise exception 'Registration evidence is immutable; create a new version';
end $$;
-- Private records have no browser DML grants. Privileged account/club erasure may cascade; updates cannot rewrite submitted evidence.
create trigger registration_pack_immutable before update on private.registration_packs for each row execute function private.registration_immutable();
create trigger registration_submission_immutable before update on private.registration_submissions for each row execute function private.registration_immutable();

create function private.registration_validate(p jsonb,p_complete boolean default false) returns jsonb
language plpgsql set search_path='' as $$
declare k text; v jsonb; s text; d date; limits jsonb:='{"first_name":40,"surname":40,"dob":10,"gender":40,"address":300,"postcode":12,"school_year":60,"medical":3,"medical_details":2000,"parent_first":40,"parent_surname":40,"mobile":30,"relationship":80,"parent_dob":10,"signature":100,"pack_version":150}';
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16000 then raise exception 'Registration form is invalid'; end if;
 for k,v in select * from jsonb_each(p) loop
  if k in ('membership','fees','weather','conduct','photos') then
   if jsonb_typeof(v) not in ('boolean','null') then raise exception 'Choose an explicit agreement or consent response'; end if;
  elsif limits ? k then
   if jsonb_typeof(v) not in ('string','null') or length(coalesce(p->>k,''))>(limits->>k)::int then raise exception 'Invalid or overlong registration field: %',k; end if;
   if coalesce(p->>k,'') ~ '[[:cntrl:]]' and k not in ('address','medical_details') then raise exception 'Invalid characters in registration field: %',k; end if;
  else raise exception 'Unknown registration field: %',k;
  end if;
 end loop;
 if p->>'medical'='no' then p:=p-'medical_details'; end if;
 if not p_complete then return p; end if;
 foreach k in array array['first_name','surname','dob','gender','address','postcode','school_year','medical','parent_first','parent_surname','mobile','relationship','parent_dob','signature','pack_version'] loop
  if length(btrim(coalesce(p->>k,'')))=0 then raise exception 'Complete the required field: %',k; end if;
 end loop;
 if length(btrim(p->>'first_name')||' '||btrim(p->>'surname'))>80 then raise exception 'Player name must be at most 80 characters'; end if;
 foreach k in array array['dob','parent_dob'] loop
  s:=p->>k;
  if s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Enter a valid date: %',k; end if;
  begin d:=s::date; exception when others then raise exception 'Enter a valid date: %',k; end;
  if d>=current_date or d<date '1900-01-01' then raise exception 'Enter a valid date: %',k; end if;
 end loop;
 if p->>'medical' not in ('yes','no') or (p->>'medical'='yes' and length(btrim(coalesce(p->>'medical_details','')))<2) then raise exception 'Complete the medical response and any required details'; end if;
 if replace(p->>'mobile',' ','') !~ '^(\+[1-9][0-9]{6,14}|0[0-9]{9,10})$' then raise exception 'Enter a valid mobile number'; end if;
 foreach k in array array['membership','fees','weather','conduct'] loop
  if p->k is distinct from 'true'::jsonb then raise exception 'Read and explicitly accept the required declaration: %',k; end if;
 end loop;
 if jsonb_typeof(p->'photos') is distinct from 'boolean' then raise exception 'Choose Yes or No for photography'; end if;
 return p;
end $$;

create function private.registration_api(p_action text,p_id uuid,p_revision bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.profiles; a private.registration_applications; pack private.registration_packs; tm public.teams;
 is_admin boolean; em text; result jsonb; data jsonb; jid uuid; req uuid; nm text; child text; st jsonb; decision text; k text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into me from public.profiles where user_id=auth.uid() for update;
 if me.user_id is null or me.role not in ('pending','pending_parent','parent','club_admin','coach','assistant_coach') then raise exception 'Registration is not available for this account'; end if;
 select lower(email) into em from auth.users where id=me.user_id and email_confirmed_at is not null and coalesce(is_anonymous,false)=false and (banned_until is null or banned_until<now());
 if em is null then raise exception 'Confirm the invited email before continuing'; end if;
 is_admin:=me.role='club_admin' and private.effective_role(me)='club_admin';
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'team',t.selkent_label,'season',pk.season,'email',x.email,
   'status',case when x.status='invited' and x.expires_at<now() then 'expired' else x.status end,
   'revision',x.revision,'updated_at',x.updated_at,'player_name',x.player_name,
   'delivery',coalesce((select case when j.status='sending' and j.updated_at<now()-interval '5 minutes' then 'uncertain' else j.status end from private.registration_delivery_jobs j where j.application_id=x.id order by j.created_at desc,j.id desc limit 1),'queued')) order by x.updated_at desc),'[]'::jsonb) into result
  from private.registration_applications x join public.teams t on t.id=x.team_id join private.registration_packs pk on pk.id=x.pack_id
  where (x.applicant_id=me.user_id or (is_admin and x.club_id=me.club_id));
  return jsonb_build_object('ok',true,'admin',is_admin,'applications',result);
 end if;
 if p_action='teams' then
  if not is_admin then raise exception 'Club Admin access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',t.selkent_label,'season',t.season) order by t.age_group,t.name),'[]'::jsonb) into result
  from public.teams t where t.club_id=me.club_id and t.active and exists(select 1 from private.registration_pack_teams pt join private.registration_packs pk on pk.id=pt.pack_id where pt.team_id=t.id and pk.club_id=t.club_id and pk.season=t.season and pk.enabled);
  return jsonb_build_object('ok',true,'teams',result);
 end if;
 if p_action='invite' then
  if not is_admin then raise exception 'Club Admin access required'; end if;
  if (p_data->>'request_key') !~ '^[0-9a-f-]{36}$' then raise exception 'Invitation retry key required'; end if;
  select * into a from private.registration_applications where creator_id=me.user_id and request_key=(p_data->>'request_key')::uuid;
  if a.id is not null then return jsonb_build_object('ok',true,'id',a.id,'queued',true); end if;
  em:=lower(btrim(p_data->>'email'));
  if em is null or em !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' or length(em)>254 then raise exception 'Enter a valid parent email'; end if;
  select * into tm from public.teams where id=(p_data->>'team_id')::uuid and club_id=me.club_id and active for share;
  if tm.id is null then raise exception 'Team not available'; end if;
  select pk.* into pack from private.registration_packs pk join private.registration_pack_teams pt on pt.pack_id=pk.id where pt.team_id=tm.id and pk.club_id=tm.club_id and pk.season=tm.season and pk.enabled order by pk.created_at desc limit 1;
  if pack.id is null then raise exception 'Current registration pack is unavailable for this team'; end if;
  select * into a from private.registration_applications where team_id=tm.id and email=em and status='invited';
  if a.id is not null then return jsonb_build_object('ok',true,'id',a.id,'queued',false); end if;
  if (select count(*) from private.registration_applications where creator_id=me.user_id and created_at>now()-interval '1 day')>=50 then raise exception 'Daily invitation limit reached'; end if;
  insert into private.registration_applications(club_id,team_id,pack_id,email,creator_id,request_key)
   values(me.club_id,tm.id,pack.id,em,me.user_id,(p_data->>'request_key')::uuid) returning * into a;
  insert into private.registration_delivery_jobs(application_id) values(a.id) returning id into jid;
  return jsonb_build_object('ok',true,'id',a.id,'queued',true);
 end if;
 if p_action='claim' then
  if coalesce(p_data->>'token','') !~ '^[0-9a-f]{64}$' then raise exception 'Invitation unavailable or expired. Reopen the original invitation email.'; end if;
  select * into a from private.registration_applications where token_hash=private.registration_hash(p_data->>'token') for update;
  if a.id is null or a.status<>'invited' or a.applicant_id is not null or a.expires_at<now() or a.email<>em then raise exception 'Invitation unavailable for this verified email, or the link has expired'; end if;
  if me.club_id is not null and me.club_id<>a.club_id then raise exception 'The invitation belongs to another club'; end if;
  if me.role in ('coach','assistant_coach','club_admin') and me.club_id is distinct from a.club_id then raise exception 'The invitation belongs to another club'; end if;
  update private.registration_applications set applicant_id=me.user_id,status='draft',token_hash=null,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  if me.role in ('pending','pending_parent') then update public.profiles set role='pending_parent',club_id=a.club_id,team_id=null,approved_at=null,approved_by=null,updated_at=now() where user_id=me.user_id; end if;
  return jsonb_build_object('ok',true,'id',a.id);
 end if;
 select * into a from private.registration_applications where id=p_id for update;
 if a.id is null or not (a.applicant_id is not distinct from me.user_id or (is_admin and a.club_id=me.club_id)) then raise exception 'Application unavailable for this account'; end if;
 if a.applicant_id=me.user_id and em<>a.email then raise exception 'Use the original invited and verified email for this application'; end if;
 select * into tm from public.teams where id=a.team_id and club_id=a.club_id and (active or p_action in ('get','document')) for share;
 select * into pack from private.registration_packs where id=a.pack_id;
 if tm.id is null then raise exception 'Team no longer available'; end if;
 if p_action='get' then
  select coalesce(jsonb_agg(to_jsonb(s) order by s.revision),'[]'::jsonb) into result from private.registration_submissions s where s.application_id=a.id;
  data:=jsonb_build_object('ok',true,'id',a.id,'status',case when a.status='invited' and a.expires_at<now() then 'expired' else a.status end,'revision',a.revision,'team',tm.selkent_label,'season',pack.season,'pack_version',pack.version,'email',a.email,'answers',case when a.applicant_id=me.user_id then a.answers else coalesce((select s.answers from private.registration_submissions s where s.application_id=a.id order by revision desc limit 1),'{}') end,'feedback',a.feedback,'expires_at',a.expires_at,'delivery',coalesce((select case when j.status='sending' and j.updated_at<now()-interval '5 minutes' then 'uncertain' else j.status end from private.registration_delivery_jobs j where j.application_id=a.id order by j.created_at desc,j.id desc limit 1),'queued'),'admin',is_admin and a.applicant_id is distinct from me.user_id,'submissions',result,'declarations',pack.documents->'declarations','pack_available',pack.enabled,'read_documents',(select coalesce(jsonb_agg(r.kind),'[]'::jsonb) from private.registration_document_reads r where r.application_id=a.id and r.user_id=me.user_id and r.sha256=pack.documents->r.kind->>'sha256'));
  if is_admin and a.applicant_id is distinct from me.user_id then
   select coalesce(jsonb_agg(jsonb_build_object('name',p->>'name','number',p->'number') order by p->>'name'),'[]'::jsonb) into result from public.team_state ts cross join lateral jsonb_array_elements(coalesce(ts.state->'squad','[]')) p where ts.team_id=tm.id and coalesce(p->>'status','active')='active';
   data:=data||jsonb_build_object('players',result);
  end if;
  return data;
 end if;
 if p_action='document' then
  k:=p_data->>'kind';
  if k not in ('terms','conduct') or pack.documents->k is null then raise exception 'Document unavailable'; end if;
  if private.registration_hash(pack.documents->k->>'text') is distinct from pack.documents->k->>'sha256' then raise exception 'Document integrity check failed'; end if;
  if a.applicant_id=me.user_id then insert into private.registration_document_reads(application_id,user_id,kind,sha256) values(a.id,me.user_id,k,pack.documents->k->>'sha256') on conflict do nothing; end if;
  return jsonb_build_object('ok',true,'document',pack.documents->k,'version',pack.version);
 end if;
 if a.revision is distinct from p_revision then raise exception 'Application changed. Reload before saving or reviewing.'; end if;
 if p_action in ('save','submit') then
  if a.applicant_id is distinct from me.user_id or a.status not in ('draft','corrections') then raise exception 'Only your own open registration can be edited'; end if;
  if not pack.enabled then raise exception 'The registration pack has changed or is unavailable. Contact the club before submitting.'; end if;
  data:=private.registration_validate(p_data->'answers',p_action='submit');
  if p_action='submit' then
   if data->>'pack_version' is distinct from pack.version then raise exception 'Read and agree to this application’s registration pack'; end if;
   foreach k in array array['terms','conduct'] loop
    if not exists(select 1 from private.registration_document_reads r where r.application_id=a.id and r.user_id=me.user_id and r.kind=k and r.sha256=pack.documents->k->>'sha256') then raise exception 'Read the full required document before accepting: %',k; end if;
   end loop;
  end if;
  update private.registration_applications set answers=data,revision=revision+1,status=case when p_action='submit' then 'submitted' else status end,updated_at=now() where id=a.id returning * into a;
  if p_action='submit' then
   update public.profiles set full_name=btrim(data->>'parent_first')||' '||btrim(data->>'parent_surname'),updated_at=now() where user_id=me.user_id and role='pending_parent';
   insert into private.registration_submissions(application_id,revision,answers,applicant_id,email,pack_id,document_hashes) values(a.id,a.revision,a.answers,me.user_id,em,pack.id,jsonb_build_object('terms',pack.documents->'terms'->>'sha256','conduct',pack.documents->'conduct'->>'sha256'));
  end if;
  return jsonb_build_object('ok',true,'id',a.id,'revision',a.revision,'status',a.status);
 end if;
 if not is_admin or a.club_id<>me.club_id or a.applicant_id=me.user_id then raise exception 'Independent Club Admin review required'; end if;
 if p_action in ('cancel','resend') then
  if a.status<>'invited' or a.applicant_id is not null then raise exception 'Only an unclaimed invitation can be resent or cancelled'; end if;
  if p_action='resend' and (select max(created_at) from private.registration_delivery_jobs where application_id=a.id)>now()-interval '1 minute' then raise exception 'Wait a minute before resending'; end if;
  if p_action='resend' and (select count(*) from private.registration_delivery_jobs where application_id=a.id and created_at>now()-interval '1 day')>=10 then raise exception 'Invitation resend limit reached'; end if;
  update private.registration_delivery_jobs set status='cancelled',ticket_hash=null,ack_hash=null,updated_at=now() where application_id=a.id and status in ('queued','sending');
  update private.registration_applications set token_hash=null,expires_at=now()+interval '7 days',status=case when p_action='cancel' then 'cancelled' else 'invited' end,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  if p_action='resend' then insert into private.registration_delivery_jobs(application_id) values(a.id); end if;
  return jsonb_build_object('ok',true,'id',a.id,'status',a.status,'revision',a.revision);
 end if;
 if p_action='review' then
  if a.status<>'submitted' or a.applicant_id is null then raise exception 'A submitted application is required'; end if;
  decision:=p_data->>'decision';
  if decision not in ('approve','corrections','decline') then raise exception 'Choose a review decision'; end if;
  if decision<>'approve' then
   if length(btrim(coalesce(p_data->>'note','')))<3 or length(p_data->>'note')>1000 then raise exception 'Explain the correction or decision (3 to 1000 characters)'; end if;
   update private.registration_applications set status=case when decision='decline' then 'declined' else 'corrections' end,feedback=btrim(p_data->>'note'),reviewed_by=me.user_id,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  else
   if p_data->'verified' is distinct from 'true'::jsonb then raise exception 'Verify the parent, child and intended team before approval'; end if;
   if not exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=a.applicant_id and lower(u.email)=a.email and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) and p.club_id=a.club_id and p.role in ('pending_parent','parent','coach','assistant_coach','club_admin')) then raise exception 'Applicant account needs independent review'; end if;
   nm:=btrim(a.answers->>'first_name')||' '||btrim(a.answers->>'surname');
   child:=nullif(btrim(p_data->>'existing_player'),'');
   if child is not null then
    select p->>'name' into child from public.team_state ts cross join lateral jsonb_array_elements(coalesce(ts.state->'squad','[]')) p where ts.team_id=tm.id and coalesce(p->>'status','active')='active' and p->>'name'=child;
    if child is null then raise exception 'Select a verified existing player from this team'; end if;
   end if;
   insert into public.parent_access_requests(user_id,club_id,team_id,child_name,status,updated_at,reviewed_at,reviewed_by)
   values(a.applicant_id,a.club_id,tm.id,coalesce(child,nm),'pending',now(),null,null)
   on conflict(user_id,team_id,child_name) do update set status='pending',updated_at=now(),reviewed_at=null,reviewed_by=null returning id into req;
   -- This status and the roster/link decision commit together, or all roll back.
   update private.registration_applications set status='approved',parent_request_id=req,player_name=coalesce(child,nm),reviewed_by=me.user_id,revision=revision+1,updated_at=now() where id=a.id returning * into a;
   if child is null then result:=public.admin_onboard_player(tm.id,nm,(p_data->>'shirt_number')::int,p_data->>'player_role',req);
   else result:=public.approve_parent_request(req,child); end if;
  end if;
  return jsonb_build_object('ok',true,'id',a.id,'revision',a.revision,'status',a.status);
 end if;
 raise exception 'Unknown registration action';
end $$;
revoke all on function private.registration_api(text,uuid,bigint,jsonb),private.registration_validate(jsonb,boolean),private.registration_hash(text),private.registration_immutable() from public,anon,authenticated;
create function public.registration_api(p_action text,p_id uuid default null,p_revision bigint default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 return private.registration_api(p_action,p_id,p_revision,p_data);
end $$;
revoke all on function public.registration_api(text,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.registration_api(text,uuid,bigint,jsonb) to authenticated;

-- Service-issued capabilities cross the Edge-to-Worker boundary without a shared secret.
-- Claim tokens are generated only when the Worker redeems a ticket; only hashes persist.
create function public.registration_delivery(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.registration_delivery_jobs; a private.registration_applications; ticket text; ack text; token text; tm public.teams;
begin
 if p_action='lease' then
  if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Service delivery only'; end if;
  select * into a from private.registration_applications where id=p_id for update;
  if a.id is null or a.status<>'invited' or a.applicant_id is not null or a.expires_at<now() then return jsonb_build_object('ok',true,'skipped',true); end if;
  select * into j from private.registration_delivery_jobs where application_id=a.id and status='queued' order by created_at limit 1 for update;
  if j.id is null then return jsonb_build_object('ok',true,'skipped',true); end if;
  ticket:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  update private.registration_delivery_jobs set status='sending',ticket_hash=private.registration_hash(ticket),leased_at=now(),updated_at=now() where id=j.id;
  return jsonb_build_object('ok',true,'ticket',ticket);
 elsif p_action='redeem' then
  if coalesce(p_data->>'ticket','') !~ '^[0-9a-f]{64}$' then raise exception 'Delivery unavailable'; end if;
  select * into j from private.registration_delivery_jobs where ticket_hash=private.registration_hash(p_data->>'ticket') and status='sending' and redeemed_at is null and leased_at>now()-interval '2 minutes';
  if j.id is null then raise exception 'Delivery unavailable'; end if;
  select * into a from private.registration_applications where id=j.application_id and status='invited' and applicant_id is null and expires_at>now() for update;
  if a.id is null then raise exception 'Delivery unavailable'; end if;
  select * into j from private.registration_delivery_jobs where id=j.id and status='sending' and redeemed_at is null and ticket_hash=private.registration_hash(p_data->>'ticket') for update;
  if j.id is null then raise exception 'Delivery unavailable'; end if;
  select * into tm from public.teams where id=a.team_id and active;
  if tm.id is null then raise exception 'Delivery unavailable'; end if;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');ack:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  update private.registration_applications set token_hash=private.registration_hash(token) where id=a.id;
  update private.registration_delivery_jobs set ticket_hash=null,ack_hash=private.registration_hash(ack),redeemed_at=now(),updated_at=now() where id=j.id;
  return jsonb_build_object('ok',true,'id',j.id,'ack',ack,'email',a.email,'token',token,'expires_at',a.expires_at);
 elsif p_action='ack' then
  if coalesce(p_data->>'ack','') !~ '^[0-9a-f]{64}$' or p_data->>'status' not in ('sent','failed','uncertain') then raise exception 'Delivery unavailable'; end if;
  select * into j from private.registration_delivery_jobs where id=p_id and ack_hash=private.registration_hash(p_data->>'ack') and status='sending' and redeemed_at>now()-interval '5 minutes' for update;
  if j.id is null then raise exception 'Delivery unavailable'; end if;
  update private.registration_delivery_jobs set status=p_data->>'status',ack_hash=null,receipt=left(p_data->>'receipt',150),error_code=left(p_data->>'error_code',80),updated_at=now() where id=j.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Delivery unavailable';
end $$;
revoke all on function public.registration_delivery(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.registration_delivery(text,uuid,jsonb) to anon,service_role;

-- Fail closed if the observed permission boundary has changed.
do $guard$ begin
 if pg_get_functiondef('public.get_my_context()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.get_my_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare
  p public.profiles; t public.teams; ct public.teams; c public.clubs; target uuid; ts public.team_state;
  safe_state jsonb; is_restricted boolean:=false; target_age integer; real_role text;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.user_id is null then return null; end if;
  real_role:=p.role;
  p.role:=private.effective_role(p);
  if p.role=''parent'' then
    select linked.id into target
    from public.teams linked
    join public.parent_player_links ppl on ppl.team_id=linked.id and ppl.parent_user_id=p.user_id
    where linked.club_id=p.club_id and linked.active=true
    order by case when linked.id=p.team_id then 0 else 1 end,linked.age_group,linked.name
    limit 1;
    if target is not null then select * into t from public.teams where id=target; end if;
  else
    if p.team_id is not null then select * into t from public.teams where id=p.team_id; end if;
  end if;
  if p.coach_team_id is not null then select * into ct from public.teams where id=p.coach_team_id; end if;
  if p.club_id is not null then select * into c from public.clubs where id=p.club_id; end if;
  if p.role<>''parent'' then target:=coalesce(p.coach_team_id,p.team_id); end if;
  target_age:=case
    when p.role=''parent'' and t.id is not null then public.team_player_age(t.age_group,t.selkent_label)
    when ct.id is not null then public.team_player_age(ct.age_group,ct.selkent_label)
    else public.team_player_age(t.age_group,t.selkent_label)
  end;
  if target is not null then
    select * into ts from public.team_state where team_id=target;
    if ts.team_id is not null then
      safe_state:=private.state_for_viewer(ts.state,target,p.user_id,p.role,target_age);
      is_restricted:=((target_age is null or target_age between 7 and 11) and p.role in (''parent'',''player''));
    end if;
  end if;
  return jsonb_build_object(
    ''profile'',to_jsonb(p),
    ''team'',case when t.id is null then null else to_jsonb(t) end,
    ''coach_team'',case when ct.id is null then null else to_jsonb(ct) end,
    ''club'',case when c.id is null then null else to_jsonb(c) end,
    ''team_state'',safe_state,
    ''team_state_revision'',case when ts.team_id is null then null else ts.revision end,
    ''team_state_restricted'',is_restricted,
    ''inbox_allowed'',p.role in (''club_admin'',''coach'',''assistant_coach'',''parent''),
    ''real_role'',real_role,
    ''acting_as_parent'',(p.role=''parent'' and real_role<>''parent''),
    ''can_have_children'',real_role in (''club_admin'',''coach'',''assistant_coach''),
    ''has_children'',exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id)
  );
end $function$
' then raise exception 'Registration guard baseline changed: get_my_context'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.get_my_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.profiles; t public.teams; ct public.teams; c public.clubs; target uuid; ts public.team_state;
  safe_state jsonb; is_restricted boolean:=false; target_age integer; real_role text;
begin
  select * into p from public.profiles where user_id=auth.uid();
  if p.user_id is null then return null; end if;
  real_role:=p.role;
  p.role:=private.effective_role(p);
  if p.role='parent' then
    select linked.id into target
    from public.teams linked
    join public.parent_player_links ppl on ppl.team_id=linked.id and ppl.parent_user_id=p.user_id
    where linked.club_id=p.club_id and linked.active=true
    order by case when linked.id=p.team_id then 0 else 1 end,linked.age_group,linked.name
    limit 1;
    if target is not null then select * into t from public.teams where id=target; end if;
  else
    if p.team_id is not null then select * into t from public.teams where id=p.team_id; end if;
  end if;
  if p.coach_team_id is not null then select * into ct from public.teams where id=p.coach_team_id; end if;
  if p.club_id is not null then select * into c from public.clubs where id=p.club_id; end if;
  if p.role<>'parent' then target:=coalesce(p.coach_team_id,p.team_id); end if;
  target_age:=case
    when p.role='parent' and t.id is not null then public.team_player_age(t.age_group,t.selkent_label)
    when ct.id is not null then public.team_player_age(ct.age_group,ct.selkent_label)
    else public.team_player_age(t.age_group,t.selkent_label)
  end;
  if target is not null and public.can_read_team(target) then
    select * into ts from public.team_state where team_id=target;
    if ts.team_id is not null then
      safe_state:=private.state_for_viewer(ts.state,target,p.user_id,p.role,target_age);
      is_restricted:=((target_age is null or target_age between 7 and 11) and p.role in ('parent','player'));
    end if;
  end if;
  return jsonb_build_object(
    'profile',to_jsonb(p),
    'team',case when t.id is null then null else to_jsonb(t) end,
    'coach_team',case when ct.id is null then null else to_jsonb(ct) end,
    'club',case when c.id is null then null else to_jsonb(c) end,
    'team_state',safe_state,
    'team_state_revision',case when ts.team_id is null then null else ts.revision end,
    'team_state_restricted',is_restricted,
    'inbox_allowed',p.role in ('club_admin','coach','assistant_coach','parent'),
    'real_role',real_role,
    'acting_as_parent',(p.role='parent' and real_role<>'parent'),
    'can_have_children',real_role in ('club_admin','coach','assistant_coach'),
    'has_children',exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id)
  );
end $function$
;

-- Fail closed if the observed permission boundary has changed.
do $guard$ begin
 if pg_get_functiondef('public.list_announcements_for_me()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.list_announcements_for_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  me public.profiles; result jsonb;
begin
  if auth.uid() is null then return ''[]''::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null then return ''[]''::jsonb; end if;
  me.role:=private.effective_role(me);
  if me.role=''player'' and exists (
    select 1 from public.teams t where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return ''[]''::jsonb; end if;
  select coalesce(jsonb_agg(x order by (x->>''pinned'')::boolean desc,(x->>''important'')::boolean desc,x->>''created_at'' desc),''[]''::jsonb) into result
  from (
    select jsonb_build_object(
      ''id'',a.id,''title'',a.title,''body'',a.body,''audience'',a.audience,''age_group'',a.age_group,''team_id'',a.team_id,
      ''pinned'',a.pinned,''important'',a.important,''created_at'',a.created_at,''expires_at'',a.expires_at,''read_at'',r.read_at,
      ''read_count'',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      ''target_count'',(
        select count(distinct target_user) from (
          select p2.user_id as target_user
          from public.profiles p2
          left join public.teams t2 on t2.id=coalesce(p2.coach_team_id,p2.team_id)
          where p2.club_id=a.club_id and p2.role in (''club_admin'',''coach'',''assistant_coach'',''player'')
            and (p2.role<>''player'' or public.team_player_age(t2.age_group,t2.selkent_label) not between 7 and 16)
            and (a.audience=''whole_club''
              or (a.audience=''coaches'' and p2.role in (''coach'',''assistant_coach'',''club_admin''))
              or (a.audience=''team'' and a.team_id in (select private.assigned_team_ids(p2.user_id)))
              or (a.audience=''age_group'' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(p2.user_id)) and ta.age_group=a.age_group)))
          union
          select p3.user_id from public.profiles p3
          where p3.club_id=a.club_id and p3.role=''parent''
            and (a.audience in (''whole_club'',''parents'')
              or (a.audience=''team'' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p3.user_id and ppl.team_id=a.team_id))
              or (a.audience=''age_group'' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=p3.user_id and pt.age_group=a.age_group)))
        ) recipients
      )
    ) x
    from public.club_announcements a
    left join public.announcement_reads r on r.announcement_id=a.id and r.user_id=auth.uid()
    where a.club_id=me.club_id
      and (a.expires_at is null or a.expires_at>now() or me.role=''club_admin'')
      and (
        me.role=''club_admin''
        or a.audience=''whole_club''
        or (a.audience=''coaches'' and me.role in (''coach'',''assistant_coach''))
        or (a.audience=''parents'' and me.role=''parent'')
        or (a.audience=''team'' and (
              (me.role=''parent'' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=me.user_id and ppl.team_id=a.team_id))
              or (me.role<>''parent'' and a.team_id in (select private.assigned_team_ids(me.user_id)))))
        or (a.audience=''age_group'' and (
              (me.role=''parent'' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group))
              or (me.role<>''parent'' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(me.user_id)) and ta.age_group=a.age_group))))
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $function$
' then raise exception 'Registration guard baseline changed: list_announcements_for_me'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.list_announcements_for_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.profiles; result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.club_id is null or me.role not in ('club_admin','coach','assistant_coach','parent','player') then return '[]'::jsonb; end if;
  me.role:=private.effective_role(me);
  if me.role='player' and exists (
    select 1 from public.teams t where t.id=me.team_id and t.club_id=me.club_id
      and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
  ) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc,(x->>'important')::boolean desc,x->>'created_at' desc),'[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id',a.id,'title',a.title,'body',a.body,'audience',a.audience,'age_group',a.age_group,'team_id',a.team_id,
      'pinned',a.pinned,'important',a.important,'created_at',a.created_at,'expires_at',a.expires_at,'read_at',r.read_at,
      'read_count',(select count(*) from public.announcement_reads rr where rr.announcement_id=a.id),
      'target_count',(
        select count(distinct target_user) from (
          select p2.user_id as target_user
          from public.profiles p2
          left join public.teams t2 on t2.id=coalesce(p2.coach_team_id,p2.team_id)
          where p2.club_id=a.club_id and p2.role in ('club_admin','coach','assistant_coach','player')
            and (p2.role<>'player' or public.team_player_age(t2.age_group,t2.selkent_label) not between 7 and 16)
            and (a.audience='whole_club'
              or (a.audience='coaches' and p2.role in ('coach','assistant_coach','club_admin'))
              or (a.audience='team' and a.team_id in (select private.assigned_team_ids(p2.user_id)))
              or (a.audience='age_group' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(p2.user_id)) and ta.age_group=a.age_group)))
          union
          select p3.user_id from public.profiles p3
          where p3.club_id=a.club_id and p3.role='parent'
            and (a.audience in ('whole_club','parents')
              or (a.audience='team' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=p3.user_id and ppl.team_id=a.team_id))
              or (a.audience='age_group' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=p3.user_id and pt.age_group=a.age_group)))
        ) recipients
      )
    ) x
    from public.club_announcements a
    left join public.announcement_reads r on r.announcement_id=a.id and r.user_id=auth.uid()
    where a.club_id=me.club_id
      and (a.expires_at is null or a.expires_at>now() or me.role='club_admin')
      and (
        me.role='club_admin'
        or a.audience='whole_club'
        or (a.audience='coaches' and me.role in ('coach','assistant_coach'))
        or (a.audience='parents' and me.role='parent')
        or (a.audience='team' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl where ppl.parent_user_id=me.user_id and ppl.team_id=a.team_id))
              or (me.role<>'parent' and a.team_id in (select private.assigned_team_ids(me.user_id)))))
        or (a.audience='age_group' and (
              (me.role='parent' and exists(select 1 from public.parent_player_links ppl join public.teams pt on pt.id=ppl.team_id where ppl.parent_user_id=me.user_id and pt.age_group=a.age_group))
              or (me.role<>'parent' and exists(select 1 from public.teams ta where ta.id in (select private.assigned_team_ids(me.user_id)) and ta.age_group=a.age_group))))
      )
    order by a.pinned desc,a.important desc,a.created_at desc
    limit 50
  ) q;
  return result;
end $function$
;

-- Fail closed if the observed permission boundary has changed.
do $guard$ begin
 if pg_get_functiondef('public.list_notifications_for_me()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.list_notifications_for_me()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',n.id,''type'',n.type,''title'',n.title,''body'',n.body,''entity_key'',n.entity_key,
    ''team_id'',n.team_id,''created_at'',n.created_at,''read_at'',n.read_at
  ) order by n.created_at desc),''[]''::jsonb)
  from public.app_notifications n
  where n.recipient_user_id=auth.uid()
    and n.created_at > now()-interval ''180 days''
    -- Hide previously issued football alerts as well as future ones for U7–U16 players.
    and not exists (
      select 1 from public.profiles p
      join public.teams t on t.id=n.team_id and t.club_id=p.club_id
      where p.user_id=auth.uid() and p.role=''player''
        and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
    )
  limit 100
$function$
' then raise exception 'Registration guard baseline changed: list_notifications_for_me'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.list_notifications_for_me()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'type',n.type,'title',n.title,'body',n.body,'entity_key',n.entity_key,
    'team_id',n.team_id,'created_at',n.created_at,'read_at',n.read_at
  ) order by n.created_at desc),'[]'::jsonb)
  from public.app_notifications n
  where n.recipient_user_id=auth.uid()
    and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('club_admin','coach','assistant_coach','parent','player'))
    and n.created_at > now()-interval '180 days'
    -- Hide previously issued football alerts as well as future ones for U7–U16 players.
    and not exists (
      select 1 from public.profiles p
      join public.teams t on t.id=n.team_id and t.club_id=p.club_id
      where p.user_id=auth.uid() and p.role='player'
        and public.team_player_age(t.age_group,t.selkent_label) between 7 and 16
    )
  limit 100
$function$
;

-- Fail closed if the observed permission boundary has changed.
do $guard$ begin
 if pg_get_functiondef('public.approve_parent_request(uuid, text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.approve_parent_request(p_request_id uuid, p_player_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare
  me public.profiles; req public.parent_access_requests; target public.profiles; ts public.team_state; canonical_name text;
  staff_requester boolean;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in (''club_admin'',''coach'',''assistant_coach'') then
    raise exception ''Coach, Assistant Coach or Club Admin access required'';
  end if;

  select * into req from public.parent_access_requests where id=p_request_id and status=''pending'' for update;
  if req.id is null then raise exception ''Pending parent request not found''; end if;
  if req.club_id<>me.club_id then raise exception ''Parent request belongs to another club''; end if;
  if req.user_id=auth.uid() then raise exception ''You cannot approve your own request. Ask a Club Admin or the team coach.''; end if;
  if me.role in (''coach'',''assistant_coach'') and req.team_id<>coalesce(me.coach_team_id,me.team_id) then
    raise exception ''You can only review parent requests for your own team'';
  end if;

  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role not in (''pending_parent'',''parent'',''coach'',''assistant_coach'',''club_admin'') then
    raise exception ''Parent account is not available for approval'';
  end if;
  if target.club_id<>req.club_id then raise exception ''Parent account club does not match request''; end if;
  staff_requester:=target.role in (''coach'',''assistant_coach'',''club_admin'');

  select * into ts from public.team_state where team_id=req.team_id;
  if ts.team_id is null then raise exception ''Team squad is not available''; end if;

  select squad_player->>''name'' into canonical_name
  from jsonb_array_elements(case when jsonb_typeof(ts.state->''squad'')=''array'' then ts.state->''squad'' else ''[]''::jsonb end) squad_player
  where coalesce(squad_player->>''status'',''active'')=''active''
    and public.team_identity_norm(squad_player->>''name'')=public.team_identity_norm(p_player_name)
  limit 1;
  if canonical_name is null then raise exception ''Select an active player from this team before approving the request''; end if;

  insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name,shirt_number,created_by)
  values(req.club_id,req.team_id,req.user_id,left(canonical_name,80),null,auth.uid())
  on conflict (team_id,parent_user_id,player_name) do update set created_by=excluded.created_by;

  update public.parent_access_requests set status=''approved'',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=req.id;

  if staff_requester then
    update public.profiles set updated_at=now() where user_id=req.user_id;
  else
    update public.profiles
    set role=''parent'',access_method=''email'',team_id=coalesce(team_id,req.team_id),
        approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now()
    where user_id=req.user_id;
  end if;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(req.club_id,req.team_id,req.user_id,''access_approved'',''Child access approved'',
         canonical_name||'' has been linked to your ''||case when staff_requester then ''account. Use "Switch team or profile" to open the parent view.'' else ''parent account for this team.'' end,
         ''access-approved-request:''||req.id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object(''ok'',true,''request_id'',req.id,''team_id'',req.team_id,''player_name'',canonical_name,''parent_user_id'',req.user_id);
end $function$
' then raise exception 'Registration guard baseline changed: approve_parent_request'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.approve_parent_request(p_request_id uuid, p_player_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.profiles; req public.parent_access_requests; target public.profiles; ts public.team_state; canonical_name text;
  staff_requester boolean;
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach') then
    raise exception 'Coach, Assistant Coach or Club Admin access required';
  end if;

  select * into req from public.parent_access_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Pending parent request not found'; end if;
  if req.club_id<>me.club_id then raise exception 'Parent request belongs to another club'; end if;
  if req.user_id=auth.uid() then raise exception 'You cannot approve your own request. Ask a Club Admin or the team coach.'; end if;
  if me.role in ('coach','assistant_coach') and req.team_id<>coalesce(me.coach_team_id,me.team_id) then
    raise exception 'You can only review parent requests for your own team';
  end if;

  select * into target from public.profiles where user_id=req.user_id for update;
  if target.user_id is null or target.role not in ('pending_parent','parent','coach','assistant_coach','club_admin') then
    raise exception 'Parent account is not available for approval';
  end if;
  if target.club_id<>req.club_id then raise exception 'Parent account club does not match request'; end if;
  if target.role='pending_parent' and exists(select 1 from private.registration_applications a where a.applicant_id=target.user_id and a.team_id=req.team_id and a.status not in ('approved','cancelled')) and not exists(select 1 from private.registration_applications a where a.parent_request_id=req.id and a.status='approved') then raise exception 'Review the full registration application before granting access'; end if;
  staff_requester:=target.role in ('coach','assistant_coach','club_admin');

  select * into ts from public.team_state where team_id=req.team_id;
  if ts.team_id is null then raise exception 'Team squad is not available'; end if;

  select squad_player->>'name' into canonical_name
  from jsonb_array_elements(case when jsonb_typeof(ts.state->'squad')='array' then ts.state->'squad' else '[]'::jsonb end) squad_player
  where coalesce(squad_player->>'status','active')='active'
    and public.team_identity_norm(squad_player->>'name')=public.team_identity_norm(p_player_name)
  limit 1;
  if canonical_name is null then raise exception 'Select an active player from this team before approving the request'; end if;

  insert into public.parent_player_links(club_id,team_id,parent_user_id,player_name,shirt_number,created_by)
  values(req.club_id,req.team_id,req.user_id,left(canonical_name,80),null,auth.uid())
  on conflict (team_id,parent_user_id,player_name) do update set created_by=excluded.created_by;

  update public.parent_access_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=req.id;

  if staff_requester then
    update public.profiles set updated_at=now() where user_id=req.user_id;
  else
    update public.profiles
    set role='parent',access_method='email',team_id=coalesce(team_id,req.team_id),
        approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()),updated_at=now()
    where user_id=req.user_id;
  end if;

  insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key)
  values(req.club_id,req.team_id,req.user_id,'access_approved','Child access approved',
         canonical_name||' has been linked to your '||case when staff_requester then 'account. Use "Switch team or profile" to open the parent view.' else 'parent account for this team.' end,
         'access-approved-request:'||req.id::text)
  on conflict(recipient_user_id,type,entity_key) where entity_key is not null
  do update set created_at=now(),read_at=null,body=excluded.body;

  return jsonb_build_object('ok',true,'request_id',req.id,'team_id',req.team_id,'player_name',canonical_name,'parent_user_id',req.user_id);
end $function$
;
