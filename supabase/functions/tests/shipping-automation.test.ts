import { encrypt, sha256 } from "../_shared/crypto.ts";
import {
  bookConfirmedReturn,
  checkConfirmedReturn,
} from "../_shared/shipping-automation.ts";
const scope = {
  store: "11111111-1111-4111-8111-111111111111",
  conversation: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  sender: "966500000001",
};
const id = "44444444-4444-4444-8444-444444444444",
  ref = "RLDTEST-" + id.replaceAll("-", "");
Deno.env.set(
  "INTEGRATION_ENCRYPTION_KEY",
  btoa("12345678901234567890123456789012"),
);
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
async function harness(options: Record<string, any> = {}) {
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ENABLED", "true");
  Deno.env.set("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED", "true");
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_STORE_IDS", scope.store);
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_SENDERS", scope.sender);
  const warehouse = {
    id: "warehouse",
    code: "RLDSETOWN",
    name: "Own warehouse",
    city: "Riyadh",
    address: "Private warehouse address",
  };
  const parcel = {
    sku: "SHOE-1",
    quantity: 1,
    version: 1,
    weight_grams: 1000,
    length_mm: 300,
    width_mm: 200,
    height_mm: 120,
  };
  const details = {
    store: scope.store,
    conversation: scope.conversation,
    caseId: scope.caseId,
    recipientPhone: scope.sender,
    orderId: "100",
    itemId: "shoe",
    quantity: 1,
    city: "Jeddah",
    address: "Private street and district",
    building: "3474",
    postcode: "12221",
  };
  const base: any = {
    collection: {
      id,
      settings_version: 3,
      state: "DETAILS_CONFIRMED",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      ciphertext: await encrypt(JSON.stringify(details)),
    },
    settings: {
      state: "APPROVED",
      automatic_requested: true,
      version: 3,
      courier_ids: ["2828", "56468"],
      collection_method: "PICKUP_BY_DC",
      cap_halalas: 10000,
      approved_warehouse_fingerprint: await sha256(
        JSON.stringify({
          id: warehouse.id,
          name: warehouse.name,
          city: warehouse.city,
          address: warehouse.address,
        }),
      ),
    },
    warehouse,
    parcel: options.noParcel ? null : parcel,
    booking: null,
    attempt: null,
  };
  const calls: Array<{ name: string; args: any }> = [],
    requests: Array<{ path: string; body: any }> = [];
  let claims = 0, reserved = 0, settled = 0, issues: string[] = [];
  const admin = {
    rpc: async (name: string, a: any) => {
      calls.push({ name, args: a });
      if (name === "shipping_automation_read") {
        return { data: base, error: null };
      }
      if (name === "shipping_automation_issue") {
        issues.push(a.p_reason);
        return { data: null, error: null };
      }
      if (name === "shipping_automation_claim") {
        if (options.claimError) {
          return { data: null, error: { message: options.claimError } };
        }
        if (base.booking) return { data: false, error: null };
        claims++;
        reserved = base.settings.cap_halalas;
        base.booking = {
          collection_id: id,
          attempt_id: id,
          stage: "ORDER_CREATING",
          order_ref: ref,
          return_ref: null,
          parcel_snapshot: parcel,
        };
        base.attempt = { state: "SUBMITTING", approved_cap_halalas: 10000 };
        return { data: true, error: null };
      }
      if (name === "shipping_automation_advance") {
        assert(base.booking.stage === a.p_from);
        base.booking.stage = a.p_to;
        base.booking.return_ref = a.p_return || base.booking.return_ref;
        return { data: null, error: null };
      }
      if (name === "shipping_finish_attempt") {
        if (a.p_state === "BOOKED") {
          settled++;
          reserved = 0;
          base.attempt.state = "BOOKED";
        } else base.attempt.state = a.p_state;
        return { data: true, error: null };
      }
      if (name === "shipping_note_provider_reference") {
        return { data: true, error: null };
      }
      throw Error("unexpected rpc " + name);
    },
  };
  const provider = {
    request: async (path: string, body?: any) => {
      requests.push({ path, body });
      if (path === "/getPickupLocationList") {
        return {
          success: true,
          warehouses: [
            options.warehouseChanged
              ? { ...warehouse, address: "Changed address" }
              : warehouse,
          ],
        };
      }
      if (path === "/checkOTODeliveryFee") {
        return {
          success: true,
          deliveryCompany: [{
            deliveryOptionId: 2828,
            deliveryOptionName: "SMSA",
            price: options.aboveCap ? 200 : 68.42,
            returnFee: 34.21,
            pickupDropoff: options.dropoff ? "freeDropoff" : "freePickup",
          }],
        };
      }
      if (path === "/accountInfo") {
        return { remainingCredit: options.noProviderFunds ? 0 : 1000 };
      }
      if (path === "/createOrder") {
        if (options.orderTimeout) throw Error("timeout");
        return { success: true, otoId: 31183263 };
      }
      if (path === "/createReturnShipment") {
        if (options.returnTimeout) throw Error("timeout");
        if (options.failedWithChild) {
          return { success: false, returnOrderId: ref + "-R1" };
        }
        return { success: true, msg: "request received" };
      }
      if (path.startsWith("/orderDetails")) {
        return {
          success: true,
          orderId: options.foreignReturn ? "FOREIGN" : ref,
          currency: "SAR",
          shipmentId: "123456",
          status: options.status || "returnShipmentCreated",
          statusHistory: [{
            status: "returnShipmentCreated",
            shipmentId: "123456",
          }],
        };
      }
      if (path === "/getReturnDetails") {
        return {
          success: true,
          orderId: ref,
          returnLocationCode: warehouse.code,
          returnedItems: [{ sku: parcel.sku, quantityToBeReturned: 1 }],
        };
      }
      if (path.startsWith("/shipmentTransactions")) {
        return {
          success: true,
          shipments: [{
            orderId: ref,
            shipmentNumber: "123456",
            currency: "SAR",
            dcCharge: options.highCharge ? 110 : 68.42,
            shipmentType: "reverse",
          }],
        };
      }
      if (path.startsWith("/creditTransactions")) {
        return {
          success: true,
          transactions: [{
            ID: 1,
            orderID: ref,
            shipmentID: "123456",
            currency: "SAR",
            chargingType: "charge",
            status: "booked",
            transactionType: "dcFee",
            amount: options.highCharge ? 110 : 68.42,
          }],
        };
      }
      throw Error("unexpected provider " + path);
    },
    pdf: async () => new TextEncoder().encode("%PDF-verified-test"),
  };
  const deps = {
    provider: async () => {
      if (options.providerDown) throw Error("down");
      return provider;
    },
    fresh: async () => {
      if (options.orderChanged) throw Error("order changed");
      return {
        facts: {
          storeId: scope.store,
          orderId: "100",
          customerName: "Ahmed",
          currency: "SAR",
          items: [{
            id: "shoe",
            sku: parcel.sku,
            name: "Shoes",
            price: 70,
            quantity: 1,
          }],
        },
        decisionId: "new-decision",
      };
    },
  };
  return {
    admin,
    deps,
    base,
    calls,
    requests,
    issues,
    claims: () => claims,
    reserved: () => reserved,
    settled: () => settled,
  };
}
Deno.test("automatic sandbox return uses measured package and actual service price with one cap reservation", async () => {
  const h = await harness();
  const r = await bookConfirmedReturn(h.admin, scope, h.deps);
  assert(r.state === "preparing" && h.claims() === 1 && h.reserved() === 10000);
  const quote = h.requests.find((x) => x.path === "/checkOTODeliveryFee")!;
  assert(
    quote.body.forReverseShipment === true &&
      quote.body.destinationCity === "Jeddah" && quote.body.weight === 1,
  );
  const claim = h.calls.find((x) => x.name === "shipping_automation_claim")!;
  assert(claim.args.p_quote === 6842);
  const order = h.requests.find((x) => x.path === "/createOrder")!.body;
  assert(
    order.createShipment === false && order.forReverseShipment === true &&
      order.packageWeight === 1 && order.items[0].sku === "SHOE-1",
  );
  assert(
    h.requests.filter((x) => x.path === "/createReturnShipment").length === 1,
  );
  const again = await bookConfirmedReturn(h.admin, scope, h.deps);
  assert(again.state === "checking" && h.claims() === 1);
});
Deno.test("missing parcel, uncertain order or changed warehouse stops before reservation or writes", async () => {
  for (
    const [option, reason] of [["noParcel", "PARCEL_REQUIRED"], [
      "orderChanged",
      "ORDER_REVIEW",
    ], ["warehouseChanged", "SETTINGS_CHANGED"]]
  ) {
    const h = await harness({ [option]: true });
    const r = await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(r.reason === reason && h.claims() === 0);
    assert(!h.requests.some((x) => x.path.startsWith("/create")));
  }
});
Deno.test("courier method, cap, shared funding and outage failures have explicit safe reasons", async () => {
  for (
    const [option, reason] of [
      ["dropoff", "COURIER_UNAVAILABLE"],
      ["aboveCap", "ABOVE_CAP"],
      ["noProviderFunds", "PROVIDER_FUNDS"],
      ["providerDown", "PROVIDER_UNAVAILABLE"],
    ]
  ) {
    const h = await harness({ [option]: true });
    const r = await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(r.reason === reason && h.reserved() === 0);
  }
});
Deno.test("atomic entitlement and wallet errors cannot become external orders", async () => {
  for (
    const [error, reason] of [
      ["shipping_insufficient_balance", "BALANCE_REQUIRED"],
      ["authorization_changed", "SETTINGS_CHANGED"],
      ["return_quantity_review", "ORDER_REVIEW"],
    ]
  ) {
    const h = await harness({ claimError: error });
    const r = await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(
      r.reason === reason &&
        !h.requests.some((x) => x.path.startsWith("/create")),
    );
  }
});
Deno.test("write timeouts retain reservations and never retry provider writes", async () => {
  for (const failure of ["orderTimeout", "returnTimeout"]) {
    const h = await harness({ [failure]: true });
    const r = await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(
      r.state === "checking" && h.reserved() === 10000 &&
        h.base.attempt.state === "UNKNOWN",
    );
    const n = h.requests.filter((x) => x.path.startsWith("/create")).length;
    await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(h.requests.filter((x) => x.path.startsWith("/create")).length === n);
  }
});
Deno.test("matching reverse evidence settles actual charges once and returns verified label bytes", async () => {
  const h = await harness();
  await bookConfirmedReturn(h.admin, scope, h.deps);
  const r = await checkConfirmedReturn(h.admin, scope, true, h.deps);
  assert(
    r.state === "booked" && r.label && h.settled() === 1 && h.reserved() === 0,
  );
  await checkConfirmedReturn(h.admin, scope, true, h.deps);
  assert(h.settled() === 1);
});
Deno.test("above-cap charges hold funds for review; preparing is never promised as pickup", async () => {
  const high = await harness({ highCharge: true });
  await bookConfirmedReturn(high.admin, scope, high.deps);
  const r = await checkConfirmedReturn(high.admin, scope, true, high.deps);
  assert(
    r.reason === "CHARGE_REVIEW" && high.settled() === 0 &&
      high.reserved() === 10000 && !r.label,
  );
  const pending = await harness({ status: "returnShipmentProcessing" });
  await bookConfirmedReturn(pending.admin, scope, pending.deps);
  const p = await checkConfirmedReturn(
    pending.admin,
    scope,
    true,
    pending.deps,
  );
  assert(p.state === "preparing" && !p.label);
});
Deno.test("foreign reverse evidence cannot settle or disclose a label", async () => {
  const h = await harness({ foreignReturn: true });
  await bookConfirmedReturn(h.admin, scope, h.deps);
  const r = await checkConfirmedReturn(h.admin, scope, true, h.deps);
  assert(r.state === "checking" && !r.label && h.settled() === 0);
});
Deno.test("default-off and non-allowlisted senders cause no database or provider activity", async () => {
  const h = await harness();
  Deno.env.set("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED", "false");
  assert((await bookConfirmedReturn(h.admin, scope, h.deps)).state === "off");
  Deno.env.set("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED", "true");
  assert(
    (await bookConfirmedReturn(
      h.admin,
      { ...scope, sender: "966500000002" },
      h.deps,
    )).state === "off",
  );
  assert(h.calls.length === 0 && h.requests.length === 0);
});

Deno.test("a returned child reference survives an unsuccessful acknowledgement", async () => {
  const h = await harness({ failedWithChild: true });
  const r = await bookConfirmedReturn(h.admin, scope, h.deps);
  assert(
    r.state === "checking" && h.base.booking.return_ref === ref + "-R1" &&
      h.base.booking.stage === "UNKNOWN" && h.reserved() === 10000,
  );
});

Deno.test("a configured single-order pilot cannot create a different order's shipment", async () => {
  const h = await harness();
  Deno.env.set("WHATSAPP_SHIPPING_SANDBOX_ORDER_IDS", "501579078");
  try {
    const r = await bookConfirmedReturn(h.admin, scope, h.deps);
    assert(
      r.reason === "ORDER_REVIEW" && h.claims() === 0 &&
        h.requests.length === 0,
    );
  } finally {
    Deno.env.delete("WHATSAPP_SHIPPING_SANDBOX_ORDER_IDS");
  }
});
