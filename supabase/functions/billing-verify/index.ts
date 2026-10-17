import { json } from "../_shared/http.ts";
import {
  reconcileStreamInvoice,
  reconcileStreamSubscription,
} from "../_shared/stream-reconcile.ts";
Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const serverKey = Deno.env.get("STREAM_INTERNAL_VERIFY_TOKEN");
  if (
    !serverKey || request.headers.get("x-billing-internal-token") !== serverKey
  ) return json({ error: "internal_request_required" }, 403);
  try {
    const { environment, invoiceId, subscriptionId } = await request.json();
    if (
      !["sandbox", "live"].includes(environment) ||
      (invoiceId && subscriptionId) ||
      typeof (invoiceId || subscriptionId) !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(invoiceId || subscriptionId)
    ) return json({ error: "invalid_request" }, 400);
    if (
      environment === "live" &&
      Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
    ) return json({ error: "live_billing_not_enabled" }, 409);
    if (subscriptionId) {
      await reconcileStreamSubscription(environment, subscriptionId);
      return json({ checked: true });
    }
    const applied = await reconcileStreamInvoice(environment, invoiceId);
    if (!applied) return json({ error: "payment_pending_review" }, 409);
    return json({ checked: true });
  } catch {
    return json({ error: "payment_pending_review" }, 409);
  }
});
