-- Candidate: apply only this named migration after the reviewed deployment gate.
-- No backfill and no external network requests in a fixture save transaction.
create table private.kickoff_delivery_config (
 singleton boolean primary key default true check(singleton),
 push_enabled boolean not null default false, email_enabled boolean not null default false,
 vapid_public_key text not null default '', push_activated_at timestamptz, email_activated_at timestamptz
);
insert into private.kickoff_delivery_config(singleton) values(true);
create table private.kickoff_updates (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade, fixture_key text not null,
 revision bigint not null, details jsonb not null, previous_details jsonb,
 created_at timestamptz not null default now(), unique(team_id,fixture_key,revision)
);
create index kickoff_latest on private.kickoff_updates(team_id,fixture_key,revision desc);
create table private.kickoff_receipts (
 update_id uuid not null references private.kickoff_updates(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 notification_id uuid references public.app_notifications(id) on delete set null,
 coach boolean not null, parent boolean not null, seen_at timestamptz,
 primary key(update_id,user_id)
);
create table private.kickoff_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth_secret text not null,
 renewed_at timestamptz not null default now()
);
create index kickoff_push_owner on private.kickoff_push_subscriptions(user_id);
create table private.kickoff_deliveries (
 id uuid primary key default gen_random_uuid(), update_id uuid not null,
 user_id uuid not null, channel text not null check(channel in ('push','email')),
 subscription_id uuid references private.kickoff_push_subscriptions(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','sending','sent','retrying','unavailable','failed','cancelled')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 claim_token uuid, claimed_at timestamptz, sent_at timestamptz, email_redeemed_at timestamptz,
 foreign key(update_id,user_id) references private.kickoff_receipts(update_id,user_id) on delete cascade
);
create index kickoff_outbox on private.kickoff_deliveries(next_attempt_at) where status in ('queued','retrying','sending');
create unique index kickoff_delivery_target on private.kickoff_deliveries(update_id,user_id,channel,coalesce(subscription_id,'00000000-0000-0000-0000-000000000000'::uuid));
-- Only definer RPCs can access private records. No REST table grants/policies.
alter table private.kickoff_delivery_config enable row level security;
alter table private.kickoff_updates enable row level security;
alter table private.kickoff_receipts enable row level security;
alter table private.kickoff_push_subscriptions enable row level security;
alter table private.kickoff_deliveries enable row level security;
revoke all on private.kickoff_delivery_config,private.kickoff_updates,private.kickoff_receipts,private.kickoff_push_subscriptions,private.kickoff_deliveries from public,anon,authenticated;

create function private.kickoff_audience(p_team uuid)
returns table(user_id uuid,coach boolean,parent boolean)
language sql stable security definer set search_path='' as $$
 with eligible as (select p.user_id,
 ((p.role in ('coach','assistant_coach') and exists(select 1 from private.assigned_team_ids(p.user_id) a where a=p_team)) or (p.role='club_admin' and p.coach_team_id=p_team)) as coach,
 exists(select 1 from public.parent_player_links l where l.parent_user_id=p.user_id and l.team_id=p_team and l.club_id=t.club_id) as parent
 from public.profiles p join public.teams t on t.club_id=p.club_id and t.id=p_team and t.active and t.club_id='00c2b0d4-b636-44bb-b4ca-6ba43305f494'
 join auth.users au on au.id=p.user_id
 where p.role in ('coach','assistant_coach','club_admin','parent') and au.email_confirmed_at is not null
 and coalesce(au.is_anonymous,false)=false and (au.banned_until is null or au.banned_until<now()))
 select user_id,coalesce(coach,false),parent from eligible where coach or parent;
$$;

-- Invalid provider dates must not break a committed team save. Fixture times are UK local.
create function private.kickoff_upcoming(p jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare day date; kickoff timestamptz;
begin
 if p->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or p->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
 day:=(p->>'date')::date;
 kickoff:=((p->>'date')||' '||(p->>'time'))::timestamp at time zone 'Europe/London';
 return coalesce(kickoff>now() and day<=(now() at time zone 'Europe/London')::date+90,false);
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $$;
create function private.kickoff_staff(p_team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.teams t on t.id=p_team and t.club_id=p.club_id where p.user_id=auth.uid() and not p.acting_as_parent and (p.role='club_admin' or (p.role in ('coach','assistant_coach') and exists(select 1 from private.assigned_team_ids(p.user_id) a where a=p_team))));
$$;
create function private.kickoff_norm(v text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(lower(replace(replace(coalesce(v,''),'&amp;','and'),'&','and')),'[^a-z0-9]+',' ','g'));
$$;
-- Use the same date/opponent/H-A/competition key as fixtureKitSelectionKey.
create function private.kickoff_details(p_state jsonb)
returns table(fixture_key text,details jsonb) language sql immutable set search_path='' as $$
 with fixtures as (
  select f, (f->>'date')||'|'||private.kickoff_norm(coalesce(nullif(f->>'opponent',''),'tbc'))||'|'||upper(coalesce(f->>'venue',''))||'|'||private.kickoff_norm(coalesce(nullif(f->>'competition',''),'fixture')) as k
  from jsonb_array_elements(case when jsonb_typeof(p_state#>'{selkent,fixtures}')='array' then p_state#>'{selkent,fixtures}' else '[]'::jsonb end) f
 ), overrides as (
  select key k,value o from jsonb_each(case when jsonb_typeof(p_state#>'{selkent,fixtureOverrides}')='object' then p_state#>'{selkent,fixtureOverrides}' else '{}'::jsonb end)
 ), combined as (select coalesce(f.k,o.k) k,f.f,o.o from fixtures f full join overrides o on f.k=o.k)
 select distinct on(k) k,jsonb_build_object(
 'date',split_part(k,'|',1),'opponent',left(coalesce(f->>'opponent',split_part(k,'|',2)),160),
 'time',coalesce(o->>'time',f->>'time',''),
 'ground',left(coalesce(o->>'groundName',f->>'groundName','Venue to be confirmed'),240),
 'address',left(coalesce(o->>'address',f->>'address',''),400),
 'status',case when nullif(o->>'confirmedAt','') is not null then 'confirmed' else 'provisional' end)
 from combined where k is not null and length(k)<600 and split_part(k,'|',1)~'^\d{4}-\d{2}-\d{2}$';
$$;

create function private.capture_kickoff_updates() returns trigger language plpgsql security definer set search_path='' as $$
declare d record; previous jsonb; event_id uuid; rev bigint; audience record; notification uuid; team public.teams; headline text; message text;
begin
 select * into team from public.teams where id=new.team_id;
 if team.id is null or not team.active or team.club_id<>'00c2b0d4-b636-44bb-b4ca-6ba43305f494' then return new; end if;
 for d in select * from private.kickoff_details(new.state) loop
  -- Ignore invalid/TBC/past kick-offs. Compare actual public content, never save timestamps.
  if not private.kickoff_upcoming(d.details) then continue; end if;
  previous:=null;
  if tg_op='UPDATE' then select x.details into previous from private.kickoff_details(old.state) x where x.fixture_key=d.fixture_key; end if;
  if previous is not distinct from d.details then continue; end if;
  select coalesce(max(u.revision),0)+1 into rev from private.kickoff_updates u where u.team_id=new.team_id and u.fixture_key=d.fixture_key;
  insert into private.kickoff_updates(club_id,team_id,fixture_key,revision,details,previous_details) values(team.club_id,new.team_id,d.fixture_key,rev,d.details,previous) returning id into event_id;
  update private.kickoff_deliveries set status='cancelled',claim_token=null where update_id in(select id from private.kickoff_updates where team_id=new.team_id and fixture_key=d.fixture_key and id<>event_id) and status in ('queued','sending','retrying','unavailable');
  headline:=case when previous->>'time'~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then 'Kick-off details changed' else 'Kick-off details added' end;
  message:=team.name||' · '||(d.details->>'date')||E'\nvs '||(d.details->>'opponent')||E'\nKick-off '||(d.details->>'time')||E'\n'||(d.details->>'ground')||case when d.details->>'address'<>'' then E'\n'||(d.details->>'address') else '' end||E'\n'||case when d.details->>'status'='confirmed' then 'Confirmed' else 'Provisional: awaiting the other club’s confirmation' end;
  for audience in select * from private.kickoff_audience(new.team_id) loop
   insert into public.app_notifications(club_id,team_id,recipient_user_id,type,title,body,entity_key) values(team.club_id,new.team_id,audience.user_id,'kickoff_update',headline,left(message,1200),'kickoff-update:'||event_id) returning id into notification;
   insert into private.kickoff_receipts(update_id,user_id,notification_id,coach,parent) values(event_id,audience.user_id,notification,audience.coach,audience.parent);
   insert into private.kickoff_deliveries(update_id,user_id,channel) values(event_id,audience.user_id,'email');
   insert into private.kickoff_deliveries(update_id,user_id,channel,subscription_id)
     select event_id,audience.user_id,'push',s.id from private.kickoff_push_subscriptions s where s.user_id=audience.user_id and s.renewed_at>now()-interval '30 days';
   if not found then insert into private.kickoff_deliveries(update_id,user_id,channel,status) values(event_id,audience.user_id,'push','unavailable'); end if;
  end loop;
 end loop;
 return new;
end $$;
create trigger capture_kickoff_updates after insert or update of state on public.team_state for each row execute function private.capture_kickoff_updates();

create function public.list_kickoff_updates_for_me() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'type','kickoff_update','title',n.title,'body',n.body,'entity_key',n.entity_key,'team_id',u.team_id,'created_at',u.created_at,'read_at',n.read_at,'update_id',u.id,'details',u.details,'previous_details',u.previous_details,'seen_at',r.seen_at,
 'confirmation_totals',case when private.kickoff_staff(u.team_id) then (select jsonb_build_object('coaches',count(*) filter(where a.coach),'coaches_seen',count(*) filter(where a.coach and rr.seen_at is not null),'parents',count(*) filter(where a.parent),'parents_seen',count(*) filter(where a.parent and rr.seen_at is not null)) from private.kickoff_receipts rr join private.kickoff_audience(u.team_id) a on a.user_id=rr.user_id where rr.update_id=u.id) else null end,
 'delivery_totals',case when private.kickoff_staff(u.team_id) then (select coalesce(jsonb_object_agg(s.label,s.n),'{}'::jsonb) from (select case when not(case when q.channel='push' then cfg.push_enabled else cfg.email_enabled end) and q.status in ('queued','retrying') then 'unavailable' else q.status end label,count(*) n from private.kickoff_deliveries q cross join private.kickoff_delivery_config cfg where q.update_id=u.id group by 1) s) else null end) order by u.created_at desc),'[]'::jsonb)
 from private.kickoff_receipts r join private.kickoff_updates u on u.id=r.update_id join public.app_notifications n on n.id=r.notification_id
 where r.user_id=auth.uid() and exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=auth.uid())
 and not exists(select 1 from private.kickoff_updates newer where newer.team_id=u.team_id and newer.fixture_key=u.fixture_key and newer.revision>u.revision)
 and exists(select 1 from public.team_state ts cross join lateral private.kickoff_details(ts.state) current_details where ts.team_id=u.team_id and current_details.fixture_key=u.fixture_key and current_details.details=u.details)
 and u.created_at>now()-interval '180 days';
$$;
create function public.acknowledge_kickoff_update(p_update_id uuid,p_confirm_seen boolean) returns timestamptz language plpgsql security definer set search_path='' as $$
declare u private.kickoff_updates; stamp timestamptz;
begin
 if p_confirm_seen is distinct from true then raise exception 'Tick I’ve seen these details first' using errcode='22023'; end if;
 select * into u from private.kickoff_updates where id=p_update_id;
 if u.id is null then raise exception 'Update unavailable' using errcode='42501'; end if;
 -- Serialize with save_team_state to prevent acknowledging a superseded version.
 perform 1 from public.team_state where team_id=u.team_id for update;
 if not exists(select 1 from public.team_state ts cross join lateral private.kickoff_details(ts.state) d where ts.team_id=u.team_id and d.fixture_key=u.fixture_key and d.details=u.details) or exists(select 1 from private.kickoff_updates newer where newer.team_id=u.team_id and newer.fixture_key=u.fixture_key and newer.revision>u.revision) then raise exception 'KICKOFF_DETAILS_CHANGED' using errcode='40001'; end if;
 if not exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=auth.uid()) then raise exception 'Team access required' using errcode='42501'; end if;
 update private.kickoff_receipts set seen_at=coalesce(seen_at,now()) where update_id=p_update_id and user_id=auth.uid() returning seen_at into stamp;
 if stamp is null then raise exception 'This update is not addressed to you' using errcode='42501'; end if;
 return stamp;
end $$;
create function public.get_kickoff_push_settings(p_endpoint text default '') returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('available',c.push_enabled and length(c.vapid_public_key)=87,'public_key',case when c.push_enabled then c.vapid_public_key else '' end,'subscribed',exists(select 1 from private.kickoff_push_subscriptions s where s.user_id=auth.uid() and s.endpoint=p_endpoint and s.renewed_at>now()-interval '30 days')) from private.kickoff_delivery_config c
 where exists(select 1 from public.profiles p join auth.users a on a.id=p.user_id where p.user_id=auth.uid() and p.club_id='00c2b0d4-b636-44bb-b4ca-6ba43305f494' and p.role in ('coach','assistant_coach','club_admin','parent') and a.email_confirmed_at is not null and coalesce(a.is_anonymous,false)=false and (a.banned_until is null or a.banned_until<now()));
$$;
create function public.register_kickoff_push(p_endpoint text,p_p256dh text,p_auth text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.profiles p join auth.users a on a.id=p.user_id where p.user_id=auth.uid() and p.club_id='00c2b0d4-b636-44bb-b4ca-6ba43305f494' and p.role in ('coach','assistant_coach','club_admin','parent') and a.email_confirmed_at is not null and coalesce(a.is_anonymous,false)=false and (a.banned_until is null or a.banned_until<now())) then raise exception 'Approved adult access required' using errcode='42501'; end if;
 -- Prevent server-side requests to arbitrary hosts. Expand only for reviewed vendor endpoints.
 if p_endpoint is null or p_p256dh is null or p_auth is null or length(p_endpoint)>2048 or p_endpoint!~'^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$' or p_endpoint~'[#@]' or p_p256dh!~'^[A-Za-z0-9_-]{87}$' or p_auth!~'^[A-Za-z0-9_-]{22}$' then raise exception 'Invalid push subscription' using errcode='22023'; end if;
 if not exists(select 1 from private.kickoff_delivery_config where push_enabled and length(vapid_public_key)=87) then raise exception 'Push is not configured' using errcode='55000'; end if;
 insert into private.kickoff_push_subscriptions(user_id,endpoint,p256dh,auth_secret) values(auth.uid(),p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,renewed_at=now() where private.kickoff_push_subscriptions.user_id=auth.uid() returning id into result;
 if result is null then raise exception 'This device belongs to another account; turn off push before switching accounts' using errcode='42501'; end if;
 return result;
end $$;
create function public.unregister_kickoff_push(p_endpoint text) returns void language sql security definer set search_path='' as $$delete from private.kickoff_push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint$$;

-- Service-role dispatcher only: authenticated browser clients cannot claim or inspect destinations.
create function public.configure_kickoff_delivery(p_public_key text,p_push_enabled boolean,p_email_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_push_enabled and p_public_key!~'^[A-Za-z0-9_-]{87}$' then raise exception 'Invalid VAPID public key'; end if;
 update private.kickoff_delivery_config set vapid_public_key=p_public_key,
 push_activated_at=case when not p_push_enabled then null when not push_enabled then now() else push_activated_at end,
 email_activated_at=case when not p_email_enabled then null when not email_enabled then now() else email_activated_at end,
 push_enabled=p_push_enabled,email_enabled=p_email_enabled;
end $$;
create function public.claim_kickoff_deliveries(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update private.kickoff_deliveries set status='failed',claim_token=null where status='sending' and claimed_at<now()-interval '10 minutes' and attempts>=5;
 -- Revocation/assignment checks happen at send time as well as creation time.
 update private.kickoff_deliveries d set status='cancelled',claim_token=null from private.kickoff_updates u where u.id=d.update_id and d.status in ('queued','retrying','sending') and (
 not exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=d.user_id) or exists(select 1 from private.kickoff_updates n where n.team_id=u.team_id and n.fixture_key=u.fixture_key and n.revision>u.revision) or not private.kickoff_upcoming(u.details) or not exists(select 1 from public.team_state ts cross join lateral private.kickoff_details(ts.state) current_details where ts.team_id=u.team_id and current_details.fixture_key=u.fixture_key and current_details.details=u.details));
 -- Enabling a channel never sends earlier queued updates as a backfill.
 update private.kickoff_deliveries d set status='cancelled',claim_token=null from private.kickoff_updates u,private.kickoff_delivery_config c
 where u.id=d.update_id and d.status in ('queued','retrying','sending') and
 (case when d.channel='push' then c.push_enabled and u.created_at<c.push_activated_at else c.email_enabled and u.created_at<c.email_activated_at end);
 update private.kickoff_deliveries d set status='unavailable' from auth.users a where a.id=d.user_id and d.channel='email' and d.status in ('queued','retrying') and (nullif(a.email,'') is null or a.email_confirmed_at is null);
 with candidates as (
 select d.id from private.kickoff_deliveries d cross join private.kickoff_delivery_config c
 where (d.status in ('queued','retrying') or (d.status='sending' and d.claimed_at<now()-interval '10 minutes')) and d.next_attempt_at<=now() and d.attempts<5 and
 (case when d.channel='push' then c.push_enabled and exists(select 1 from private.kickoff_push_subscriptions s where s.id=d.subscription_id and s.user_id=d.user_id and s.renewed_at>now()-interval '30 days') else c.email_enabled end)
 order by d.next_attempt_at for update of d skip locked limit greatest(1,least(p_limit,50))
 ), claimed as (update private.kickoff_deliveries d set status='sending',attempts=attempts+1,claim_token=gen_random_uuid(),claimed_at=now(),email_redeemed_at=null where d.id in(select id from candidates) returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'claim_token',d.claim_token,'channel',d.channel,'update_id',u.id,'details',u.details,'title',n.title,'body',n.body,'email',case when d.channel='email' then a.email end,'subscription',case when d.channel='push' then jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_secret)) end)),'[]'::jsonb) into result
 from claimed d join private.kickoff_updates u on u.id=d.update_id join private.kickoff_receipts r on r.update_id=d.update_id and r.user_id=d.user_id left join public.app_notifications n on n.id=r.notification_id left join auth.users a on a.id=d.user_id left join private.kickoff_push_subscriptions s on s.id=d.subscription_id;
 return result;
end $$;
create function public.validate_kickoff_delivery(p_id uuid,p_claim_token uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.kickoff_deliveries d join private.kickoff_updates u on u.id=d.update_id cross join private.kickoff_delivery_config c where d.id=p_id and d.claim_token=p_claim_token and d.status='sending' and d.claimed_at>now()-interval '10 minutes' and private.kickoff_upcoming(u.details) and (case when d.channel='push' then c.push_enabled and u.created_at>=c.push_activated_at else c.email_enabled and u.created_at>=c.email_activated_at end) and exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=d.user_id) and not exists(select 1 from private.kickoff_updates n where n.team_id=u.team_id and n.fixture_key=u.fixture_key and n.revision>u.revision) and exists(select 1 from public.team_state ts cross join lateral private.kickoff_details(ts.state) current_details where ts.team_id=u.team_id and current_details.fixture_key=u.fixture_key and current_details.details=u.details));
$$;
create function public.finish_kickoff_delivery(p_id uuid,p_claim_token uuid,p_outcome text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if p_outcome not in ('sent','retrying','failed','unavailable','expired','cancelled') then raise exception 'Invalid delivery outcome'; end if;
 update private.kickoff_deliveries set status=case when p_outcome='expired' then 'unavailable' when p_outcome='retrying' and attempts>=5 then 'failed' else p_outcome end,
 sent_at=case when p_outcome='sent' then now() else sent_at end,next_attempt_at=now()+least(3600,60*power(2,attempts)::integer)*interval '1 second',claim_token=null
 where id=p_id and claim_token=p_claim_token and status='sending' returning subscription_id into target;
 if p_outcome='expired' and target is not null then delete from private.kickoff_push_subscriptions where id=target; end if;
end $$;

-- Only a matching Vault-held dispatcher token can retrieve this feature's signing key.
create function public.kickoff_dispatch_configuration(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare expected text; keys jsonb;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
 select decrypted_secret into expected from vault.decrypted_secrets where name='kickoff_dispatch_token';
 if expected is null or sha256(convert_to(expected,'UTF8')) is distinct from sha256(convert_to(p_token,'UTF8')) then return null; end if;
 select decrypted_secret::jsonb into keys from vault.decrypted_secrets where name='kickoff_vapid_credentials';
 if keys is null and not exists(select 1 from private.kickoff_delivery_config where push_enabled or email_enabled) then return jsonb_build_object('needs_key',true); end if;
 if keys is null or keys->>'publicKey' is null or keys->>'privateKey' is null or keys->>'publicKey' !~ '^[A-Za-z0-9_-]{87}$' or keys->>'privateKey' !~ '^[A-Za-z0-9_-]{43}$' or keys->>'subject' is distinct from 'mailto:secretary@shootershillfc.com' or not exists(select 1 from private.kickoff_delivery_config where vapid_public_key=keys->>'publicKey') then raise exception 'Kick-off signing configuration unavailable'; end if;
 return keys;
end $$;

-- One-time bootstrap keeps the private key inside the trusted Edge/Vault path.
-- Replays cannot rotate an existing signing pair or alter browser subscriptions.
create function public.install_kickoff_signing(p_token text,p_credentials jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare verified jsonb;
begin
 perform 1 from private.kickoff_delivery_config for update;
 verified:=public.kickoff_dispatch_configuration(p_token);
 if verified is null then raise exception 'Dispatcher access required' using errcode='42501'; end if;
 if coalesce((verified->>'needs_key')::boolean,false)=false then return false; end if;
 if p_credentials->>'publicKey' is null or p_credentials->>'privateKey' is null or p_credentials->>'publicKey' !~ '^[A-Za-z0-9_-]{87}$' or p_credentials->>'privateKey' !~ '^[A-Za-z0-9_-]{43}$' or p_credentials->>'subject' is distinct from 'mailto:secretary@shootershillfc.com' then raise exception 'Invalid signing configuration'; end if;
 perform vault.create_secret(p_credentials::text,'kickoff_vapid_credentials','Kick-off Web Push signing pair; server runtime only');
 update private.kickoff_delivery_config set vapid_public_key=p_credentials->>'publicKey';
 return true;
end $$;

-- One-use email capability for fixed server-held recipient and content.
create function public.redeem_kickoff_email(p_id uuid,p_claim_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.kickoff_deliveries; result jsonb;
begin
 select * into job from private.kickoff_deliveries where id=p_id and claim_token=p_claim_token for update;
 if job.id is null or job.channel<>'email' or job.email_redeemed_at is not null or not public.validate_kickoff_delivery(p_id,p_claim_token) then raise exception 'Delivery unavailable' using errcode='42501'; end if;
 select jsonb_build_object('id',job.id,'update_id',u.id,'title',n.title,'body',n.body,'email',a.email) into result
 from private.kickoff_updates u join private.kickoff_receipts r on r.update_id=u.id and r.user_id=job.user_id
 join public.app_notifications n on n.id=r.notification_id join auth.users a on a.id=job.user_id
 where u.id=job.update_id and nullif(a.email,'') is not null and a.email_confirmed_at is not null;
 if result is null then raise exception 'Delivery unavailable' using errcode='42501'; end if;
 update private.kickoff_deliveries set email_redeemed_at=now() where id=job.id;
 return result;
end $$;

revoke all on function private.kickoff_audience(uuid),private.kickoff_upcoming(jsonb),private.kickoff_staff(uuid),private.kickoff_norm(text),private.kickoff_details(jsonb),private.capture_kickoff_updates() from public,anon,authenticated;
revoke all on function public.list_kickoff_updates_for_me(),public.acknowledge_kickoff_update(uuid,boolean),public.get_kickoff_push_settings(text),public.register_kickoff_push(text,text,text),public.unregister_kickoff_push(text) from public,anon;
grant execute on function public.list_kickoff_updates_for_me(),public.acknowledge_kickoff_update(uuid,boolean),public.get_kickoff_push_settings(text),public.register_kickoff_push(text,text,text),public.unregister_kickoff_push(text) to authenticated;
revoke all on function public.configure_kickoff_delivery(text,boolean,boolean),public.claim_kickoff_deliveries(integer),public.validate_kickoff_delivery(uuid,uuid),public.finish_kickoff_delivery(uuid,uuid,text),public.kickoff_dispatch_configuration(text),public.install_kickoff_signing(text,jsonb) from public,anon,authenticated;
grant execute on function public.configure_kickoff_delivery(text,boolean,boolean),public.claim_kickoff_deliveries(integer),public.validate_kickoff_delivery(uuid,uuid),public.finish_kickoff_delivery(uuid,uuid,text),public.kickoff_dispatch_configuration(text),public.install_kickoff_signing(text,jsonb) to service_role;
revoke all on function public.redeem_kickoff_email(uuid,uuid) from public,authenticated;
grant execute on function public.redeem_kickoff_email(uuid,uuid) to anon,service_role;
