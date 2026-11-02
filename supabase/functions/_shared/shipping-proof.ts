/** Provider evidence parsing shared by sandbox tests and customer automation. */
export function shipmentStatus(value: unknown) {
  const statuses: Record<string, string> = {
    new: "preparing",
    newReturn: "preparing",
    returnShipmentProcessing: "preparing",
    returnShipmentCreated: "booked",
    returnPickedUp: "collected",
    returnInTransit: "in_transit",
    returnDelivered: "delivered",
    assignedToWarehouse: "preparing",
    shipmentCreated: "booked",
    searchingDriver: "booked",
    pickedUp: "collected",
    inTransit: "in_transit",
    outForDelivery: "in_transit",
    delivered: "delivered",
    returned: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
    failedDelivery: "needs_attention",
    deliveryFailed: "needs_attention",
  };
  return typeof value === "string" ? statuses[value] || "checking" : "checking";
}
/** Settle only an exact SAR shipment with matching, booked wallet debits. */
export function verifiedCharge(
  order: string,
  shipment: string,
  shipments: Record<string, any>,
  credits: Record<string, any>,
  verifiedCurrency?: string,
) {
  if (
    shipments.success !== true ||
    credits.success !== true ||
    !Array.isArray(shipments.shipments) ||
    !Array.isArray(credits.transactions) ||
    shipments.shipments.length >= 100 ||
    credits.transactions.length >= 100
  ) {
    throw Error("charge_unconfirmed");
  }
  const rows = shipments.shipments.filter(
    (r: any) =>
      r.orderId === order &&
      String(r.shipmentNumber ?? r.shipmentNumnber) === shipment &&
      (r.currency === undefined || r.currency === "SAR"),
  );
  if (
    rows.some(
      (r: any) =>
        r.shipmentType !== undefined &&
        !["reverse", "Reverse Shipment", "Return Shipment"].includes(
          r.shipmentType,
        ),
    ) ||
    rows.length !== 1 ||
    (rows[0].currency !== "SAR" && verifiedCurrency !== "SAR")
  ) {
    throw Error("charge_unconfirmed");
  }
  const amount = (v: unknown) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(v))) {
      throw Error("charge_unconfirmed");
    }
    const n = Math.round(Number(v) * 100);
    if (!Number.isSafeInteger(n) || n < 0) throw Error("charge_unconfirmed");
    return n;
  };
  const debits = credits.transactions.filter(
    (r: any) =>
      (r.orderID ?? r.orderId) === order &&
      String(r.shipmentID ?? r.shipmentId) === shipment,
  );
  if (!debits.length) throw Error("charge_unconfirmed");
  const seen = new Set<string>();
  let total = 0,
    base = 0;
  for (const r of debits) {
    if (
      (r.currency !== undefined && r.currency !== "SAR") ||
      (r.shipmentType !== undefined &&
        !["reverse", "Reverse Shipment", "Return Shipment"].includes(
          r.shipmentType,
        )) ||
      r.chargingType !== "charge" ||
      r.status !== "booked" ||
      !["dcFee", "otoFee", "vat", "tax", "extraWeight"].includes(
        r.transactionType,
      ) ||
      !/^\d+$/.test(String(r.ID ?? r.id)) ||
      seen.has(String(r.ID ?? r.id))
    ) {
      throw Error("charge_unconfirmed");
    }
    seen.add(String(r.ID ?? r.id));
    const a = amount(r.amount);
    total += a;
    if (r.transactionType === "dcFee") base += a;
  }
  if (
    base !== amount(rows[0].dcCharge ?? rows[0].shipmentCost) ||
    total <= 0 ||
    !Number.isSafeInteger(total)
  ) {
    throw Error("charge_unconfirmed");
  }
  return {
    halalas: total,
    evidence: "oto-charge:" + Array.from(seen).sort().join("-"),
  };
}

export function boundReverse(
  orderRef: string,
  warehouse: string,
  sku: string,
  quantity: number,
  detail: Record<string, any>,
  reverse: Record<string, any> | null,
) {
  if (
    detail.success !== true || detail.currency !== "SAR" ||
    typeof detail.orderId !== "string"
  ) throw Error("return_binding_unconfirmed");
  const child = new RegExp("^" + orderRef + "-R[0-9]{1,6}$");
  if (detail.orderId !== orderRef) {
    if (!child.test(detail.orderId)) throw Error("return_binding_unconfirmed");
    return { orderRef: detail.orderId, shipment: ref(detail.shipmentId) };
  }
  if (
    reverse?.success !== true || reverse.orderId !== orderRef ||
    reverse.returnLocationCode !== warehouse ||
    !Array.isArray(reverse.returnedItems) ||
    reverse.returnedItems.length !== 1 ||
    reverse.returnedItems[0].sku !== sku ||
    Number(reverse.returnedItems[0].quantityToBeReturned) !== quantity
  ) throw Error("return_binding_unconfirmed");
  const history = Array.isArray(detail.statusHistory)
    ? detail.statusHistory
    : [];
  const shipments = new Set<string>(
    history.filter((r: any) =>
      typeof r.status === "string" && r.status.startsWith("return") &&
      r.shipmentId
    ).map((r: any) => ref(r.shipmentId)),
  );
  if (shipments.size !== 1) throw Error("return_binding_unconfirmed");
  const shipment = Array.from(shipments)[0];
  if (detail.shipmentId && String(detail.shipmentId) !== shipment) {
    throw Error("return_binding_unconfirmed");
  }
  return { orderRef, shipment };
}
function ref(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^[-A-Za-z0-9_.:]{1,120}$/.test(String(value))
  ) throw Error("return_binding_unconfirmed");
  return String(value);
}
