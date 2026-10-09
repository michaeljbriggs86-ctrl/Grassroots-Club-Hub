-- Throwaway local Postgres only. Minimal stand-ins for the tables claim_invite touches.
-- NOT the real schema, RLS or auth. Do not run against Supabase.
create schema if not exists extensions; create extension if not exists pgcrypto schema extensions;
create schema if not exists auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
create table public.teams(id uuid primary key, club_id uuid, age_group int);
create table public.profiles(user_id uuid primary key, club_id uuid, team_id uuid, coach_team_id uuid, role text,
  access_method text, approved_at timestamptz, approved_by uuid, updated_at timestamptz);
create table public.invitations(id uuid primary key default gen_random_uuid(), code_hash bytea, role text, used_at timestamptz,
  used_by uuid, expires_at timestamptz, created_at timestamptz default now(), invited_email text, club_id uuid, team_id uuid, created_by uuid);
