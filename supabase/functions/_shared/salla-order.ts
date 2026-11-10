/** Only documented base slugs establish delivery; merchant labels can be renamed. */
export function sallaOrderStatus(order: Record<string, any>): string {
  const raw = typeof order.status === "string" ? order.status : order.status?.slug;
  const statuses: Record<string, string> = {
    delivered: "delivered", shipped: "shipped", delivering: "shipped",
    canceled: "cancelled", cancelled: "cancelled", restored: "returned",
    under_review: "processing", in_progress: "processing",
    payment_pending: "processing", waiting_for_payment_confirmation: "processing",
    payment_failed: "processing",
  };
  // "completed" is distinct from "delivered" in Salla. Unknown/custom statuses
  // remain missing facts so policy evaluation can request merchant review.
  return typeof raw === "string" ? statuses[raw.toLowerCase()] ?? "" : "";
}

export function sallaOrderReferenceMatches(order: Record<string, any>, reference: string): boolean {
  return order.reference_id !== undefined && order.reference_id !== null &&
    String(order.reference_id) === reference.trim();
}

/** Salla date objects carry their timezone separately from their date string. */
export function sallaOrderDate(value: unknown): string | null {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const date = typeof value === "string" ? value : typeof object?.date === "string" ? object.date : "";
  if (!date) return null;
  let raw = date.replace(" ", "T");
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const zone = object?.timezone;
    if (zone === "Asia/Riyadh") raw += "+03:00";
    else if (zone === "UTC" || zone === "Etc/UTC") raw += "Z";
    else if (typeof zone === "string" && /^[+-]\d{2}:\d{2}$/.test(zone)) raw += zone;
    else return null; // A server timezone is not evidence of the order timezone.
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
