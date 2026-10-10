-- 010 (NOT applied): deferred from 009 at Mike's request not to change permissions yet.
begin;

-- Only an owner can set or clear a title, and only on a Club Admin in the same club.
create or replace function public.set_admin_title(p_user_id uuid, p_title text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me public.profiles; target public.profiles; t text:=nullif(btrim(coalesce(p_title,'')),'');
begin
  select * into me from public.profiles where user_id=auth.uid();
  if me.user_id is null or me.role<>'club_admin' or me.is_owner is not true then raise exception 'Owner access required'; end if;
  select * into target from public.profiles where user_id=p_user_id;
  if target.user_id is null or target.club_id is distinct from me.club_id or target.role<>'club_admin' then raise exception 'Choose a Club Admin in your club'; end if;
  if t is not null and t not in ('Director','Club Secretary','Developer') then raise exception 'Title must be Director, Club Secretary or Developer'; end if;
  update public.profiles set club_title=t, updated_at=now() where user_id=p_user_id;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'club_title',t);
end $function$;
revoke all on function public.set_admin_title(uuid,text) from public, anon;
grant execute on function public.set_admin_title(uuid,text) to authenticated;


-- A club must always keep at least one owner: block removing the last owner flag.
create or replace function public.guard_last_owner() returns trigger language plpgsql as $function$
begin
  if old.is_owner is true and new.is_owner is not true then
    if not exists (select 1 from public.profiles p where p.club_id=old.club_id and p.is_owner is true and p.user_id<>old.user_id) then
      raise exception 'A club must keep at least one owner';
    end if;
  end if;
  return new;
end $function$;
drop trigger if exists trg_guard_last_owner on public.profiles;
create trigger trg_guard_last_owner before update of is_owner on public.profiles for each row execute function public.guard_last_owner();

commit;
