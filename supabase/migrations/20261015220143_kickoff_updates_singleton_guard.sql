-- Repair the approved kickoff_updates implementation for hosted safeupdate.
-- Preserve all authorization, key-installation and activation semantics.
-- CREATE OR REPLACE retains existing grants; no tables or records are created.
create or replace function public.configure_kickoff_delivery(p_public_key text,p_push_enabled boolean,p_email_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_push_enabled and p_public_key!~'^[A-Za-z0-9_-]{87}$' then raise exception 'Invalid VAPID public key'; end if;
 update private.kickoff_delivery_config set vapid_public_key=p_public_key,
 push_activated_at=case when not p_push_enabled then null when not push_enabled then now() else push_activated_at end,
 email_activated_at=case when not p_email_enabled then null when not email_enabled then now() else email_activated_at end,
 push_enabled=p_push_enabled,email_enabled=p_email_enabled where singleton;
end $$;

create or replace function public.install_kickoff_signing(p_token text,p_credentials jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare verified jsonb;
begin
 perform 1 from private.kickoff_delivery_config for update;
 verified:=public.kickoff_dispatch_configuration(p_token);
 if verified is null then raise exception 'Dispatcher access required' using errcode='42501'; end if;
 if coalesce((verified->>'needs_key')::boolean,false)=false then return false; end if;
 if p_credentials->>'publicKey' is null or p_credentials->>'privateKey' is null or p_credentials->>'publicKey' !~ '^[A-Za-z0-9_-]{87}$' or p_credentials->>'privateKey' !~ '^[A-Za-z0-9_-]{43}$' or p_credentials->>'subject' is distinct from 'mailto:secretary@shootershillfc.com' then raise exception 'Invalid signing configuration'; end if;
 perform vault.create_secret(p_credentials::text,'kickoff_vapid_credentials','Kick-off Web Push signing pair; server runtime only');
 update private.kickoff_delivery_config set vapid_public_key=p_credentials->>'publicKey' where singleton;
 return true;
end $$;
