import {
  parseServiceIntent,
  publicProduct,
} from "../_shared/customer-assistant.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("unknown model actions cannot enable store writes", () => {
  const r = parseServiceIntent({ intent: "REFUND", search: "x".repeat(500) });
  assert(r.intent === "QUESTION" && r.search.length === 160);
});
Deno.test(
  "customer product mapping excludes internal costs and admin links",
  () => {
    const p = publicProduct({
      id: 1,
      name: "Shoes",
      cost_price: 25,
      urls: {
        customer: "https://example.com/shoes",
        admin: "https://admin.example.com",
      },
      price: { amount: 100, currency: "SAR" },
      quantity: 0,
      unlimited_quantity: true,
      customer: { email: "private@example.com" },
    });
    const text = JSON.stringify(p);
    assert(
      !text.includes("cost_price") &&
        !text.includes("admin.example") &&
        !text.includes("private@example"),
    );
    assert(p.unlimited && p.quantity === 0);
  },
);
Deno.test("unsafe product links never become customer purchase links", () => {
  assert(
    publicProduct({ id: 1, urls: { customer: "javascript:alert(1)" } }).url ===
      null,
  );
});
