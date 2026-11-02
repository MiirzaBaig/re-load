import { sampleParcel } from "./contracts";
export type ReturnTestInput = {
  name: string;
  email: string;
  phone: string;
  customerAddress: string;
  warehouseAddress: string;
  courierId: string;
  capHalalas: number;
  consent: true;
};
const ids = new Set(["2828", "56468", "56469", "56470", "56471"]);
function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string") throw Error("invalid_input");
  const s = value.trim();
  if (s.length < min || s.length > max || /[\u0000-\u001f<>]/.test(s))
    throw Error("invalid_input");
  return s;
}
export function returnTestInput(value: unknown): ReturnTestInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("invalid_input");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "name",
          "email",
          "phone",
          "customerAddress",
          "warehouseAddress",
          "courierId",
          "capHalalas",
          "consent",
        ].includes(k),
    ) ||
    v.consent !== true
  )
    throw Error("invalid_input");
  const phone = testDigits(text(v.phone, 9, 25))
    .replace(/[\s()+-]/g, "")
    .replace(/^00966/, "966")
    .replace(/^0(?=5)/, "966");
  const email = text(v.email, 5, 254).toLowerCase();
  if (
    !/^9665\d{8}$/.test(phone) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !ids.has(String(v.courierId)) ||
    !Number.isSafeInteger(v.capHalalas) ||
    Number(v.capHalalas) < 100 ||
    Number(v.capHalalas) > 1000000
  )
    throw Error("invalid_input");
  return {
    name: text(v.name, 2, 80),
    email,
    phone,
    customerAddress: text(v.customerAddress, 12, 300),
    warehouseAddress: text(v.warehouseAddress, 12, 300),
    courierId: String(v.courierId),
    capHalalas: Number(v.capHalalas),
    consent: true,
  };
}
export function testReferences(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw Error("invalid_input");
  return {
    warehouse: "RLDW" + id.replaceAll("-", ""),
    order: "RLDTEST-" + id.replaceAll("-", ""),
  };
}
export function testWarehouse(id: string, input: ReturnTestInput) {
  return {
    type: "warehouse",
    code: testReferences(id).warehouse,
    name: "Reload sandbox " + id,
    mobile: input.phone,
    address: input.warehouseAddress,
    contactName: input.name,
    contactEmail: input.email,
    city: "Riyadh",
    country: "SA",
  };
}
export function testOrder(id: string, input: ReturnTestInput) {
  return {
    orderId: testReferences(id).order,
    pickupLocationCode: testReferences(id).warehouse,
    createShipment: false,
    forReverseShipment: true,
    payment_method: "paid",
    amount: 100,
    amount_due: 0,
    currency: "SAR",
    packageCount: 1,
    packageWeight: sampleParcel.weight,
    boxLength: sampleParcel.length,
    boxWidth: sampleParcel.width,
    boxHeight: sampleParcel.height,
    storeName: "Reload sandbox",
    customer: {
      name: input.name,
      email: input.email,
      mobile: input.phone,
      address: input.customerAddress,
      city: "Riyadh",
      country: "SA",
    },
    items: [
      {
        name: "Sandbox shoes",
        sku: "RLD-TEST-SHOES",
        quantity: 1,
        price: 100,
        rowTotal: 100,
      },
    ],
  };
}
export function testReturn(id: string, input: ReturnTestInput) {
  return {
    orderId: testReferences(id).order,
    pickupLocationCode: testReferences(id).warehouse,
    deliveryOptionId: input.courierId,
    pickingType: "PICKUP_BY_DC",
    items: [{ sku: "RLD-TEST-SHOES", quantity: "1" }],
  };
}
export function returnReference(id: string, value: unknown): string {
  if (
    typeof value !== "string" ||
    !new RegExp("^" + testReferences(id).order + "-R[0-9]{1,6}$").test(value)
  )
    throw Error("provider_response");
  return value;
}

export function shipmentReference(value: unknown): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^[A-Za-z0-9_.:-]{1,120}$/.test(String(value))
  )
    throw Error("provider_response");
  return String(value);
}
export { shipmentStatus, verifiedCharge } from "../../../supabase/functions/_shared/shipping-proof.ts";

export function testDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (c) =>
    String(c.charCodeAt(0) - (c <= "٩" ? 0x660 : 0x6f0)),
  );
}

/** Legacy OTO staging retains the parent ID for a reverse-only shipment.
 * Accept it only with exact reverse warehouse/item and return-history proof. */
export function verifiedReturnBinding(
  id: string,
  detail: Record<string, any>,
  reverse: Record<string, any> | null,
) {
  const refs = testReferences(id);
  if (detail.success !== true || detail.currency !== "SAR")
    throw Error("return_binding_unconfirmed");
  if (detail.orderId !== refs.order) {
    returnReference(id, detail.orderId);
    return {
      orderRef: detail.orderId,
      shipment: detail.shipmentId ? shipmentReference(detail.shipmentId) : null,
    };
  }
  if (
    reverse?.success !== true ||
    reverse.orderId !== refs.order ||
    reverse.returnLocationCode !== refs.warehouse ||
    !Array.isArray(reverse.returnedItems) ||
    reverse.returnedItems.length !== 1 ||
    reverse.returnedItems[0].sku !== "RLD-TEST-SHOES" ||
    Number(reverse.returnedItems[0].quantityToBeReturned) !== 1
  )
    throw Error("return_binding_unconfirmed");
  const history = Array.isArray(detail.statusHistory)
    ? detail.statusHistory
    : [];
  const shipments = new Set<string>(
    history
      .filter(
        (r: any) =>
          typeof r.status === "string" &&
          r.status.startsWith("return") &&
          r.shipmentId,
      )
      .map((r: any) => shipmentReference(r.shipmentId)),
  );
  if (shipments.size !== 1) throw Error("return_binding_unconfirmed");
  const shipment = Array.from(shipments)[0];
  if (detail.shipmentId && String(detail.shipmentId) !== shipment)
    throw Error("return_binding_unconfirmed");
  return { orderRef: refs.order, shipment };
}
