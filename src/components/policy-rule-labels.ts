import { CalendarDays, Hash, ListChecks, PackageCheck, PackageX, Truck, UserRound, type LucideIcon } from "lucide-react";
import type { PolicyRule } from "@/lib/domain";

/*
 * One place that turns a policy rule's stored codes into words a merchant
 * reads: its title, a one-line explanation, its values as labels, and the
 * sentence it becomes for a customer. Used while reviewing proposed rules and
 * again on the publish page, so both always say the same thing.
 */

type T = (en: string, ar: string) => string;

const valueLabels = (t: T): Record<string, string> => ({
  defective: t("Faulty item", "منتج معيب"),
  wrong_item: t("Wrong item received", "استلام منتج مختلف"),
  not_as_described: t("Not as described", "غير مطابق للوصف"),
  damaged_in_transit: t("Damaged during delivery", "تلف أثناء التوصيل"),
  changed_mind: t("Changed mind", "تغيير الرأي"),
  new_unopened: t("New and unopened", "جديد وغير مفتوح"),
  opened_unused: t("Opened but unused", "مفتوح ولم يُستخدم"),
  used: t("Used", "مستخدم"),
  delivered: t("Delivered", "تم التسليم"),
  shipped: t("Shipped", "تم الشحن"),
  processing: t("Processing", "قيد التجهيز"),
  cancelled: t("Cancelled", "ملغي"),
  manual_review: t("Ask the store to review", "إحالة الطلب إلى المتجر للمراجعة"),
});

const codes = (rule: PolicyRule) => rule.value.split(",").map((value) => value.trim()).filter(Boolean);

export function describeRule(rule: PolicyRule, t: T): { title: string; help: string; icon: LucideIcon; values: string[] } {
  const presentation: Record<string, { title: string; icon: LucideIcon; help: string }> = {
    window: { title: t("Return period", "مهلة الإرجاع"), icon: CalendarDays, help: t("Counted from the delivery date.", "تُحسب من تاريخ التسليم.") },
    reasons: { title: t("Accepted reasons", "أسباب الإرجاع المقبولة"), icon: ListChecks, help: t("Customers can request a return for these reasons.", "يمكن للعميل طلب الإرجاع للأسباب التالية.") },
    conditions: { title: t("Item condition", "حالة المنتج"), icon: PackageCheck, help: t("The item must be in one of these conditions.", "يجب أن يكون المنتج بإحدى الحالات التالية.") },
    exclusions: { title: t("Excluded product codes", "رموز المنتجات المستثناة"), icon: PackageX, help: t("Items with these exact product codes cannot be returned.", "لا يُقبل إرجاع المنتجات التي تطابق رموزها الرموز التالية تمامًا.") },
    order_status: { title: t("Order status", "حالة الطلب"), icon: Truck, help: t("Returns are accepted for orders in these states.", "يُقبل الإرجاع للطلبات في الحالات التالية.") },
    quantity: { title: t("Quantity limit", "الحد الأقصى للكمية"), icon: Hash, help: t("Cannot exceed the quantity in the order.", "لا يمكن تجاوز الكمية الموجودة في الطلب.") },
    fallback: { title: t("When information is missing", "عند نقص المعلومات"), icon: UserRound, help: t("If the delivery date or order status cannot be verified.", "إذا تعذّر التحقق من تاريخ التسليم أو حالة الطلب.") },
  };
  const labels = valueLabels(t);
  const values = rule.category === "window"
    ? [t(`${rule.value} days after delivery`, `${rule.value} يومًا من التسليم`)]
    : rule.category === "quantity"
      ? [t(`Up to ${rule.value} per item`, `حتى ${rule.value} من كل منتج`)]
      : codes(rule).map((code) => (rule.category === "exclusions" ? code : labels[code] ?? code));
  return { ...(presentation[rule.category] ?? { title: rule.name, icon: ListChecks, help: rule.description ?? "" }), values };
}

/** The rule as one plain sentence about what happens to a customer's request. */
export function customerSentence(rule: PolicyRule, t: T): string | null {
  const labels = valueLabels(t);
  const list = (items: string[], or = false) => {
    const joiner = or ? t(" or ", " أو ") : t(" and ", " و");
    return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(t(", ", "، "))}${joiner}${items[items.length - 1]}`;
  };
  const named = codes(rule).map((code) => (labels[code] ?? code).toLowerCase());
  switch (rule.category) {
    case "window": return t(`A return can be requested up to ${rule.value} days after delivery.`, `يمكن طلب الإرجاع حتى ${rule.value} يومًا بعد التسليم.`);
    case "reasons": return t(`Accepted when the reason is: ${list(named, true)}.`, `يُقبل عندما يكون السبب: ${list(named, true)}.`);
    case "conditions": return t(`The item must be ${list(named, true)}.`, `يجب أن يكون المنتج ${list(named, true)}.`);
    case "exclusions": return t(`Products with the code ${list(codes(rule), true)} can't be returned.`, `المنتجات ذات الرمز ${list(codes(rule), true)} لا تُرجع.`);
    case "order_status": return t(`The order must be ${list(named, true)}.`, `يجب أن تكون حالة الطلب: ${list(named, true)}.`);
    case "quantity": return t(`Up to ${rule.value} of each item can come back.`, `يمكن إرجاع حتى ${rule.value} من كل منتج.`);
    case "fallback": return codes(rule).includes("manual_review")
      ? t("If the delivery date or order status can't be confirmed, the request comes to you to decide.", "إذا تعذّر تأكيد تاريخ التسليم أو حالة الطلب، يُحال الطلب إليك للقرار.")
      : null;
    default: return null;
  }
}
