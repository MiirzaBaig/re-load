import { planAccess } from "../_shared/plan-access.ts";
function assert(v: unknown) {
  if (!v) throw new Error("Assertion failed");
}
const now = Date.parse("2026-10-21T12:00:00Z");
const paid = {
  enforcementEnabled: true,
  plan: "standard",
  status: "ACTIVE",
  periodStart: "2026-10-01T00:00:00Z",
  periodEnd: "2026-11-01T00:00:00Z",
};
Deno.test("both paid plans include customer support but only Premium permits purchase actions", () => {
  const standard = planAccess(paid, now);
  assert(standard.support && !standard.checkout && !standard.shipping);
  const premium = planAccess({ ...paid, plan: "premium" }, now);
  assert(premium.support && premium.checkout && premium.shipping);
});
Deno.test("pilot bypass and trial never grant checkout or shipping", () => {
  for (
    const snapshot of [{ enforcementEnabled: false }, {
      enforcementEnabled: true,
      trialUntil: "2026-12-01",
      plan: "premium",
    }]
  ) {
    const result = planAccess(snapshot, now);
    assert(result.support && !result.checkout && !result.shipping);
  }
});
Deno.test("expired, future, frozen, invalid and absent billing fail closed", () => {
  for (
    const snapshot of [
      null,
      {},
      { ...paid, periodEnd: "2026-10-21T12:00:00Z" },
      { ...paid, periodStart: "2027-01-01" },
      { ...paid, status: "FROZEN" },
      { ...paid, plan: "made-up" },
      { ...paid, periodEnd: "invalid" },
    ]
  ) {
    const result = planAccess(snapshot, now);
    assert(!result.support && !result.checkout && !result.shipping);
  }
});
Deno.test("cancellation preserves paid time and annual periods remain valid", () => {
  assert(planAccess({ ...paid, status: "CANCELED" }, now).support);
  assert(
    planAccess({ ...paid, plan: "premium", periodEnd: "2027-10-01" }, now)
      .checkout,
  );
});

Deno.test("server entitlement reads are bound to the requested store and live billing", async () => {
  const { supportAllowed, checkoutEntitled } = await import(
    "../_shared/billing.ts"
  );
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert(
        name === "billing_snapshot" && args.p_store === "store-a" &&
          args.p_environment === "live",
      );
      return {
        data: {
          ...paid,
          periodStart: new Date(Date.now() - 1000).toISOString(),
          periodEnd: new Date(Date.now() + 60_000).toISOString(),
        },
        error: null,
      };
    },
  } as unknown as Parameters<typeof supportAllowed>[1];
  assert(await supportAllowed("store-a", admin));
  assert(!await checkoutEntitled("store-a", admin));
});
Deno.test("billing lookup failure cannot grant purchase eligibility", async () => {
  const { checkoutEntitled } = await import("../_shared/billing.ts");
  const admin = {
    rpc: async () => ({ data: null, error: { message: "offline" } }),
  } as unknown as Parameters<typeof checkoutEntitled>[1];
  let rejected = false;
  try {
    await checkoutEntitled("store-a", admin);
  } catch (e) {
    rejected = (e as Error).message === "billing_check_failed";
  }
  assert(rejected);
});
