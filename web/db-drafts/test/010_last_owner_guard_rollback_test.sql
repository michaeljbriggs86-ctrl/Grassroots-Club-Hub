-- Rolled-back test for draft 010 (title setter + last-owner guard). Paste the WHOLE file into the SQL editor and run.
-- It ends with an error on purpose so NOTHING is kept. Every line should start PASS.
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


-- A club must always keep at least one owner: block removing the last owner flag, and block turning the last owner into a non-admin.
-- (Hardened 11 Oct 2026: also guards role changes, fixes the function search_path, and only counts owners who are still Club Admins.)
create or replace function public.guard_last_owner() returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if old.is_owner is true and (new.is_owner is not true or new.role is distinct from 'club_admin') then
    if not exists (select 1 from public.profiles p where p.club_id=old.club_id and p.is_owner is true and p.role='club_admin' and p.user_id<>old.user_id) then
      raise exception 'A club must keep at least one owner who is a Club Admin';
    end if;
  end if;
  return new;
end $function$;
drop trigger if exists trg_guard_last_owner on public.profiles;
create trigger trg_guard_last_owner before update of is_owner, role on public.profiles for each row execute function public.guard_last_owner();

-- (commit removed for the test)

do $$
declare r text:=''; a record; b record; ok boolean; n int;
begin
  select user_id,club_id into a from public.profiles where is_owner and role='club_admin' order by created_at limit 1;
  select user_id into b from public.profiles where is_owner and role='club_admin' and club_id=a.club_id and user_id<>a.user_id order by created_at limit 1;
  if b.user_id is null then raise exception 'TEST SETUP: need two owners'; end if;
  -- 1. removing ONE owner while another remains is allowed
  update public.profiles set is_owner=false where user_id=a.user_id;
  select count(*) into n from public.profiles where user_id=a.user_id and not is_owner;
  r:=r||E'\n'||case when n=1 then 'PASS one owner can be removed while another remains' else 'FAIL could not remove a non-last owner' end;
  -- 2. removing the LAST owner is blocked
  begin update public.profiles set is_owner=false where user_id=b.user_id; r:=r||E'\nFAIL last owner flag was removed';
  exception when others then r:=r||E'\nPASS removing the last owner flag is blocked (' || sqlerrm || ')'; end;
  -- 3. demoting the LAST owner from Club Admin is blocked
  begin update public.profiles set role='coach' where user_id=b.user_id; r:=r||E'\nFAIL last owner was demoted';
  exception when others then r:=r||E'\nPASS demoting the last owner is blocked'; end;
  -- 4. unrelated updates are not affected
  update public.profiles set full_name=full_name where user_id=b.user_id;
  r:=r||E'\nPASS ordinary profile updates still work';
  -- 5. title setter: only an owner
  perform set_config('request.jwt.claims', json_build_object('sub',b.user_id,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.set_admin_title(b.user_id,'Director'); r:=r||E'\nPASS an owner can set a valid title';
  exception when others then r:=r||E'\nFAIL owner could not set title: '||sqlerrm; end;
  begin perform public.set_admin_title(b.user_id,'Emperor'); r:=r||E'\nFAIL invalid title accepted';
  exception when others then r:=r||E'\nPASS invalid title rejected'; end;
  reset role;
  set local role anon;
  begin perform public.set_admin_title(b.user_id,'Director'); r:=r||E'\nFAIL anon can set titles';
  exception when others then r:=r||E'\nPASS anon cannot call set_admin_title'; end;
  reset role;
  raise exception 'TEST RESULTS (nothing was kept):%', r;
end $$;
