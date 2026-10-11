-- Companion to 019_member_contact_details.sql. DRAFT / NOT APPLIED.
-- Requires 019 contacts, 012 assignments and 015 effective capacity.
-- Atomic Club Admin import: approved accounts only, no account/team creation.
-- Must be explicitly approved by Mike along with the contact directory draft.
create function private.import_contact_details(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.profiles; item jsonb; current_contact private.member_contact_details;
  target_id uuid; seen uuid[]:='{}'; count_imported integer:=0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select p.* into me from public.profiles p where p.user_id=auth.uid() for update;
  if me.user_id is null or me.club_id is null or private.effective_role(me) is distinct from 'club_admin' then
    raise exception 'Club Admin access required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Contact rows must be an array'; end if;
  if jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then raise exception 'Import between 1 and 500 contacts'; end if;
  for item in select value from jsonb_array_elements(p_rows) order by value->>'user_id' loop
    if jsonb_typeof(item)<>'object' then raise exception 'Invalid contact row'; end if;
    if exists (select 1 from jsonb_object_keys(item) k where k not in ('user_id','email','phone'))
      or not item ? 'user_id' or jsonb_typeof(item->'user_id') is distinct from 'string'
      or not (item ? 'email' or item ? 'phone')
      or (item ? 'email' and jsonb_typeof(item->'email') is distinct from 'string')
      or (item ? 'phone' and jsonb_typeof(item->'phone') is distinct from 'string') then
      raise exception 'Use only a member ID and email or phone strings';
    end if;
    target_id:=(item->>'user_id')::uuid;
    if target_id=any(seen) then raise exception 'Use one row per member'; end if;
    seen:=array_append(seen,target_id);
    -- Lock the profile before reading existing values. The shared single-save
    -- path also locks it, so blank-preserving merges do not lose concurrent edits.
    perform 1 from public.profiles p where p.user_id=target_id for update;
    select c.* into current_contact from private.member_contact_details c where c.user_id=target_id;
    perform private.save_contact_details(target_id,
      case when item ? 'email' then item->>'email' else coalesce(current_contact.email,'') end,
      case when item ? 'phone' then item->>'phone' else coalesce(current_contact.phone,'') end);
    count_imported:=count_imported+1;
  end loop;
  -- Any invalid/revoked/cross-club target raises and rolls back the whole call.
  return jsonb_build_object('ok',true,'imported',count_imported);
end $$;

create function public.import_member_contact_details(p_rows jsonb)
returns jsonb language sql security invoker set search_path=''
begin atomic
  select private.import_contact_details(p_rows);
end;
revoke all on function private.import_contact_details(jsonb),public.import_member_contact_details(jsonb) from public,anon,authenticated;
grant execute on function private.import_contact_details(jsonb),public.import_member_contact_details(jsonb) to authenticated;
