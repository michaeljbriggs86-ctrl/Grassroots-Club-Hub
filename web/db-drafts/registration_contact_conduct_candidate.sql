-- DRAFT / NOT APPLIED. Mike must explicitly name this change before live application.
-- Requires 019_member_contact_details.sql, 012 assignments, 015 capacity and player identity.
-- Narrow parent registration intake only: no payment, access approval or register finalisation.
begin;
create table private.registration_conduct_documents (
 club_id uuid references public.clubs(id), season text, document_id text not null,
 version text not null, title text not null, sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 available boolean not null default false, primary key(club_id,season)
);
create table private.registration_conduct_acceptances (
 adult_user_id uuid references public.profiles(user_id), club_id uuid references public.clubs(id),
 team_id uuid references public.teams(id), player_name text not null, season text not null,
 document_id text not null, document_version text not null, document_sha256 text not null,
 accepted_at timestamptz not null default clock_timestamp(),
 primary key(adult_user_id,team_id,player_name,season,document_id,document_version)
);
alter table private.registration_conduct_documents enable row level security;
alter table private.registration_conduct_acceptances enable row level security;
revoke all on private.registration_conduct_documents,private.registration_conduct_acceptances from public,anon,authenticated;
-- Source PDF is immutable and stored in private R2, never in the public repository or static assets.
insert into private.registration_conduct_documents values
 ('00c2b0d4-b636-44bb-b4ca-6ba43305f494','2026/27','shooters-registration-information',
 'sha256:92cf3f0cde6c6c24690a6a48f75dbbc07b2f06b989f0d5f5e689cd4f8934565e',
 'Club code of conduct · Registration information.pdf',
 '92cf3f0cde6c6c24690a6a48f75dbbc07b2f06b989f0d5f5e689cd4f8934565e',true);

create function private.registration_contact_conduct(p_team_id uuid,p_player_name text,p_season text,
 p_submit boolean default false,p_mobile text default null,p_document_version text default null,p_agree boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.profiles; t public.teams; er text; child text; doc private.registration_conduct_documents;
 mobile text:=replace(btrim(coalesce(p_mobile,'')),' ',''); evidence jsonb; own_contact text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select p.* into me from public.profiles p where p.user_id=auth.uid() for update;
 er:=private.effective_role(me);
 if me.user_id is null or me.club_id is null or er is null or er not in ('parent','club_admin') then raise exception 'Approved parent or Club Admin access required'; end if;
 select x.* into t from public.teams x where x.id=p_team_id and x.club_id=me.club_id and x.active for share;
 if t.id is null or p_season is distinct from t.season or length(coalesce(p_player_name,''))>80 then raise exception 'Registration not available for this team and season'; end if;
 -- Resolve the canonical real squad identity; no name provided by a browser creates a child.
 select i.player_name into child from private.player_season_identity i
 where i.team_id=t.id and i.club_id=t.club_id and i.season=t.season
 and i.player_status='active' and lower(btrim(i.player_name))=lower(btrim(p_player_name));
 if child is null then
  select p->>'name' into child from public.team_state st cross join lateral jsonb_array_elements(coalesce(st.state->'squad','[]'::jsonb)) p
  where st.team_id=t.id and lower(btrim(p->>'name'))=lower(btrim(p_player_name)) and coalesce(p->>'status','active')='active';
 end if;
 if child is null then raise exception 'Player not available'; end if;
 if er='parent' and not exists(select 1 from public.parent_player_links l where l.parent_user_id=me.user_id and l.club_id=me.club_id and l.team_id=t.id and lower(btrim(l.player_name))=lower(btrim(child))) then raise exception 'Own linked child required'; end if;
 select d.* into doc from private.registration_conduct_documents d where d.club_id=t.club_id and d.season=t.season for share;
 if p_submit then
  if er<>'parent' then raise exception 'Only the linked parent can accept'; end if;
  if mobile !~ '^(\+[1-9][0-9]{6,14}|0[0-9]{9,10})$' then raise exception 'Enter a valid mobile number'; end if;
  if doc.club_id is null or not doc.available then raise exception 'Code of conduct is unavailable'; end if;
  if p_agree is distinct from true or p_document_version is distinct from doc.version then raise exception 'Agree to the current code of conduct'; end if;
  insert into private.member_contact_details(user_id,phone,updated_by) values(me.user_id,mobile,me.user_id)
  on conflict(user_id) do update set phone=excluded.phone,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
  insert into private.registration_conduct_acceptances(adult_user_id,club_id,team_id,player_name,season,document_id,document_version,document_sha256)
  values(me.user_id,me.club_id,t.id,child,t.season,doc.document_id,doc.version,doc.sha256)
  on conflict do nothing; -- network retries preserve the first authenticated acceptance timestamp.
 end if;
 select phone into own_contact from private.member_contact_details where user_id=me.user_id;
 select coalesce(jsonb_agg(jsonb_build_object('adult_name',p.full_name,'adult_user_id',a.adult_user_id,
  'mobile',coalesce(c.phone,''),'accepted_at',a.accepted_at,'document_id',a.document_id,
  'document_version',a.document_version,'document_sha256',a.document_sha256) order by a.accepted_at),'[]'::jsonb) into evidence
 from private.registration_conduct_acceptances a join public.profiles p on p.user_id=a.adult_user_id
 left join private.member_contact_details c on c.user_id=a.adult_user_id
 where a.club_id=me.club_id and a.team_id=t.id and a.player_name=child and a.season=t.season
 and (er='club_admin' or a.adult_user_id=me.user_id);
 return jsonb_build_object('ok',true,'submitted',p_submit,'can_submit',er='parent','player_name',child,
 'team_id',t.id,'team_name',t.name,'age_group',t.age_group,'season',t.season,
 'mobile',case when er='parent' then coalesce(own_contact,'') else '' end,'evidence',evidence,
 'document',jsonb_build_object('available',coalesce(doc.available,false),'id',doc.document_id,
 'version',doc.version,'sha256',doc.sha256,'title',doc.title));
end $$;
create function public.get_registration_contact_conduct(p_team_id uuid,p_player_name text,p_season text)
returns jsonb language sql security invoker set search_path=''
begin atomic select private.registration_contact_conduct(p_team_id,p_player_name,p_season); end;
create function public.submit_registration_contact_conduct(p_team_id uuid,p_player_name text,p_season text,p_mobile text,p_document_version text,p_agree boolean)
returns jsonb language sql security invoker set search_path=''
begin atomic select private.registration_contact_conduct(p_team_id,p_player_name,p_season,true,p_mobile,p_document_version,p_agree); end;
revoke all on function private.registration_contact_conduct(uuid,text,text,boolean,text,text,boolean),
 public.get_registration_contact_conduct(uuid,text,text),public.submit_registration_contact_conduct(uuid,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function private.registration_contact_conduct(uuid,text,text,boolean,text,text,boolean),
 public.get_registration_contact_conduct(uuid,text,text),public.submit_registration_contact_conduct(uuid,text,text,text,text,boolean) to authenticated;
commit;
