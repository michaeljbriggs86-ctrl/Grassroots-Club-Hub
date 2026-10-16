-- CANDIDATE ONLY. Requires explicit named live approval before application.
-- Figma review passed: NY8QhcuOWiEcD0pKDTsbP8, node 370:6986, 15 October.
-- The 23:33 reviewed refinement marks only the actor's notice read with an
-- explicit response. Merely opening/marking read never implies a response.
-- Attendance remains authoritative in public.match_availability. The new private
-- records bind an explicit own-child response to an exact release and row version.
-- Read-only catalog hashes checked against the actual deployed predecessors.
do $$
declare expected record; actual text;
begin
 for expected in select * from (values
  ('public.stamp_match_availability_response()','c93f78f928a3e60fb70a3981f31b294fd2c97a26fbbd6343ab54f9d2cec8ddb4'),
  ('public.list_kickoff_updates_for_me()','e12d83d4d673c08d57eecea5c118915a33ddc39d1b60f7c4fb9659166a7c09a5'),
  ('public.acknowledge_kickoff_update(uuid,boolean)','0017e9a18d652cc3cb5e329bb5122e4557f08550779cf3a7ded6e143a9a421ec')
 ) baseline(signature,fingerprint) loop
  select encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(expected.signature)),'UTF8')),'hex') into actual;
  if actual is distinct from expected.fingerprint then raise exception 'Kick-off response predecessor drift: %',expected.signature; end if;
 end loop;
end $$;
alter table private.kickoff_receipts add column coach_acknowledged_at timestamptz;
create table private.kickoff_parent_response_links (
 update_id uuid not null, user_id uuid not null,
 parent_link_id uuid not null references public.parent_player_links(id) on delete cascade,
 availability_id uuid not null references public.match_availability(id) on delete cascade,
 availability_updated_at timestamptz not null, responded_at timestamptz not null default now(),
 primary key(update_id,user_id,parent_link_id),
 foreign key(update_id,user_id) references private.kickoff_receipts(update_id,user_id) on delete cascade
);
create index kickoff_parent_response_availability on private.kickoff_parent_response_links(availability_id);
alter table private.kickoff_parent_response_links enable row level security;
revoke all on private.kickoff_parent_response_links from public,anon,authenticated;

-- Match fixtureResponseKey/miniCupGroup and its dated/opt-in undated read fallbacks.
-- A neutral venue does not alter a group key. The age source deliberately matches
-- the app, including its word-boundary handling; do not use the old X-age helper.
create function private.kickoff_response_keys(p_state jsonb,p_fixture_key text) returns text[]
language plpgsql immutable set search_path='' as $$
declare source text; age integer; fixture jsonb; row jsonb; rows jsonb[]; selected jsonb[];
 competition text; day text; dated text; result text[]; opponents integer;
begin
 source:=coalesce(p_state#>>'{meta,ageGroup}','')||' '||coalesce(p_state#>>'{division,name}','');
 age:=coalesce(substring(source from '(?i)(?:\mU\s*|\mUnder\s*)([0-9]{1,2})\M')::integer,0);
 select f into fixture from jsonb_array_elements(case when jsonb_typeof(p_state#>'{selkent,fixtures}')='array' then p_state#>'{selkent,fixtures}' else '[]'::jsonb end) f
 where (f->>'date')||'|'||private.kickoff_norm(coalesce(nullif(f->>'opponent',''),'tbc'))||'|'||upper(coalesce(f->>'venue',''))||'|'||private.kickoff_norm(coalesce(nullif(f->>'competition',''),'fixture'))=p_fixture_key limit 1;
 result:=array[p_fixture_key];
 if fixture is not null and age between 8 and 11 and coalesce(fixture->>'competition','')~*'\m(cup|vase)\M' then
  competition:=private.kickoff_norm(fixture->>'competition');day:=fixture->>'date';
  select array_agg(f),count(distinct private.kickoff_norm(f->>'opponent')) into rows,opponents
  from jsonb_array_elements(p_state#>'{selkent,fixtures}') f where f->>'date'=day and private.kickoff_norm(f->>'competition')=competition and coalesce(f->>'opponent','')<>'';
  if opponents=2 then
   select array_agg(f order by opponent,sortkey) into selected from (
    select distinct on(opponent) f,opponent,sortkey from (
     select f,private.kickoff_norm(f->>'opponent') opponent,
     private.kickoff_norm(f->>'opponent')||'|'||coalesce(f->>'venue','')||'|'||coalesce((select string_agg(v #>> '{}',',' order by ord) from jsonb_array_elements(case when jsonb_typeof(f->'providerTeamIds')='array' then f->'providerTeamIds' else '[]'::jsonb end) with ordinality x(v,ord)),'') sortkey
     from unnest(rows) f
    ) sorted order by opponent,sortkey collate "C"
   ) picked;
   result:=array[day||'|cup-group|'||competition];
   foreach row in array selected loop
    dated:=(row->>'date')||'|'||private.kickoff_norm(coalesce(nullif(row->>'opponent',''),'tbc'))||'|'||upper(coalesce(row->>'venue',''))||'|'||private.kickoff_norm(coalesce(nullif(row->>'competition',''),'fixture'));
    result:=array_append(result,dated);
   end loop;
  end if;
 end if;
 -- Only explicitly opted-in legacy undated keys are read by the app.
 foreach dated in array result loop
  if array_length(string_to_array(dated,'|'),1)=4 and p_state#>>'{selkent,legacyResponseFixtureKey}'=dated then result:=array_append(result,substring(dated from 12)); end if;
 end loop;
 return result;
end $$;

create function private.kickoff_effective_availability(p_team uuid,p_state jsonb,p_fixture_key text,p_player text)
returns public.match_availability language sql stable security definer set search_path='' as $$
 select a from public.match_availability a where a.team_id=p_team
 and a.fixture_key=any(private.kickoff_response_keys(p_state,p_fixture_key))
 and private.kickoff_norm(a.player_name)=private.kickoff_norm(p_player)
 order by a.updated_at desc,array_position(private.kickoff_response_keys(p_state,p_fixture_key),a.fixture_key),a.id limit 1;
$$;

create function private.kickoff_response_current(p_update uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.kickoff_updates u join public.teams t on t.id=u.team_id and t.club_id=u.club_id and t.active
 join public.team_state ts on ts.team_id=u.team_id
 where u.id=p_update and u.club_id='00c2b0d4-b636-44bb-b4ca-6ba43305f494'
 and not exists(select 1 from private.kickoff_updates n where n.team_id=u.team_id and n.fixture_key=u.fixture_key and n.revision>u.revision)
 and exists(select 1 from private.kickoff_details(ts.state) d where d.fixture_key=u.fixture_key and d.details=u.details));
$$;
create function private.lock_current_kickoff_response(p_update uuid) returns private.kickoff_updates
language plpgsql security definer set search_path='' as $$
declare u private.kickoff_updates;
begin
 select * into u from private.kickoff_updates where id=p_update;
 if u.id is null then raise exception 'Update unavailable' using errcode='42501'; end if;
 perform 1 from public.team_state where team_id=u.team_id for update;
 if not private.kickoff_response_current(u.id) then raise exception 'KICKOFF_DETAILS_CHANGED' using errcode='40001'; end if;
 return u;
end $$;

create function private.kickoff_response_children(p_update uuid,p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u private.kickoff_updates; st jsonb; link record; a public.match_availability;
 evidence private.kickoff_parent_response_links; current_response boolean; result jsonb:='[]'::jsonb;
begin
 select * into u from private.kickoff_updates where id=p_update;
 select state into st from public.team_state where team_id=u.team_id;
 for link in select l.* from public.parent_player_links l where l.parent_user_id=p_user and l.team_id=u.team_id and l.club_id=u.club_id order by l.player_name,l.id loop
  a:=private.kickoff_effective_availability(u.team_id,st,u.fixture_key,link.player_name);
  select * into evidence from private.kickoff_parent_response_links e where e.update_id=p_update and e.user_id=p_user and e.parent_link_id=link.id;
  current_response:=coalesce(evidence.availability_id=a.id and evidence.availability_updated_at=a.updated_at and a.status in('available','unavailable'),false);
  result:=result||jsonb_build_array(jsonb_build_object('parent_link_id',link.id,'player_name',link.player_name,'status',a.status,'response_source',a.response_source,
   'availability_updated_at',a.updated_at,'responded_at',evidence.responded_at,'response_current',current_response,
   'response_state',case when current_response then 'current' when evidence.update_id is not null then 'changed' else 'none' end));
 end loop;
 return result;
end $$;

create function private.kickoff_parent_response_totals(p_update uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with children as (
  select c from private.kickoff_receipts r join private.kickoff_updates u on u.id=r.update_id
  join private.kickoff_audience(u.team_id) a on a.user_id=r.user_id and a.parent
  cross join lateral jsonb_array_elements(private.kickoff_response_children(u.id,r.user_id)) c
  where r.update_id=p_update and r.parent
 ), players as (
  select c->>'player_name' player,
  bool_or((c->>'response_current')::boolean and c->>'status'='available') available,
  bool_or((c->>'response_current')::boolean and c->>'status'='unavailable') unavailable,
  bool_or(c->>'response_state'='changed') changed
  from children group by c->>'player_name'
 ) select jsonb_build_object('total',count(*),'available',count(*) filter(where available),'unavailable',count(*) filter(where unavailable),
 'changed',count(*) filter(where not available and not unavailable and changed),'pending',count(*) filter(where not available and not unavailable and not changed)) from players;
$$;

create function private.kickoff_response_payload(p_update uuid,p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u private.kickoff_updates; r private.kickoff_receipts; n public.app_notifications; me public.profiles;
 children jsonb:='[]'::jsonb; staff boolean; parent boolean; parent_state text; fresh integer; changed integer;
begin
 select * into u from private.kickoff_updates where id=p_update;
 select * into r from private.kickoff_receipts where update_id=p_update and user_id=p_user;
 if r.update_id is null or not private.kickoff_response_current(p_update) or not exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=p_user) then return null; end if;
 select * into n from public.app_notifications where id=r.notification_id;
 if n.id is null then return null; end if;
 select * into me from public.profiles where user_id=p_user;
 staff:=coalesce(private.effective_role(me) in('coach','assistant_coach','club_admin') and r.coach and exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=p_user and a.coach),false);
 parent:=coalesce(private.effective_role(me)='parent' and r.parent and exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=p_user and a.parent),false);
 if parent then children:=private.kickoff_response_children(p_update,p_user); end if;
 select count(*) filter(where (c->>'response_current')::boolean),count(*) filter(where c->>'response_state'='changed') into fresh,changed from jsonb_array_elements(children) c;
 parent_state:=case when jsonb_array_length(children)>0 and fresh=jsonb_array_length(children) then 'complete' when fresh>0 then 'partial' when changed>0 then 'changed' else 'none' end;
 return jsonb_build_object('id',n.id,'type','kickoff_update','title',n.title,'body',n.body,'entity_key',n.entity_key,'team_id',u.team_id,'team_name',(select name from public.teams where id=u.team_id),
 'created_at',u.created_at,'read_at',n.read_at,'update_id',u.id,'fixture_key',u.fixture_key,'revision',u.revision,'details',u.details,'previous_details',u.previous_details,'seen_at',case when parent then r.seen_at else null end,
 'can_acknowledge_as_coach',staff,'coach_acknowledged_at',case when staff then r.coach_acknowledged_at else null end,'can_respond_as_parent',parent,'children',children,'parent_response_state',parent_state,
 'confirmation_totals',case when private.kickoff_staff(u.team_id) then (select jsonb_build_object('coaches',count(*) filter(where a.coach),'coaches_seen',count(*) filter(where a.coach and rr.coach_acknowledged_at is not null),'parents',count(*) filter(where a.parent),'parents_seen',count(*) filter(where a.parent and jsonb_array_length(private.kickoff_response_children(u.id,rr.user_id))>0 and not exists(select 1 from jsonb_array_elements(private.kickoff_response_children(u.id,rr.user_id)) c where not(c->>'response_current')::boolean))) from private.kickoff_receipts rr join private.kickoff_audience(u.team_id) a on a.user_id=rr.user_id where rr.update_id=u.id) else null end,
 'delivery_totals',case when private.kickoff_staff(u.team_id) then (select coalesce(jsonb_object_agg(s.label,s.n),'{}'::jsonb) from (select case when not(case when q.channel='push' then cfg.push_enabled else cfg.email_enabled end) and q.status in('queued','retrying') then 'unavailable' else q.status end label,count(*) n from private.kickoff_deliveries q cross join private.kickoff_delivery_config cfg where q.update_id=u.id group by 1) s) else null end);
end $$;

create or replace function public.list_kickoff_updates_for_me() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(payload order by created_at desc),'[]'::jsonb) from (
 select private.kickoff_response_payload(u.id,auth.uid()) payload,u.created_at
 from private.kickoff_receipts r join private.kickoff_updates u on u.id=r.update_id
 where r.user_id=auth.uid() and u.created_at>now()-interval '180 days'
 ) listed where payload is not null;
$$;

create function public.acknowledge_kickoff_as_coach(p_update_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles; u private.kickoff_updates; stamp timestamptz; read_stamp timestamptz;
begin
 select * into me from public.profiles where user_id=auth.uid() for share;
 if me.user_id is null or private.effective_role(me) not in('coach','assistant_coach','club_admin') then raise exception 'Coaching capacity required' using errcode='42501'; end if;
 u:=private.lock_current_kickoff_response(p_update_id);
 if me.club_id<>u.club_id or not exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=auth.uid() and a.coach) then raise exception 'Team access required' using errcode='42501'; end if;
 update private.kickoff_receipts set coach_acknowledged_at=coalesce(coach_acknowledged_at,now()) where update_id=u.id and user_id=auth.uid() and coach returning coach_acknowledged_at into stamp;
 if stamp is null then raise exception 'This update is not addressed to you' using errcode='42501'; end if;
 update public.app_notifications set read_at=coalesce(read_at,now()) where id=(select notification_id from private.kickoff_receipts where update_id=u.id and user_id=auth.uid()) and recipient_user_id=auth.uid() returning read_at into read_stamp;
 if read_stamp is null then raise exception 'Update unavailable' using errcode='42501'; end if;
 return jsonb_build_object('update_id',u.id,'revision',u.revision,'coach_acknowledged_at',stamp,'read_at',read_stamp);
end $$;

-- The old checkbox endpoint is staff-only compatibility. Historical seen_at is
-- never migrated into staff acknowledgement because its acting capacity is unknown.
create or replace function public.acknowledge_kickoff_update(p_update_id uuid,p_confirm_seen boolean) returns timestamptz
language plpgsql security definer set search_path='' as $$
begin
 if p_confirm_seen is distinct from true then raise exception 'Confirm the current details first' using errcode='22023'; end if;
 return (public.acknowledge_kickoff_as_coach(p_update_id)->>'coach_acknowledged_at')::timestamptz;
end $$;

-- Existing own-child availability writes must keep parent provenance in Parent
-- capacity even when the same adult also coaches. All other stamp behavior stays.
create or replace function public.stamp_match_availability_response() returns trigger
language plpgsql set search_path='' as $$
begin
 new.parent_user_id:=auth.uid();
 new.response_source:=case when public.my_role() in('coach','assistant_coach','club_admin') and public.can_edit_team(new.team_id) then 'coach'
                           when public.my_role()='player' then 'player' else 'parent' end;
 new.updated_at:=now();
 return new;
end $$;

create function public.respond_kickoff_parent_availability(p_update_id uuid,p_parent_link_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.profiles; u private.kickoff_updates; link public.parent_player_links;
 st jsonb; keys text[]; existing public.match_availability; effective public.match_availability; saved public.match_availability; read_stamp timestamptz;
begin
 if p_status is null or p_status not in('available','unavailable') then raise exception 'Choose Attending or Unavailable' using errcode='22023'; end if;
 select * into me from public.profiles where user_id=auth.uid() for share;
 if me.user_id is null or private.effective_role(me)<>'parent' then raise exception 'Parent capacity required' using errcode='42501'; end if;
 u:=private.lock_current_kickoff_response(p_update_id);
 if me.club_id<>u.club_id or not exists(select 1 from private.kickoff_audience(u.team_id) a where a.user_id=auth.uid() and a.parent) or not exists(select 1 from private.kickoff_receipts r where r.update_id=u.id and r.user_id=auth.uid() and r.parent) then raise exception 'Team access required' using errcode='42501'; end if;
 select * into link from public.parent_player_links l where l.id=p_parent_link_id and l.parent_user_id=auth.uid() and l.team_id=u.team_id and l.club_id=u.club_id for share;
 if link.id is null then raise exception 'This child is not linked to your account' using errcode='42501'; end if;
 select state into st from public.team_state where team_id=u.team_id;
 keys:=private.kickoff_response_keys(st,u.fixture_key);
 select * into existing from public.match_availability a where a.team_id=u.team_id and a.fixture_key=keys[1] and a.player_name=link.player_name for update;
 effective:=private.kickoff_effective_availability(u.team_id,st,u.fixture_key,link.player_name);
 if existing.id is not null and existing.id=effective.id and existing.status=p_status and existing.response_source='parent' then saved:=existing;
 else
  insert into public.match_availability(team_id,fixture_key,parent_user_id,player_name,status) values(u.team_id,keys[1],auth.uid(),link.player_name,p_status)
  on conflict(team_id,fixture_key,player_name) do update set status=excluded.status,parent_user_id=excluded.parent_user_id where public.match_availability.team_id=u.team_id returning * into saved;
 end if;
 insert into private.kickoff_parent_response_links(update_id,user_id,parent_link_id,availability_id,availability_updated_at) values(u.id,auth.uid(),link.id,saved.id,saved.updated_at)
 on conflict(update_id,user_id,parent_link_id) do update set availability_id=excluded.availability_id,availability_updated_at=excluded.availability_updated_at,responded_at=case when private.kickoff_parent_response_links.availability_id=excluded.availability_id and private.kickoff_parent_response_links.availability_updated_at=excluded.availability_updated_at then private.kickoff_parent_response_links.responded_at else now() end where private.kickoff_parent_response_links.update_id=u.id;
 update private.kickoff_receipts set seen_at=coalesce(seen_at,now()) where update_id=u.id and user_id=auth.uid();
 update public.app_notifications set read_at=coalesce(read_at,now()) where id=(select notification_id from private.kickoff_receipts where update_id=u.id and user_id=auth.uid()) and recipient_user_id=auth.uid() returning read_at into read_stamp;
 if read_stamp is null then raise exception 'Update unavailable' using errcode='42501'; end if;
 return private.kickoff_response_payload(u.id,auth.uid());
end $$;

create function public.list_kickoff_updates_for_admin(p_team_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.profiles; result jsonb;
begin
 select * into me from public.profiles where user_id=auth.uid();
 if me.user_id is null or me.role<>'club_admin' or me.acting_as_parent or me.club_id<>'00c2b0d4-b636-44bb-b4ca-6ba43305f494'
 or not exists(select 1 from auth.users a where a.id=auth.uid() and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false) and (a.banned_until is null or a.banned_until<now())) then raise exception 'Club Admin access required' using errcode='42501'; end if;
 if p_team_id is not null and not exists(select 1 from public.teams t where t.id=p_team_id and t.club_id=me.club_id and t.active) then raise exception 'Team access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('update_id',u.id,'team_id',u.team_id,'team_name',t.name,'fixture_key',u.fixture_key,'revision',u.revision,'details',u.details,'created_at',u.created_at,
 'coaches',(select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',coalesce(nullif(p.full_name,''),'Coach'),'acknowledged_at',r.coach_acknowledged_at,'revision_current',r.coach_acknowledged_at is not null) order by p.full_name,a.user_id),'[]'::jsonb)
 from private.kickoff_audience(u.team_id) a join public.profiles p on p.user_id=a.user_id join private.kickoff_receipts r on r.update_id=u.id and r.user_id=a.user_id and r.coach where a.coach),
 'parents',private.kickoff_parent_response_totals(u.id)) order by u.created_at desc),'[]'::jsonb) into result
 from (select * from private.kickoff_updates k where k.club_id=me.club_id and (p_team_id is null or k.team_id=p_team_id) and k.created_at>now()-interval '180 days' and private.kickoff_response_current(k.id) and private.kickoff_upcoming(k.details) order by k.created_at desc limit 100) u join public.teams t on t.id=u.team_id;
 return result;
end $$;

revoke all on function private.kickoff_response_keys(jsonb,text),private.kickoff_effective_availability(uuid,jsonb,text,text),private.kickoff_response_current(uuid),private.lock_current_kickoff_response(uuid),private.kickoff_response_children(uuid,uuid),private.kickoff_parent_response_totals(uuid),private.kickoff_response_payload(uuid,uuid) from public,anon,authenticated;
revoke all on function public.acknowledge_kickoff_as_coach(uuid),public.respond_kickoff_parent_availability(uuid,uuid,text),public.list_kickoff_updates_for_admin(uuid) from public,anon;
grant execute on function public.acknowledge_kickoff_as_coach(uuid),public.respond_kickoff_parent_availability(uuid,uuid,text),public.list_kickoff_updates_for_admin(uuid) to authenticated;
