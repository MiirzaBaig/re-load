do $$
declare value text;
begin
 if has_table_privilege('anon','private.whatsapp_public_visitors','SELECT') then raise exception 'anonymous_table_access'; end if;
 if has_function_privilege('authenticated','public.whatsapp_public_language(text,text,text)','EXECUTE') then raise exception 'user_rpc_access'; end if;
 if not has_function_privilege('service_role','public.whatsapp_public_language(text,text,text)','EXECUTE') then raise exception 'server_rpc_blocked'; end if;
 value:=public.whatsapp_public_language('test-phone','test-sender');
 if value is not null then raise exception 'unexpected_default'; end if;
 perform public.whatsapp_public_language('test-phone','test-sender','en');
 value:=public.whatsapp_public_language('test-phone','test-sender');
 if value<>'en' then raise exception 'language_not_saved'; end if;
 if public.whatsapp_public_language('different-phone','test-sender') is not null then raise exception 'phone_isolation'; end if;
 if public.whatsapp_public_language('test-phone','different-sender') is not null then raise exception 'sender_isolation'; end if;
 update private.whatsapp_public_visitors set expires_at=now()-interval '1 minute' where phone_id='test-phone';
 if public.whatsapp_public_language('test-phone','test-sender') is not null then raise exception 'expired_language_used'; end if;
 perform public.whatsapp_public_language('test-phone','other-sender','ar');
 if exists(select 1 from private.whatsapp_public_visitors where sender='test-sender') then raise exception 'expired_row_not_removed'; end if;
 begin
  perform public.whatsapp_public_language('test-phone','test-sender','invalid');
  raise exception 'bad_language_accepted';
 exception when others then if sqlerrm<>'invalid_language' then raise; end if; end;
end $$;
