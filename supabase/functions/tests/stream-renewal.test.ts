import { reconcileStreamInvoice } from "../_shared/stream-reconcile.ts";
Deno.env.set("SUPABASE_URL", "https://billing-test.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
Deno.env.set("STREAM_SANDBOX_X_API_KEY", "test-sandbox-key");
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
const checkout = {
  id: "checkout",
  store_id: "store",
  consumer_id: "customer",
  plan: "standard",
  billing_interval: "annual",
  product_id: "standard-year",
  kind: "SUBSCRIPTION",
  status: "PAID",
  amount_halalas: 143040,
};
async function fixture(
  options: {
    status?: string;
    interval?: string;
    recorded?: boolean;
    amount?: string;
  } = {},
) {
  const original = globalThis.fetch;
  const applied: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (url.hostname === "stream-app-service.streampay.sa") {
      if (path.includes("/invoices/")) {
        return Response.json({
          id: "invoice",
          payment_link_id: "link",
          organization_consumer_id: "customer",
          subscription: { id: "subscription" },
          currency: "SAR",
          status: options.status || "COMPLETED",
          total_amount: options.amount || "2870.400",
          created_at: "2026-10-17T00:00:00Z",
          payments: [{
            scheduled_on: "2026-10-17T00:00:00Z",
            currency: "SAR",
            current_status: "SUCCEEDED",
            payment_method: "VISA",
            amount: options.amount || "2870.400",
          }],
        });
      }
      return Response.json({
        organization_consumer_id: "customer",
        currency: "SAR",
        items: [{ product_id: "premium-year", quantity: 1 }],
        recurring_interval: options.interval || "YEAR",
        recurring_interval_count: 1,
        current_period_start: "2026-10-17T00:00:00Z",
        current_period_end: "2027-10-17T00:00:00Z",
      });
    }
    if (path.endsWith("/billing_checkouts")) return Response.json(checkout);
    if (path.endsWith("/store_billing")) {
      return Response.json({
        plan: "standard",
        subscription_id: "subscription",
        period_start: "2025-10-17T00:00:00Z",
        period_end: "2026-10-17T00:00:00Z",
      });
    }
    if (path.endsWith("/billing_catalog")) {
      return Response.json({
        plan: "premium",
        billing_interval: "annual",
        product_id: "premium-year",
      });
    }
    if (path.endsWith("/billing_payments")) {
      return Response.json(
        url.searchParams.get("select") === "invoice_id"
          ? { invoice_id: "old-invoice" }
          : options.recorded
          ? {
            store_id: "store",
            amount_halalas: 287040,
            refunded_halalas: 0,
            period_start: "2026-10-17T00:00:00Z",
            period_end: "2027-10-17T00:00:00Z",
          }
          : null,
      );
    }
    if (path.endsWith("/rpc/billing_apply_invoice")) {
      applied.push(JSON.parse(String(init?.body)));
      return Response.json(null);
    }
    throw new Error("Unexpected test request");
  };
  try {
    await reconcileStreamInvoice("sandbox", "invoice");
    return { applied, error: false };
  } catch {
    return { applied, error: true };
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("renewal uses the approved actual product, annual price and paid period", async () => {
  const result = await fixture();
  assert(!result.error && result.applied.length === 1);
  assert(
    result.applied[0].p_interval === "annual" &&
      result.applied[0].p_plan === "premium" &&
      result.applied[0].p_amount === 287040,
  );
});
Deno.test("unpaid renewal never extends access", async () => {
  const result = await fixture({ status: "PENDING" });
  assert(result.error && result.applied.length === 0);
});
Deno.test("annual renewal with wrong price or interval fails closed", async () => {
  for (const options of [{ amount: "299.00" }, { interval: "MONTH" }]) {
    const result = await fixture(options);
    assert(result.error && result.applied.length === 0);
  }
});
Deno.test("repeated settled invoice does not reset allowance", async () => {
  const result = await fixture({ recorded: true });
  assert(!result.error && result.applied.length === 0);
});
