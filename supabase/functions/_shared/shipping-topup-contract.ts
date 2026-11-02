import { halalas, paidInvoice } from "./billing-contract.ts";
export const shippingUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export function topupAmount(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 100 ||
    value > 10000000
  )
    throw new Error("invalid_amount");
  return value;
}
export function verifyShippingInvoice(
  checkout: Record<string, any>,
  invoice: Record<string, any>,
  link: Record<string, any>,
) {
  if (
    !shippingUuid(invoice.id) ||
    invoice.payment_link_id !== checkout.payment_link_id ||
    invoice.organization_consumer_id !== checkout.consumer_id ||
    invoice.subscription ||
    invoice.subscription_id ||
    link.id !== checkout.payment_link_id ||
    link.currency !== "SAR" ||
    link.organization_consumer_id !== checkout.consumer_id ||
    halalas(link.amount) !== checkout.amount_halalas ||
    link.max_number_of_payments !== 1
  )
    throw new Error("shipping_payment_mismatch");
  for (const items of [link.items, invoice.items]) {
    if (
      !Array.isArray(items) ||
      items.length !== 1 ||
      items[0].product_id !== checkout.product_id ||
      Number(items[0].quantity) !== 1
    )
      throw new Error("shipping_product_mismatch");
  }
  if (!paidInvoice(invoice, checkout.amount_halalas))
    throw new Error("shipping_payment_not_settled");
  const ids = new Set<string>();
  for (const p of invoice.payments) {
    if (!shippingUuid(p.id) || ids.has(p.id))
      throw new Error("shipping_payment_mismatch");
    ids.add(p.id);
  }
  const refunded = Math.max(
    halalas(invoice.total_refunded ?? "0"),
    invoice.payments.reduce(
      (sum: number, p: Record<string, unknown>) =>
        sum + halalas(p.amount_refunded ?? "0"),
      0,
    ),
  );
  if (refunded > checkout.amount_halalas)
    throw new Error("shipping_payment_mismatch");
  return { refunded };
}
