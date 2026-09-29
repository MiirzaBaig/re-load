/**
 * Reconstruct a decision's per-rule result from what the database stores.
 *
 * `return-decide` evaluates every rule but persists only the failing reason
 * codes, plus the frozen rules (`policy_snapshot.rules_snapshot`) and order
 * facts (`order_facts_snapshot`). Every rule that fails emits exactly one code
 * for its category, so a rule's result is fully determined by whether its
 * category's code appears. Nothing here is re-evaluated against today's date:
 * the receipt shows the decision as it was made.
 */

export type RuleState = "passed" | "failed" | "missing";

export interface ReceiptRule {
  id: string;
  name: string;
  description: string;
  value: string;
  category: string;
  sourceExcerpt?: string;
  state: RuleState;
  reasonCode?: string;
}

/** Failure codes by rule category, as emitted by return-decide. */
const FAILURE_CODES: Record<string, { failed: string[]; missing: string[] }> = {
  window: { failed: ["OUTSIDE_WINDOW"], missing: ["MISSING_DELIVERY_DATE"] },
  reasons: { failed: ["REASON_NOT_ALLOWED"], missing: [] },
  conditions: { failed: ["CONDITION_NOT_ALLOWED"], missing: [] },
  exclusions: { failed: ["ITEM_EXCLUDED"], missing: [] },
  order_status: { failed: ["ORDER_STATUS_FAIL"], missing: ["MISSING_ORDER_STATUS"] },
  quantity: { failed: ["QUANTITY_EXCEEDED"], missing: [] },
};

export function receiptRules(
  rulesSnapshot: unknown,
  reasonCodes: string[],
): ReceiptRule[] {
  if (!Array.isArray(rulesSnapshot)) return [];
  const codes = new Set(reasonCodes);
  return rulesSnapshot.map((raw: Record<string, unknown>, index) => {
    const category = String(raw.category ?? "");
    const map = FAILURE_CODES[category];
    const missing = map?.missing.find((code) => codes.has(code));
    const failed = map?.failed.find((code) => codes.has(code));
    return {
      id: String(raw.id ?? index),
      name: String(raw.name ?? "Rule"),
      description: String(raw.description ?? ""),
      value: String(raw.value ?? ""),
      category,
      sourceExcerpt: typeof raw.sourceExcerpt === "string" && raw.sourceExcerpt.trim()
        ? raw.sourceExcerpt
        : undefined,
      state: missing ? "missing" : failed ? "failed" : "passed",
      reasonCode: missing ?? failed,
    };
  });
}

type T = (en: string, ar: string) => string;

export const reasonLabel = (reason: string, t: T) =>
  ({
    defective: t("Item is defective", "المنتج معيب"),
    wrong_item: t("Wrong item received", "استلم منتجًا خاطئًا"),
    not_as_described: t("Not as described", "غير مطابق للوصف"),
    changed_mind: t("Changed their mind", "غيّر رأيه"),
    damaged_in_transit: t("Damaged in transit", "تضرر أثناء الشحن"),
  })[reason] ?? reason;

export const conditionLabel = (condition: string, t: T) =>
  ({
    new_unopened: t("New, unopened", "جديد، غير مفتوح"),
    opened_unused: t("Opened, unused", "مفتوح، غير مستخدم"),
    used: t("Used", "مستخدم"),
  })[condition] ?? condition;

export const statusLabel = (status: string, t: T) =>
  ({
    OPEN: t("Open", "مفتوحة"),
    AWAITING_ITEM: t("Awaiting item", "بانتظار المنتج"),
    RECEIVED: t("Item received", "تم استلام المنتج"),
    RESOLVED: t("Resolved", "مغلقة"),
    CANCELLED: t("Cancelled", "ملغاة"),
  })[status] ?? status;
