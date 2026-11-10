-- Serialize case creation per immutable decision. Concurrent browser/worker
-- submissions must return the same case, rather than both inserting a new one.
create or replace function public.create_return_case_from_decision(
  p_decision_id uuid,
  p_customer_snapshot jsonb,
  p_item_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision public.eligibility_decisions%rowtype;
  v_case_id uuid;
begin
  select * into v_decision from public.eligibility_decisions
  where id = p_decision_id for update;
  if v_decision.id is null or v_decision.outcome = 'NOT_ELIGIBLE' then raise exception 'case_not_allowed'; end if;
  select id into v_case_id from public.return_cases where decision_id = p_decision_id;
  if v_case_id is not null then return v_case_id; end if;
  insert into public.return_cases(store_id, decision_id, order_id, customer_snapshot, item_snapshot)
  values (v_decision.store_id, v_decision.id, v_decision.order_id, p_customer_snapshot, p_item_snapshot)
  returning id into v_case_id;
  insert into public.audit_events(store_id, event_type, entity_type, entity_id, metadata)
  values (v_decision.store_id, 'RETURN_CASE_CREATED', 'return_case', v_case_id,
    jsonb_build_object('decision_id', v_decision.id, 'outcome', v_decision.outcome));
  return v_case_id;
end;
$$;

revoke all on function public.create_return_case_from_decision(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_return_case_from_decision(uuid, jsonb, jsonb) to service_role;
