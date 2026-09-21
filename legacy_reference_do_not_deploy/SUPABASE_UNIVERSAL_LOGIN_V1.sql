-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

create or replace function public.list_login_clubs()
returns jsonb
language sql
stable
security definer
set search_path='public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug',cs.slug,
    'display_name',cs.display_name,
    'short_name',cs.short_name,
    'primary_color',cs.primary_color,
    'secondary_color',cs.secondary_color,
    'is_demo',cs.is_demo
  ) order by cs.display_name),'[]'::jsonb)
  from public.club_settings cs
  where cs.active=true;
$$;

grant execute on function public.list_login_clubs() to anon, authenticated;

create or replace function public.list_login_teams(p_club_slug text)
returns jsonb
language sql
stable
security definer
set search_path='public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'age_group',t.age_group,
    'label',concat('U',t.age_group,' ',t.name)
  ) order by t.age_group,t.name),'[]'::jsonb)
  from public.teams t
  join public.club_settings cs on cs.club_id=t.club_id
  where cs.slug=lower(trim(p_club_slug)) and cs.active=true and t.active=true;
$$;

grant execute on function public.list_login_teams(text) to anon, authenticated;
