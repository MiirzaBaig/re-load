import { trackingMessage } from "../_shared/customer-tracking.ts";
import type { ZidOrderTracking } from "../_shared/zid-product.ts";
const tracking: ZidOrderTracking = { orderNumber: "76099262", status: "shipped", statusLabel: "In delivery", courier: "Store Courier", trackingNumber: "TEST123456", trackingUrl: "https://track.example.com/TEST123456", estimatedDelivery: "Usually tomorrow", deliveredAt: null };
function assert(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
Deno.test("shipment replies include verified facts without turning estimates into promises", () => {
  const body = trackingMessage("Nova", tracking, "en");
  assert(body.includes("On its way") && body.includes("TEST123456") && body.includes(tracking.trackingUrl!));
  assert(!body.includes("tomorrow") && !body.includes("refund"));
});
Deno.test("Arabic tracking uses a clear local message and omits unavailable fields", () => {
  const body = trackingMessage("نوفا", { ...tracking, courier: null, trackingNumber: null, trackingUrl: null }, "ar");
  assert(body.includes("في الطريق إليك") && body.includes("نوفا") && body.includes("القائمة"));
  assert(!body.includes("null") && !body.includes("شركة الشحن"));
});
Deno.test("tracking never sends unsafe links or undocumented status claims", () => {
  const body = trackingMessage("Nova", { ...tracking, status: "unknown" as ZidOrderTracking["status"], trackingUrl: "javascript:alert(1)" }, "en");
  assert(!body.includes("javascript") && body.includes("confirm the status"));
});
