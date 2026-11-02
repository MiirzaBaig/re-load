import { processFlow } from "../_shared/whatsapp-journey.ts";
import { signReturnFacts } from "../_shared/return-token.ts";
const store = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Nova",
  return_code: "RL-TEST",
};
const conversation = {
  id: "22222222-2222-4222-8222-222222222222",
  language: "en",
  contact_id: "contact",
  return_case_id: null,
};
const caseId = "33333333-3333-4333-8333-333333333333",
  decisionId = "44444444-4444-4444-8444-444444444444",
  sender = "966500000001";
const order = {
  storeId: store.id,
  orderId: "100",
  customerName: "Ahmed",
  items: [{ id: "shoe", name: "Shoes", sku: "SH", quantity: 2, price: 70 }],
};
Deno.env.set("RETURN_TOKEN_SECRET", "journey-test-secret");
Deno.env.set(
  "INTEGRATION_ENCRYPTION_KEY",
  btoa("12345678901234567890123456789012"),
);
Deno.env.set("SUPABASE_URL", "https://example.invalid");
Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "server-test");
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
async function harness() {
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ENABLED", "true");
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_STORE_IDS", store.id);
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_SENDERS", sender);
  let state: any = {
    step: "AWAITING_CONFIRMATION",
    context: {
      order,
      itemId: "shoe",
      quantity: 1,
      reason: "wrong_item",
      condition: "unopened",
      decisionId,
      verificationToken: await signReturnFacts(order),
    },
  };
  const calls: Array<{ name: string; args: any }> = [];
  let confirmed = false, allowed = true;
  const query: any = {
    update: () => query,
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: {
        id: caseId,
        order_id: order.orderId,
        decision_id: decisionId,
        item_snapshot: { id: "shoe", quantity: 1 },
      },
      error: null,
    }),
    single: async () => ({
      data: { outcome: "ELIGIBLE", reason_codes: [] },
      error: null,
    }),
    then: (r: any) => Promise.resolve({ error: null }).then(r),
  };
  const admin: any = {
    from: () => query,
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === "get_whatsapp_flow_state") {
        return { data: [state], error: null };
      }
      if (name === "set_whatsapp_flow_state") {
        state = { step: args.p_step, context: args.p_context };
      }
      if (name === "billing_snapshot") {
        return { data: { enforcementEnabled: false }, error: null };
      }
      if (name === "create_return_case_from_decision") {
        return { data: caseId, error: null };
      }
      if (name === "shipping_collection_gate") {
        return {
          data: { allowed, confirmed, version: 3, method: "PICKUP_BY_DC" },
          error: null,
        };
      }
      if (name === "shipping_collection_confirm") {
        confirmed = true;
        return { data: { confirmed: true }, error: null };
      }
      if (name === "shipping_collection_status") {
        return {
          data: confirmed ? { state: "DETAILS_CONFIRMED" } : null,
          error: null,
        };
      }
      if (name === "get_whatsapp_cases") {
        return {
          data: [{ id: caseId, order_id: order.orderId, status: "OPEN" }],
          error: null,
        };
      }
      return { error: null };
    },
  };
  return {
    state: () => state,
    calls,
    admin,
    deny: () => {
      allowed = false;
    },
    send: async (input: string, language = "en") =>
      processFlow(admin, store, { ...conversation, language }, sender, input),
  };
}
function button(r: Awaited<ReturnType<typeof processFlow>>, suffix: string) {
  assert(r.result.kind === "buttons" || r.result.kind === "list");
  const list = r.result.kind === "buttons" ? r.result.buttons : r.result.rows;
  const found = list.find((x) =>
    x.id.endsWith(":" + suffix) || x.id === suffix
  );
  assert(found, "missing " + suffix);
  return found.id;
}
Deno.test("verified eligible case continues through collection, menu, help, confirmation and tracking without AI or booking", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw Error("unexpected external call");
  };
  try {
    const h = await harness();
    let r = await h.send("confirm_return");
    assert(h.state().step === "SHIPPING_COLLECTION");
    r = await h.send(button(r, "city0"));
    r = await h.send("Al Olaya district, Sample Street");
    assert(h.state().context.collection.stage === "BUILDING");
    await h.send("menu");
    assert(
      h.state().context.returnResume.context.collection.stage === "BUILDING",
    );
    await h.send("language_ar");
    assert(
      h.state().context.returnResume.context.collection.stage === "BUILDING",
    );
    r = await h.send("resume_return", "ar");
    assert(r.body.includes("رقم المبنى"));
    r = await h.send("help", "ar");
    assert(button(r, "collection_help"));
    await h.send("collection_help", "ar");
    assert(!h.state().context.ticketDraft.includes("Sample Street"));
    await h.send("cancel_ticket", "ar");
    r = await h.send("resume_return", "ar");
    r = await h.send("٣٤٧٤", "ar");
    r = await h.send("١٢٢٢١", "ar");
    const confirm = button(r, "confirm");
    r = await h.send(confirm, "ar");
    assert(h.state().step === "COMPLETE" && !h.state().context.collection);
    assert(r.body.includes("لم نحجز"));
    await h.send(confirm, "ar");
    assert(
      h.calls.filter((x) => x.name === "shipping_collection_confirm").length ===
        1,
    );
    r = await h.send("check_status", "ar");
    assert(
      r.body.includes("بيانات الطرد") && !r.body.includes("Sample Street"),
    );
    assert(
      h.calls.filter((x) => x.name === "create_return_case_from_decision")
        .length === 1,
    );
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("expired collection re-verifies and resumes the same case rather than creating another return", async () => {
  const h = await harness();
  let r = await h.send("confirm_return");
  r = await h.send(button(r, "city0"));
  h.state().context.collection.expiresAt = 1;
  r = await h.send("continue");
  assert(button(r, "collection_verify"));
  await h.send("collection_verify");
  assert(
    h.state().step === "AWAITING_ORDER" &&
      h.state().context.collectionCaseId === caseId,
  );
  const original = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = async () => {
    lookups++;
    return new Response(
      JSON.stringify({
        order,
        verificationToken: await signReturnFacts(order),
      }),
      { status: 200 },
    );
  };
  try {
    r = await h.send("100");
    assert(
      lookups === 1 && h.state().step === "SHIPPING_COLLECTION" &&
        h.state().context.caseId === caseId,
    );
    assert(
      h.calls.filter((x) => x.name === "create_return_case_from_decision")
        .length === 1,
    );
    assert(r.body.includes("Which city"));
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("ineligible shipping authorization keeps the existing merchant-review route and never asks for addresses", async () => {
  const h = await harness();
  h.deny();
  const r = await h.send("confirm_return");
  assert(h.state().step === "COMPLETE");
  assert(
    !r.body.includes("Which city") && r.body.includes("confirm the next step"),
  );
  assert(!h.calls.some((x) => x.name === "shipping_collection_confirm"));
});

Deno.test("stopping collection can restart details against the same saved return",async()=>{
 const h=await harness();let r=await h.send("confirm_return");r=await h.send(button(r,"city0"));r=await h.send("cancel");assert(h.state().step==="COMPLETE");assert(button(r,"collection_continue"));r=await h.send("collection_continue");assert(h.state().step==="SHIPPING_COLLECTION"&&r.body.includes("Which city"));assert(h.calls.filter(x=>x.name==="create_return_case_from_decision").length===1);
});
