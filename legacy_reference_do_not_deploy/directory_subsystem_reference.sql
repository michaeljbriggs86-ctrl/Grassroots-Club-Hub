-- Directory subsystem reference snapshot
-- Exported from live Supabase project: Shooters Hill Team Tracker
-- Date: 2026-09-18
-- ARCHIVAL ONLY - DO NOT DEPLOY AS A MIGRATION.
-- No database changes were made to produce this file.
--
-- Exact live filter used:
--   proname LIKE 'directory\_%'
--   OR proname = 'provision_club_from_fa_import'
--   OR proname LIKE 'seed_findfootball\_%'
--
-- 11 functions matched.
-- ACLs are recorded as comments only. There are NO GRANT/REVOKE statements.

-- public.directory_auto_route_failed_crawl()
-- RETURNS: trigger
-- LIVE ACL: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_auto_route_failed_crawl()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare hs integer;
begin
  if new.status='failed' and new.source_id is not null and new.adapter_key is not null and new.fallback_status is null then
    hs:=null;
    if coalesce(new.last_error,'') ~ 'HTTP [0-9]{3}' then hs:=(regexp_match(new.last_error,'HTTP ([0-9]{3})'))[1]::integer; end if;
    perform public.record_directory_adapter_failure(new.id,hs,coalesce(new.last_error,'Automated acquisition failed'),24);
  end if;
  return new;
end $function$;


-- public.directory_find_match_candidates(p_record_type text, p_name text, p_county_fa_id uuid, p_limit integer)
-- RETURNS: TABLE(entity_id uuid, canonical_name text, score real, match_basis text)
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_find_match_candidates(p_record_type text, p_name text, p_county_fa_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(entity_id uuid, canonical_name text, score real, match_basis text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare n text := public.directory_norm(p_name);
begin
  if p_record_type='club' then
    return query
      select c.id,c.canonical_name,
             similarity(c.normalized_name,n)::real,
             case when c.normalized_name=n then 'exact_name' else 'fuzzy_name' end
      from public.directory_clubs c
      where (p_county_fa_id is null or c.county_fa_id=p_county_fa_id or exists (
          select 1 from public.directory_club_county_fas x where x.club_id=c.id and x.county_fa_id=p_county_fa_id))
      order by (c.normalized_name=n) desc, similarity(c.normalized_name,n) desc
      limit greatest(1,least(coalesce(p_limit,5),20));
  elsif p_record_type='league' then
    return query
      select l.id,l.canonical_name,
             similarity(l.normalized_name,n)::real,
             case when l.normalized_name=n then 'exact_name' else 'fuzzy_name' end
      from public.directory_leagues l
      where (p_county_fa_id is null or l.county_fa_id=p_county_fa_id or exists (
          select 1 from public.directory_league_county_fas x where x.league_id=l.id and x.county_fa_id=p_county_fa_id))
      order by (l.normalized_name=n) desc, similarity(l.normalized_name,n) desc
      limit greatest(1,least(coalesce(p_limit,5),20));
  elsif p_record_type='team' then
    return query
      select t.id,t.canonical_name,
             similarity(t.normalized_name,n)::real,
             case when t.normalized_name=n then 'exact_name' else 'fuzzy_name' end
      from public.directory_teams t
      join public.directory_clubs c on c.id=t.club_id
      where (p_county_fa_id is null or c.county_fa_id=p_county_fa_id or exists (
          select 1 from public.directory_club_county_fas x where x.club_id=c.id and x.county_fa_id=p_county_fa_id))
      order by (t.normalized_name=n) desc, similarity(t.normalized_name,n) desc
      limit greatest(1,least(coalesce(p_limit,5),20));
  else
    raise exception 'Unsupported record type %',p_record_type;
  end if;
end $function$;


-- public.directory_import_stats()
-- RETURNS: jsonb
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_import_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
select jsonb_build_object(
  'counties',(select count(*) from directory_county_fas where active),
  'leagues',(select count(*) from directory_leagues where active),
  'clubs',(select count(*) from directory_clubs where active),
  'teams',(select count(*) from directory_teams where active),
  'queue_pending',(select count(*) from directory_import_queue where status='pending'),
  'queue_processing',(select count(*) from directory_import_queue where status='processing'),
  'queue_done',(select count(*) from directory_import_queue where status='done'),
  'queue_failed',(select count(*) from directory_import_queue where status='failed')
);
$function$;


-- public.directory_norm(v text)
-- RETURNS: text
-- LIVE ACL: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_norm(v text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select trim(regexp_replace(lower(extensions.unaccent(coalesce(v,''))), '[^a-z0-9]+', ' ', 'g'));
$function$;


-- public.directory_population_completion_qa_trigger()
-- RETURNS: trigger
-- LIVE ACL: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_population_completion_qa_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status='complete' and old.status is distinct from 'complete' then perform public.seed_directory_quality_checks(new.id); end if;
  return new;
end $function$;


-- public.directory_queue_browser_from_fallback()
-- RETURNS: trigger
-- LIVE ACL: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_queue_browser_from_fallback()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status='partial' and new.fallback_status='manual_required' and new.source_id is not null then
    perform public.enqueue_directory_browser_task(new.source_id,new.population_job_id,coalesce(new.fallback_reason,new.last_error,'Automated acquisition requires browser fallback'),50);
  end if;
  return new;
end $function$;


-- public.directory_select_source_adapter(p_source_id uuid)
-- RETURNS: TABLE(adapter_key text, strategy text, config jsonb)
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_select_source_adapter(p_source_id uuid)
 RETURNS TABLE(adapter_key text, strategy text, config jsonb)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select a.adapter_key,a.strategy,a.config
  from public.directory_source_registry s
  join public.directory_provider_adapters a
    on a.enabled
   and (a.provider_key=s.provider_key or a.provider_key is null)
   and (a.host_pattern is null or coalesce(s.host,'') ilike a.host_pattern)
  left join public.directory_adapter_host_health h
    on h.adapter_key=a.adapter_key and h.host=coalesce(s.host,'')
  where s.id=p_source_id
    and not (coalesce(h.status,'unknown')='blocked' and coalesce(h.blocked_until,'infinity'::timestamptz)>now())
  order by case when a.provider_key=s.provider_key then 0 else 1 end,
           case when a.host_pattern is not null then 0 else 1 end,
           case a.strategy when 'json_api' then 0 when 'direct_html' then 1 when 'managed_scraper' then 2 when 'rendered_browser' then 3 else 9 end,
           a.priority asc
  limit 1;
$function$;


-- public.directory_team_parent_candidates(p_team_name text, p_county_fa_id uuid, p_limit integer)
-- RETURNS: TABLE(club_id uuid, club_name text, score numeric, match_basis text)
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.directory_team_parent_candidates(p_team_name text, p_county_fa_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(club_id uuid, club_name text, score numeric, match_basis text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
with candidate_names as (
  select c.id club_id,c.canonical_name club_name,c.normalized_name candidate_name,'canonical'::text basis
  from public.directory_clubs c
  where c.active
    and (p_county_fa_id is null or c.county_fa_id=p_county_fa_id or exists (
      select 1 from public.directory_club_county_fas x where x.club_id=c.id and x.county_fa_id=p_county_fa_id))
  union all
  select c.id,c.canonical_name,a.normalized_alias,'alias'::text
  from public.directory_clubs c
  join public.directory_aliases a on a.entity_type='club' and a.entity_id=c.id
  where c.active and length(a.normalized_alias)>=5
    and (p_county_fa_id is null or c.county_fa_id=p_county_fa_id or exists (
      select 1 from public.directory_club_county_fas x where x.club_id=c.id and x.county_fa_id=p_county_fa_id))
), scored as (
  select cn.club_id,cn.club_name,cn.basis,cn.candidate_name,
    case
      when cn.candidate_name=public.directory_norm(p_team_name) then 1.000::numeric
      when public.directory_norm(p_team_name) like cn.candidate_name || ' %' and length(cn.candidate_name)>=5
        then least(0.995::numeric,0.980::numeric + least(length(cn.candidate_name)::numeric / greatest(length(public.directory_norm(p_team_name)),1),1)*0.015)
      when position(' '||cn.candidate_name||' ' in ' '||public.directory_norm(p_team_name)||' ')>0 and length(cn.candidate_name)>=8
        then 0.900::numeric
      else round((extensions.similarity(cn.candidate_name,public.directory_norm(p_team_name))*0.80)::numeric,4)
    end score
  from candidate_names cn
  where length(cn.candidate_name)>=5
), per_club as (
  select club_id,club_name,max(score) score,
         (array_agg(case when basis='canonical' then 'club_name' else 'club_alias' end order by score desc))[1] match_basis
  from scored
  group by club_id,club_name
)
select club_id,club_name,score,match_basis
from per_club
order by score desc,length(public.directory_norm(club_name)) desc
limit greatest(1,least(coalesce(p_limit,5),20));
$function$;


-- public.provision_club_from_fa_import(p_payload jsonb)
-- RETURNS: jsonb
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.provision_club_from_fa_import(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me public.profiles;
  v_club uuid;
  v_name text;
  v_short text;
  v_slug text;
  v_county text;
  v_county_url text;
  v_ft_id text;
  v_ft_url text;
  v_season text;
  v_primary text;
  v_secondary text;
  v_accent text;
  row jsonb;
  v_age integer;
  v_team_name text;
  v_league text;
  v_external_label text;
  v_team_id uuid;
  v_rule jsonb;
  imported_count integer:=0;
  skipped_count integer:=0;
begin
  select * into me from public.profiles where user_id=auth.uid() for update;
  if me.user_id is null then raise exception 'Sign in required'; end if;
  if me.club_id is not null or me.role not in ('pending','revoked') then raise exception 'This account is already attached to a club'; end if;

  v_name=left(trim(coalesce(p_payload->>'club_name','')),120);
  if length(v_name)<2 then raise exception 'Choose a club'; end if;
  v_short=left(trim(coalesce(p_payload->>'short_name','')),24);
  if length(v_short)<2 then v_short=left(v_name,18); end if;
  v_slug=public.slugify_club_name(v_name);
  if length(v_slug)<2 then raise exception 'Club name is not valid'; end if;
  if exists(select 1 from public.club_settings where slug=v_slug) then
    v_slug=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end if;
  v_county=left(trim(coalesce(p_payload->>'county_fa_name','')),120);
  v_county_url=left(trim(coalesce(p_payload->>'county_fa_website','')),500);
  v_ft_id=left(trim(coalesce(p_payload->>'fulltime_club_id','')),60);
  v_ft_url=left(trim(coalesce(p_payload->>'fulltime_club_url','')),500);
  v_season=left(trim(coalesce(p_payload->>'season','2026/27')),20);
  v_primary=case when coalesce(p_payload->>'primary_color','') ~ '^#[0-9A-Fa-f]{6}$' then p_payload->>'primary_color' else '#1d7a65' end;
  v_secondary=case when coalesce(p_payload->>'secondary_color','') ~ '^#[0-9A-Fa-f]{6}$' then p_payload->>'secondary_color' else '#ffffff' end;
  v_accent=case when coalesce(p_payload->>'accent_color','') ~ '^#[0-9A-Fa-f]{6}$' then p_payload->>'accent_color' else v_primary end;

  insert into public.clubs(name,selkent_club_url) values(v_name,null) returning id into v_club;
  insert into public.club_settings(club_id,slug,display_name,short_name,primary_color,secondary_color,accent_color,current_season,default_provider_key,results_publish_from_age,player_account_age_groups,config)
  values(v_club,v_slug,v_name,v_short,v_primary,v_secondary,v_accent,v_season,'fa_fulltime',12,'{}'::integer[],jsonb_build_object('sport','football','county_fa_name',v_county,'county_fa_website',v_county_url,'onboarding_source','fa_county_fulltime','rules_need_review',true));

  insert into public.competition_providers(club_id,provider_key,provider_type,display_name,enabled,is_primary,config)
  values(v_club,'fa_fulltime','fa_fulltime','FA Full-Time',true,true,jsonb_build_object('county_fa_name',v_county,'county_fa_website',v_county_url,'fulltime_club_id',v_ft_id,'fulltime_club_url',v_ft_url));

  for row in select value from jsonb_array_elements(coalesce(p_payload->'teams','[]'::jsonb)) loop
    begin v_age=(row->>'age_group')::integer; exception when others then v_age=null; end;
    v_team_name=left(trim(coalesce(row->>'team_name','')),120);
    v_external_label=left(trim(coalesce(row->>'external_name',v_team_name)),160);
    v_league=left(trim(coalesce(row->>'league_name','')),160);
    if v_age is null or v_age<7 or v_age>18 or length(v_team_name)<1 then
      skipped_count=skipped_count+1;
      continue;
    end if;
    insert into public.teams(club_id,name,age_group,division,season,selkent_label,league_name,active)
    values(v_club,v_team_name,v_age,'',v_season,coalesce(nullif(v_external_label,''),v_team_name),coalesce(nullif(v_league,''),'FA Full-Time'),true)
    returning id into v_team_id;
    imported_count=imported_count+1;
    if not exists(select 1 from public.competition_rules where club_id=v_club and age_group=v_age) then
      v_rule=public.default_rule_for_age(v_age);
      insert into public.competition_rules(club_id,provider_key,age_group,format,players_on_pitch,max_registered,matchday_max,rolling_substitutions,results_published,player_accounts_allowed,stats_config)
      values(v_club,'fa_fulltime',v_age,v_rule->>'format',(v_rule->>'players_on_pitch')::int,(v_rule->>'max_registered')::int,(v_rule->>'matchday_max')::int,(v_rule->>'rolling_substitutions')::boolean,v_age>=12,false,'{"goals":true,"assists":true,"awards":true,"discipline":true}'::jsonb);
    end if;
  end loop;

  insert into public.fa_club_imports(club_id,county_fa_name,county_fa_website,fulltime_club_id,fulltime_club_name,fulltime_club_url,raw_teams,imported_by)
  values(v_club,v_county,v_county_url,v_ft_id,v_name,v_ft_url,coalesce(p_payload->'raw_teams','[]'::jsonb),auth.uid());

  update public.profiles set club_id=v_club,team_id=null,coach_team_id=null,role='club_admin',approved_at=now(),approved_by=auth.uid(),updated_at=now() where user_id=auth.uid();

  return jsonb_build_object('club_id',v_club,'slug',v_slug,'display_name',v_name,'teams_imported',imported_count,'teams_skipped',skipped_count);
end $function$;


-- public.seed_findfootball_club(p_provider_club_id text, p_club_name text, p_county_fa_id uuid, p_priority integer)
-- RETURNS: uuid
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.seed_findfootball_club(p_provider_club_id text, p_club_name text, p_county_fa_id uuid, p_priority integer DEFAULT 100)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_club uuid;
  v_now timestamptz := now();
  v_norm text := directory_norm(coalesce(p_club_name,''));
  v_url text := 'https://find.englandfootball.com/club/'||trim(p_provider_club_id);
begin
  if coalesce(trim(p_provider_club_id),'')='' or coalesce(trim(p_club_name),'')='' then
    raise exception 'provider club id and club name are required';
  end if;

  select id into v_club from directory_clubs
   where provider_key='findfootball' and provider_club_id=trim(p_provider_club_id)
   limit 1;

  if v_club is null then
    insert into directory_clubs(
      canonical_name,normalized_name,provider_key,provider_club_id,county_fa_id,
      source_url,active,metadata,last_seen_at,updated_at
    ) values (
      trim(p_club_name),v_norm,'findfootball',trim(p_provider_club_id),p_county_fa_id,
      v_url,true,jsonb_build_object('import_source','findfootball_search_seed','team_enrichment_status','pending'),v_now,v_now
    ) returning id into v_club;
  else
    update directory_clubs set
      canonical_name=trim(p_club_name),normalized_name=v_norm,
      county_fa_id=coalesce(p_county_fa_id,county_fa_id),source_url=v_url,active=true,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('import_source','findfootball_search_seed'),
      last_seen_at=v_now,updated_at=v_now
    where id=v_club;
  end if;

  insert into directory_aliases(entity_type,entity_id,alias,normalized_alias,source)
  values('club',v_club,trim(p_club_name),v_norm,'findfootball')
  on conflict(entity_type,entity_id,normalized_alias) do update set alias=excluded.alias,source=excluded.source;

  insert into directory_club_import_queue(
    provider_key,provider_club_id,club_name,county_fa_id,source_url,priority,status,attempts,next_attempt_at,updated_at
  ) values (
    'findfootball',trim(p_provider_club_id),trim(p_club_name),p_county_fa_id,v_url,coalesce(p_priority,100),'pending',0,v_now,v_now
  ) on conflict(provider_key,provider_club_id) do update set
    club_name=excluded.club_name,
    county_fa_id=coalesce(excluded.county_fa_id,directory_club_import_queue.county_fa_id),
    source_url=excluded.source_url,
    priority=least(directory_club_import_queue.priority,excluded.priority),
    status=case when directory_club_import_queue.status in ('completed','partial') then directory_club_import_queue.status else 'pending' end,
    updated_at=v_now;

  return v_club;
end;
$function$;


-- public.seed_findfootball_clubs_batch(p_rows jsonb)
-- RETURNS: integer
-- LIVE ACL: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.seed_findfootball_clubs_batch(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  r jsonb;
  v_county uuid;
  v_count integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;
  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_county := null;
    if nullif(r->>'county_fa_id','') is not null then
      v_county := (r->>'county_fa_id')::uuid;
    elsif nullif(r->>'county_fa','') is not null then
      select id into v_county from directory_county_fas where lower(name)=lower(trim(r->>'county_fa')) limit 1;
    end if;
    perform seed_findfootball_club(
      r->>'provider_club_id',
      r->>'club_name',
      v_county,
      coalesce(nullif(r->>'priority','')::integer,100)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
