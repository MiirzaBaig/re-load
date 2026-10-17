export const BILLING_PLANS = {
  standard: {
    name: "Standard",
    price: 14900,
    annualPrice: 143040,
    firstMonth: 9900,
    messages: 500,
  },
  premium: {
    name: "Premium",
    price: 29900,
    annualPrice: 287040,
    firstMonth: 19900,
    messages: 2000,
  },
} as const;
export type BillingPlan = keyof typeof BILLING_PLANS;
export type BillingEnvironment = "sandbox" | "live";
export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "standard" || value === "premium";
}
export function halalas(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("invalid_amount");
  }
  if (!/^\d+(\.\d+)?$/.test(String(value))) {
    throw new Error("invalid_amount");
  }
  const [whole, decimal = ""] = String(value).split(".");
  const fraction = decimal.replace(/0+$/, "");
  if (fraction.length > 2) throw new Error("invalid_amount");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("invalid_amount");
  return result;
}
export function safeStreamUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_checkout_url");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "streampay.sa" ||
      url.hostname.endsWith(".streampay.sa")) ||
    url.username || url.password
  ) throw new Error("invalid_checkout_url");
  return url.toString();
}
export function paidInvoice(
  invoice: Record<string, unknown>,
  expected: number,
) {
  if (
    invoice.currency !== "SAR" || halalas(invoice.total_amount) !== expected ||
    invoice.status !== "COMPLETED"
  ) return false;
  const payments = Array.isArray(invoice.payments)
    ? invoice.payments as Array<Record<string, unknown>>
    : [];
  const allowed = new Set([
    "MADA",
    "VISA",
    "MASTERCARD",
    "APPLE_PAY",
    "SAMSUNG_PAY",
    "AMEX",
    "PGW_CARD_UNSPECIFIED",
    "CARD",
  ]);
  const total = payments.reduce((sum, p) => {
    if (
      !["SUCCEEDED", "SETTLED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
        String(p.current_status),
      ) || !allowed.has(String(p.payment_method)) || p.currency !== "SAR"
    ) return sum;
    return sum + halalas(p.amount);
  }, 0);
  return total === expected;
}

export type BillingInterval = "monthly" | "annual";
export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}
export function billingPrice(plan: BillingPlan, interval: BillingInterval) {
  return interval === "annual"
    ? BILLING_PLANS[plan].annualPrice
    : BILLING_PLANS[plan].price;
}
export function providerInterval(interval: BillingInterval) {
  return interval === "annual" ? "YEAR" : "MONTH";
}
