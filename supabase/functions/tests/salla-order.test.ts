import { sallaOrderDate, sallaOrderReferenceMatches, sallaOrderStatus } from "../_shared/salla-order.ts";
function equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error(`${actual} !== ${expected}`); }
Deno.test("Salla delivery in progress cannot satisfy delivered policy", () => {
  equal(sallaOrderStatus({ status: { slug: "delivering" } }), "shipped");
  equal(sallaOrderStatus({ status: { slug: "delivered" } }), "delivered");
  equal(sallaOrderStatus({ status: { slug: "completed" } }), "");
});
Deno.test("Salla renamed labels never establish a delivered state", () => {
  equal(sallaOrderStatus({ status: { name: "Delivered" } }), "");
  equal(sallaOrderStatus({ status: { slug: "in_progress", name: "Delivered" } }), "processing");
  equal(sallaOrderStatus({ status: { slug: "delivery_cancelled" } }), "");
  equal(sallaOrderStatus({ status: { slug: "canceled" } }), "cancelled");
  equal(sallaOrderStatus({}), "");
});
Deno.test("Salla lookup requires exact customer-facing reference, never first search result or internal ID", () => {
  equal(sallaOrderReferenceMatches({ id: 123, reference_id: 456 }, " 456 "), true);
  equal(sallaOrderReferenceMatches({ id: 123, reference_id: 456 }, "123"), false);
  equal(sallaOrderReferenceMatches({ id: 123 }, "123"), false);
  equal(sallaOrderReferenceMatches({ reference_id: 456 }, "4567"), false);
});
Deno.test("Salla separate Riyadh timezone is converted accurately", () => {
  equal(sallaOrderDate({ date: "2026-11-10 10:00:00.000000", timezone: "Asia/Riyadh" }), "2026-11-10T07:00:00.000Z");
  equal(sallaOrderDate("2026-11-10T10:00:00+03:00"), "2026-11-10T07:00:00.000Z");
  equal(sallaOrderDate({ date: "2026-11-10 10:00:00", timezone: "UTC" }), "2026-11-10T10:00:00.000Z");
});
Deno.test("Salla missing, malformed and unzoned dates are not invented", () => {
  for (const value of [null, "", "invalid", "2026-11-10 10:00:00", { date: "2026-11-10 10:00:00", timezone: "Unknown" }]) equal(sallaOrderDate(value), null);
});
