import test from "node:test";
import assert from "node:assert/strict";
import {
  checkoutMonitor,
  journeyReport,
  journeyStatus,
  nextAction,
} from "../src/lib/checkout-monitor";
const fixture = () => ({
  environment: "development",
  checked_at: "2026-10-24T01:00:00Z",
  limit: 50,
  blocked: true,
  records: [
    {
      reference: "CT-123456789A",
      state: "UNKNOWN",
      updated_at: "2026-10-23T18:30:00Z",
      review_expires_at: "2026-10-23T18:40:00Z",
      has_order_reference: false,
      events: [],
    },
  ],
});
test("monitor projection excludes unknown fields and all private envelope values", () => {
  const raw: any = fixture();
  raw.token = "secret";
  raw.records[0].session_hash = "private";
  raw.records[0].customer = { email: "private@example.com" };
  raw.records[0].payment_link = "https://private.example/pay";
  const parsed = checkoutMonitor(raw);
  const payload = JSON.stringify(parsed);
  for (const value of [
    "secret",
    "session_hash",
    "private@example.com",
    "payment_link",
  ])
    assert(!payload.includes(value));
  assert(
    !journeyReport(parsed.records[0], parsed).includes("private@example.com"),
  );
  assert(
    journeyReport(parsed.records[0], parsed).includes(
      "Earlier step history was not recorded.",
    ),
  );
});
test("malformed, production, duplicate or unsafe monitor responses are rejected", () => {
  for (const change of [
    (r: any) => (r.environment = "production"),
    (r: any) => (r.records[0].state = "INVENTED"),
    (r: any) => (r.records[0].reference = "session-secret"),
    (r: any) => (r.checked_at = "bad"),
    (r: any) => r.records.push(r.records[0]),
    (r: any) =>
      r.records[0].events.push({
        stage: "secret",
        outcome: "failed",
        code: null,
        provider_status: null,
        occurred_at: r.checked_at,
      }),
    (r: any) =>
      r.records[0].events.push({
        stage: "recheck",
        outcome: "failed",
        code: "private@example.com",
        provider_status: 500,
        occurred_at: r.checked_at,
      }),
  ]) {
    const raw = fixture();
    change(raw);
    assert.throws(() => checkoutMonitor(raw));
  }
});
test("unconfirmed creation and waiting drafts never become successful purchases", () => {
  const data = checkoutMonitor(fixture());
  const record = data.records[0];
  assert.equal(journeyStatus(record, true), "unconfirmed");
  const draft = { ...record, state: "READY" as const };
  assert.equal(journeyStatus(draft, true), "waiting");
  assert(nextAction(draft, true, false).includes("earlier unconfirmed"));
  const created = {
    ...record,
    state: "CREATED" as const,
    has_order_reference: true,
  };
  assert.equal(journeyStatus(created, false), "waiting");
  const paid = {
    ...created,
    events: [
      {
        stage: "payment_checked" as const,
        outcome: "paid" as const,
        code: null,
        provider_status: null,
        occurred_at: data.checked_at,
      },
    ],
  };
  assert.equal(journeyStatus(paid, false), "done");
  assert.equal(
    journeyStatus(
      {
        ...paid,
        events: [
          ...paid.events,
          { ...paid.events[0], outcome: "unknown" as const },
        ],
      },
      false,
    ),
    "waiting",
  );
});
