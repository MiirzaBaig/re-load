// Creates sandbox catalogue entries only. Never creates a payment or subscription.
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
try {
  loadEnvFile(".env");
} catch {}
const key = process.env.STREAM_SANDBOX_X_API_KEY;
if (!key) throw new Error("Missing sandbox credentials");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
async function stream(path, body) {
  const r = await fetch(
    `https://stream-app-service.streampay.sa/api/v2${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Reload/1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error(`Stream HTTP ${r.status}`);
  return r.json();
}
const user = await stream("/user");
if (user.organization?.sandbox !== true)
  throw new Error(
    "STOP: provider did not confirm sandbox mode. Nothing created.",
  );
console.log("Provider confirmed sandbox mode.");
for (const [plan, price, discount, interval] of [
  ["standard", 149, 50, "monthly"],
  ["premium", 299, 100, "monthly"],
  ["standard", 1430.4, 0, "annual"],
  ["premium", 2870.4, 0, "annual"],
]) {
  const { data: existing, error } = await admin
    .from("billing_catalog")
    .select("product_id")
    .eq("environment", "sandbox")
    .eq("plan", plan)
    .eq("billing_interval", interval)
    .maybeSingle();
  if (error) throw new Error("Billing migration must be applied first.");
  if (existing) {
    console.log(`${plan} ${interval}: existing sandbox catalogue preserved`);
    continue;
  }
  const products = await stream(
    `/products?external_metadata.reload_plan=${plan}&limit=100`,
  );
  let product = products.data?.find(
    (p) =>
      p.external_metadata?.reload_plan === plan &&
      (p.external_metadata?.reload_interval || "monthly") === interval,
  );
  if (!product)
    product = await stream("/products", {
      name: `Reload ${plan === "premium" ? "Premium" : "Standard"}`,
      type: "RECURRING",
      recurring_interval: interval === "annual" ? "YEAR" : "MONTH",
      recurring_interval_count: 1,
      prices: [
        { currency: "SAR", amount: price, is_price_exempt_from_vat: false },
      ],
      external_metadata: { reload_plan: plan, reload_interval: interval },
    });
  const coupons = await stream("/coupons?limit=100");
  let coupon = coupons.data?.find(
    (c) => c.name === `Reload ${plan} first-month private offer`,
  );
  if (discount && !coupon)
    coupon = await stream("/coupons", {
      name: `Reload ${plan} first-month private offer`,
      discount_value: discount,
      currency: "SAR",
      is_percentage: false,
      is_active: true,
    });
  const saved = await admin
    .from("billing_catalog")
    .insert({
      environment: "sandbox",
      plan,
      billing_interval: interval,
      product_id: product.id,
      coupon_id: discount ? coupon.id : null,
    });
  if (saved.error) throw new Error("Could not persist sandbox catalogue.");
  console.log(
    `${plan} ${interval}: recurring sandbox product configured${discount ? " with private first-month discount" : ""}`,
  );
}
console.log("No payment collected. No live products changed.");
