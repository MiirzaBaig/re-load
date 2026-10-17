import { sha256 } from "./crypto.ts";

const MAX_BODY_BYTES = 262144;
const encoder = new TextEncoder();

export type StreamEventReceipt = {
  payload_digest: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  provider_status: string | null;
  provider_timestamp: string | null;
  invoice_id: string | null;
  subscription_id: string | null;
};

export async function verifyStreamSignature(
  body: string,
  header: string,
  secret: string,
  now = Date.now(),
) {
  if (!secret) return false;
  const match = /^t=(\d+),v1=([a-fA-F0-9]{64})$/.exec(header.trim());
  if (!match || Math.abs(now / 1000 - Number(match[1])) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = Uint8Array.from(
    match[2].match(/../g)!,
    (byte) => parseInt(byte, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${match[1]}.${body}`),
  );
}

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function streamWebhookHandler(deps: {
  secret: () => string | undefined;
  save: (receipt: StreamEventReceipt) => Promise<void>;
  now?: () => number;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    const secret = deps.secret();
    if (!secret) return reply(503, { error: "webhook_not_configured" });
    if (
      !request.headers.get("content-type")?.toLowerCase().startsWith(
        "application/json",
      )
    ) return reply(415, { error: "json_required" });
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
      return reply(413, { error: "payload_too_large" });
    }

    try {
      // Bound streamed requests too; Content-Length alone is not trustworthy.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            return reply(413, { error: "payload_too_large" });
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let raw: string;
      try {
        raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return reply(400, { error: "invalid_encoding" });
      }
      if (
        !await verifyStreamSignature(
          raw,
          request.headers.get("x-webhook-signature") ?? "",
          secret,
          deps.now?.() ?? Date.now(),
        )
      ) {
        return reply(401, { error: "invalid_signature" });
      }
      let event: Record<string, unknown>;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error();
        }
        event = parsed;
      } catch {
        return reply(400, { error: "invalid_json" });
      }
      const validLabel = (value: unknown): value is string =>
        typeof value === "string" && /^[A-Z][A-Z0-9_]{0,119}$/.test(value);
      if (
        !validLabel(event.event_type) || !validLabel(event.entity_type) ||
        typeof event.entity_id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(event.entity_id)
      ) {
        return reply(400, { error: "invalid_event" });
      }
      // Store identifiers only. Never persist card details, customer contacts or arbitrary metadata.
      // This receipt is NOT payment approval; subscription reconciliation is a separate stage.
      const uuid = (value: unknown): string | null =>
        typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
          ? value
          : null;
      const data = event.data && typeof event.data === "object"
        ? event.data as Record<string, any>
        : {};
      await deps.save({
        invoice_id: uuid(data.invoice?.id ?? data.invoice_id),
        subscription_id: uuid(data.subscription?.id ?? data.subscription_id),
        payload_digest: await sha256(raw),
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        provider_status: validLabel(event.status) ? event.status : null,
        provider_timestamp: typeof event.timestamp === "string"
          ? event.timestamp.slice(0, 80)
          : null,
      });
      return reply(200, { received: true });
    } catch {
      console.error("streampay_webhook_receipt_failed");
      return reply(500, { error: "webhook_recording_failed" });
    }
  };
}
