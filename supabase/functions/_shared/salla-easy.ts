import { sha256, verifySallaSignature } from "./crypto.ts";

export type EasyEvent = {
  digest: string;
  merchant: string;
  event: string;
  occurredAt: string;
  codeHash: string | null;
  access: string | null;
  refresh: string | null;
  expiresAt: string | null;
  scopes: string[];
  name: string | null;
};
export type EasyDependencies = {
  secret: string;
  encrypt: (value: string) => Promise<string>;
  identity: (token: string) => Promise<{ id: string; name: string }>;
  apply: (event: EasyEvent) => Promise<void>;
};
export const EASY_EVENTS = new Set([
  "app.store.authorize",
  "app.settings.updated",
  "app.uninstalled",
  "app.store.uninstalled",
]);
export function sallaPairingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toUpperCase();
  return /^RL-S-[A-F0-9]{32}$/.test(clean) ? clean : null;
}
export function sallaEventTime(value: unknown, now = Date.now()): string {
  if (typeof value !== "string") throw Error("invalid_event");
  // Provider timestamps without a zone are Saudi local time; never use host TZ.
  const normalized = value.replace(" ", "T");
  const timestamp = Date.parse(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
      ? normalized
      : normalized + "+03:00",
  );
  if (!Number.isFinite(timestamp) || timestamp > now + 300_000) {
    throw Error("invalid_event");
  }
  return new Date(timestamp).toISOString();
}

/** Signature and merchant identity are checked before any credential write. */
export async function handleSallaEasy(
  request: Request,
  deps: EasyDependencies,
): Promise<Response | null> {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 131_072) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  const raw = new TextDecoder().decode(bytes);
  if (
    !await verifySallaSignature(
      raw,
      request.headers.get("X-Salla-Signature") || "",
      deps.secret,
    )
  ) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }
  if (!EASY_EVENTS.has(payload.event)) return null;
  try {
    const merchant = String(payload.merchant ?? "");
    if (!/^[1-9]\d{0,19}$/.test(merchant)) throw Error("invalid_event");
    const e: EasyEvent = {
      digest: await sha256(raw),
      merchant,
      event: payload.event,
      occurredAt: sallaEventTime(payload.created_at),
      codeHash: null,
      access: null,
      refresh: null,
      expiresAt: null,
      scopes: [],
      name: null,
    };
    const data = payload.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw Error("invalid_event");
    }
    if (e.event === "app.store.authorize") {
      if (
        typeof data.access_token !== "string" || !data.access_token ||
        data.access_token.length > 8192 ||
        typeof data.refresh_token !== "string" || !data.refresh_token ||
        data.refresh_token.length > 8192 ||
        typeof data.scope !== "string" || data.scope.length > 4096 ||
        typeof data.expires !== "number" || !Number.isSafeInteger(data.expires)
      ) throw Error("invalid_event");
      const expiry = data.expires * 1000;
      if (expiry <= Date.now() || expiry > Date.now() + 45 * 86_400_000) {
        throw Error("invalid_event");
      }
      e.scopes = [
        ...new Set<string>(data.scope.split(/[\s,]+/).filter(Boolean)),
      ];
      if (
        !["orders", "products"].every((p) =>
          e.scopes.includes(p + ".read") || e.scopes.includes(p + ".read_write")
        )
      ) {
        throw Error("missing_scopes");
      }
      const identity = await deps.identity(data.access_token);
      if (identity.id !== merchant) throw Error("merchant_mismatch");
      e.name = identity.name.slice(0, 120);
      e.access = await deps.encrypt(data.access_token);
      e.refresh = await deps.encrypt(data.refresh_token);
      e.expiresAt = new Date(expiry).toISOString();
    } else if (e.event === "app.settings.updated") {
      const code = sallaPairingCode(data.settings?.reload_connection_code);
      // Ordinary settings edits have no effect on workspace ownership.
      if (!code) return Response.json({ received: true });
      e.codeHash = await sha256(code);
    }
    await deps.apply(e);
    return Response.json({ received: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known = ["invalid_event", "missing_scopes", "merchant_mismatch"]
      .includes(code);
    // Never include provider bodies, credentials, pairing codes or DB errors.
    return Response.json({
      error: known ? code : "authorization_processing_failed",
    }, { status: known ? 400 : 503 });
  }
}
