import test from "node:test";
import assert from "node:assert/strict";
import {
  returnTestInput,
  testOrder,
  testReturn,
  testWarehouse,
  testReferences,
  returnReference,
  verifiedCharge,
  verifiedReturnBinding,
} from "../src/lib/oto/return-contract";
import {
  prepareReturnTest,
  submitReturnTest,
  refreshReturnTest,
  returnTestLabel,
  approveReturnCharge,
} from "../src/lib/oto/return-server";
import { GET, POST } from "../src/app/api/shipping/returns/route";
import { shippingTestContext } from "./fixtures/shipping-billing-server";
const store = "11111111-1111-4111-8111-111111111111",
  user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "test@example.com",
  },
  id = "33333333-3333-4333-8333-333333333333";
const input = returnTestInput({
  name: "Test Contact",
  email: "test@example.com",
  phone: "٠٥٠١٢٣٤٥٦٧",
  customerAddress: "Sample customer street, Riyadh",
  warehouseAddress: "Sample warehouse street, Riyadh",
  courierId: "2828",
  capHalalas: 3000,
  consent: true,
});
const child = testReferences(id).order + "-R1";
const shipments = {
  success: true,
  shipments: [
    {
      orderId: child,
      shipmentNumber: "TEST-SHIP",
      currency: "SAR",
      dcCharge: 25,
    },
  ],
};
const credits = {
  success: true,
  transactions: [
    {
      orderID: child,
      shipmentID: "TEST-SHIP",
      currency: "SAR",
      chargingType: "charge",
      status: "booked",
      transactionType: "dcFee",
      amount: 25,
      ID: 123,
    },
  ],
};
const original = fetch;
function request(b: any, origin = "https://reload.example") {
  return new Request("https://reload.example/api/shipping/returns", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}
async function harness(work: (h: any) => Promise<void>, options: any = {}) {
  const keys = [
    "OTO_SANDBOX_ENABLED",
    "OTO_SANDBOX_RETURNS_ENABLED",
    "OTO_SANDBOX_REFRESH_TOKEN",
    "SHIPPING_SANDBOX_TOPUPS_ENABLED",
    "STREAM_SANDBOX_X_API_KEY",
    "STREAM_SANDBOX_ALLOWED_EMAILS",
  ];
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    OTO_SANDBOX_ENABLED: "true",
    OTO_SANDBOX_RETURNS_ENABLED: "true",
    OTO_SANDBOX_REFRESH_TOKEN: "test",
    SHIPPING_SANDBOX_TOPUPS_ENABLED: "true",
    STREAM_SANDBOX_X_API_KEY: "test",
    STREAM_SANDBOX_ALLOWED_EMAILS: user.email,
  });
  const h: any = {
    r: null,
    claimCount: 0,
    providerWrites: [],
    rpcCalls: [],
    settles: 0,
    walletState: "SUBMITTING",
    savedShipment: null,
  };
  const admin = {
    rpc: async (name: string, a: any) => {
      h.rpcCalls.push(name);
      if (name === "oto_return_test_prepare") {
        h.r = {
          id,
          store_id: store,
          user_id: user.id,
          fingerprint: a.p_fingerprint,
          state: "DRAFT",
          quote_halalas: a.p_quote,
          cap_halalas: a.p_cap,
          expires_at: new Date(Date.now() + 600000).toISOString(),
          courier_id: a.p_courier,
          events: [],
        };
        return { data: h.r };
      }
      if (name === "oto_return_test_record") return { data: h.r };
      if (name === "oto_return_test_claim") {
        if (options.noFunds) return { error: { message: "PRIVATE" } };
        const yes = h.r.state === "DRAFT";
        if (yes) {
          h.claimCount++;
          h.r.state = "WAREHOUSE_CREATING";
        }
        return { data: yes };
      }
      if (name === "oto_return_test_advance") {
        assert.equal(h.r.state, a.p_from);
        h.r.state = a.p_to;
        if (a.p_return) h.r.return_order_ref = a.p_return;
        return { data: null };
      }
      if (name === "oto_return_test_approve_charge") {
        assert.equal(a.p_amount, 6842);
        assert.equal(a.p_user, user.id);
        h.r.cap_halalas = a.p_amount;
        h.approvals = (h.approvals || 0) + 1;
        return { data: true };
      }
      if (name === "shipping_attempt_record")
        return {
          data: {
            state: h.walletState,
            providerShipmentRef: h.savedShipment,
            settledHalalas: h.settles
              ? options.overCharge
                ? 6842
                : 2500
              : null,
          },
        };
      if (name === "shipping_note_provider_reference") {
        h.savedShipment = a.p_provider_ref;
        return { data: true };
      }
      if (name === "shipping_finish_attempt") {
        h.walletState = a.p_state;
        if (a.p_state === "BOOKED") {
          assert.equal(a.p_charge, options.overCharge ? 6842 : 2500);
          h.settles++;
        }
        return { data: true };
      }
      throw Error("unexpected rpc " + name);
    },
  };
  shippingTestContext({ user, role: "owner", storeId: store }, admin);
  globalThis.fetch = async (raw, init) => {
    const u = new URL(String(raw));
    assert.equal(u.origin, "https://staging-api.tryoto.com");
    assert.equal(init?.redirect, "error");
    const path = u.pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (path.endsWith("/refreshToken"))
      return Response.json({ success: true, access_token: "test-access" });
    if (path.endsWith("/accountInfo"))
      return Response.json({
        remainingCredit: options.providerEmpty ? 0 : 1000,
      });
    if (path.endsWith("/checkOTODeliveryFee"))
      return Response.json({
        success: true,
        deliveryCompany: [
          {
            deliveryOptionId: 2828,
            deliveryOptionName: "Test SMSA",
            returnFee: 12.5,
            price: 25,
            pickupDropoff: "freePickup",
          },
        ],
      });
    if (
      [
        "/rest/v2/createPickupLocation",
        "/rest/v2/createOrder",
        "/rest/v2/createReturnShipment",
      ].includes(path)
    ) {
      h.providerWrites.push(path);
      if (options.failAt === path) throw Error("PRIVATE timeout");
    }
    if (path.endsWith("/createPickupLocation"))
      return Response.json({
        success: true,
        pickupLocationCode: testReferences(id).warehouse,
      });
    if (path.endsWith("/createOrder")) {
      assert.equal(body.createShipment, false);
      assert.equal(body.forReverseShipment, true);
      assert(!("deliveryOptionId" in body));
      return Response.json({ success: true, otoId: 123 });
    }
    if (path.endsWith("/createReturnShipment"))
      return Response.json({
        success: true,
        ...(options.asyncReceipt
          ? { msg: "Return shipment request is received" }
          : { returnOrderId: options.foreignChild ? "FOREIGN-R1" : child }),
      });
    if (path.endsWith("/orderDetails"))
      return Response.json({
        success: true,
        orderId: options.foreignOrder
          ? "FOREIGN"
          : options.asyncReceipt
            ? testReferences(id).order
            : child,
        currency: "SAR",
        ...(options.asyncReceipt
          ? {
              statusHistory: [
                { status: "returnShipmentProcessing", shipmentId: "TEST-SHIP" },
              ],
            }
          : { shipmentId: "TEST-SHIP" }),
        status: "shipmentCreated",
      });
    if (path.endsWith("/getReturnDetails"))
      return Response.json({
        success: true,
        orderId: testReferences(id).order,
        returnLocationCode: testReferences(id).warehouse,
        returnedItems: [{ sku: "RLD-TEST-SHOES", quantityToBeReturned: 1 }],
      });
    if (path.endsWith("/shipmentTransactions"))
      return Response.json(
        options.overCharge
          ? {
              success: true,
              shipments: [{ ...shipments.shipments[0], dcCharge: 68.42 }],
            }
          : options.asyncReceipt
            ? {
                success: true,
                shipments: [
                  {
                    ...shipments.shipments[0],
                    orderId: testReferences(id).order,
                  },
                ],
              }
            : shipments,
      );
    if (path.endsWith("/creditTransactions"))
      return Response.json(
        options.unknownCharge
          ? { success: true, transactions: [] }
          : options.overCharge
            ? {
                success: true,
                transactions: [{ ...credits.transactions[0], amount: 68.42 }],
              }
            : options.asyncReceipt
              ? {
                  success: true,
                  transactions: [
                    {
                      ...credits.transactions[0],
                      orderID: testReferences(id).order,
                    },
                  ],
                }
              : credits,
      );
    if (path.startsWith("/rest/v2/print/")) {
      assert.equal(decodeURIComponent(path.split("/").pop()!), child);
      return Response.json({
        success: true,
        trackingNumber: "TEST-SHIP",
        printAWBURL: options.foreignLabel
          ? "http://127.0.0.1/private"
          : "https://staging-api.tryoto.com/print/awb?enc=test",
      });
    }
    if (path === "/print/awb")
      return new Response("%PDF-1.7\nTEST", {
        headers: { "Content-Type": "application/pdf" },
      });
    throw Error("unexpected provider path " + path);
  };
  try {
    await work(h);
  } finally {
    globalThis.fetch = original;
    shippingTestContext(null, null);
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
test("return contracts bind parent/child, explicit reverse-only order and controlled contact consent", () => {
  assert.equal(input.phone, "966501234567");
  assert.equal(testOrder(id, input).forReverseShipment, true);
  assert.equal(testOrder(id, input).createShipment, false);
  assert.equal(testWarehouse(id, input).type, "warehouse");
  assert.equal(testReturn(id, input).items[0].sku, "RLD-TEST-SHOES");
  assert.equal(returnReference(id, child), child);
  for (const bad of [
    { ...input, consent: false },
    { ...input, phone: "123" },
    { ...input, courierId: "999" },
    { ...input, token: "secret" },
  ])
    assert.throws(() => returnTestInput(bad));
  assert.throws(() => returnReference(id, "unrelated-R1"));
});
test("charge verifier refuses guessed, foreign, duplicated, refunded and unsupported currency charges", () => {
  assert.equal(
    verifiedCharge(child, "TEST-SHIP", shipments, credits).halalas,
    2500,
  );
  for (const bad of [
    { success: true, transactions: [] },
    {
      success: true,
      transactions: [credits.transactions[0], credits.transactions[0]],
    },
    {
      success: true,
      transactions: [{ ...credits.transactions[0], currency: "USD" }],
    },
    {
      success: true,
      transactions: [{ ...credits.transactions[0], chargingType: "refund" }],
    },
  ])
    assert.throws(() => verifiedCharge(child, "TEST-SHIP", shipments, bad));
});
test("return API denies unauthenticated, cross-origin, arbitrary provider fields and readonly writes", async () =>
  harness(async (h) => {
    shippingTestContext(null, null);
    assert.equal(
      (
        await GET(
          new Request(
            "https://reload.example/api/shipping/returns?store=" + store,
          ),
        )
      ).status,
      403,
    );
    assert.equal((await POST(request({}, "https://evil.example"))).status, 403);
    assert.equal((await POST(request({ token: "SECRET" }))).status, 400);
    shippingTestContext({ role: "member" }, null);
    assert.equal(
      (await POST(request({ storeId: store, action: "submit", id, input })))
        .status,
      403,
    );
    assert.equal(h.providerWrites.length, 0);
  }));
test("one submission creates warehouse/order/return once and uses child for tracking, charge and label", async () =>
  harness(async (h) => {
    await prepareReturnTest(store, user, id, input);
    await submitReturnTest(store, user, id, input);
    await submitReturnTest(store, user, id, input);
    assert.equal(h.claimCount, 1);
    assert.equal(h.providerWrites.length, 3);
    assert.equal(h.r.return_order_ref, child);
    const progress = await refreshReturnTest(store, user.email);
    assert.equal("tracking" in progress && progress.tracking?.status, "booked");
    assert.equal(h.settles, 1);
    await refreshReturnTest(store, user.email);
    assert.equal(h.settles, 1);
    assert.equal(
      new TextDecoder()
        .decode(await returnTestLabel(store, user.email))
        .slice(0, 5),
      "%PDF-",
    );
  }));
test("no funds, edited selections and expired quotes cannot create external resources", async () => {
  await harness(
    async (h) => {
      await prepareReturnTest(store, user, id, input);
      await assert.rejects(() => submitReturnTest(store, user, id, input));
      assert.equal(h.providerWrites.length, 0);
    },
    { noFunds: true },
  );
  await harness(async (h) => {
    await prepareReturnTest(store, user, id, input);
    await assert.rejects(() =>
      submitReturnTest(store, user, id, { ...input, name: "Changed Contact" }),
    );
    h.r.expires_at = new Date(0).toISOString();
    await assert.rejects(() => submitReturnTest(store, user, id, input));
    assert.equal(h.providerWrites.length, 0);
  });
});
test("uncertain external writes keep reserved state and never replay a creation", async () => {
  for (const failAt of [
    "/rest/v2/createPickupLocation",
    "/rest/v2/createOrder",
    "/rest/v2/createReturnShipment",
  ])
    await harness(
      async (h) => {
        await prepareReturnTest(store, user, id, input);
        await assert.rejects(() => submitReturnTest(store, user, id, input));
        assert.equal(h.walletState, "UNKNOWN");
        await assert.rejects(
          () => refreshReturnTest(store, user.email),
          /booking_needs_checking/,
        );
        const count = h.providerWrites.length;
        await submitReturnTest(store, user, id, input);
        assert.equal(h.providerWrites.length, count);
      },
      { failAt },
    );
});
test("unknown charge keeps reservation; foreign order or label cannot be exposed", async () => {
  await harness(
    async (h) => {
      await prepareReturnTest(store, user, id, input);
      await submitReturnTest(store, user, id, input);
      await refreshReturnTest(store, user.email);
      assert.equal(h.settles, 0);
      assert.equal(h.walletState, "SUBMITTING");
    },
    { unknownCharge: true },
  );
  await harness(
    async () => {
      await prepareReturnTest(store, user, id, input);
      await submitReturnTest(store, user, id, input);
      await assert.rejects(() => refreshReturnTest(store, user.email));
    },
    { foreignOrder: true },
  );
  await harness(
    async () => {
      await prepareReturnTest(store, user, id, input);
      await submitReturnTest(store, user, id, input);
      await refreshReturnTest(store, user.email);
      await assert.rejects(() => returnTestLabel(store, user.email));
    },
    { foreignLabel: true },
  );
});

test("empty OTO wallet blocks creation without reserving merchant funds", async () =>
  harness(
    async (h) => {
      await prepareReturnTest(store, user, id, input);
      await assert.rejects(
        () => submitReturnTest(store, user, id, input),
        /provider_funds_required/,
      );
      assert.equal(h.claimCount, 0);
      assert.equal(h.providerWrites.length, 0);
    },
    { providerEmpty: true },
  ));

test("legacy reverse binding requires exact parent, warehouse, returned SKU and return-specific shipment history", () => {
  const parent = testReferences(id).order;
  const detail = {
    success: true,
    currency: "SAR",
    orderId: parent,
    statusHistory: [
      { status: "returnShipmentProcessing", shipmentId: "TEST-SHIP" },
    ],
  };
  const reverse = {
    success: true,
    orderId: parent,
    returnLocationCode: testReferences(id).warehouse,
    returnedItems: [{ sku: "RLD-TEST-SHOES", quantityToBeReturned: 1 }],
  };
  assert.equal(
    verifiedReturnBinding(id, detail, reverse).shipment,
    "TEST-SHIP",
  );
  for (const bad of [
    { ...reverse, returnLocationCode: "OTHER" },
    { ...reverse, returnedItems: [{ sku: "OTHER", quantityToBeReturned: 1 }] },
    { ...reverse, orderId: "OTHER" },
  ])
    assert.throws(() => verifiedReturnBinding(id, detail, bad));
  assert.throws(() =>
    verifiedReturnBinding(
      id,
      {
        ...detail,
        statusHistory: [{ status: "shipmentCreated", shipmentId: "FORWARD" }],
      },
      reverse,
    ),
  );
});
test("actual staging charge aliases require bound SAR order and matching reverse shipment debit", () => {
  const s = {
    success: true,
    shipments: [
      {
        orderId: child,
        shipmentNumber: "TEST-SHIP",
        shipmentType: "reverse",
        shipmentCost: 68.42,
      },
    ],
  };
  const c = {
    success: true,
    transactions: [
      {
        orderId: child,
        shipmentId: "TEST-SHIP",
        shipmentType: "reverse",
        amount: 68.42,
        id: 1380215,
        status: "booked",
        chargingType: "charge",
        transactionType: "dcFee",
      },
    ],
  };
  assert.equal(verifiedCharge(child, "TEST-SHIP", s, c, "SAR").halalas, 6842);
  assert.throws(() => verifiedCharge(child, "TEST-SHIP", s, c));
  assert.throws(() =>
    verifiedCharge(
      child,
      "TEST-SHIP",
      s,
      { success: true, transactions: [{ ...c.transactions[0], amount: 50 }] },
      "SAR",
    ),
  );
  assert.throws(() =>
    verifiedCharge(
      child,
      "TEST-SHIP",
      {
        success: true,
        shipments: [{ ...s.shipments[0], shipmentType: "forward" }],
      },
      c,
      "SAR",
    ),
  );
});

test("asynchronous return acknowledgement is saved and refreshed without a second booking", async () =>
  harness(
    async (h) => {
      await prepareReturnTest(store, user, id, input);
      await submitReturnTest(store, user, id, input);
      assert.equal(h.r.state, "RETURN_REQUESTED");
      assert.equal(h.providerWrites.length, 3);
      await submitReturnTest(store, user, id, input);
      const result = await refreshReturnTest(store, user.email);
      assert.equal(result.attempt?.hasReturn, true);
      assert.equal(h.r.return_order_ref, testReferences(id).order);
      assert.equal(h.providerWrites.length, 3);
      assert.equal(h.settles, 1);
    },
    { asyncReceipt: true },
  ));
test("over-cap charges remain reserved until an exact newly verified approval", async () =>
  harness(
    async (h) => {
      await prepareReturnTest(store, user, id, input);
      await submitReturnTest(store, user, id, input);
      const result = await refreshReturnTest(store, user.email);
      assert.equal(
        "chargeReview" in result && result.chargeReview?.amountHalalas,
        6842,
      );
      assert.equal(h.settles, 0);
      await assert.rejects(
        () => approveReturnCharge(store, user, 6800),
        /charge_changed/,
      );
      assert.equal(h.approvals || 0, 0);
      await approveReturnCharge(store, user, 6842);
      assert.equal(h.approvals, 1);
      assert.equal(h.settles, 1);
      await refreshReturnTest(store, user.email);
      assert.equal(h.settles, 1);
      assert.equal(h.providerWrites.length, 3);
    },
    { overCharge: true },
  ));
