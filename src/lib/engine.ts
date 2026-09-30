import {
  type EligibilityDecision,
  type EligibilityOutcome,
  type AppliedRuleResult,
  type PolicyVersion,
  type DeliveryFacts,
  type ReturnReason,
  type ItemCondition,
  type PolicyRule,
  daysBetween,
  DEMO_CLOCK,
} from "./domain";

interface EvaluationInput {
  policyVersion: PolicyVersion;
  facts: DeliveryFacts;
  itemId: string;
  quantity: number;
  reason: ReturnReason;
  condition: ItemCondition;
}

export function evaluateEligibility(input: EvaluationInput): EligibilityDecision {
  const { policyVersion, facts, itemId, quantity, reason, condition } = input;
  const appliedRules: AppliedRuleResult[] = [];
  const reasonCodes: string[] = [];
  const relevantFacts: { label: string; value: string }[] = [];

  const item = facts.items.find((i) => i.id === itemId);
  if (!item) {
    return {
      outcome: "MANUAL_REVIEW",
      reasonCodes: ["ITEM_NOT_FOUND"],
      explanation: "The item could not be found in the order. This case needs manual review.",
      appliedRules: [],
      policyVersionId: policyVersion.id,
      policyVersionLabel: policyVersion.versionLabel,
      evaluatedAt: DEMO_CLOCK.now.toISOString(),
      relevantFacts: [{ label: "Order", value: facts.orderId }],
    };
  }

  relevantFacts.push(
    { label: "Order", value: facts.orderId },
    { label: "Item", value: item.name },
    { label: "Quantity requested", value: String(quantity) },
    { label: "Reason", value: reason },
    { label: "Condition", value: condition },
  );

  if (facts.deliveryDate) {
    const delivery = new Date(facts.deliveryDate);
    const daysSinceDelivery = daysBetween(delivery, DEMO_CLOCK.now);
    relevantFacts.push({ label: "Delivery date", value: facts.deliveryDate });
    relevantFacts.push({ label: "Days since delivery", value: String(daysSinceDelivery) });
  } else {
    relevantFacts.push({ label: "Delivery date", value: "Not available" });
  }

  let hasFailingRule = false;
  let hasMissingData = false;

  for (const rule of policyVersion.rules) {
    const result = evaluateRule(rule, facts, item, quantity, reason, condition);
    appliedRules.push(result);
    if (!result.passed) {
      hasFailingRule = true;
      reasonCodes.push(result.reasonCode);
      if (result.reasonCode === "MISSING_DELIVERY_DATE" || result.reasonCode === "MISSING_ORDER_STATUS") {
        hasMissingData = true;
      }
    }
  }

  let outcome: EligibilityOutcome;
  let explanation: string;
  let deadline: string | undefined;

  if (hasMissingData) {
    outcome = "MANUAL_REVIEW";
    const missing = appliedRules.find((r) => r.reasonCode === "MISSING_DELIVERY_DATE");
    explanation = missing
      ? "The delivery date is not available, so the return window cannot be calculated. Your store needs to take a closer look."
      : "Required order information is missing. Your store needs to take a closer look.";
  } else if (hasFailingRule) {
    const firstFailure = appliedRules.find((r) => !r.passed && r.reasonCode !== "MISSING_DELIVERY_DATE");
    outcome = "NOT_ELIGIBLE";
    explanation = firstFailure
      ? `This item is outside the return policy: ${firstFailure.rule.name.toLowerCase()}, ${firstFailure.evaluatedValue}.`
      : "This item is outside the return policy.";
  } else {
    outcome = "ELIGIBLE";
    const windowRule = policyVersion.rules.find((r) => r.category === "window");
    if (windowRule && facts.deliveryDate) {
      const delivery = new Date(facts.deliveryDate);
      const windowDays = parseInt(windowRule.value, 10);
      const deadlineDate = new Date(delivery);
      deadlineDate.setDate(deadlineDate.getDate() + windowDays);
      deadline = deadlineDate.toISOString();
    }
    explanation = "This item qualifies for return. All policy conditions are met.";
  }

  return {
    outcome,
    reasonCodes,
    explanation,
    appliedRules,
    policyVersionId: policyVersion.id,
    policyVersionLabel: policyVersion.versionLabel,
    evaluatedAt: DEMO_CLOCK.now.toISOString(),
    relevantFacts,
    deadline,
  };
}

function evaluateRule(
  rule: PolicyRule,
  facts: DeliveryFacts,
  item: { id: string; name: string; sku: string; price: number; quantity: number },
  requestedQuantity: number,
  reason: ReturnReason,
  condition: ItemCondition,
): AppliedRuleResult {
  switch (rule.category) {
    case "window":
      return evaluateWindowRule(rule, facts);
    case "reasons":
      return evaluateReasonRule(rule, reason);
    case "conditions":
      return evaluateConditionRule(rule, condition);
    case "exclusions":
      return evaluateExclusionRule(rule, item);
    case "order_status":
      return evaluateOrderStatusRule(rule, facts);
    case "quantity":
      return evaluateQuantityRule(rule, item, requestedQuantity);
    case "fallback":
      return { rule, passed: true, evaluatedValue: "N/A", reasonCode: "FALLBACK_OK" };
    default:
      return { rule, passed: true, evaluatedValue: "N/A", reasonCode: "RULE_OK" };
  }
}

function evaluateWindowRule(rule: PolicyRule, facts: DeliveryFacts): AppliedRuleResult {
  if (!facts.deliveryDate) {
    return {
      rule,
      passed: false,
      evaluatedValue: "No delivery date available",
      reasonCode: "MISSING_DELIVERY_DATE",
    };
  }
  const delivery = new Date(facts.deliveryDate);
  const daysSince = daysBetween(delivery, DEMO_CLOCK.now);
  const windowDays = parseInt(rule.value, 10);
  const withinWindow = daysSince >= 0 && daysSince <= windowDays;
  return {
    rule,
    passed: withinWindow,
    evaluatedValue: `${daysSince} days since delivery (window: ${windowDays} days)`,
    reasonCode: withinWindow ? "WITHIN_WINDOW" : "OUTSIDE_WINDOW",
  };
}

function evaluateReasonRule(rule: PolicyRule, reason: ReturnReason): AppliedRuleResult {
  const allowedReasons = rule.value.split(",").map((r) => r.trim());
  const passed = allowedReasons.includes(reason);
  return {
    rule,
    passed,
    evaluatedValue: reason,
    reasonCode: passed ? "REASON_ALLOWED" : "REASON_NOT_ALLOWED",
  };
}

function evaluateConditionRule(rule: PolicyRule, condition: ItemCondition): AppliedRuleResult {
  const allowedConditions = rule.value.split(",").map((c) => c.trim());
  const passed = allowedConditions.includes(condition);
  return {
    rule,
    passed,
    evaluatedValue: condition,
    reasonCode: passed ? "CONDITION_ALLOWED" : "CONDITION_NOT_ALLOWED",
  };
}

function evaluateExclusionRule(
  rule: PolicyRule,
  item: { id: string; name: string; sku: string; price: number; quantity: number },
): AppliedRuleResult {
  const excludedSkus = rule.value.split(",").map((s) => s.trim().toLowerCase());
  const passed = !excludedSkus.includes(item.sku.toLowerCase());
  return {
    rule,
    passed,
    evaluatedValue: item.sku,
    reasonCode: passed ? "ITEM_NOT_EXCLUDED" : "ITEM_EXCLUDED",
  };
}

function evaluateOrderStatusRule(rule: PolicyRule, facts: DeliveryFacts): AppliedRuleResult {
  const allowedStatuses = rule.value.split(",").map((s) => s.trim());
  const passed = allowedStatuses.includes(facts.orderStatus);
  return {
    rule,
    passed,
    evaluatedValue: facts.orderStatus,
    reasonCode: passed ? "ORDER_STATUS_OK" : "ORDER_STATUS_FAIL",
  };
}

function evaluateQuantityRule(
  rule: PolicyRule,
  item: { id: string; name: string; sku: string; price: number; quantity: number },
  requestedQuantity: number,
): AppliedRuleResult {
  const maxQty = parseInt(rule.value, 10);
  const passed = requestedQuantity <= maxQty && requestedQuantity <= item.quantity;
  return {
    rule,
    passed,
    evaluatedValue: `${requestedQuantity} requested (max ${maxQty}, available ${item.quantity})`,
    reasonCode: passed ? "QUANTITY_OK" : "QUANTITY_EXCEEDED",
  };
}
