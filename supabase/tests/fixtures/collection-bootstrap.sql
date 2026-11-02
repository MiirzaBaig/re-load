create table public.whatsapp_conversations(id uuid primary key,store_id uuid references public.stores(id),return_case_id uuid,contact_id uuid);
create table private.whatsapp_case_links(conversation_id uuid,case_id uuid,primary key(conversation_id,case_id));
create table private.whatsapp_flow_state(conversation_id uuid primary key,step text,context jsonb default '{}');
create table private.whatsapp_inbox(id text primary key,status text,message jsonb,reply jsonb,sender text,created_at timestamptz default now());
alter table public.return_cases add column decision_id uuid,add column order_id text,add column item_snapshot jsonb;
create table public.eligibility_decisions(id uuid primary key,store_id uuid,policy_version_id uuid,outcome text,order_id text,evaluated_at timestamptz default now());
create function public.set_whatsapp_flow_state(p_conversation_id uuid,p_step text,p_context jsonb) returns void language sql as $$ insert into private.whatsapp_flow_state values(p_conversation_id,p_step,p_context) on conflict(conversation_id) do update set step=p_step,context=p_context $$;
create table private.journey_activity(store_id uuid,conversation_id uuid,kind text,step text,source_message_id text);

create table public.whatsapp_contacts(id uuid primary key,store_id uuid,wa_id text);

create table public.whatsapp_messages(id uuid primary key,message_type text);
