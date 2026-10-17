import {
  halalas,
  paidInvoice,
  safeStreamUrl,
} from "../_shared/billing-contract.ts";
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
Deno.test("money uses exact halalas; invalid provider amounts fail closed", () => {
  assert(halalas("119.90") === 11990);
  assert(halalas(149) === 14900);
  assert(halalas("149.000") === 14900);
  for (const value of ["149.001", "-1", "1e4", "NaN", null]) {
    let rejected = false;
    try {
      halalas(value);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
});
Deno.test("checkout redirects allow only HTTPS Stream-owned hosts", () => {
  assert(safeStreamUrl("https://streampay.sa/s/test").includes("/s/test"));
  for (
    const url of [
      "https://streampay.sa.evil.example/s/test",
      "javascript:alert(1)",
      "http://streampay.sa/s/test",
      "https://user@streampay.sa/s/test",
    ]
  ) {
    let rejected = false;
    try {
      safeStreamUrl(url);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
});
Deno.test("invoice completion alone or manual marking never activates access", () => {
  const invoice = {
    currency: "SAR",
    status: "COMPLETED",
    total_amount: "149.00",
    payments: [{
      currency: "SAR",
      amount: "149",
      current_status: "SUCCEEDED",
      payment_method: "VISA",
    }],
  };
  assert(paidInvoice(invoice, 14900));
  assert(!paidInvoice({ ...invoice, payments: [] }, 14900));
  assert(
    !paidInvoice({
      ...invoice,
      payments: [{ ...invoice.payments[0], payment_method: "CASH" }],
    }, 14900),
  );
  assert(
    !paidInvoice({
      ...invoice,
      payments: [{ ...invoice.payments[0], current_status: "FAILED" }],
    }, 14900),
  );
  assert(!paidInvoice({ ...invoice, currency: "USD" }, 14900));
  assert(!paidInvoice(invoice, 9900));
});

Deno.test("annual prices are exactly 20 percent below twelve monthly payments", async () => {
  const { BILLING_PLANS, billingPrice, providerInterval, isBillingInterval } =
    await import("../_shared/billing-contract.ts");
  for (const plan of ["standard", "premium"] as const) {
    assert(
      billingPrice(plan, "annual") ===
        BILLING_PLANS[plan].price * 12 * 80 / 100,
    );
    assert(billingPrice(plan, "monthly") === BILLING_PLANS[plan].price);
  }
  assert(billingPrice("standard", "annual") === 143040);
  assert(billingPrice("premium", "annual") === 287040);
  assert(providerInterval("annual") === "YEAR");
  assert(providerInterval("monthly") === "MONTH");
  for (const invalid of [null, "year", "ANNUAL", {}, "daily"]) {
    assert(!isBillingInterval(invalid));
  }
});
