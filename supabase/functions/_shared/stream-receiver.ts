import { adminClient } from "./supabase.ts";
import { streamWebhookHandler } from "./streampay-webhook.ts";
import {
  reconcileStreamInvoice,
  reconcileStreamSubscription,
} from "./stream-reconcile.ts";
import type { BillingEnvironment } from "./billing-contract.ts";

export function streamReceiver(environment: BillingEnvironment) {
  return streamWebhookHandler({
    secret: () =>
      Deno.env.get(
        environment === "sandbox"
          ? "STREAM_SANDBOX_WEBHOOK_SECRET"
          : "STREAM_WEBHOOK_SECRET",
      ),
    save: async (receipt) => {
      const admin = adminClient();
      const saved = await admin.from("streampay_webhook_events").upsert({
        ...receipt,
        environment,
      }, { onConflict: "environment,payload_digest", ignoreDuplicates: true });
      if (saved.error) throw saved.error;
      try {
        const invoiceId = receipt.entity_type === "INVOICE"
          ? receipt.entity_id
          : receipt.invoice_id;
        const subscriptionId = receipt.entity_type === "SUBSCRIPTION"
          ? receipt.entity_id
          : receipt.subscription_id;
        if (
          invoiceId &&
          [
            "INVOICE_COMPLETED",
            "PAYMENT_SUCCEEDED",
            "PAYMENT_REFUNDED",
            "PAYMENT_PARTIALLY_REFUNDED",
          ].includes(receipt.event_type)
        ) await reconcileStreamInvoice(environment, invoiceId);
        if (subscriptionId) {
          await reconcileStreamSubscription(environment, subscriptionId);
        }
        const updated = await admin.from("streampay_webhook_events").update({
          processing_status: invoiceId || subscriptionId
            ? "PROCESSED"
            : "IGNORED",
        }).eq("environment", environment).eq(
          "payload_digest",
          receipt.payload_digest,
        );
        if (updated.error) throw updated.error;
      } catch {
        await admin.from("streampay_webhook_events").update({
          processing_status: "FAILED",
        }).eq("environment", environment).eq(
          "payload_digest",
          receipt.payload_digest,
        );
        throw new Error("billing_reconciliation_failed");
      }
    },
  });
}
