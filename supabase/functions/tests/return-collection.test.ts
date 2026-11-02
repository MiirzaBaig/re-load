import {
  advanceCollection,
  beginCollection,
  type CollectionContext,
  collectionEnabled,
  type CollectionReply,
  collectionSensitive,
} from "../_shared/return-collection.ts";
import { decrypt } from "../_shared/crypto.ts";
import { signReturnFacts } from "../_shared/return-token.ts";
const store = "11111111-1111-4111-8111-111111111111",
  conversation = "22222222-2222-4222-8222-222222222222",
  caseId = "33333333-3333-4333-8333-333333333333",
  sender = "966500000001";
Deno.env.set("RETURN_TOKEN_SECRET", "test-only-secret");
Deno.env.set(
  "INTEGRATION_ENCRYPTION_KEY",
  btoa("12345678901234567890123456789012"),
);
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
function flags() {
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ENABLED", "true");
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_STORE_IDS", store);
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_SENDERS", sender);
}
function harness(allowed = true) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let count = 0;
  let changed = false;
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "shipping_collection_gate") {
        return {
          data: { allowed, version: 3, method: "PICKUP_BY_DC" },
          error: null,
        };
      }
      if (name === "shipping_collection_confirm") {
        if (changed) return { data: { confirmed: false }, error: null };
        count = 1;
        return { data: { confirmed: true }, error: null };
      }
      return { error: Error("unexpected RPC"), data: null };
    },
  };
  return {
    admin,
    calls,
    count: () => count,
    change: () => {
      changed = true;
    },
  };
}
async function context(): Promise<CollectionContext> {
  return {
    caseId,
    order: { orderId: "100" },
    itemId: "shoe",
    quantity: 1,
    verificationToken: await signReturnFacts({
      storeId: store,
      orderId: "100",
      items: [{ id: "shoe", quantity: 2 }],
    }),
  };
}
async function move(
  h: ReturnType<typeof harness>,
  c: CollectionContext,
  input: string,
  l: "ar" | "en" = "en",
) {
  const r = await advanceCollection(
    h.admin,
    c,
    store,
    conversation,
    sender,
    input,
    l,
  );
  assert(r.body.length <= 1024, "interactive body is too long");
  assert((r.buttons?.length || 0) <= 3 && (r.rows?.length || 0) <= 10);
  for (const button of r.buttons || []) {
    assert(button.title.length <= 20 && button.id.length <= 200);
  }
  for (const row of r.rows || []) {
    assert(row.title.length <= 24 && row.id.length <= 200);
  }
  c.collection = r.state;
  return r;
}
function click(r: CollectionReply, suffix: string) {
  const b = [...(r.buttons || []), ...(r.rows || [])].find((x) =>
    x.id.toLowerCase().endsWith(":" + suffix.toLowerCase())
  );
  assert(b, "missing button " + suffix);
  return b.id;
}
async function review(l: "ar" | "en" = "en") {
  flags();
  const h = harness(), c = await context();
  let r = await beginCollection(h.admin, c, store, conversation, sender, l);
  assert(r);
  c.collection = r.state;
  r = await move(h, c, click(r, "city0"), l);
  r = await move(h, c, "Al Olaya district, Sample Street", l);
  r = await move(h, c, l === "ar" ? "٣٤٧٤" : "3474", l);
  r = await move(h, c, l === "ar" ? "١٢٢٢١" : "12221", l);
  return { h, c, r };
}
Deno.test("collection is default-off, exact store/sender allowlisted and requires standing authorization", async () => {
  flags();
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ENABLED", "false");
  assert(!collectionEnabled(store, sender));
  flags();
  assert(
    !collectionEnabled("other", sender) &&
      !collectionEnabled(store, "966500000002"),
  );
  const h = harness(false);
  assert(
    await beginCollection(
      h.admin,
      await context(),
      store,
      conversation,
      sender,
      "en",
    ) === null,
  );
});
Deno.test("Arabic and English collect encrypted details and confirm exactly once without booking or spending", async () => {
  for (const l of ["ar", "en"] as const) {
    const { h, c, r } = await review(l);
    assert(String(c.collection?.stage) === "REVIEW");
    assert(
      !JSON.stringify(c).includes("Sample Street") &&
        !r.body.includes("Sample Street"),
    );
    const d = JSON.parse(await decrypt(c.collection!.ciphertext!));
    assert(
      d.building === "3474" && d.postcode === "12221" && d.caseId === caseId,
    );
    const out = await move(h, c, click(r, "confirm"), l);
    assert(out.done && h.count() === 1);
    assert(
      h.calls.every((x) =>
        ["shipping_collection_gate", "shipping_collection_confirm"].includes(
          x.name,
        )
      ),
    );
    const saved = h.calls.find((x) =>
      x.name === "shipping_collection_confirm"
    )!;
    assert(!JSON.stringify(saved).includes("Sample Street"));
    assert(!out.body.includes("confirmed pickup"));
  }
});
Deno.test("stale and forged buttons cannot confirm or change a later field", async () => {
  const { h, c, r } = await review();
  const state = JSON.stringify(c.collection);
  const old = `rc:${c.collection!.id}:1:confirm`;
  const out = await move(h, c, old);
  assert(
    out.body.includes("earlier step") && h.count() === 0 &&
      JSON.stringify(c.collection) === state,
  );
  await move(
    h,
    c,
    `rc:44444444-4444-4444-8444-444444444444:${c.collection!.revision}:confirm`,
  );
  assert(h.count() === 0);
  await move(h, c, "confirm");
  assert(h.count() === 0);
  assert(click(r, "confirm").length < 200);
});
Deno.test("back, edit, side questions, help and cancel keep safe navigation without guessing fields", async () => {
  const { h, c, r } = await review();
  let out = await move(h, c, click(r, "edit"));
  out = await move(h, c, click(out, "editaddress"));
  assert(String(c.collection?.stage) === "ADDRESS");
  const before = c.collection!.ciphertext;
  out = await move(h, c, "When will I get a refund?");
  assert(
    c.collection!.ciphertext === before && out.body.includes("refund approval"),
  );
  out = await move(h, c, "HELP");
  assert(out.help);
  out = await move(h, c, "BACK");
  assert(String(c.collection!.stage) === "CITY");
  out = await move(h, c, "CANCEL");
  assert(out.done && h.count() === 0 && out.body.includes("still saved"));
});
Deno.test("expired verification cannot reveal or submit details; cancellation and help remain available", async () => {
  const { h, c, r } = await review();
  c.collection!.expiresAt = Date.now() - 1;
  const out = await move(h, c, click(r, "confirm"));
  assert(out.expired && !out.body.includes("3474") && h.count() === 0);
  assert(out.buttons?.some((x) => x.id === "collection_verify"));
  const lost = await advanceCollection(
    h.admin,
    { ...c, collection: undefined },
    store,
    conversation,
    sender,
    "continue",
    "ar",
  );
  assert(lost.expired);
});
Deno.test("scope and order bindings cannot reuse a different customer's draft or facts", async () => {
  const { h, c } = await review();
  let rejected = false;
  try {
    await advanceCollection(
      h.admin,
      c,
      store,
      "different",
      sender,
      "continue",
      "en",
    );
  } catch {
    rejected = true;
  }
  assert(rejected);
  const other = await context();
  other.verificationToken = await signReturnFacts({
    storeId: "other",
    orderId: "100",
    items: [{ id: "shoe", quantity: 2 }],
  });
  let denied = false;
  try {
    await beginCollection(h.admin, other, store, conversation, sender, "en");
  } catch {
    denied = true;
  }
  assert(denied);
});
Deno.test("settings changes stop submission and outages preserve draft for retry", async () => {
  const { h, c, r } = await review();
  h.change();
  const out = await move(h, c, click(r, "confirm"));
  assert(out.done && h.count() === 0 && out.body.includes("changed"));
  const fresh = await review();
  const failed = {
    rpc: async () => ({
      data: null,
      error: Error("timeout with private payload"),
    }),
  };
  let rejected = false;
  try {
    await advanceCollection(
      failed,
      fresh.c,
      store,
      conversation,
      sender,
      click(fresh.r, "confirm"),
      "en",
    );
  } catch (e) {
    rejected = String(e) === "Error: collection_records_unavailable";
  }
  assert(rejected && String(fresh.c.collection?.stage) === "REVIEW");
});
Deno.test("unsupported city, invalid address and digits never advance or enter model context", async () => {
  flags();
  const h = harness(), c = await context();
  let r = await beginCollection(h.admin, c, store, conversation, sender, "en");
  assert(r);
  c.collection = r.state;
  r = await move(h, c, "Dubai");
  assert(String(c.collection?.stage) === "CITY" && r.body.includes("HELP"));
  r = await move(h, c, click(r, "city0"));
  r = await move(h, c, "https://example.com/address");
  assert(String(c.collection?.stage) === "ADDRESS");
  r = await move(h, c, "Sample district, Sample street");
  await move(h, c, "12345");
  assert(String(c.collection?.stage) === "BUILDING");
  assert(collectionSensitive("SHIPPING_COLLECTION", "any address"));
  assert(collectionSensitive("MENU", "rc:old"));
  assert(!collectionSensitive("MENU", "hello"));
});

Deno.test("expired old buttons expose no address summary and cancel/help still work", async () => {
  const { h, c } = await review();
  c.collection!.expiresAt = 1;
  const out = await advanceCollection(
    h.admin,
    c,
    store,
    conversation,
    sender,
    `rc:${c.collection!.id}:1:confirm`,
    "en",
  );
  assert(
    out.expired && !out.body.includes("Riyadh") && !out.body.includes("21"),
  );
  const help = await advanceCollection(
    h.admin,
    c,
    store,
    conversation,
    sender,
    "HELP",
    "en",
  );
  assert(help.help);
  const cancel = await advanceCollection(
    h.admin,
    c,
    store,
    conversation,
    sender,
    "CANCEL",
    "en",
  );
  assert(cancel.done && h.count() === 0);
});

Deno.test("an exact order pilot fence prevents collection for other verified orders", async () => {
  flags();
  const h = harness(), c = await context();
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ORDER_IDS", "501579078");
  try {
    assert(
      await beginCollection(h.admin, c, store, conversation, sender, "en") ===
        null,
    );
    assert(h.calls.length === 0);
  } finally {
    Deno.env.delete("WHATSAPP_SHIPPING_SANDBOX_ORDER_IDS");
  }
});
