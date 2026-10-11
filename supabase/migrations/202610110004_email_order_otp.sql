-- Order-bound verification. No customer contact or code is exposed through RLS.
create table private.order_email_challenges (
 id uuid primary key,
 store_id uuid not null references public.stores(id) on delete cascade,
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 order_number text not null check(length(order_number) between 1 and 100),
 request_message text not null unique,
 recipient_hash text not null,
 code_hash text not null,
 delivery_ciphertext text not null,
 verifier_ciphertext text not null,
 status text not null default 'PREPARED' check(status in ('PREPARED','SENT','FAILED','CONSUMED')),
 attempts integer not null default 0,
 last_attempt_message text,
 last_attempt_status text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 consumed_at timestamptz,
 verified_message text,
 provider_id text
);
create index order_email_conversation_idx on private.order_email_challenges(conversation_id,created_at desc);
create index order_email_recipient_idx on private.order_email_challenges(recipient_hash,created_at desc);
create index order_email_store_idx on private.order_email_challenges(store_id,created_at desc);
revoke all on private.order_email_challenges from public,anon,authenticated;

create function public.prepare_order_email_otp(p_id uuid,p_conversation uuid,p_order text,p_message text,p_recipient text,p_hash text,p_delivery text,p_verifier text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.whatsapp_conversations; r private.order_email_challenges;
begin
 -- Global lock makes recipient and store quotas atomic across conversations.
 perform pg_catalog.pg_advisory_xact_lock(73419011);
 select * into c from public.whatsapp_conversations where id=p_conversation for update;
 if c.id is null then return jsonb_build_object('status','unavailable'); end if;
 select * into r from private.order_email_challenges where request_message=p_message;
 if r.id is not null then
  if r.conversation_id<>c.id or r.order_number<>p_order then return jsonb_build_object('status','unavailable'); end if;
  return jsonb_build_object('status',r.status,'id',r.id,'delivery',r.delivery_ciphertext);
 end if;
 if exists(select 1 from private.order_email_challenges where conversation_id=c.id and created_at>now()-interval '60 seconds') then
  return jsonb_build_object('status','cooldown'); end if;
 if (select count(*) from private.order_email_challenges where conversation_id=c.id and created_at>now()-interval '1 hour')>=5
 or (select count(*) from private.order_email_challenges where recipient_hash=p_recipient and created_at>now()-interval '1 hour')>=10
 or (select count(*) from private.order_email_challenges where store_id=c.store_id and created_at>now()-interval '1 hour')>=100
 or (select count(*) from private.order_email_challenges where created_at>now()-interval '1 hour')>=500 then
  return jsonb_build_object('status','limited'); end if;
 update private.order_email_challenges set status='FAILED',delivery_ciphertext='' where conversation_id=c.id and status in ('PREPARED','SENT');
 insert into private.order_email_challenges(id,store_id,conversation_id,order_number,request_message,recipient_hash,code_hash,delivery_ciphertext,verifier_ciphertext)
 values(p_id,c.store_id,c.id,p_order,p_message,p_recipient,p_hash,p_delivery,p_verifier);
 return jsonb_build_object('status','PREPARED','id',p_id,'delivery',p_delivery);
end $$;

create function public.finish_order_email_otp(p_id uuid,p_conversation uuid,p_sent boolean,p_provider text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare r private.order_email_challenges;
begin
 select * into r from private.order_email_challenges where id=p_id and conversation_id=p_conversation for update;
 if r.id is null or r.status not in ('PREPARED','SENT') or r.expires_at<=now() then return false; end if;
 update private.order_email_challenges set status=case when p_sent then 'SENT' else 'FAILED' end,
 provider_id=case when p_sent then p_provider else null end,
 delivery_ciphertext=case when p_sent then delivery_ciphertext else '' end where id=r.id;
 insert into public.audit_events(store_id,event_type,entity_type,entity_id)
 values(r.store_id,case when p_sent then 'ORDER_OTP_EMAIL_ACCEPTED' else 'ORDER_OTP_EMAIL_FAILED' end,'order_verification',r.id);
 return true;
end $$;

create function public.verify_order_email_otp(p_id uuid,p_conversation uuid,p_order text,p_hash text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.order_email_challenges;
begin
 select * into r from private.order_email_challenges where id=p_id and conversation_id=p_conversation and order_number=p_order for update;
 if r.id is null then return jsonb_build_object('status','expired'); end if;
 -- Idempotent replay of the successful inbound message only.
 if r.status='CONSUMED' and r.verified_message=p_message and r.consumed_at>now()-interval '20 minutes' then
  return jsonb_build_object('status','verified','verifier',r.verifier_ciphertext); end if;
 if r.expires_at<=now() or r.status<>'SENT' then return jsonb_build_object('status','expired'); end if;
 if r.last_attempt_message=p_message then return jsonb_build_object('status',r.last_attempt_status); end if;
 if r.attempts>=5 then return jsonb_build_object('status','locked'); end if;
 if r.code_hash<>p_hash then
  update private.order_email_challenges set attempts=attempts+1,last_attempt_message=p_message,
   last_attempt_status=case when r.attempts+1>=5 then 'locked' else 'invalid' end where id=r.id;
  return jsonb_build_object('status',case when r.attempts+1>=5 then 'locked' else 'invalid' end);
 end if;
 update private.order_email_challenges set status='CONSUMED',consumed_at=now(),verified_message=p_message,delivery_ciphertext='' where id=r.id;
 insert into public.audit_events(store_id,event_type,entity_type,entity_id) values(r.store_id,'ORDER_EMAIL_VERIFIED','order_verification',r.id);
 return jsonb_build_object('status','verified','verifier',r.verifier_ciphertext);
end $$;

create function public.get_order_email_grant(p_id uuid,p_conversation uuid,p_order text)
returns text language sql security definer set search_path='' as $$
 select verifier_ciphertext from private.order_email_challenges where id=p_id and conversation_id=p_conversation
 and order_number=p_order and status='CONSUMED' and consumed_at>now()-interval '20 minutes';
$$;
revoke all on function public.prepare_order_email_otp(uuid,uuid,text,text,text,text,text,text),
 public.finish_order_email_otp(uuid,uuid,boolean,text), public.verify_order_email_otp(uuid,uuid,text,text,text),
 public.get_order_email_grant(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_order_email_otp(uuid,uuid,text,text,text,text,text,text),
 public.finish_order_email_otp(uuid,uuid,boolean,text), public.verify_order_email_otp(uuid,uuid,text,text,text),
 public.get_order_email_grant(uuid,uuid,text) to service_role;

-- Strip submitted codes from completed inbox jobs; queued jobs retain input only
-- while it is needed for recovery. The merchant transcript is already masked.
create or replace function public.finish_whatsapp_inbox(p_id text,p_error text default null,p_uncertain boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 update private.whatsapp_inbox set
 status=case when p_error is null then 'DONE' when p_uncertain then 'UNCERTAIN' when attempts>=5 then 'FAILED' else 'QUEUED' end,
 last_error=left(p_error,180),available_at=now()+make_interval(secs=>least(300,attempts*30)),
 lease_until=null,finished_at=case when p_error is null then now() else null end
 where id=p_id;
 update private.whatsapp_inbox set message=jsonb_set(message,'{text,body}','"[Verification code hidden]"'::jsonb)
 where id=p_id and status in ('DONE','FAILED','UNCERTAIN') and exists(
  select 1 from public.whatsapp_messages where external_message_id=p_id and direction='INBOUND' and body='[Verification code hidden]');
 delete from private.whatsapp_inbox where status='DONE' and finished_at<now()-interval '7 days';
 delete from private.identity_review_facts where expires_at<now();
end $$;
select cron.schedule('reload-order-otp-cleanup','17 * * * *',
 $cron$update private.order_email_challenges set delivery_ciphertext='',verifier_ciphertext='' where expires_at<now()-interval '20 minutes';
 delete from private.order_email_challenges where created_at<now()-interval '7 days';$cron$);
