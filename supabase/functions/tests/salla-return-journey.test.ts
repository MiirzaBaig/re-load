import { assert, contact, daysAgo, fixture } from "./fixtures/salla-return-harness.ts";

Deno.test("dummy Salla order passes real verification, signing, policy decision and case handlers", async () => fixture(async h => {
  const order = await h.lookup();
  assert(order.status === 200 && order.order.customerName === "Omar Demo");
  const result = await h.evaluate(order.verificationToken);
  assert(result.status === 200 && result.decision.outcome === "ELIGIBLE");
  assert(h.state.cases.length === 0, "checking eligibility must not submit a case");
  const submitted = await h.evaluate(order.verificationToken, { action: "create_case", decisionId: result.decisionId });
  assert(submitted.status === 200 && submitted.caseId && h.state.cases.length === 1);
}));

Deno.test("dummy identity, order reference and store routing reject without signing private facts", async () => fixture(async h => {
  for (const input of [{ verifier: "966500000001" }, { orderNumber: "90002" }, { returnCode: "foreign-workspace-code" }]) {
    const result = await h.lookup(input);
    assert(result.status === 404 && !result.order && !result.verificationToken);
  }
  h.state.wrongCandidate = true;
  assert((await h.lookup()).status === 404, "first search result must match exact reference");
  assert(h.state.decisions.length === 0 && h.state.cases.length === 0);
}));

Deno.test("dummy unavailable and throttled lookups provide recoverable errors", async () => fixture(async h => {
  h.state.outage = true;
  assert((await h.lookup()).error === "order_lookup_unavailable");
  h.state.outage = false; h.state.rateAllowed = false;
  assert((await h.lookup()).status === 429);
  h.state.rateAllowed = true;
  assert((await h.lookup()).status === 200);
}));

for (const scenario of ["old", "delivering", "missing-date", "completed", "used", "excluded", "too-many"] as const) {
  Deno.test(`dummy policy scenario: ${scenario}`, async () => fixture(async h => {
    let changes: Record<string, unknown> = {};
    if (scenario === "old") h.order.delivered_at = daysAgo(20);
    if (scenario === "delivering") h.order.status.slug = "delivering";
    if (scenario === "missing-date") h.order.delivered_at = "";
    if (scenario === "completed") h.order.status.slug = "completed";
    if (scenario === "used") changes = { condition: "used" };
    if (scenario === "excluded") h.items[0].sku = "FINAL-DEMO";
    if (scenario === "too-many") changes = { quantity: 3 };
    const order = await h.lookup();
    const result = await h.evaluate(order.verificationToken, changes);
    const expected = ["missing-date", "completed"].includes(scenario) ? "MANUAL_REVIEW" : "NOT_ELIGIBLE";
    assert(result.status === 200 && result.decision.outcome === expected, `${scenario}: ${JSON.stringify(result)}`);
    if (expected === "NOT_ELIGIBLE") {
      const denied = await h.evaluate(order.verificationToken, { ...changes, action: "create_case", decisionId: result.decisionId });
      assert(denied.status === 409 && h.state.cases.length === 0);
    }
  }));
}

Deno.test("dummy workspace without a published policy cannot evaluate or create a case", async () => fixture(async h => {
  h.state.policyPublished = false;
  const order = await h.lookup();
  const result = await h.evaluate(order.verificationToken);
  assert(result.status === 409 && result.error === "published_policy_required");
  assert(h.state.decisions.length === 0 && h.state.cases.length === 0);
}));

Deno.test("dummy signed verification cannot be altered by customer", async () => fixture(async h => {
  const order = await h.lookup();
  const result = await h.evaluate(`x${order.verificationToken}`);
  assert(result.status === 401 && h.state.decisions.length === 0 && h.state.cases.length === 0);
}));

Deno.test("dummy expired verification requires a fresh order check", async () => fixture(async h => {
  const order = await h.lookup();
  const clock = Date.now;
  try {
    Date.now = () => clock() + 16 * 60000;
    assert((await h.evaluate(order.verificationToken)).error === "expired_return_token");
    assert(h.state.decisions.length === 0);
  } finally { Date.now = clock; }
}));

for (const changes of [{ quantity: 2 }, { reason: "changed_mind" }, { condition: "opened_unused" }]) {
  Deno.test(`dummy submission cannot change evaluated ${Object.keys(changes)[0]}`, async () => fixture(async h => {
    const order = await h.lookup(); const decision = await h.evaluate(order.verificationToken);
    const result = await h.evaluate(order.verificationToken, { action: "create_case", decisionId: decision.decisionId, ...changes });
    assert(result.status === 409 && h.state.cases.length === 0);
  }));
}

Deno.test("dummy quantity cannot exceed purchase when merchant omits a quantity rule", async () => fixture(async h => {
  h.policy.rules_snapshot = h.policy.rules_snapshot.filter(rule => rule.category !== "quantity");
  const order = await h.lookup();
  assert((await h.evaluate(order.verificationToken, { quantity: 3 })).decision.outcome === "NOT_ELIGIBLE");
  assert((await h.evaluate(order.verificationToken, { quantity: 0 })).status === 400);
}));

Deno.test("dummy repeated case submission reuses the saved decision and case", async () => fixture(async h => {
  const order = await h.lookup(); const decision = await h.evaluate(order.verificationToken);
  const body = { action: "create_case", decisionId: decision.decisionId };
  const first = await h.evaluate(order.verificationToken, body);
  const second = await h.evaluate(order.verificationToken, body);
  assert(first.caseId === second.caseId && h.state.cases.length === 1);
}));

Deno.test("dummy case submission cannot reuse another order's decision", async () => fixture(async h => {
  const first = await h.lookup();
  const decision = await h.evaluate(first.verificationToken);
  h.order.reference_id = 90002;
  const second = await h.lookup();
  const result = await h.evaluate(second.verificationToken, { action: "create_case", decisionId: decision.decisionId });
  assert(result.status === 409 && h.state.cases.length === 0);
}));

Deno.test("dummy case submission cannot replace the item approved by a decision", async () => fixture(async h => {
  const order = await h.lookup();
  const decision = await h.evaluate(order.verificationToken);
  const result = await h.evaluate(order.verificationToken, { action: "create_case", decisionId: decision.decisionId, itemId: "72" });
  assert(result.status === 409 && h.state.cases.length === 0, "case must preserve the evaluated item");
}));

for (const language of ["en", "ar"]) {
  Deno.test(`dummy ${language} WhatsApp customer completes real flow with verified Salla facts`, async () => fixture(async h => {
    h.state.flowLanguage = language;
    h.state.step = "AWAITING_ORDER";
    const first = await h.flow("90001");
    assert(h.state.step === "AWAITING_ITEM" && first.result.kind === "list");
    await h.flow("item:71");
    assert(h.state.step === "AWAITING_QUANTITY");
    await h.flow("1");
    assert(h.state.step === "AWAITING_REASON");
    await h.flow("reason:defective");
    assert(h.state.step === "AWAITING_CONDITION");
    await h.flow("condition:new_unopened");
    assert(h.state.step === "AWAITING_PHOTO");
    await h.flow("skip_photo");
    assert(h.state.step === "AWAITING_CONFIRMATION" && h.state.cases.length === 0);
    const finished = await h.flow("confirm_return");
    assert(h.state.step === "COMPLETE" && h.state.cases.length === 1);
    assert(finished.body.includes("RL-66666666"));
    assert(!h.state.calls.some(c => c.includes("graph.facebook.com") || c.includes("tryoto.com")));
    assert(!finished.body.includes(contact), "confirmation must not repeat private contact");
  }));
}

Deno.test("dummy WhatsApp navigation supports editing and cancelling without submitting", async () => fixture(async h => {
  h.state.step = "AWAITING_ORDER";
  await h.flow("90001"); await h.flow("item:71"); await h.flow("1"); await h.flow("reason:defective"); await h.flow("condition:new_unopened"); await h.flow("skip_photo");
  await h.flow("edit_return");
  assert(h.state.step === "AWAITING_ITEM" && h.state.cases.length === 0);
  await h.flow("item:72"); await h.flow("reason:defective"); await h.flow("condition:new_unopened"); await h.flow("skip_photo");
  await h.flow("cancel_return");
  assert(h.state.step === "MENU" && h.state.decisions.length === 0 && h.state.cases.length === 0);
}));

Deno.test("dummy WhatsApp verification retry recovers after wrong contact and provider outage", async () => fixture(async h => {
  h.state.step = "AWAITING_ORDER";
  h.order.customer.mobile = "966500000001";
  const mismatch = await h.flow("90001");
  assert(h.state.step === "AWAITING_ORDER" && !mismatch.body.includes("Demo shoes"));
  h.order.customer.mobile = contact; h.state.outage = true;
  const outage = await h.flow("90001");
  assert(h.state.step === "AWAITING_ORDER" && outage.body.includes("reach the store"));
  h.state.outage = false;
  await h.flow("90001");
  assert(h.state.step === "AWAITING_ITEM");
}));
