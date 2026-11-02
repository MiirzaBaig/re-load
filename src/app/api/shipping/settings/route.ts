import { billingMember, billingOrigin } from "@/lib/billing-server";
import {
  getShippingSettings,
  saveShippingParcel,
  saveShippingSettings,
  approveShippingSettings,
  pauseShippingSettings,
  manageShippingWarehouse,
  ShippingSettingsError,
} from "@/lib/shipping/settings-server";
export const runtime = "nodejs";
export const maxDuration = 150;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
function fail(e: unknown) {
  return Response.json(
    { error: e instanceof ShippingSettingsError ? e.code : "unavailable" },
    { status: e instanceof ShippingSettingsError ? e.status : 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const m = await billingMember(
      new URL(request.url).searchParams.get("store"),
    );
    if (!m)
      return Response.json(
        { error: "access_denied" },
        { status: 403, headers },
      );
    return Response.json(await getShippingSettings(m.storeId, m.user), {
      headers,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    try {
      billingOrigin(request);
    } catch {
      return Response.json(
        { error: "invalid_request" },
        { status: 403, headers },
      );
    }
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return Response.json(
        { error: "invalid_request" },
        { status: 403, headers },
      );
    const text = await request.text();
    if (text.length > 4096)
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    let b;
    try {
      b = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    }
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).some(
        (k) => !["storeId", "action", "input", "version", "id"].includes(k),
      )
    )
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    const m = await billingMember(b.storeId, true);
    if (!m)
      return Response.json(
        { error: "access_denied" },
        { status: 403, headers },
      );
    let result;
    if (b.action === "parcel")
      result = await saveShippingParcel(m.storeId, m.user, b.input);
    else if (b.action === "save")
      result = await saveShippingSettings(m.storeId, m.user, b.input);
    else if (b.action === "approve")
      result = await approveShippingSettings(m.storeId, m.user, b.version);
    else if (b.action === "pause")
      result = await pauseShippingSettings(m.storeId, m.user, b.version);
    else if (b.action === "warehouse" || b.action === "recoverWarehouse")
      result = await manageShippingWarehouse(
        m.storeId,
        m.user,
        b.id,
        b.input,
        b.action === "recoverWarehouse",
      );
    else
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    return Response.json(result, { headers });
  } catch (e) {
    return fail(e);
  }
}
