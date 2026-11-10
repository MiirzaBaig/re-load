import { encrypt } from "../../_shared/crypto.ts";
import { adminClient } from "../../_shared/supabase.ts";
import { processFlow } from "../../_shared/whatsapp-journey.ts";

export const store = { id: "11111111-1111-4111-8111-111111111111", name: "Omar Demo Store", return_code: "22222222-2222-4222-8222-222222222222" };
export const conversation = { id: "33333333-3333-4333-8333-333333333333", language: "en", contact_id: "44444444-4444-4444-8444-444444444444", return_case_id: null };
export const contact = "966500000000";
type Handler = (request: Request) => Response | Promise<Response>;
const handlers: Record<string, Handler> = {};
const serve = Deno.serve;
// Capture the actual Edge entry points without opening a port or changing production exports.
Deno.serve = ((handler: Handler) => { handlers[Object.keys(handlers).length === 0 ? "salla-order-lookup" : "return-decide"] = handler; return {}; }) as typeof Deno.serve;
try {
  await import("../../salla-order-lookup/index.ts");
  await import("../../return-decide/index.ts");
} finally { Deno.serve = serve; }

export function assert(value: unknown, message = "assertion failed"): void { if (!value) throw new Error(message); }
export const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export async function fixture(work: (h: Awaited<ReturnType<typeof harness>>) => Promise<void>) {
  const names = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY", "INTEGRATION_ENCRYPTION_KEY", "RETURN_TOKEN_SECRET", "WHATSAPP_SHIPPING_SANDBOX_ENABLED", "WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED"];
  const saved = names.map(name => Deno.env.get(name));
  Deno.env.set("SUPABASE_URL", "https://database.test");
  Deno.env.set("SUPABASE_SECRET_KEY", "fixture-service-key");
  Deno.env.set("SUPABASE_ANON_KEY", "fixture-anon-key");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("f".repeat(32)));
  Deno.env.set("RETURN_TOKEN_SECRET", "fixture-signing-key-never-used-in-production");
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ENABLED", "false");
  Deno.env.set("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED", "false");
  const previous = fetch;
  try { const h = await harness(); globalThis.fetch = h.fetch; await work(h); }
  finally { globalThis.fetch = previous; names.forEach((name, i) => saved[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, saved[i]!)); }
}

async function harness() {
  const token = await encrypt("fixture-access-token");
  const order = { id: 1001, reference_id: 90001, status: { slug: "delivered" }, date: { date: daysAgo(5), timezone: "UTC" }, delivered_at: daysAgo(2), currency: "SAR", customer: { first_name: "Omar", last_name: "Demo", email: "omar@example.invalid", mobile: contact } };
  const items = [{ id: 71, name: "Demo shoes", sku: "DEMO-SHOE", quantity: 2, amounts: { price_without_tax: { amount: 150 } } }, { id: 72, name: "Demo bag", sku: "DEMO-BAG", quantity: 1, amounts: { price_without_tax: { amount: 80 } } }];
  const rule = (category: string, value: string) => ({ id: category, name: category, description: "Dummy rule", category, value });
  const policy = { id: "55555555-5555-4555-8555-555555555555", version_label: "Dummy v1", source_text: "14 days after delivery; unused products; max 2 items.", rules_snapshot: [rule("window", "14"), rule("reasons", "defective,wrong_item,changed_mind"), rule("conditions", "new_unopened,opened_unused"), rule("order_status", "delivered"), rule("quantity", "2"), rule("exclusions", "FINAL-")] };
  const state = { step: "MENU", context: {} as Record<string, any>, policyPublished: true, outage: false, wrongCandidate: false, rateAllowed: true, flowLanguage: "en", decisions: [] as any[], cases: [] as any[], calls: [] as string[] };
  const object = (v: unknown) => Response.json(v);
  const request = (name: string, body: Record<string, unknown>) => handlers[name](new Request(`https://database.test/functions/v1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", authorization: "Bearer fixture-service-key" }, body: JSON.stringify(body) }));
  const lookup = async (overrides: Record<string, unknown> = {}) => { const r = await request("salla-order-lookup", { returnCode: store.return_code, orderNumber: String(order.reference_id), verifier: contact, ...overrides }); return { status: r.status, ...await r.json() }; };
  const evaluate = async (verificationToken: string, overrides: Record<string, unknown> = {}) => { const r = await request("return-decide", { verificationToken, itemId: "71", quantity: 1, reason: "defective", condition: "new_unopened", ...overrides }); return { status: r.status, ...await r.json() }; };
  const mockedFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const raw = init?.body ? String(init.body) : input instanceof Request && method !== "GET" ? await input.clone().text() : "{}";
    const body = JSON.parse(raw || "{}");
    state.calls.push(`${method} ${url.hostname}${url.pathname}`);
    if (url.hostname === "api.salla.dev") {
      assert(method === "GET", "Salla writes are forbidden in fixtures");
      if (state.outage) return new Response("{}", { status: 503 });
      if (url.pathname.endsWith("/orders")) return object({ success: true, data: url.searchParams.get("reference_id") === String(order.reference_id) ? [state.wrongCandidate ? { ...order, reference_id: 777 } : order] : [] });
      if (url.pathname.endsWith("/orders/1001")) return object({ success: true, data: order });
      if (url.pathname.endsWith("/orders/items")) return object({ success: true, data: items });
    }
    assert(url.hostname === "database.test", `Unexpected external request: ${url.hostname}`);
    if (url.pathname.includes("/functions/v1/")) return request(url.pathname.split("/").pop()!, body);
    const rpc = url.pathname.split("/rpc/")[1];
    if (rpc) {
      if (rpc === "consume_public_rate_limit") return object(state.rateAllowed);
      if (rpc === "billing_snapshot") return object({ enforcementEnabled: false });
      if (rpc === "get_zid_credential") return object([]);
      if (rpc === "get_salla_credential") { assert(body.p_store_id === store.id, "tenant-bound credential read"); return object([{ access_token_ciphertext: token, token_expires_at: daysAgo(-10) }]); }
      if (rpc === "record_return_decision") {
        const decision = { id: `decision-${state.decisions.length + 1}`, store_id: body.p_store_id, order_id: body.p_order_id, outcome: body.p_outcome, reason_codes: body.p_reason_codes, order_facts_snapshot: body.p_order_facts, ...body };
        state.decisions.push(decision); return object([{ decision_id: decision.id, case_id: null }]);
      }
      if (rpc === "create_return_case_from_decision") {
        const existing = state.cases.find(c => c.decisionId === body.p_decision_id);
        if (existing) return object(existing.id);
        const row = { id: "66666666-6666-4666-8666-666666666666", decisionId: body.p_decision_id, item: body.p_item_snapshot }; state.cases.push(row); return object(row.id);
      }
      if (rpc === "get_whatsapp_flow_state") return object([{ step: state.step, context: state.context }]);
      if (rpc === "set_whatsapp_flow_state") { state.step = body.p_step; state.context = body.p_context ?? {}; return object(null); }
      if (rpc === "record_journey_issue") return object(null);
      throw new Error(`Unhandled fixture RPC: ${rpc}`);
    }
    const table = url.pathname.split("/").pop();
    if (table === "stores") return object(url.searchParams.get("return_code") === `eq.${store.return_code}` ? { id: store.id } : null);
    if (table === "policy_versions") { assert(url.searchParams.get("store_id") === `eq.${store.id}`, "tenant-bound policy read"); return object(state.policyPublished ? policy : null); }
    if (table === "eligibility_decisions") {
      const row = state.decisions.find(d => `eq.${d.id}` === url.searchParams.get("id") && `eq.${d.store_id}` === url.searchParams.get("store_id") && (!url.searchParams.has("order_id") || `eq.${d.order_id}` === url.searchParams.get("order_id")));
      return object(row ?? null);
    }
    if (table === "commerce_connections") return object({ platform: "salla" });
    if (table === "whatsapp_conversations" && method === "PATCH") return new Response(null, { status: 204 });
    throw new Error(`Unhandled fixture request: ${method} ${url.pathname}`);
  };
  const flow = (text: string) => processFlow(adminClient(), store, { ...conversation, language: state.flowLanguage }, contact, text);
  return { state, order, items, policy, lookup, evaluate, request, flow, fetch: mockedFetch };
}
