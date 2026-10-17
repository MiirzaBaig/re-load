import { StreamProvider } from "../_shared/stream-provider.ts";
import { scheduleStreamChange } from "../_shared/stream-schedule.ts";
const pending = {
  target_items: [{ product_id: "premium-year", quantity: 1 }],
  target_recurring_interval: "YEAR",
  target_recurring_interval_count: 1,
  target_subscription_coupon_ids: [],
};
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
Deno.test("scheduled change retry does not send another PUT", async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(init?.method || "GET");
    return Response.json({ pending_change: pending });
  };
  try {
    await scheduleStreamChange(
      new StreamProvider("test-only"),
      "test-sub",
      "premium-year",
      "annual",
    );
    assert(methods.join(",") === "GET");
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("conflicting change is preserved without explicit replacement", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ pending_change: pending });
  };
  try {
    let failed = false;
    try {
      await scheduleStreamChange(
        new StreamProvider("test-only"),
        "test-sub",
        "premium-month",
        "monthly",
      );
    } catch {
      failed = true;
    }
    assert(failed && calls === 1);
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("confirmed replacement supports provider empty 204 response", async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const method = init?.method || "GET";
    methods.push(method);
    if (method === "GET") return Response.json({ pending_change: pending });
    if (method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({
      pending_change: {
        ...pending,
        target_items: [{ product_id: "premium-month", quantity: 1 }],
        target_recurring_interval: "MONTH",
      },
    });
  };
  try {
    await scheduleStreamChange(
      new StreamProvider("test-only"),
      "test-sub",
      "premium-month",
      "monthly",
      true,
    );
    assert(methods.join(",") === "GET,DELETE,PUT");
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("unconfirmed provider change fails closed", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ pending_change: null });
  try {
    let failed = false;
    try {
      await scheduleStreamChange(
        new StreamProvider("test-only"),
        "test-sub",
        "premium-year",
        "annual",
      );
    } catch {
      failed = true;
    }
    assert(failed);
  } finally {
    globalThis.fetch = original;
  }
});
