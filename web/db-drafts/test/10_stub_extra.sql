create table public.clubs(id uuid primary key);
alter table public.teams add column name text, add column active boolean default true;
alter table public.profiles add column full_name text;
create table public.app_notifications(id uuid primary key default gen_random_uuid(), club_id uuid, team_id uuid, recipient_user_id uuid, type text, title text, body text, entity_key text, created_at timestamptz default now(), read_at timestamptz);
create unique index on public.app_notifications(recipient_user_id,type,entity_key) where entity_key is not null;
create role authenticated nologin; create role anon nologin;
