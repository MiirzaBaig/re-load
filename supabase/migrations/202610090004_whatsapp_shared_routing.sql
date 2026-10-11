-- One receiving number can serve many stores. Routing is explicit, never inferred from an order.
alter table public.whatsapp_connections drop constraint whatsapp_connections_phone_number_id_key;
create index whatsapp_connections_phone_idx on public.whatsapp_connections(phone_number_id);
create table private.whatsapp_routes (
 phone_number_id text not null, wa_id text not null,
 store_id uuid not null references public.stores(id) on delete cascade,
 updated_at timestamptz not null default now(), primary key(phone_number_id, wa_id)
);
revoke all on private.whatsapp_routes from public, anon, authenticated;
create function public.whatsapp_route(p_phone text, p_sender text, p_code uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if p_code is not null then
  select s.id into target from public.stores s join public.whatsapp_connections c on c.store_id=s.id
   where s.return_code=p_code and c.phone_number_id=p_phone and c.status='CONNECTED';
  if target is null then
   delete from private.whatsapp_routes where phone_number_id=p_phone and wa_id=p_sender;
   return null;
  end if;
  insert into private.whatsapp_routes(phone_number_id,wa_id,store_id) values(p_phone,p_sender,target)
   on conflict(phone_number_id,wa_id) do update set store_id=excluded.store_id,updated_at=now();
 else
  select r.store_id into target from private.whatsapp_routes r join public.whatsapp_connections c on c.store_id=r.store_id
   where r.phone_number_id=p_phone and r.wa_id=p_sender and c.phone_number_id=p_phone and c.status='CONNECTED'
   and r.updated_at > now()-interval '30 days';
 end if;
 if target is not null then update private.whatsapp_routes set updated_at=now() where phone_number_id=p_phone and wa_id=p_sender; end if;
 return target;
end $$;
revoke all on function public.whatsapp_route(text,text,uuid) from public,anon,authenticated;
grant execute on function public.whatsapp_route(text,text,uuid) to service_role;

create table public.identity_reviews (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
 order_number text not null check(length(order_number) between 1 and 100),
 requester_phone text not null,
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','DECLINED')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 review_note text check(length(review_note) <= 500)
);
create unique index identity_reviews_pending_idx on public.identity_reviews(conversation_id,order_number) where status='PENDING';
alter table public.identity_reviews enable row level security;
grant select on public.identity_reviews to authenticated;
create policy identity_reviews_read on public.identity_reviews for select to authenticated
 using(private.has_store_role(store_id,array['owner','admin']));
create table private.identity_review_facts (
 review_id uuid primary key references public.identity_reviews(id) on delete cascade,
 facts jsonb not null, expires_at timestamptz not null
);
revoke all on private.identity_review_facts from public,anon,authenticated;
create function public.resolve_identity_review(p_id uuid,p_actor uuid,p_facts jsonb default null,p_note text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.identity_reviews;
begin
 select * into r from public.identity_reviews where id=p_id for update;
 if r.id is null or r.status<>'PENDING' then return false; end if;
 if not exists(select 1 from public.memberships where store_id=r.store_id and user_id=p_actor and role in ('owner','admin')) then
  raise exception 'not_authorized'; end if;
 if p_facts is not null and (p_facts->>'storeId') is distinct from r.store_id::text then raise exception 'store_mismatch'; end if;
 update public.identity_reviews set status=case when p_facts is null then 'DECLINED' else 'APPROVED' end,
 reviewed_by=p_actor,reviewed_at=now(),review_note=left(p_note,500) where id=p_id;
 if p_facts is not null then
 insert into private.identity_review_facts values(p_id,p_facts,now()+interval '24 hours'); end if;
 insert into public.audit_events(store_id,actor_user_id,event_type,entity_type,entity_id)
 values(r.store_id,p_actor,case when p_facts is null then 'IDENTITY_DECLINED' else 'IDENTITY_APPROVED' end,'identity_review',p_id);
 return true;
end $$;
create function public.get_identity_review_facts(p_id uuid,p_conversation uuid)
returns jsonb language sql security definer set search_path='' as $$
 select f.facts from private.identity_review_facts f join public.identity_reviews r on r.id=f.review_id
 where r.id=p_id and r.conversation_id=p_conversation and r.status='APPROVED' and f.expires_at>now();
$$;
revoke all on function public.resolve_identity_review(uuid,uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.get_identity_review_facts(uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_identity_review(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.get_identity_review_facts(uuid,uuid) to service_role;

-- Requests are serialized per conversation; completed reviews can be requested
-- again, with a daily limit, rather than recycling expired/declined grants.
create function public.request_identity_review(p_conversation uuid,p_order text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.whatsapp_conversations; review uuid; phone text;
begin
 select * into c from public.whatsapp_conversations where id=p_conversation for update;
 if c.id is null then raise exception 'conversation_missing'; end if;
 select id into review from public.identity_reviews where conversation_id=c.id and order_number=p_order and status='PENDING';
 if review is not null then return review; end if;
 if (select count(*) from public.identity_reviews where conversation_id=c.id and created_at>now()-interval '1 day')>=3 then
 raise exception 'verification_limit_reached'; end if;
 select wa_id into phone from public.whatsapp_contacts where id=c.contact_id and store_id=c.store_id;
 insert into public.identity_reviews(store_id,conversation_id,order_number,requester_phone)
 values(c.store_id,c.id,p_order,phone) returning id into review;
 return review;
end $$;
revoke all on function public.request_identity_review(uuid,text) from public,anon,authenticated;
grant execute on function public.request_identity_review(uuid,text) to service_role;
grant all on public.identity_reviews to service_role;
