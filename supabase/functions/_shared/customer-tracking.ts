import type { ZidOrderTracking } from "./zid-product.ts";

/** Shipment facts only. Customer identity and addresses never enter this reply. */
export function trackingMessage(store: string, tracking: ZidOrderTracking, language: "ar" | "en") {
  const ar = language === "ar";
  const labels: Record<string, [string, string]> = {
    processing: ["قيد التجهيز", "Preparing your order"],
    shipped: ["في الطريق إليك", "On its way"],
    delivered: ["تم التوصيل", "Delivered"],
    cancelled: ["ملغي", "Cancelled"],
    returned: ["تم الإرجاع", "Returned"],
  };
  const status = labels[tracking.status]?.[ar ? 0 : 1] ?? (ar ? "الحالة تحتاج تأكيد من المتجر" : "The store needs to confirm the status");
  const clean = (v: string) => v.replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 160);
  const lines = [ar ? `هذا آخر تحديث لطلبك من ${clean(store)}:` : `Here’s the latest on your ${clean(store)} order:`, "",
    `${ar ? "رقم الطلب" : "Order"}: ${clean(tracking.orderNumber)}`,
    `${ar ? "الحالة" : "Status"}: ${status}`];
  if (tracking.courier) lines.push(`${ar ? "شركة الشحن" : "Courier"}: ${clean(tracking.courier)}`);
  if (tracking.trackingNumber) lines.push(`${ar ? "رقم التتبع" : "Tracking number"}: ${clean(tracking.trackingNumber)}`);
  if (tracking.trackingUrl) {
    try {
      if (new URL(tracking.trackingUrl).protocol === "https:" && !/\s/.test(tracking.trackingUrl) && tracking.trackingUrl.length <= 1200)
        lines.push("", ar ? "تابع شحنتك هنا:" : "Track your shipment here:", tracking.trackingUrl);
    } catch { /* An invalid link is omitted, never repaired or guessed. */ }
  }
  lines.push("", ar ? "تحتاج مساعدة ثانية؟ اكتب «القائمة»." : "Need anything else? Type MENU.");
  return lines.join("\n");
}
