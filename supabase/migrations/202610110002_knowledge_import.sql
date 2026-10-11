-- Imported knowledge stays unpublished until a merchant approves it.
alter table public.store_knowledge
 add column source_url text,
 add column source_excerpt text,
 add column source_type text check(source_type in ('URL','TEXT')),
 add column source_hash text;
alter table public.store_knowledge drop constraint store_knowledge_category_check;
alter table public.store_knowledge add constraint store_knowledge_category_check
 check(category in ('FAQ','DELIVERY','WARRANTY','SUPPORT','RETURNS','SIZING','CARE','PAYMENTS','LOCATIONS','CANCELLATION'));
create unique index store_knowledge_source_idx on public.store_knowledge(store_id,source_hash);
