import { encrypt } from "../_shared/crypto.ts";
import { encode } from "npm:@toon-format/toon@4.4.0";
import { processFlow } from "../_shared/whatsapp-journey.ts";

Deno.env.set("SUPABASE_URL", "https://example.invalid");
Deno.env.set("SUPABASE_ANON_KEY", "test-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
Deno.env.set("RETURN_TOKEN_SECRET", "test-only-return-token-secret");

const store = { id: "store-a", name: "Nova", return_code: "code-a" };
const conversation = { id: "conversation-a", language: "en", contact_id: "contact-a", return_case_id: null };
const order = { storeId: store.id, orderId: "SA-10492", customerName: "Ahmed", items: [{ id: "item-1", name: "Shoes", sku: "SH", quantity: 12, price: 200 }] };
function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }
function harness(step: string, context: Record<string, unknown> = {}, reviewStatus = "PENDING", facts: unknown = null, platform: string | null = null, credential: string | null = null) {
  let state = { step, context };
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const query = { update: () => query, insert: () => query, upsert: () => query, select: () => query, eq: () => query, is: () => query,
    maybeSingle: async () => ({ data: platform ? { platform } : null, error: null }),
    single: async () => ({ data: { status: reviewStatus }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "get_whatsapp_flow_state") return { data: [state], error: null };
      if (name === "set_whatsapp_flow_state") state = { step: String(args.p_step), context: args.p_context as Record<string, unknown> };
      if (name === "request_identity_review") return { data: "review-id", error: null };
      if (name === "get_zid_credential") return { data: credential ? [{ link_ciphertext: credential }] : [], error: null };
      if (name === "get_identity_review_facts") return { data: facts, error: null };
      return { error: null };
    }, from: () => query,
  } as unknown as Parameters<typeof processFlow>[0];
  return { admin, calls, state: () => state };
}

Deno.test("a greeting preserves an unfinished request", async () => {
  const h = harness("AWAITING_REASON", { order, itemId: "item-1" });
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "hello");
  assert(h.state().step === "AWAITING_REASON");
  assert(reply.result.kind === "buttons" && reply.result.buttons[0].id === "resume_return");
});

Deno.test("language choice identifies the selected merchant before order lookup", async () => {
  const h = harness("AWAITING_LANGUAGE");
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "language_en");
  assert(h.state().step === "MENU");
  assert(reply.body.includes("Nova"));
});

Deno.test("phone mismatch reveals no order details and offers merchant review", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "order_not_verified" }), { status: 404 });
  try {
    const h = harness("AWAITING_ORDER");
    const reply = await processFlow(h.admin, store, conversation, "966500000000", "SA-10492");
    assert(!reply.body.includes("Ahmed") && !reply.body.includes("Shoes"));
    assert(h.state().context.orderNumber === "SA-10492");
    assert(reply.result.kind === "buttons" && reply.result.buttons[0].id === "identity_request");
    assert(!reply.body.toLowerCase().includes("code sent"));
  } finally { globalThis.fetch = original; }
});

Deno.test("platform outage is not presented as an identity mismatch", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "order_lookup_unavailable" }), { status: 503 });
  try {
    const h = harness("AWAITING_ORDER");
    const reply = await processFlow(h.admin, store, conversation, "966500000000", "SA-10492");
    assert(reply.result.kind === "text" && reply.body.includes("reach the store"));
    assert(!h.state().context.orderNumber);
  } finally { globalThis.fetch = original; }
});

Deno.test("pending review keeps order details private", async () => {
  const h = harness("AWAITING_ORDER", { identityReviewId: "review-id", orderNumber: "SA-10492" });
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "identity_status");
  assert(!reply.body.includes("Ahmed") && !reply.body.includes("Shoes"));
  assert(h.state().step === "AWAITING_ORDER");
});

Deno.test("approved review resumes only through conversation-bound facts and a fresh order lookup", async () => {
  const original = globalThis.fetch;
  let requested: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => {
    requested = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ order, verificationToken: "fresh-test-token" }));
  };
  try {
    const h = harness("AWAITING_ORDER", { identityReviewId: "review-id" }, "APPROVED", { ...order, _verificationContact: "ahmed@example.com" });
    const reply = await processFlow(h.admin, store, conversation, "966500000000", "identity_status");
    assert(h.state().step === "AWAITING_ITEM");
    assert(h.calls.find((call) => call.name === "get_identity_review_facts")?.args.p_conversation === conversation.id);
    assert(requested.verifier === "ahmed@example.com" && requested.returnCode === store.return_code);
    assert(h.state().context.verificationToken === "fresh-test-token");
    assert(reply.result.kind === "list");
  } finally { globalThis.fetch = original; }
});

Deno.test("expired manual approval requires a fresh verification", async () => {
  const h = harness("AWAITING_ORDER", { identityReviewId: "review-id" }, "APPROVED", null);
  await processFlow(h.admin, store, conversation, "966500000000", "identity_status");
  assert(h.state().step === "AWAITING_ORDER" && !h.state().context.identityReviewId);
});

Deno.test("all order items are accessible beyond Meta's ten-row limit", async () => {
  const items = Array.from({ length: 21 }, (_, index) => ({ ...order.items[0], id: `item-${index}`, name: `Item ${index}` }));
  const h = harness("AWAITING_ITEM", { order: { ...order, items } });
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "item_page:2");
  assert(reply.result.kind === "list");
  assert(reply.result.rows.length <= 10);
  assert(reply.result.rows.some((row) => row.id === "item:item-20"));
  assert(reply.result.rows.some((row) => row.id === "item_page:1"));
});

Deno.test("quantities above ten are accepted only within purchased quantity", async () => {
  const h = harness("AWAITING_QUANTITY", { order, itemId: "item-1" });
  await processFlow(h.admin, store, conversation, "966500000000", "12");
  assert(h.state().context.quantity === 12 && h.state().step === "AWAITING_REASON");
  const invalid = harness("AWAITING_QUANTITY", { order, itemId: "item-1" });
  await processFlow(invalid.admin, store, conversation, "966500000000", "13");
  assert(invalid.state().step === "AWAITING_QUANTITY");
});

Deno.test("unrecognized photo input keeps the customer at the optional photo step", async () => {
  const h = harness("AWAITING_PHOTO", { order, itemId: "item-1" });
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "skip");
  assert(h.state().step === "AWAITING_PHOTO");
  assert(reply.body.includes("WhatsApp image"));
});

Deno.test("transition and its reply are committed together before delivery", async () => {
  const h = harness("MENU");
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "start_return", undefined, { id: "message-1", type: "text" });
  const commit = h.calls.find((call) => call.name === "commit_whatsapp_transition");
  assert(commit?.args.p_step === "AWAITING_ORDER");
  assert(!h.calls.some((call) => call.name === "set_whatsapp_flow_state"));
  const persisted = commit.args.p_reply as { plan: { body: string }; storeId: string; conversationId: string };
  assert(persisted.plan.body === reply.body);
  assert(persisted.storeId === store.id && persisted.conversationId === conversation.id);
});

Deno.test("reporting a bug keeps the return available for continuation", async () => {
  const h = harness("AWAITING_REASON", { order, itemId: "item-1", quantity: 1 });
  await processFlow(h.admin, store, conversation, "966500000000", "report_bug");
  const resume = h.state().context.returnResume as { step: string; context: { itemId: string } };
  assert(h.state().step === "AWAITING_REPORT_MESSAGE");
  assert(resume.step === "AWAITING_REASON" && resume.context.itemId === "item-1");
});

Deno.test("resume after a report restores the saved return step", async () => {
  const h = harness("MENU", { returnResume: { step: "AWAITING_REASON", context: { order, itemId: "item-1", quantity: 1 } } });
  const reply = await processFlow(h.admin, store, conversation, "966500000000", "resume_return");
  assert(h.state().step === "AWAITING_REASON");
  assert(reply.result.kind === "list" && reply.result.rows.some((row) => row.id === "reason:defective"));
});

Deno.test("manually verified customers can track their completed return", async () => {
  const h = harness("COMPLETE", { identityReviewId: "review-id" });
  await processFlow(h.admin, store, conversation, "966500000000", "check_status");
  assert(h.calls.some((call) => call.name === "get_whatsapp_cases"));
});

Deno.test("optional photo can be skipped without creating evidence", async () => {
 const h=harness("AWAITING_PHOTO",{order,itemId:"item-1",quantity:1,reason:"defective",condition:"new_unopened"});
 const reply=await processFlow(h.admin,store,conversation,"966500000000","skip_photo");
 assert(h.state().step === "AWAITING_CONFIRMATION");
 assert(!h.state().context.photoEvidenceId);
 assert(!reply.body.includes("Photo received"));
 assert(reply.result.kind === "buttons" && reply.result.buttons[0].id === "confirm_return");
});
Deno.test("complaint preview does not create a ticket before customer confirmation", async()=>{
 const h=harness("MENU",{serviceMode:"COMPLAINT"});
 const reply=await processFlow(h.admin,store,conversation,"966500000000","My delivery is missing");
 assert(h.state().context.ticketDraft === "My delivery is missing");
 assert(!h.calls.some(c=>c.name === "create_support_ticket"));
 assert(reply.result.kind === "buttons" && reply.result.buttons[0].id === "send_ticket");
});
Deno.test("tracking still checks the sender before exposing order details", async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({error:"order_not_verified"}),{status:404});
 try{const h=harness("AWAITING_ORDER",{serviceMode:"TRACK"});const reply=await processFlow(h.admin,store,conversation,"966500000000","SA-10492");assert(h.state().context.serviceMode === "TRACK");assert(!reply.body.includes("Shoes"));}finally{globalThis.fetch=original;}
});
Deno.test("verified tracking shows status without starting a return",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({order:{...order,orderStatus:"delivered"},verificationToken:"test-token"}));
 try{const h=harness("AWAITING_ORDER",{serviceMode:"TRACK"});const reply=await processFlow(h.admin,store,conversation,"966500000000","SA-10492");assert(h.state().step === "MENU");assert(reply.body.includes("Delivered"));assert(!h.calls.some(c=>c.name === "create_return_case_from_decision"));}finally{globalThis.fetch=original;}
});
Deno.test("screenshot reference requires confirmation before lookup",async()=>{
 const h=harness("AWAITING_ORDER",{extractedOrder:"SA-10492"});
 const reply=await processFlow(h.admin,store,conversation,"966500000000","type_order");
 assert(h.state().step === "AWAITING_ORDER");assert(!h.state().context.extractedOrder);assert(reply.body.includes("type"));
});

Deno.test("the service menu stays within Meta's ten-row limit, including resume",async()=>{const h=harness("MENU",{returnResume:{step:"AWAITING_REASON",context:{order,itemId:"item-1"}}});const reply=await processFlow(h.admin,store,conversation,"966500000000","menu");assert(reply.result.kind === "list");assert(reply.result.rows.length<=10);assert(reply.result.rows.some(r=>r.id === "resume_return"));assert(reply.result.rows.some(r=>r.id === "track_tickets"));});

Deno.test("Zid tracking wiring keeps identity checks and returns only shipment facts", async () => {
  const original = globalThis.fetch;
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("x".repeat(32)));
  const credential = await encrypt("https://zam-mcp-server.zid.sa/mcp/test-only-link-123456");
  const raw = { id: "76099262", customer: { mobile: "966500000000", email: "private@example.com" }, order_status: { code: "indelivery" }, shipping: { method: { courier: "Courier", tracking: { number: "TEST123456", url: "https://track.example.com/test" } } } };
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("salla-order-lookup")) return new Response(JSON.stringify({ order: { ...order, orderId: raw.id }, verificationToken: "test-token" }));
    const request = JSON.parse(String(init?.body));
    if (request.method !== "tools/call") return Response.json({ result: {} });
    assert(request.params.name === "Orders");
    const payload = request.params.arguments.action === "list" ? { orders: [{ id: raw.id }] } : { order: raw };
    return Response.json({ result: { content: [{ type: "text", text: encode(payload) }] } });
  };
  try {
    const h = harness("AWAITING_ORDER", { serviceMode: "TRACK" }, "PENDING", null, "zid", credential);
    const reply = await processFlow(h.admin, store, conversation, "966500000000", raw.id);
    assert(reply.body.includes("TEST123456") && reply.body.includes("On its way"));
    assert(!reply.body.includes("private@example.com") && !reply.body.includes("Ahmed"));
    assert(h.calls.find(c => c.name === "get_zid_credential")?.args.p_store_id === store.id);
  } finally { globalThis.fetch = original; }
});
Deno.test("Zid tracking failure after verification gives a retry message without stale shipment facts", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ order: { ...order, orderStatus: "delivered" }, verificationToken: "test-token" });
  try {
    const h = harness("AWAITING_ORDER", { serviceMode: "TRACK" }, "PENDING", null, "zid");
    const reply = await processFlow(h.admin, store, conversation, "966500000000", order.orderId);
    assert(reply.body.includes("couldn’t get the shipment update") && !reply.body.includes("Delivered"));
  } finally { globalThis.fetch = original; }
});
Deno.test("editing a ticket never submits the old draft and previews the correction",async()=>{
 const h=harness("MENU",{ticketDraft:"One shoe is missing",serviceMode:"COMPLAINT"});
 const first=await processFlow(h.admin,store,conversation,"966500000000","edit_ticket");
 assert(h.state().context.ticketEditing === true && first.body.includes("Nothing has been sent"));
 const second=await processFlow(h.admin,store,conversation,"966500000000","Actually, only the laces are missing");
 assert(h.state().context.ticketDraft === "Actually, only the laces are missing");
 assert(second.body.includes("laces") && !h.calls.some(c=>c.name === "create_support_ticket"));
});
Deno.test("typed ticket corrections and additions require a fresh confirmation",async()=>{
 const h=harness("MENU",{ticketDraft:"Missing laces",serviceMode:"COMPLAINT"});
 await processFlow(h.admin,store,conversation,"966500000000","Add this detail: the box was damaged");
 assert(h.state().context.ticketDraft === "Missing laces\nthe box was damaged");
 const reply=await processFlow(h.admin,store,conversation,"966500000000","yes");
 assert(reply.result.kind === "buttons" && !h.calls.some(c=>c.name === "create_support_ticket"));
});
Deno.test("long ticket previews fit interactive limits without losing the full draft",async()=>{
 const message="x".repeat(4096);const h=harness("MENU",{serviceMode:"COMPLAINT"});
 const reply=await processFlow(h.admin,store,conversation,"966500000000",message);
 assert(reply.body.length<1024 && h.state().context.ticketDraft === message);
 assert(reply.body.includes("full message is saved"));
});
