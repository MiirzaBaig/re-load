import { StreamProvider } from "./stream-provider.ts";
import {
  shippingUuid,
  verifyShippingInvoice,
} from "./shipping-topup-contract.ts";

/** Call only with an invoice fetched from the fixed provider API using sandbox credentials. */
export async function reconcileShippingTopup(
  admin: any,
  provider: StreamProvider,
  environment: string,
  invoice: Record<string, any>,
) {
  if (environment !== "sandbox" || !shippingUuid(invoice.payment_link_id))
    return false;
  const saved = await admin.rpc("shipping_topup_by_link", {
    p_link: invoice.payment_link_id,
  });
  if (saved.error) throw new Error("shipping_records_unavailable");
  const checkout = saved.data;
  if (!checkout) return false;
  if (checkout.environment !== "sandbox")
    throw new Error("shipping_environment_mismatch");
  const link = await provider.request(
    `/payment_links/${checkout.payment_link_id}`,
  );
  const { refunded } = verifyShippingInvoice(checkout, invoice, link);
  if (refunded > 0) {
    if (checkout.state === "PAID" || checkout.state === "REFUND_REVIEW") {
      const review = await admin.rpc("shipping_topup_refund_review", {
        p_id: checkout.id,
        p_invoice: invoice.id,
      });
      if (review.error) throw new Error("shipping_refund_review_pending");
      return true;
    }
    throw new Error("shipping_refunded_before_credit");
  }
  const applied = await admin.rpc("shipping_topup_complete", {
    p_id: checkout.id,
    p_invoice: invoice.id,
    p_link: checkout.payment_link_id,
    p_consumer: checkout.consumer_id,
    p_product: checkout.product_id,
    p_amount: checkout.amount_halalas,
  });
  if (applied.error) throw new Error("shipping_credit_pending");
  return true;
}
