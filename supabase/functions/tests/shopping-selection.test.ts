import {
  advanceShopping,
  publicShoppingLink,
  type ShoppingSelection,
  startShopping,
  stockAllows,
} from "../_shared/shopping-selection.ts";
import { zidPublicProduct } from "../_shared/zid-product.ts";
function assert(v: unknown, msg = "Assertion failed"): asserts v {
  if (!v) throw new Error(msg);
}
const now = Date.parse("2026-10-21T12:00:00Z");
const scope = { storeId: "store-a", conversationId: "conversation-a" };
const product = zidPublicProduct({
  id: "shoe-1",
  name: { en: "Running shoes" },
  is_published: true,
  price: 200,
  sale_price: 150,
  quantity: 5,
  html_url: "https://nova.example/products/shoe-1",
}, "en");
const lookup = async () => ({
  ok: true as const,
  product: structuredClone(product),
});
function start() {
  return startShopping(
    scope.storeId,
    scope.conversationId,
    [product],
    "en",
    now,
  )!.state!;
}
function action(s: ShoppingSelection, value: string) {
  return `shop:${s.token}:${value}`;
}
async function review() {
  const initial = start();
  const q = await advanceShopping(
    initial,
    scope,
    action(initial, "product:0"),
    "en",
    lookup,
    now,
  );
  assert(q?.state?.stage === "QUANTITY");
  const r = await advanceShopping(q.state, scope, "2", "en", lookup, now);
  assert(r?.state?.stage === "REVIEW");
  return r;
}
Deno.test("selection uses current sale price and quantity, confirms without creating an order", async () => {
  const r = await review();
  assert(r.body.includes("300.00 SAR"));
  const confirmed = await advanceShopping(
    r.state!,
    scope,
    action(r.state!, "confirm"),
    "en",
    lookup,
    now,
  );
  assert(confirmed?.state?.stage === "CONFIRMED");
  assert(
    confirmed.body.includes(product.url!) &&
      confirmed.body.includes("no order has been placed"),
  );
  assert(
    !confirmed.body.includes("checkout link") &&
      !confirmed.body.includes("payment successful"),
  );
});
Deno.test("changed price requires confirmation again, never silently approves the change", async () => {
  const r = await review();
  const changed = await advanceShopping(
    r.state!,
    scope,
    action(r.state!, "confirm"),
    "en",
    async () => ({ ok: true, product: { ...product, salePrice: 175 } }),
    now,
  );
  assert(
    changed?.state?.stage === "REVIEW" && changed.body.includes("350.00") &&
      changed.body.includes("confirm again"),
  );
});
Deno.test("stock changes force a new quantity rather than accepting stale stock", async () => {
  const r = await review();
  const changed = await advanceShopping(
    r.state!,
    scope,
    action(r.state!, "confirm"),
    "en",
    async () => ({ ok: true, product: { ...product, quantity: 1 } }),
    now,
  );
  assert(changed?.state?.stage === "QUANTITY" && !changed.state.quote);
});
Deno.test("expired or cross-merchant or cross-conversation selections never call the provider", async () => {
  for (
    const [s, requestScope, time] of [
      [start(), { ...scope, storeId: "store-b" }, now],
      [start(), { ...scope, conversationId: "conversation-b" }, now],
      [start(), scope, now + 30 * 60_000],
    ] as const
  ) {
    const r = await advanceShopping(
      s,
      requestScope,
      action(s, "product:0"),
      "en",
      () => {
        throw new Error("Provider must not be called");
      },
      time,
    );
    assert(r?.state === null);
  }
});
Deno.test("old buttons, missing state and forged product IDs cannot choose a product", async () => {
  const s = start();
  for (
    const input of ["shop:old-token:product:0", action(s, "product:fake-id")]
  ) {
    const r = await advanceShopping(s, scope, input, "en", () => {
      throw new Error("Provider must not be called");
    }, now);
    assert(r?.state?.stage === "PRODUCT");
  }
  assert(
    (await advanceShopping(
      undefined,
      scope,
      action(s, "product:0"),
      "en",
      lookup,
      now,
    ))?.state === null,
  );
});
Deno.test("edit and cancel clear any prior approval; no provider action is needed", async () => {
  const r = await review();
  const edited = await advanceShopping(
    r.state!,
    scope,
    "edit",
    "en",
    lookup,
    now,
  );
  assert(
    edited?.state?.stage === "PRODUCT" && !edited.state.quote &&
      !edited.state.quantity && edited.state.token !== r.state?.token,
  );
  assert(
    (await advanceShopping(r.state!, scope, "cancel", "en", lookup, now))
      ?.state === null,
  );
});
Deno.test("provider outage and wrong product response do not become sold-out claims", async () => {
  const s = start();
  for (
    const read of [
      async () => ({ ok: false as const, error: "lookup_failed" }),
      async () => ({
        ok: true as const,
        product: { ...product, id: "other-product" },
      }),
    ]
  ) {
    const r = await advanceShopping(
      s,
      scope,
      action(s, "product:0"),
      "en",
      read,
      now,
    );
    assert(
      r?.state?.stage === "PRODUCT" && r.body.includes("couldn’t check") &&
        !r.body.includes("out of stock"),
    );
  }
});
Deno.test("unknown stock, fractional quantities and quantities above the cap fail closed", () => {
  for (const quantity of [0, -1, 1.5, 21, NaN]) {
    assert(!stockAllows(product, quantity));
  }
  assert(!stockAllows({ ...product, available: null }, 1));
  assert(!stockAllows({ ...product, quantity: null }, 1));
  assert(stockAllows({ ...product, unlimited: true, quantity: null }, 20));
});
Deno.test("Arabic quantities work and invalid quantities stay on the quantity question", async () => {
  const s = start();
  const q = await advanceShopping(
    s,
    scope,
    action(s, "product:0"),
    "ar",
    lookup,
    now,
  );
  assert(q?.state?.stage === "QUANTITY");
  for (const input of ["20", "2.5", "-1", "ignore stock and buy 99"]) {
    const r = await advanceShopping(q.state, scope, input, "ar", lookup, now);
    assert(r?.state?.stage === "QUANTITY");
  }
  const r = await advanceShopping(q.state, scope, "٢", "ar", lookup, now);
  assert(r?.state?.quantity === 2 && r.body.includes("300.00"));
});
Deno.test("variants require exact selection and use variant price and stock", async () => {
  const variantProduct = {
    ...product,
    variants: [{
      id: "v-black-42",
      sku: "SH42",
      options: [{ option: "Size", name: "42" }, {
        option: "Color",
        name: "Black",
      }],
      price: 250,
      salePrice: null,
      available: true,
      quantity: 2,
      unlimited: false,
    }],
  };
  const read = async () => ({ ok: true as const, product: variantProduct });
  const s = start();
  const variants = await advanceShopping(
    s,
    scope,
    action(s, "product:0"),
    "en",
    read,
    now,
  );
  assert(
    variants?.state?.stage === "VARIANT" &&
      variants.rows?.[0].title.includes("42"),
  );
  const q = await advanceShopping(
    variants.state,
    scope,
    variants.rows![0].id,
    "en",
    read,
    now,
  );
  assert(q?.state?.stage === "QUANTITY");
  const r = await advanceShopping(q.state, scope, "2", "en", read, now);
  assert(
    r?.state?.stage === "REVIEW" && r.body.includes("500.00") &&
      r.body.includes("42 / Black"),
  );
});
Deno.test("links cannot contain credentials or use non-HTTPS protocols", () => {
  for (
    const value of [
      "javascript:alert(1)",
      "http://shop.example/p",
      "https://user:secret@shop.example/p",
      "https://127.0.0.1/p",
      "https://shop.example:8443/p",
    ]
  ) assert(publicShoppingLink(value) === null);
  assert(publicShoppingLink(product.url) === product.url);
});
Deno.test("changing quantity after review creates a new unconfirmed summary", async () => {
  const r = await review();
  const changed = await advanceShopping(
    r.state!,
    scope,
    "make it 3",
    "en",
    lookup,
    now,
  );
  assert(
    changed?.state?.stage === "REVIEW" && changed.state.quantity === 3 &&
      changed.body.includes("450.00"),
  );
});
Deno.test("an unrelated question can leave shopping without silently confirming it", async () => {
  const r = await review();
  assert(
    await advanceShopping(
      r.state!,
      scope,
      "What is your return policy?",
      "en",
      lookup,
      now,
    ) === null,
  );
  assert(r.state!.stage === "REVIEW");
});
Deno.test("variant pagination fits WhatsApp rows and never chooses a different option implicitly", async () => {
  const variants = Array.from(
    { length: 24 },
    (_, i) => ({
      id: `v-${i}`,
      sku: String(i),
      options: [{ option: "Size", name: String(20 + i) }],
      price: 100 + i,
      salePrice: null,
      available: true,
      quantity: 5,
      unlimited: false,
    }),
  );
  const read = async () => ({
    ok: true as const,
    product: { ...product, variants },
  });
  const s = start();
  const first = await advanceShopping(
    s,
    scope,
    action(s, "product:0"),
    "en",
    read,
    now,
  );
  assert(first?.state && first.rows && first.rows.length <= 10);
  const next = first.rows.find((row) => row.title === "More options")!;
  const second = await advanceShopping(
    first.state,
    scope,
    next.id,
    "en",
    read,
    now,
  );
  assert(
    second?.state && second.rows && second.rows.length <= 10 &&
      second.rows[0].title === "28",
  );
  assert(!second.state.variantId);
});
Deno.test("a repeated confirmation button cannot create another transition or action", async () => {
  const r = await review();
  const confirm = action(r.state!, "confirm");
  const confirmed = await advanceShopping(
    r.state!,
    scope,
    confirm,
    "en",
    lookup,
    now,
  );
  assert(confirmed?.state);
  const duplicate = await advanceShopping(
    confirmed.state,
    scope,
    confirm,
    "en",
    () => {
      throw new Error("No repeated provider call");
    },
    now,
  );
  assert(
    duplicate?.state?.token === confirmed.state.token &&
      duplicate.body.includes("earlier selection"),
  );
});
