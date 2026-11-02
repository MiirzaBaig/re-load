# Ollama runtime verification — 24 October 2026

Owner reported paying the Ollama bill and requested a live check. Local OLLAMA_API_KEY is empty; tests used the existing secret inside the correct Reload Supabase project. No original provider secret was retrieved or printed.

## Results

A temporary token-protected, time-limited server-only function sent synthetic inputs to Ollama. All API calls below used the hosted credential, not mocks.

| Check | Model | Result |
| --- | --- | --- |
| English grounded support answer | deepseek-v4.1-flash | HTTP200; correctly answered 3–5 working days, approximately 0.65s |
| Arabic support answer | deepseek-v4.1-flash | HTTP200; Arabic response, approximately 0.83s |
| Basic policy extraction | deepseek-v4.1-flash | HTTP200; extracted 7 days and unused condition, approximately 0.66s |
| Screenshot OCR, original parser | gemma4:31b | HTTP200 with correct reference inside a Markdown JSON fence; strict JSON parsing failed |
| Actual corrected OCR helper | gemma4:31b | Extracted exact synthetic RL-582741 reference |
| Actual corrected photo-assessment helper | gemma4:31b | Recognized no product in the synthetic order screenshot and required merchant review |

The actual patched image helpers were tested together in hosted Supabase, completing in approximately 2.62s at 09:04 UTC. These small-input timings are observations, not production latency guarantees. No real customer data, WhatsApp sends, store writes, published answers/policies, payment or shipment was involved. No billing-account status or plan balance was inspected; successful authenticated inference establishes API access at test time.

## Fix and deployment

Added a bounded JSON-object parser accepting plain JSON or exactly one complete JSON/unlabelled code fence. Surrounding prose, partial fences, nonobject JSON and oversized responses are rejected. OCR reference validation and conservative photo-review rules remain intact. Only image helpers use the new parser; text/knowledge behavior was not changed.

All 120 backend tests passed, including five new parsing and image-helper tests. Deployed whatsapp-inbox version31 and whatsapp-photo-analysis version14; hosted inventory confirms both ACTIVE. No migration, key rotation, Gemini switch or website deployment is required. The temporary check was deleted and verified absent. The production functions retain their existing authentication/authorization configuration.

## Remaining acceptance

A complete human-operated WhatsApp conversation, merchant knowledge/policy extraction endpoint, real order screenshot and customer return-photo journey have not been tested by this check. Existing tenant/billing/identity guards and provider availability still affect those paths. Source changes and this report are local and have not yet been committed/pushed.
