import { decrypt, sha256 } from "./crypto.ts";
import {
  collectionEnabled,
  collectionOrderAllowed,
} from "./return-collection.ts";
import {
  boundReverse,
  shipmentStatus,
  verifiedCharge,
} from "./shipping-proof.ts";
import {
  type ShippingProvider,
  shippingProvider,
} from "./shipping-provider.ts";
import { courierRates } from "./shipping-rates.ts";
type Admin = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: any; error: any }>;
};
export type ShippingScope = {
  store: string;
  conversation: string;
  caseId: string;
  sender: string;
};
export type ShippingResult = {
  state:
    | "off"
    | "waiting"
    | "checking"
    | "preparing"
    | "booked"
    | "collected"
    | "in_transit"
    | "delivered"
    | "cancelled"
    | "needs_attention";
  reason?: string;
  label?: Uint8Array;
  shipment?: string;
};
export type ShippingFresh = {
  facts: {
    storeId: string;
    orderId: string;
    customerName: string;
    customerEmail?: string;
    currency: string;
    items: Array<
      { id: string; sku: string; name: string; price: number; quantity: number }
    >;
  };
  decisionId: string;
};
type Deps = {
  provider?: () => Promise<ShippingProvider>;
  fresh?: (
    data: { orderId: string; itemId: string; quantity: number },
  ) => Promise<ShippingFresh>;
  photoReview?: boolean;
};
const waiting = (reason: string): ShippingResult => ({
  state: "waiting",
  reason,
});
function enabled(s: ShippingScope) {
  return collectionEnabled(s.store, s.sender) &&
    Deno.env.get("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED") === "true";
}
function money(v: unknown) {
  if (
    (typeof v !== "number" && typeof v !== "string") ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(v))
  ) throw Error("provider_unavailable");
  const n = Math.round(Number(v) * 100);
  if (!Number.isSafeInteger(n) || n < 0) throw Error("provider_unavailable");
  return n;
}
async function rpc(admin: Admin, name: string, args: Record<string, unknown>) {
  const r = await admin.rpc(name, args);
  if (r.error) {
    throw Error(
      [
        "shipping_insufficient_balance",
        "shipping_wallet_review",
        "shipping_unconfirmed_attempt",
        "authorization_changed",
        "return_quantity_review",
        "confirmation_expired",
      ].find((code) => String(r.error.message).includes(code)) ||
        "shipping_records_unavailable",
    );
  }
  return r.data;
}
const args = (s: ShippingScope) => ({
  p_store: s.store,
  p_conversation: s.conversation,
  p_case: s.caseId,
});
async function read(admin: Admin, s: ShippingScope) {
  return rpc(admin, "shipping_automation_read", args(s));
}
async function issue(admin: Admin, s: ShippingScope, reason: string) {
  try {
    await rpc(admin, "shipping_automation_issue", {
      ...args(s),
      p_reason: reason,
    });
  } catch { /* Do not let optional diagnostics mutate an uncertain booking. */ }
  return waiting(reason);
}
async function advance(
  admin: Admin,
  s: ShippingScope,
  from: string,
  to: string,
  ref: string | null = null,
) {
  return rpc(admin, "shipping_automation_advance", {
    ...args(s),
    p_from: from,
    p_to: to,
    p_return: ref,
  });
}
export async function bookConfirmedReturn(
  admin: Admin,
  s: ShippingScope,
  deps: Deps,
): Promise<ShippingResult> {
  if (!enabled(s)) return { state: "off" };
  let b: any;
  try {
    b = await read(admin, s);
  } catch {
    return waiting("PROVIDER_UNAVAILABLE");
  }
  if (!b?.collection) return waiting("ORDER_REVIEW");
  if (b.booking) return { state: "checking" }; // A retry must only reconcile the recorded attempt, never repeat a write.
  if (deps.photoReview) return issue(admin, s, "ORDER_REVIEW");
  if (!b.parcel) return issue(admin, s, "PARCEL_REQUIRED");
  const c = b.collection, settings = b.settings, parcel = b.parcel;
  if (
    c.state !== "DETAILS_CONFIRMED" || !c.ciphertext ||
    Date.parse(c.expires_at) <= Date.now() || !settings ||
    settings.state !== "APPROVED" || !settings.automatic_requested ||
    settings.version !== c.settings_version || !b.warehouse
  ) return issue(admin, s, "SETTINGS_CHANGED");
  let details: any, fresh: ShippingFresh;
  try {
    details = JSON.parse(await decrypt(c.ciphertext));
    if (
      details.store !== s.store || details.conversation !== s.conversation ||
      details.caseId !== s.caseId || details.recipientPhone !== s.sender ||
      !collectionOrderAllowed(details.orderId) ||
      !details.city || !details.address || !/^\d{4}$/.test(details.building) ||
      !/^\d{5}$/.test(details.postcode) || !deps.fresh
    ) throw Error();
    fresh = await deps.fresh({
      orderId: details.orderId,
      itemId: details.itemId,
      quantity: details.quantity,
    });
    if (
      fresh.facts.storeId !== s.store ||
      fresh.facts.orderId !== details.orderId || fresh.facts.currency !== "SAR"
    ) throw Error();
  } catch {
    return issue(admin, s, "ORDER_REVIEW");
  }
  const item = fresh.facts.items.find((x) => x.id === details.itemId);
  if (
    !item || item.sku !== parcel.sku || details.quantity !== parcel.quantity ||
    item.quantity < details.quantity || !item.name ||
    !fresh.facts.customerName || !Number.isFinite(item.price) || item.price < 0
  ) return issue(admin, s, "ORDER_REVIEW");
  let provider: ShippingProvider, courier: string, quote: number;
  try {
    provider = await (deps.provider || shippingProvider)();
    const list = await provider.request("/getPickupLocationList");
    const warehouse = Array.isArray(list.warehouses)
      ? list.warehouses.find((w: any) => w.code === b.warehouse.code)
      : null;
    if (
      list.success !== true || !warehouse ||
      !["Riyadh", "Jeddah", "Dammam"].includes(warehouse.city)
    ) return issue(admin, s, "SETTINGS_CHANGED");
    const view = {
      id: b.warehouse.id,
      name: b.warehouse.code.startsWith("RLDW")
        ? "Test return warehouse"
        : typeof warehouse.name === "string"
        ? warehouse.name
        : "Return warehouse",
      city: warehouse.city,
      address: String(warehouse.address).slice(0, 300),
    };
    if (
      await sha256(JSON.stringify(view)) !==
        settings.approved_warehouse_fingerprint
    ) return issue(admin, s, "SETTINGS_CHANGED");
    const response = await provider.request("/checkOTODeliveryFee", {
      originCity: warehouse.city,
      destinationCity: details.city,
      originCountry: "SA",
      destinationCountry: "SA",
      weight: parcel.weight_grams / 1000,
      length: parcel.length_mm / 10,
      width: parcel.width_mm / 10,
      height: parcel.height_mm / 10,
      packageCount: 1,
      totalDue: 0,
      currency: "SAR",
      forReverseShipment: true,
    });
    const rates = courierRates(response),
      available = settings.courier_ids.map((id: string) =>
        rates.find((r) =>
          r.id === id && r.sandboxBookable && r.price !== null && r.price > 0 &&
          (settings.collection_method === "PICKUP_BY_DC"
            ? ["pickup", "either"]
            : ["dropoff", "either"]).includes(r.pickup)
        )
      ).filter(Boolean);
    if (!available.length) return issue(admin, s, "COURIER_UNAVAILABLE");
    const chosen = available.find((r: any) =>
      money(r.price) <= settings.cap_halalas
    );
    if (!chosen) return issue(admin, s, "ABOVE_CAP");
    courier = chosen.id;
    quote = money(chosen.price);
    const account = await provider.request("/accountInfo");
    if (money(account.remainingCredit) < settings.cap_halalas) {
      return issue(admin, s, "PROVIDER_FUNDS");
    }
  } catch {
    return issue(admin, s, "PROVIDER_UNAVAILABLE");
  }
  let claimed: boolean;
  try {
    claimed = await rpc(admin, "shipping_automation_claim", {
      ...args(s),
      p_settings_version: settings.version,
      p_parcel_version: parcel.version,
      p_courier: courier,
      p_quote: quote,
      p_warehouse_fingerprint: settings.approved_warehouse_fingerprint,
      p_decision: fresh.decisionId,
    });
  } catch (error) {
    try {
      if ((await read(admin, s))?.booking) return { state: "checking" };
    } catch {}
    const code = error instanceof Error ? error.message : "";
    return issue(
      admin,
      s,
      ["shipping_insufficient_balance", "shipping_wallet_review"].includes(code)
        ? "BALANCE_REQUIRED"
        : ["authorization_changed", "confirmation_expired"].includes(code)
        ? "SETTINGS_CHANGED"
        : code === "return_quantity_review"
        ? "ORDER_REVIEW"
        : code === "shipping_unconfirmed_attempt"
        ? "BOOKING_UNCERTAIN"
        : "PROVIDER_UNAVAILABLE",
    );
  }
  if (!claimed) return { state: "checking" };
  const ref = "RLDTEST-" + c.id.replaceAll("-", "");
  let stage = "ORDER_CREATING";
  try {
    const order = await provider.request("/createOrder", {
      orderId: ref,
      pickupLocationCode: b.warehouse.code,
      createShipment: false,
      forReverseShipment: true,
      payment_method: "paid",
      amount: Number((item.price * details.quantity).toFixed(2)),
      amount_due: 0,
      currency: "SAR",
      packageCount: 1,
      packageWeight: parcel.weight_grams / 1000,
      boxLength: parcel.length_mm / 10,
      boxWidth: parcel.width_mm / 10,
      boxHeight: parcel.height_mm / 10,
      storeName: "Reload sandbox",
      customer: {
        name: fresh.facts.customerName,
        ...(fresh.facts.customerEmail
          ? { email: fresh.facts.customerEmail }
          : {}),
        mobile: s.sender,
        address: `${details.building}, ${details.address}, ${details.postcode}`,
        city: details.city,
        country: "SA",
        postcode: details.postcode,
      },
      items: [{
        name: item.name,
        sku: item.sku,
        quantity: details.quantity,
        price: item.price,
        rowTotal: Number((item.price * details.quantity).toFixed(2)),
      }],
    });
    if (order.success !== true || !/^\d+$/.test(String(order.otoId))) {
      throw Error();
    }
    await advance(admin, s, stage, "ORDER_READY");
    stage = "ORDER_READY";
    await advance(admin, s, stage, "RETURN_CREATING");
    stage = "RETURN_CREATING";
    const returned = await provider.request("/createReturnShipment", {
      orderId: ref,
      pickupLocationCode: b.warehouse.code,
      deliveryOptionId: courier,
      pickingType: settings.collection_method,
      items: [{ sku: item.sku, quantity: String(details.quantity) }],
    });
    const child = returned.returnOrderId;
    if (
      child !== undefined &&
      (!new RegExp("^" + ref + "-R[0-9]{1,6}$").test(String(child)))
    ) throw Error();
    // Preserve an exact returned child reference before interpreting its acknowledgement.
    if (child) {
      await advance(admin, s, stage, "RETURN_REQUESTED", String(child));
      stage = "RETURN_REQUESTED";
    }
    if (returned.success !== true) throw Error();
    if (!child) await advance(admin, s, stage, "RETURN_REQUESTED");
    return { state: "preparing" };
  } catch {
    try {
      await advance(admin, s, stage, "UNKNOWN");
    } catch {}
    try {
      await rpc(admin, "shipping_finish_attempt", {
        p_store: s.store,
        p_id: c.id,
        p_environment: "sandbox",
        p_state: "UNKNOWN",
      });
    } catch {}
    await issue(admin, s, "BOOKING_UNCERTAIN");
    return { state: "checking" };
  }
}
export async function checkConfirmedReturn(
  admin: Admin,
  s: ShippingScope,
  label = false,
  deps: Deps = {},
): Promise<ShippingResult> {
  if (!enabled(s)) return { state: "off" };
  let b: any;
  try {
    b = await read(admin, s);
  } catch {
    return waiting("PROVIDER_UNAVAILABLE");
  }
  if (!b?.booking) return { state: "off" };
  const j = b.booking, a = b.attempt;
  if (["ORDER_CREATING", "ORDER_READY"].includes(j.stage)) {
    return { state: "checking" };
  }
  try {
    const provider = await (deps.provider || shippingProvider)();
    const ref = j.return_ref || j.order_ref;
    const detail = await provider.request(
      `/orderDetails?orderId=${encodeURIComponent(ref)}`,
    );
    const reverse = ref === j.order_ref
      ? await provider.request("/getReturnDetails", { orderId: ref })
      : null;
    const bound = boundReverse(
      j.order_ref,
      b.warehouse.code,
      j.parcel_snapshot.sku,
      j.parcel_snapshot.quantity,
      detail,
      reverse,
    );
    await rpc(admin, "shipping_note_provider_reference", {
      p_store: s.store,
      p_id: j.attempt_id,
      p_environment: "sandbox",
      p_provider_ref: bound.shipment,
    });
    if (a?.state !== "BOOKED") {
      const shipments = await provider.request(
        `/shipmentTransactions?orderId=${
          encodeURIComponent(bound.orderRef)
        }&perPage=100&page=1`,
      );
      const credits = await provider.request(
        `/creditTransactions?orderId=${
          encodeURIComponent(bound.orderRef)
        }&perPage=100&page=1`,
      );
      const charge = verifiedCharge(
        bound.orderRef,
        bound.shipment,
        shipments,
        credits,
        detail.currency,
      );
      if (charge.halalas > a.approved_cap_halalas) {
        return issue(admin, s, "CHARGE_REVIEW");
      }
      await rpc(admin, "shipping_finish_attempt", {
        p_store: s.store,
        p_id: j.attempt_id,
        p_environment: "sandbox",
        p_state: "BOOKED",
        p_charge: charge.halalas,
        p_provider_ref: bound.shipment,
        p_evidence_ref: charge.evidence,
      });
    }
    if (j.stage !== "VERIFIED") {
      await advance(admin, s, j.stage, "VERIFIED", bound.orderRef);
    }
    const status = shipmentStatus(detail.status);
    const state = status === "checking"
      ? "checking"
      : status as ShippingResult["state"];
    // A preparing receipt cannot be turned into an accepted pickup; labels are exposed only once booked.
    const result: ShippingResult = { state, shipment: bound.shipment };
    if (
      label &&
      ["booked", "collected", "in_transit", "delivered"].includes(state)
    ) result.label = await provider.pdf(bound.orderRef, bound.shipment);
    return result;
  } catch {
    return { state: "checking" };
  }
}
