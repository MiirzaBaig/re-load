import { billingMember, billingOrigin } from "@/lib/billing-server";
import {
  prepareReturnTest,
  submitReturnTest,
  returnTestSnapshot,
  refreshReturnTest,
  returnTestLabel,
  ReturnTestError,
  approveReturnCharge,
} from "@/lib/oto/return-server";
export const runtime = "nodejs";
export const maxDuration = 180;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
function failure(e: unknown) {
  return Response.json(
    { error: e instanceof ReturnTestError ? e.code : "unavailable" },
    { status: e instanceof ReturnTestError ? e.status : 503, headers },
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
    return Response.json(
      {
        ...(await returnTestSnapshot(member.storeId, member.user.email || "")),
        canManage: ["owner", "admin"].includes(member.role),
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
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
    const raw = await request.text();
    if (raw.length > 4096)
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    let b;
    try {
      b = JSON.parse(raw);
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
        (k) =>
          !["storeId", "action", "id", "input", "amountHalalas"].includes(k),
      )
    )
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    const member = await billingMember(b.storeId, true);
    if (!member)
      return Response.json(
        { error: "access_denied" },
        { status: 403, headers },
      );
    if (b.action === "approveCharge")
      return Response.json(
        await approveReturnCharge(member.storeId, member.user, b.amountHalalas),
        { headers },
      );
    if (b.action === "prepare")
      return Response.json(
        await prepareReturnTest(member.storeId, member.user, b.id, b.input),
        { headers },
      );
    if (b.action === "submit")
      return Response.json(
        await submitReturnTest(member.storeId, member.user, b.id, b.input),
        { headers },
      );
    if (b.action === "refresh")
      return Response.json(
        await refreshReturnTest(member.storeId, member.user.email || ""),
        { headers },
      );
    if (b.action === "label") {
      const bytes = await returnTestLabel(
        member.storeId,
        member.user.email || "",
      );
      return new Response(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="reload-sandbox-return.pdf"',
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    return Response.json({ error: "invalid_input" }, { status: 400, headers });
  } catch (e) {
    return failure(e);
  }
}
