/** Pure OTO rate parsing used by both the website and the Edge worker. */
export type CourierRate = {
  id: string;
  name: string;
  price: number | null;
  returnFee: number | null;
  currency: "SAR";
  pickup: "pickup" | "dropoff" | "either" | "unknown";
  estimate: string | null;
  sandboxBookable: boolean;
};

function amount(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value))
  ) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? n : null;
}
function label(value: unknown, max: number): string | null {
  return typeof value === "string" &&
      value.trim() &&
      value.length <= max &&
      !/[\u0000-\u001f<>]/.test(value)
    ? value.trim()
    : null;
}
/** Only documented sandbox test couriers can ever be considered for a future booking. */
const sandboxIds = new Set(["2828", "56468", "56469", "56470", "56471"]);
export function courierRates(value: unknown): CourierRate[] {
  const v = value as { success?: unknown; deliveryCompany?: unknown } | null;
  if (
    v?.success !== true ||
    !Array.isArray(v.deliveryCompany) ||
    v.deliveryCompany.length > 200
  ) {
    throw new Error("provider_response");
  }
  const seen = new Set<string>();
  const rates: CourierRate[] = [];
  for (const row of v.deliveryCompany) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.deliveryOptionId ?? "");
    const name = label(row.deliveryOptionName, 160);
    if (
      !/^\d{1,12}$/.test(id) ||
      !name ||
      seen.has(id) ||
      (row.currency !== undefined && row.currency !== "SAR")
    ) {
      continue;
    }
    const price = amount(row.price),
      returnFee = amount(row.returnFee);
    if (price === null && returnFee === null) continue;
    seen.add(id);
    rates.push({
      id,
      name,
      price,
      returnFee,
      currency: "SAR",
      pickup: row.pickupDropoff === "freePickup"
        ? "pickup"
        : row.pickupDropoff === "freeDropoff"
        ? "dropoff"
        : row.pickupDropoff === "freePickupDropoff"
        ? "either"
        : "unknown",
      estimate: label(row.avgDeliveryTime, 100),
      sandboxBookable: sandboxIds.has(id),
    });
  }
  return rates.sort(
    (a, b) => (a.returnFee ?? Infinity) - (b.returnFee ?? Infinity),
  );
}
