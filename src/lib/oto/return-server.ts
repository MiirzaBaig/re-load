import "server-only";
import { createHash } from "node:crypto";
import { billingAdmin } from "@/lib/billing-server";
import { shippingTopupProvider } from "@/lib/shipping/topups";
import { sandboxQuotes } from "./sandbox-server";
import { sampleParcel } from "./contracts";
import {
  returnTestInput,
  testReferences,
  testWarehouse,
  testOrder,
  testReturn,
  returnReference,
  shipmentStatus,
  verifiedCharge,
  verifiedReturnBinding,
  type ReturnTestInput,
} from "./return-contract";
import { ReturnProvider } from "./return-provider";
type Actor = { id: string; email?: string };
export class ReturnTestError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
function gate(email: string) {
  shippingTopupProvider(email);
  if (
    process.env.OTO_SANDBOX_RETURNS_ENABLED !== "true" ||
    process.env.OTO_SANDBOX_ENABLED !== "true"
  )
    throw new ReturnTestError("disabled", 503);
}
async function rpc(name: string, args: Record<string, unknown>) {
  const r = await billingAdmin().rpc(name, args);
  if (r.error) throw new ReturnTestError("records_unavailable", 503);
  return r.data;
}
function fingerprint(id: string, input: ReturnTestInput) {
  testReferences(id);
  return createHash("sha256")
    .update(id + "\n" + JSON.stringify(input))
    .digest("hex");
}
async function record(store: string, id?: string) {
  return rpc("oto_return_test_record", { p_store: store, p_id: id || null });
}
export async function returnTestSnapshot(store: string, email: string) {
  gate(email);
  const r = await record(store);
  if (!r) return { attempt: null };
  const a =
    r.state === "DRAFT" || r.state === "EXPIRED"
      ? null
      : await rpc("shipping_attempt_record", {
          p_id: r.id,
          p_store: store,
          p_environment: "sandbox",
        });
  return {
    attempt: {
      id: r.id,
      stage: r.state,
      quoteHalalas: r.quote_halalas,
      capHalalas: r.cap_halalas,
      expiresAt: r.expires_at,
      walletState: a?.state || null,
      chargeHalalas: a?.settledHalalas || null,
      hasReturn: !!r.return_order_ref,
      hasShipment: !!a?.providerShipmentRef,
      events: r.events || [],
      updatedAt: r.updated_at,
    },
  };
}
export async function prepareReturnTest(
  store: string,
  user: Actor,
  id: string,
  raw: unknown,
) {
  gate(user.email || "");
  let input: ReturnTestInput;
  try {
    input = returnTestInput(raw);
    testReferences(id);
  } catch {
    throw new ReturnTestError("invalid_input", 400);
  }
  const quotes = await sandboxQuotes(
    {
      originCity: "Riyadh",
      destinationCity: "Riyadh",
      ...sampleParcel,
    },
    true,
  );
  const courier = quotes.rates.find(
    (r) =>
      r.id === input.courierId && r.sandboxBookable && r.pickup !== "dropoff",
  );
  if (!courier || courier.price === null || courier.price <= 0)
    throw new ReturnTestError("courier_unavailable");
  const quote = Math.round(courier.price * 100);
  if (quote > input.capHalalas) throw new ReturnTestError("above_cap");
  const r = await rpc("oto_return_test_prepare", {
    p_id: id,
    p_store: store,
    p_user: user.id,
    p_fingerprint: fingerprint(id, input),
    p_courier: input.courierId,
    p_quote: quote,
    p_cap: input.capHalalas,
  });
  return {
    id: r.id,
    quoteHalalas: r.quote_halalas,
    capHalalas: r.cap_halalas,
    expiresAt: r.expires_at,
    courierName: courier.name,
  };
}
export async function submitReturnTest(
  store: string,
  user: Actor,
  id: string,
  raw: unknown,
) {
  gate(user.email || "");
  let input: ReturnTestInput;
  try {
    input = returnTestInput(raw);
    testReferences(id);
  } catch {
    throw new ReturnTestError("invalid_input", 400);
  }
  const r = await record(store, id);
  if (!r || r.fingerprint !== fingerprint(id, input) || r.user_id !== user.id)
    throw new ReturnTestError("selection_changed");
  if (r.state !== "DRAFT") return returnTestSnapshot(store, user.email || "");
  if (
    !Number.isFinite(Date.parse(r.expires_at)) ||
    Date.parse(r.expires_at) <= Date.now()
  )
    throw new ReturnTestError("test_expired");
  const quotes = await sandboxQuotes(
    {
      originCity: "Riyadh",
      destinationCity: "Riyadh",
      ...sampleParcel,
    },
    true,
  );
  const current = quotes.rates.find(
    (q) =>
      q.id === input.courierId && q.sandboxBookable && q.pickup !== "dropoff",
  );
  if (
    !current ||
    current.price === null ||
    current.price <= 0 ||
    Math.round(current.price * 100) > r.cap_halalas
  )
    throw new ReturnTestError("above_cap");
  const provider = new ReturnProvider();
  await provider.connect();
  const account = await provider.request("/accountInfo");
  if (
    (typeof account.remainingCredit !== "number" &&
      typeof account.remainingCredit !== "string") ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(account.remainingCredit)) ||
    Math.round(Number(account.remainingCredit) * 100) < r.cap_halalas
  )
    throw new ReturnTestError("provider_funds_required");
  let claimed;
  try {
    claimed = await rpc("oto_return_test_claim", {
      p_store: store,
      p_id: id,
      p_user: user.id,
      p_fingerprint: fingerprint(id, input),
    });
  } catch {
    throw new ReturnTestError("funding_or_access");
  }
  if (!claimed) return returnTestSnapshot(store, user.email || "");
  const advance = (from: string, to: string, returned: string | null = null) =>
    rpc("oto_return_test_advance", {
      p_store: store,
      p_id: id,
      p_from: from,
      p_to: to,
      p_return: returned,
    });
  try {
    const warehouse = await provider.request(
      "/createPickupLocation",
      testWarehouse(id, input),
    );
    if (
      warehouse.success !== true ||
      warehouse.pickupLocationCode !== testReferences(id).warehouse
    )
      throw Error("warehouse_unconfirmed");
    await advance("WAREHOUSE_CREATING", "WAREHOUSE_READY");
    await advance("WAREHOUSE_READY", "ORDER_CREATING");
    const order = await provider.request("/createOrder", testOrder(id, input));
    if (order.success !== true || !/^\d+$/.test(String(order.otoId)))
      throw Error("order_unconfirmed");
    await advance("ORDER_CREATING", "ORDER_READY");
    await advance("ORDER_READY", "RETURN_CREATING");
    const result = await provider.request(
      "/createReturnShipment",
      testReturn(id, input),
    );
    // Save the exact child return reference before interpreting other response fields.
    if (result.returnOrderId) {
      const returned = returnReference(id, result.returnOrderId);
      await advance("RETURN_CREATING", "RETURN_SAVED", returned);
      if (result.success !== true) throw Error("return_unconfirmed");
    } else if (result.success === true) {
      await advance("RETURN_CREATING", "RETURN_REQUESTED");
    } else throw Error("return_unconfirmed");
  } catch {
    try {
      await rpc("shipping_finish_attempt", {
        p_id: id,
        p_store: store,
        p_environment: "sandbox",
        p_state: "UNKNOWN",
      });
    } catch {
      /* Existing claim still locks duplicate creation. */
    }
    throw new ReturnTestError("booking_needs_checking");
  }
  return returnTestSnapshot(store, user.email || "");
}
async function readBoundReturn(
  provider: ReturnProvider,
  r: Record<string, any>,
) {
  const ref = r.return_order_ref || testReferences(r.id).order;
  const detail = await provider.request(
    `/orderDetails?orderId=${encodeURIComponent(ref)}`,
  );
  if (detail.orderId !== ref)
    throw new ReturnTestError("provider_unavailable", 503);
  const reverse =
    ref === testReferences(r.id).order
      ? await provider.request("/getReturnDetails", { orderId: ref })
      : null;
  const binding = verifiedReturnBinding(r.id, detail, reverse);
  return { detail, binding };
}
async function recordedCharge(
  provider: ReturnProvider,
  ref: string,
  shipment: string,
  currency: string,
) {
  const shipments = await provider.request(
    `/shipmentTransactions?orderId=${encodeURIComponent(ref)}&perPage=100&page=1`,
  );
  const credits = await provider.request(
    `/creditTransactions?orderId=${encodeURIComponent(ref)}&perPage=100&page=1`,
  );
  return verifiedCharge(ref, shipment, shipments, credits, currency);
}
export async function refreshReturnTest(store: string, email: string) {
  gate(email);
  let r = await record(store);
  if (!r || ["DRAFT", "EXPIRED"].includes(r.state))
    return returnTestSnapshot(store, email);
  if (
    !["RETURN_CREATING", "RETURN_REQUESTED", "RETURN_SAVED"].includes(r.state)
  )
    throw new ReturnTestError("booking_needs_checking");
  const provider = new ReturnProvider();
  await provider.connect();
  let bound;
  try {
    bound = await readBoundReturn(provider, r);
  } catch {
    throw new ReturnTestError("booking_needs_checking");
  }
  const { detail, binding } = bound;
  if (!r.return_order_ref) {
    try {
      await rpc("oto_return_test_advance", {
        p_store: store,
        p_id: r.id,
        p_from: r.state,
        p_to: "RETURN_SAVED",
        p_return: binding.orderRef,
      });
    } catch {
      const latest = await record(store);
      if (latest?.return_order_ref !== binding.orderRef)
        throw new ReturnTestError("booking_needs_checking");
    }
    r = await record(store);
  }
  let chargeReview: { amountHalalas: number; capHalalas: number } | null = null;
  if (binding.shipment) {
    await rpc("shipping_note_provider_reference", {
      p_id: r.id,
      p_store: store,
      p_environment: "sandbox",
      p_provider_ref: binding.shipment,
    });
    const a = await rpc("shipping_attempt_record", {
      p_id: r.id,
      p_store: store,
      p_environment: "sandbox",
    });
    if (a?.state !== "BOOKED" && a?.state !== "CANCELLED") {
      try {
        const charge = await recordedCharge(
          provider,
          binding.orderRef,
          binding.shipment,
          detail.currency,
        );
        if (charge.halalas > r.cap_halalas) {
          chargeReview = {
            amountHalalas: charge.halalas,
            capHalalas: r.cap_halalas,
          };
        } else
          await rpc("shipping_finish_attempt", {
            p_id: r.id,
            p_store: store,
            p_environment: "sandbox",
            p_state: "BOOKED",
            p_charge: charge.halalas,
            p_provider_ref: binding.shipment,
            p_evidence_ref: charge.evidence,
          });
      } catch {
        /* Never guess a cost or release an uncertain reservation. */
      }
    }
  }
  return {
    ...(await returnTestSnapshot(store, email)),
    tracking: {
      status: shipmentStatus(detail.status),
      checkedAt: new Date().toISOString(),
    },
    chargeReview,
  };
}
export async function approveReturnCharge(
  store: string,
  user: Actor,
  amount: unknown,
) {
  gate(user.email || "");
  if (
    !Number.isSafeInteger(amount) ||
    Number(amount) < 1 ||
    Number(amount) > 1000000
  )
    throw new ReturnTestError("invalid_input", 400);
  const r = await record(store);
  if (!r?.return_order_ref) throw new ReturnTestError("booking_needs_checking");
  const provider = new ReturnProvider();
  await provider.connect();
  const { detail, binding } = await readBoundReturn(provider, r);
  if (!binding.shipment) throw new ReturnTestError("booking_needs_checking");
  const charge = await recordedCharge(
    provider,
    binding.orderRef,
    binding.shipment,
    detail.currency,
  );
  if (charge.halalas !== amount) throw new ReturnTestError("charge_changed");
  await rpc("oto_return_test_approve_charge", {
    p_store: store,
    p_id: r.id,
    p_user: user.id,
    p_amount: amount,
    p_shipment: binding.shipment,
  });
  return refreshReturnTest(store, user.email || "");
}
export async function returnTestLabel(store: string, email: string) {
  gate(email);
  const r = await record(store);
  if (!r?.return_order_ref) throw new ReturnTestError("label_unavailable");
  const a = await rpc("shipping_attempt_record", {
    p_id: r.id,
    p_store: store,
    p_environment: "sandbox",
  });
  if (!a?.providerShipmentRef) throw new ReturnTestError("label_unavailable");
  const provider = new ReturnProvider();
  await provider.connect();
  const { binding } = await readBoundReturn(provider, r);
  if (binding.shipment !== a.providerShipmentRef)
    throw new ReturnTestError("label_unavailable");
  return provider.label(binding.orderRef, a.providerShipmentRef);
}
