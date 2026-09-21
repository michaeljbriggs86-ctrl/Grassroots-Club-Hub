-- AI COLLABORATION PROTOCOL NOTE — 2026-09-19
-- STATUS: WRITTEN historical reference only; DO NOT DEPLOY.
-- Any older 'live'/'deployed' wording below is a historical note and is not a current deployment claim.

-- Grassroots Club Hub v2.0.22 backend reference
-- The LIVE Supabase project has already been upgraded. This file is retained
-- with the Android source as documentation and should not be re-run blindly.
--
-- v2.0.21 backend changes:
--   * profiles.role accepts assistant_coach
--   * invitations.role accepts assistant_coach
--   * assistant_coach has the same own-team read/edit/access-management rights as coach
--   * list_club_coaches() returns coach + assistant_coach and includes the role column
--   * Inbox is available to club_admin, coach, assistant_coach and parent
--   * club_admin may message any active same-club admin/coach/assistant_coach/parent
--   * coach / assistant_coach may message Club Admin and parents on their own team
--   * parent may message Club Admin and coach / assistant_coach on their own team
--   * group messages are private per-recipient inserts, not shared group threads
--   * recipients may update only club_messages.read_at
--
-- Core messaging authorization now used on the live project:

create or replace function private.can_message_user(p_recipient uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles me
    join public.profiles target on target.user_id = p_recipient
    where me.user_id = auth.uid()
      and me.club_id is not null
      and target.club_id = me.club_id
      and target.user_id <> me.user_id
      and target.role in ('club_admin','coach','assistant_coach','parent')
      and (
        me.role = 'club_admin'
        or (me.role in ('coach','assistant_coach') and (
              target.role='club_admin'
              or (target.role='parent' and target.team_id=me.team_id)
            ))
        or (me.role='parent' and (
              target.role='club_admin'
              or (target.role in ('coach','assistant_coach') and target.team_id=me.team_id)
            ))
      )
  );
$$;

create or replace function public.list_message_contacts()
returns table(user_id uuid, full_name text, role text, team_id uuid, team_name text, age_group integer)
language plpgsql
security definer
set search_path = ''
as $$
declare me public.profiles;
begin
  select p.* into me from public.profiles p where p.user_id=auth.uid();
  if me.user_id is null or me.role not in ('club_admin','coach','assistant_coach','parent') then
    return;
  end if;

  return query
  select p.user_id,p.full_name,p.role,p.team_id,t.name,t.age_group
  from public.profiles p
  left join public.teams t on t.id=p.team_id
  where p.club_id=me.club_id
    and p.user_id<>me.user_id
    and p.role in ('club_admin','coach','assistant_coach','parent')
    and (
      me.role='club_admin'
      or (me.role in ('coach','assistant_coach') and
          (p.role='club_admin' or (p.role='parent' and p.team_id=me.team_id)))
      or (me.role='parent' and
          (p.role='club_admin' or (p.role in ('coach','assistant_coach') and p.team_id=me.team_id)))
    )
  order by case p.role
             when 'club_admin' then 0
             when 'coach' then 1
             when 'assistant_coach' then 2
             else 3
           end,
           t.age_group nulls last,t.name nulls last,p.full_name;
end
$$;

revoke all on function public.list_message_contacts() from public,anon;
grant execute on function public.list_message_contacts() to authenticated,service_role;

-- Existing club_messages RLS remains:
-- SELECT: sender or recipient only
-- INSERT: sender=auth.uid(), same club and private.can_message_user(recipient)
-- UPDATE: recipient row only, with authenticated granted UPDATE(read_at) only.
