-- Candidate scheduled delivery change. Requires explicit named live approval,
-- deployed worker, verified transports, and matching dispatcher token in Vault.
-- Secret value is never embedded in cron SQL or returned from this function.
do $$ begin
 if not exists(select 1 from vault.secrets where name='kickoff_dispatch_token') then
  raise exception 'Provision kickoff_dispatch_token in Vault and the matching KICKOFF_DISPATCH_TOKEN Edge Function secret first';
 end if;
end $$;
create function private.dispatch_kickoff_updates() returns bigint language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 if not exists(select 1 from private.kickoff_delivery_config where push_enabled and email_enabled) then return null; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='kickoff_dispatch_token';
 if nullif(secret,'') is null then raise exception 'Kick-off dispatcher secret unavailable'; end if;
 select net.http_post(
  url:='https://obntycksmkcnkprrcutg.supabase.co/functions/v1/kickoff-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  body:='{}'::jsonb,timeout_milliseconds:=100000
 ) into request_id;
 return request_id;
end $$;
revoke all on function private.dispatch_kickoff_updates() from public,anon,authenticated,service_role;
select cron.schedule('kickoff-updates-delivery','* * * * *','select private.dispatch_kickoff_updates()');
