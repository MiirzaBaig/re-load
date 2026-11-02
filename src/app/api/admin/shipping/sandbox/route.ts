import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";
import {
  OtoError,
  sandboxConnection,
  sandboxQuotes,
} from "@/lib/oto/sandbox-server";
import { quoteInput } from "@/lib/oto/contracts";

export const runtime = "nodejs";
export const maxDuration = 75;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access || access.role !== "owner")
    return Response.json({ error: "access_denied" }, { status: 403, headers });
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return Response.json(
      { error: "invalid_request" },
      { status: 403, headers },
    );
  try {
    const raw = await request.text();
    if (raw.length > 2048)
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
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json(
        { error: "invalid_input" },
        { status: 400, headers },
      );
    if (body.action === "connection" && Object.keys(body).length === 1) {
      await logAdminEvent(
        access,
        "OTO_SANDBOX_CONNECTION_CHECKED",
        "shipping_sandbox",
      );
      return Response.json(await sandboxConnection(), { headers });
    }
    if (
      body.action === "quote" &&
      Object.keys(body).every((key) => ["action", "input"].includes(key))
    ) {
      let input;
      try {
        input = quoteInput(body.input);
      } catch {
        return Response.json(
          { error: "invalid_input" },
          { status: 400, headers },
        );
      }
      await logAdminEvent(
        access,
        "OTO_SANDBOX_RATES_REQUESTED",
        "shipping_sandbox",
      );
      return Response.json(await sandboxQuotes(input), { headers });
    }
    return Response.json({ error: "invalid_input" }, { status: 400, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof OtoError ? error.code : "unavailable" },
      { status: error instanceof OtoError ? error.status : 503, headers },
    );
  }
}
