import { adminClient } from "../_shared/supabase.ts";
import {
  reconcileStreamInvoice,
  reconcileStreamSubscription,
} from "../_shared/stream-reconcile.ts";
import { StreamProvider } from "../_shared/stream-provider.ts";
import { json } from "../_shared/http.ts";
Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  try {
    const body = await request.json();
    const admin = adminClient();
    if (typeof body.ticket !== "string") {
      return json({ error: "invalid_ticket" }, 403);
    }
    const ticket = await admin.rpc("consume_whatsapp_worker_ticket", {
      p_ticket: body.ticket,
    });
    if (ticket.error || !ticket.data) {
      return json({ error: "invalid_ticket" }, 403);
    }
    const { data: events, error } = await admin.from("streampay_webhook_events")
      .select("*").in("processing_status", ["RECEIVED", "FAILED"]).lt(
        "processing_attempts",
        12,
      ).gt("received_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("received_at").limit(10);
    if (error) throw error;
    let processed = 0;
    for (const event of events || []) {
      if (
        event.environment === "live" &&
        Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
      ) continue;
      try {
        const claimed = await admin.from("streampay_webhook_events").update({
          processing_attempts: event.processing_attempts + 1,
        }).eq("id", event.id).eq(
          "processing_attempts",
          event.processing_attempts,
        ).select("id").maybeSingle();
        if (claimed.error) throw claimed.error;
        if (!claimed.data) continue;
        const invoice = event.entity_type === "INVOICE"
          ? event.entity_id
          : event.invoice_id;
        const subscription = event.entity_type === "SUBSCRIPTION"
          ? event.entity_id
          : event.subscription_id;
        if (
          invoice &&
          [
            "INVOICE_COMPLETED",
            "PAYMENT_SUCCEEDED",
            "PAYMENT_REFUNDED",
            "PAYMENT_PARTIALLY_REFUNDED",
          ].includes(event.event_type)
        ) await reconcileStreamInvoice(event.environment, invoice);
        if (subscription) {
          await reconcileStreamSubscription(event.environment, subscription);
        }
        const updated = await admin.from("streampay_webhook_events").update({
          processing_status: invoice || subscription ? "PROCESSED" : "IGNORED",
        }).eq("id", event.id);
        if (updated.error) throw updated.error;
        processed++;
      } catch {
        console.error("billing_reconcile_event_failed", event.id);
      }
    }
    // Recover notifications that never arrived by reading known provider resources.
    const pending = await admin.from("billing_checkouts").select(
      "environment,payment_link_id",
    ).in("status", ["READY", "REVIEW"]).not("payment_link_id", "is", null).gt(
      "created_at",
      new Date(Date.now() - 7 * 86400000).toISOString(),
    ).lt("created_at", new Date(Date.now() - 120000).toISOString()).limit(5);
    for (const checkout of pending.data || []) {
      if (
        checkout.environment === "live" &&
        Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
      ) continue;
      try {
        const provider = new StreamProvider(
          Deno.env.get(
            checkout.environment === "sandbox"
              ? "STREAM_SANDBOX_X_API_KEY"
              : "STREAM_X_API_KEY",
          ) || "",
        );
        const invoices = await provider.request(
          `/invoices?payment_link_id=${checkout.payment_link_id}&include_payments=true&limit=10`,
        );
        for (const invoice of invoices.data || []) {
          if (invoice.status === "COMPLETED") {
            await reconcileStreamInvoice(checkout.environment, invoice.id);
          }
        }
      } catch {
        console.error("billing_checkout_recovery_failed");
      }
    }
    const accounts = await admin.from("store_billing").select(
      "environment,subscription_id",
    ).not("subscription_id", "is", null).lt(
      "updated_at",
      new Date(Date.now() - 3600000).toISOString(),
    ).order("updated_at").limit(10);
    for (const account of accounts.data || []) {
      if (
        account.environment === "live" &&
        Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
      ) continue;
      try {
        const provider = new StreamProvider(
          Deno.env.get(
            account.environment === "sandbox"
              ? "STREAM_SANDBOX_X_API_KEY"
              : "STREAM_X_API_KEY",
          ) || "",
        );
        const invoices = await provider.request(
          `/invoices?subscription_id=${account.subscription_id}&include_payments=true&limit=5&sort_field=created_at&sort_direction=desc`,
        );
        for (const invoice of (invoices.data || []).reverse()) {
          if (invoice.status === "COMPLETED") {
            await reconcileStreamInvoice(account.environment, invoice.id);
          }
        }
        await reconcileStreamSubscription(
          account.environment,
          account.subscription_id,
        );
      } catch {
        console.error("billing_subscription_recovery_failed");
      }
    }
    return json({ processed });
  } catch {
    return json({ error: "reconciliation_failed" }, 500);
  }
});
