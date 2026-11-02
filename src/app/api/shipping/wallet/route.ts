import { billingMember, billingOrigin } from "@/lib/billing-server";
import {
  ShippingTopupError,
  shippingTopupProvider,
  shippingWalletData,
  startShippingTopup,
  syncShippingTopup,
  resumeShippingTopup,
  retireExpiredShippingTopup,
} from "@/lib/shipping/topups";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
function failure(error: unknown) {
  return Response.json(
    { error: error instanceof ShippingTopupError ? error.code : "unavailable" },
    {
      status: error instanceof ShippingTopupError ? error.status : 503,
      headers,
    },
  );
}
export async function GET(request: Request) {
  try {
    const member = await billingMember(
      new URL(request.url).searchParams.get("store"),
    );
    if (!member)
      return Response.json(
        { error: "access_denied" },
        { status: 403, headers },
      );
    shippingTopupProvider(member.user.email || "");
    return Response.json(
      await shippingWalletData(
        member.storeId,
        member.client,
        ["owner", "admin"].includes(member.role),
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
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
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    const raw = await request.text();
    if (raw.length > 1024)
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (k) => !["storeId", "action", "amountHalalas"].includes(k),
      )
    )
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    const member = await billingMember(body.storeId, true);
    if (!member)
      return Response.json(
        { error: "access_denied" },
        { status: 403, headers },
      );
    if (body.action === "topup") {
      if (
        typeof body.amountHalalas !== "number" ||
        !Number.isSafeInteger(body.amountHalalas) ||
        body.amountHalalas < 100 ||
        body.amountHalalas > 10000000
      )
        return Response.json(
          { error: "invalid_amount" },
          { status: 400, headers },
        );
      return Response.json(
        await startShippingTopup(
          member.storeId,
          member.user,
          body.amountHalalas,
          new URL(request.url).origin,
        ),
        { headers },
      );
    }
    if (body.action === "recover")
      return Response.json(
        await retireExpiredShippingTopup(member.storeId, member.user),
        { headers },
      );
    if (body.action === "resume")
      return Response.json(
        await resumeShippingTopup(member.storeId, member.user.email || ""),
        { headers },
      );
    if (body.action === "sync")
      return Response.json(
        await syncShippingTopup(member.storeId, member.user.email || ""),
        { headers },
      );
    return Response.json({ error: "invalid_input" }, { status: 400, headers });
  } catch (error) {
    return failure(error);
  }
}
