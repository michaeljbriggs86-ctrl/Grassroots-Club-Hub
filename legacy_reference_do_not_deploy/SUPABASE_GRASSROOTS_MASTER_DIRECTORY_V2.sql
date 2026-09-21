-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

create unique index if not exists directory_clubs_provider_uidx
  on public.directory_clubs(provider_key, provider_club_id)
  where provider_club_id is not null and provider_club_id <> '';

create unique index if not exists directory_leagues_provider_uidx
  on public.directory_leagues(provider_key, provider_league_id)
  where provider_league_id is not null and provider_league_id <> '';

create unique index if not exists directory_leagues_name_provider_uidx
  on public.directory_leagues(provider_key, normalized_name);

create unique index if not exists directory_teams_provider_uidx
  on public.directory_teams(provider_key, provider_team_id)
  where provider_team_id is not null and provider_team_id <> '';

create index if not exists directory_clubs_postcode_idx on public.directory_clubs(postcode);
create index if not exists directory_aliases_alias_trgm_idx on public.directory_aliases using gin(normalized_alias extensions.gin_trgm_ops);

alter table public.teams add column if not exists provider_key text;
alter table public.teams add column if not exists provider_team_id text;
alter table public.teams add column if not exists provider_source_url text;
alter table public.teams add column if not exists directory_team_id uuid references public.directory_teams(id) on delete set null;

-- Canonical County FA layer. These are neutral directory records; individual clubs are added by the compiler/search cache.
insert into public.directory_county_fas(name,website,source_url,active,metadata,last_verified_at)
values
('Amateur Football Alliance','https://www.amateur-fa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Army FA','https://www.armyfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Bedfordshire FA','https://www.bedfordshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Berks & Bucks FA','https://www.berks-bucksfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Birmingham FA','https://www.birminghamfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Cambridgeshire FA','https://www.cambridgeshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Cheshire FA','https://www.cheshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Cornwall FA','https://www.cornwallfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Cumberland FA','https://www.cumberlandfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Derbyshire FA','https://www.derbyshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Devon FA','https://www.devonfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Dorset FA','https://www.dorsetfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Durham FA','https://www.durhamfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('East Riding FA','https://www.eastridingfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Essex FA','https://www.essexfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Gloucestershire FA','https://www.gloucestershirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Guernsey FA','https://www.guernseyfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Hampshire FA','https://www.hampshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Herefordshire FA','https://www.herefordshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Hertfordshire FA','https://www.hertfordshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Huntingdonshire FA','https://www.huntsfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Isle of Man FA','https://www.isleofmanfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Jersey FA','https://www.jerseyfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Kent FA','https://www.kentfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Lancashire FA','https://www.lancashirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Leicestershire & Rutland FA','https://www.leicestershirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Lincolnshire FA','https://www.lincolnshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Liverpool FA','https://www.liverpoolfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('London FA','https://www.londonfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Manchester FA','https://www.manchesterfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Middlesex FA','https://www.middlesexfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Norfolk FA','https://www.norfolkfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Northamptonshire FA','https://www.northantsfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('North Riding FA','https://www.northridingfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Northumberland FA','https://www.northumberlandfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Nottinghamshire FA','https://www.nottinghamshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Oxfordshire FA','https://www.oxfordshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('RAF FA','https://www.royalairforcefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Royal Navy FA','https://www.royalnavyfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Sheffield & Hallamshire FA','https://www.sheffieldfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Shropshire FA','https://www.shropshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Somerset FA','https://www.somersetfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Staffordshire FA','https://www.staffordshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Suffolk FA','https://www.suffolkfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Surrey FA','https://www.surreyfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Sussex FA','https://www.sussexfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Westmorland FA','https://www.westmorlandfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('West Riding FA','https://www.westridingfa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Wiltshire FA','https://www.wiltshirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now()),
('Worcestershire FA','https://www.worcestershirefa.com','https://www.thefa.com/about-football-association/who-we-are/county-fas',true,'{}',now())
on conflict(name) do update set website=excluded.website,source_url=excluded.source_url,active=true,last_verified_at=now(),updated_at=now();

drop function if exists public.search_directory_clubs(text,text,integer);

create function public.search_directory_clubs(p_query text, p_county_fa text default null, p_limit integer default 30)
returns table(club_id uuid, club_name text, county_fa text, website text, source_url text, provider_key text, provider_club_id text, postcode text, team_count bigint, rank real)
language sql stable security definer set search_path='public','extensions' as $$
  with q as (select directory_norm(p_query) nq, directory_norm(p_county_fa) nc),
  alias_score as (
    select a.entity_id,max(greatest(similarity(a.normalized_alias,(select nq from q)),case when a.normalized_alias like '%'||(select nq from q)||'%' then .99 else 0 end)) r
    from directory_aliases a where a.entity_type='club' and ((select nq from q)='' or a.normalized_alias % (select nq from q) or a.normalized_alias like '%'||(select nq from q)||'%') group by a.entity_id
  ), base as (
    select c.id,c.canonical_name,cf.name county_name,c.website,c.source_url,c.provider_key,c.provider_club_id,c.postcode,
           count(t.id) team_count,
           greatest(similarity(c.normalized_name,(select nq from q)),coalesce(a.r,0),case when c.normalized_name like '%'||(select nq from q)||'%' then .98 else 0 end,case when directory_norm(c.postcode) like (select nq from q)||'%' then .95 else 0 end) r
    from directory_clubs c left join directory_county_fas cf on cf.id=c.county_fa_id left join directory_teams t on t.club_id=c.id and t.active left join alias_score a on a.entity_id=c.id
    where c.active and ((select nq from q)='' or c.normalized_name % (select nq from q) or c.normalized_name like '%'||(select nq from q)||'%' or coalesce(a.r,0)>.25 or directory_norm(c.postcode) like (select nq from q)||'%')
      and ((select nc from q)='' or directory_norm(cf.name) like '%'||(select nc from q)||'%')
    group by c.id,c.canonical_name,cf.name,c.website,c.source_url,c.provider_key,c.provider_club_id,c.postcode,c.normalized_name,a.r
  )
  select id,canonical_name,county_name,website,source_url,provider_key,provider_club_id,postcode,team_count,r::real from base order by r desc,canonical_name limit greatest(1,least(coalesce(p_limit,30),100));
$$;

grant execute on function public.search_directory_clubs(text,text,integer) to anon, authenticated;
grant execute on function public.get_directory_club(uuid) to anon, authenticated;
