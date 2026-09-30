import { corsHeaders, json } from "../_shared/http.ts";
import { verifyReturnFacts } from "../_shared/return-token.ts";
import { adminClient } from "../_shared/supabase.ts";

type Rule = { id: string; name: string; description: string; value: string; category: string; sourceExcerpt?: string };
type Item = { id: string; name: string; sku: string; price: number; quantity: number; imageUrl?: string };
type Facts = { storeId: string; orderId: string; orderDate: string; deliveryDate: string | null; orderStatus: string; customerEmail: string; customerName: string; items: Item[]; currency: string };
type Applied = { rule: Rule; passed: boolean; evaluatedValue: string; reasonCode: string };

function daysBetween(from: Date, to: Date) { return Math.floor((to.getTime() - from.getTime()) / 86_400_000); }

function evaluate(rule: Rule, facts: Facts, item: Item, quantity: number, reason: string, condition: string): Applied {
  const list = rule.value.split(",").map((value) => value.trim());
  if (rule.category === "window") {
    if (!facts.deliveryDate) return { rule, passed: false, evaluatedValue: "No delivery date available", reasonCode: "MISSING_DELIVERY_DATE" };
    const elapsed = daysBetween(new Date(facts.deliveryDate), new Date());
    const limit = Number.parseInt(rule.value, 10);
    const passed = elapsed >= 0 && elapsed <= limit;
    return { rule, passed, evaluatedValue: `${elapsed} days since delivery (window: ${limit} days)`, reasonCode: passed ? "WITHIN_WINDOW" : "OUTSIDE_WINDOW" };
  }
  if (rule.category === "reasons") { const passed = list.includes(reason); return { rule, passed, evaluatedValue: reason, reasonCode: passed ? "REASON_ALLOWED" : "REASON_NOT_ALLOWED" }; }
  if (rule.category === "conditions") { const passed = list.includes(condition); return { rule, passed, evaluatedValue: condition, reasonCode: passed ? "CONDITION_ALLOWED" : "CONDITION_NOT_ALLOWED" }; }
  if (rule.category === "exclusions") { const passed = !list.some((code) => item.sku.toLowerCase().startsWith(code.toLowerCase())); return { rule, passed, evaluatedValue: item.sku, reasonCode: passed ? "ITEM_NOT_EXCLUDED" : "ITEM_EXCLUDED" }; }
  if (rule.category === "order_status") {
    // A missing status is an unknown fact, not a failed check. Without this the
    // customer is auto-rejected when the platform omits the field, which
    // contradicts "every missing fact required by an active rule is
    // MANUAL_REVIEW; do not guess".
    if (!facts.orderStatus?.trim()) {
      return { rule, passed: false, evaluatedValue: "No order status available", reasonCode: "MISSING_ORDER_STATUS" };
    }
    const passed = list.includes(facts.orderStatus);
    return { rule, passed, evaluatedValue: facts.orderStatus, reasonCode: passed ? "ORDER_STATUS_OK" : "ORDER_STATUS_FAIL" };
  }
  if (rule.category === "quantity") { const max = Number.parseInt(rule.value, 10); const passed = quantity > 0 && quantity <= max && quantity <= item.quantity; return { rule, passed, evaluatedValue: `${quantity} requested (max ${max}, available ${item.quantity})`, reasonCode: passed ? "QUANTITY_OK" : "QUANTITY_EXCEEDED" }; }
  return { rule, passed: true, evaluatedValue: "N/A", reasonCode: "FALLBACK_OK" };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { verificationToken, itemId, quantity, reason, condition, action = "evaluate", decisionId } = await request.json();
    if (typeof verificationToken !== "string" || typeof itemId !== "string" || !Number.isInteger(quantity) || typeof reason !== "string" || typeof condition !== "string") return json({ error: "invalid_request" }, 400);
    const facts = await verifyReturnFacts<Facts>(verificationToken);
    const item = facts.items.find((entry) => entry.id === itemId);
    if (!item) return json({ error: "item_not_found" }, 400);

    const admin = adminClient();
    if (action === "create_case") {
      if (typeof decisionId !== "string") return json({ error: "decision_required" }, 400);
      const { data: savedDecision } = await admin.from("eligibility_decisions").select("id, store_id, order_id, outcome")
        .eq("id", decisionId).eq("store_id", facts.storeId).eq("order_id", facts.orderId).maybeSingle();
      if (!savedDecision || savedDecision.outcome === "NOT_ELIGIBLE") return json({ error: "case_not_allowed" }, 409);
      const { data: caseId, error } = await admin.rpc("create_return_case_from_decision", {
        p_decision_id: decisionId,
        p_customer_snapshot: { name: facts.customerName, email: facts.customerEmail },
        p_item_snapshot: { ...item, quantity, reason, condition },
      });
      if (error) throw error;
      return json({ caseId });
    }
    const { data: policy } = await admin.from("policy_versions").select("id, version_label, source_text, rules_snapshot, published_at")
      .eq("store_id", facts.storeId).order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (!policy) return json({ error: "published_policy_required" }, 409);
    const rules = Array.isArray(policy.rules_snapshot) ? policy.rules_snapshot as Rule[] : [];
    if (rules.length === 0) return json({ error: "published_policy_required" }, 409);
    const appliedRules = rules.map((rule) => evaluate(rule, facts, item, quantity, reason, condition));
    const failures = appliedRules.filter((entry) => !entry.passed);
    const missing = failures.some((entry) => ["MISSING_DELIVERY_DATE", "MISSING_ORDER_STATUS"].includes(entry.reasonCode));
    const outcome = missing ? "MANUAL_REVIEW" : failures.length ? "NOT_ELIGIBLE" : "ELIGIBLE";
    const reasonCodes = failures.length ? failures.map((entry) => entry.reasonCode) : ["ALL_RULES_PASSED"];
    const first = failures[0];
    const explanation = outcome === "ELIGIBLE" ? "This item qualifies for return. All policy conditions are met."
      : outcome === "MANUAL_REVIEW" ? "Required order information is missing, so the store needs to review this request."
      : `This item is outside the return policy: ${first?.rule.name ?? "policy condition"}, ${first?.evaluatedValue ?? "not met"}.`;
    const windowRule = rules.find((rule) => rule.category === "window");
    let deadline: string | undefined;
    if (windowRule && facts.deliveryDate) { const date = new Date(facts.deliveryDate); date.setDate(date.getDate() + Number.parseInt(windowRule.value, 10)); deadline = date.toISOString(); }
    const decision = {
      outcome, reasonCodes, explanation, appliedRules,
      policyVersionId: policy.id, policyVersionLabel: policy.version_label,
      evaluatedAt: new Date().toISOString(), deadline,
      relevantFacts: [{ label: "Order", value: facts.orderId }, { label: "Item", value: item.name }, { label: "Quantity requested", value: String(quantity) }, { label: "Order status", value: facts.orderStatus }, { label: "Delivery date", value: facts.deliveryDate ?? "Not available" }],
    };
    let decisionIdSaved: string | null = null;
    {
      const { data, error } = await admin.rpc("record_return_decision", {
        p_store_id: facts.storeId, p_policy_version_id: policy.id, p_order_id: facts.orderId,
        p_outcome: outcome, p_reason_codes: reasonCodes, p_order_facts: facts,
        p_policy_snapshot: { ...policy, rules_snapshot: rules },
        p_customer_snapshot: { name: facts.customerName, email: facts.customerEmail },
        p_item_snapshot: { ...item, quantity, reason, condition }, p_create_case: false,
      });
      if (error) throw error;
      decisionIdSaved = data?.[0]?.decision_id ?? null;
    }
    return json({ decision, decisionId: decisionIdSaved });
  } catch (error) {
    console.error("return_decision_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "return_decision_failed" }, 500);
  }
});
