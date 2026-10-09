import { decode } from "npm:@toon-format/toon@4.4.0";

/*
 * Zid stores connect through Zid's official "AI Connector | MCP" app: the
 * merchant installs it and pastes their store's private MCP link into Reload.
 *
 * That link grants FULL store access, so Reload only ever calls an allowlist
 * of tools/actions (reading orders and creating returns), never products,
 * prices, coupons or settings. Replies are TOON text; we decode them to JSON.
 */

const ZID_MCP_HOST = "zam-mcp-server.zid.sa";

/** Tool → actions Reload may call. Everything else is refused here. */
const ALLOWED: Record<string, readonly string[]> = {
  Orders: ["list", "get", "get_credit_notes", "list_reverse_reasons", "create_reverse"],
  StoreLocations: ["list"],
};

export function isZidMcpLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === ZID_MCP_HOST && /^\/mcp\/[A-Za-z0-9+/=_-]{16,}$/.test(url.pathname);
  } catch {
    return false;
  }
}

export class ZidMcpError extends Error {}

export class ZidMcp {
  private session: string | null = null;
  private id = 0;
  private ready = false;

  constructor(private readonly link: string) {
    if (!isZidMcpLink(link)) throw new ZidMcpError("zid_link_invalid");
  }

  private async rpc(method: string, params: unknown, notify = false) {
    const response = await fetch(this.link.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
      },
      body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++this.id, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    this.session = response.headers.get("mcp-session-id") ?? this.session;
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new ZidMcpError("zid_link_invalid");
    if (!response.ok) throw new ZidMcpError(`zid_http_${response.status}`);
    const text = await response.text();
    if (notify) return null;
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("event-stream")
      ? JSON.parse(text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean).pop() ?? "{}")
      : JSON.parse(text);
    if (body.error) throw new ZidMcpError(`zid_rpc_${body.error.code ?? "error"}`);
    return body.result;
  }

  private async init() {
    if (this.ready) return;
    await this.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "reload", version: "1.0" } });
    await this.rpc("notifications/initialized", {}, true);
    this.ready = true;
  }

  /** Call an allowlisted tool action and return its decoded payload. */
  async call(tool: string, args: Record<string, unknown> & { action: string }) {
    if (!ALLOWED[tool]?.includes(args.action)) throw new ZidMcpError("zid_tool_not_allowed");
    await this.init();
    const result = await this.rpc("tools/call", { name: tool, arguments: args });
    const text = (result?.content ?? []).map((part: { text?: string }) => part.text ?? "").join("\n").trim();
    if (result?.isError || /^validation error/i.test(text)) throw new ZidMcpError(`zid_tool_error:${text.slice(0, 160)}`);
    try {
      return decode(text) as Record<string, any>;
    } catch {
      throw new ZidMcpError("zid_reply_unreadable");
    }
  }
}

/* ── Store identity (for the connection card) ───────────────────────────── */

export async function zidStoreIdentity(client: ZidMcp) {
  const list = await client.call("Orders", { action: "list", perPage: 1 });
  const first = Array.isArray(list.orders) ? list.orders[0] : null;
  if (!first?.id) return { storeId: null, storeName: null, latestOrderAt: null };
  const detail = await client.call("Orders", { action: "get", orderId: String(first.id) });
  const order = detail.order ?? {};
  return {
    storeId: order.store_id ? String(order.store_id) : null,
    storeName: typeof order.store_name === "string" ? order.store_name : null,
    latestOrderAt: zidDate(order.created_at),
  };
}

/* ── Order facts for the return decision ────────────────────────────────── */

/** Zid dates are "YYYY-MM-DD HH:mm:ss" in Saudi time. */
export function zidDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(`${value.trim().replace(" ", "T")}+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function zidStatus(code: unknown) {
  const raw = String(code ?? "").toLowerCase();
  if (raw === "delivered") return "delivered";
  if (raw === "indelivery") return "shipped";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw.includes("revers")) return "returned";
  return "processing";
}

function normalizeVerifier(value: string) {
  const clean = value.trim().toLowerCase();
  if (clean.includes("@")) return clean;
  const digits = clean.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

/**
 * Find a Zid order by its number and confirm the customer's phone or email,
 * then shape it exactly like Salla order facts so the decision engine (web
 * return page and WhatsApp) doesn't care which platform it came from.
 */
export async function zidOrderFacts(client: ZidMcp, storeId: string, orderNumber: string, verifier: string) {
  const wanted = orderNumber.trim().replace(/^#/, "");
  const list = await client.call("Orders", { action: "list", searchTerm: wanted, perPage: 10 });
  const candidates = Array.isArray(list.orders) ? list.orders : [];
  const match = candidates.find((order: Record<string, any>) =>
    [order.id, order.invoice_number, order.code].some((value) => String(value ?? "") === wanted));
  if (!match?.id) return null;

  const detail = await client.call("Orders", { action: "get", orderId: String(match.id) });
  const order = (detail.order ?? match) as Record<string, any>;
  const customer = order.customer ?? {};
  const supplied = normalizeVerifier(verifier);
  const known = [customer.email, customer.mobile, customer.phone]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => normalizeVerifier(String(value)));
  if (!supplied || !known.includes(supplied)) return null;

  const products = Array.isArray(order.products) ? order.products : [];
  return {
    storeId,
    orderId: String(order.id),
    externalOrderId: String(order.id),
    orderDate: zidDate(order.created_at) ?? new Date().toISOString(),
    deliveryDate: zidDate(order.delivered_at),
    orderStatus: zidStatus(order.order_status?.code),
    customerEmail: String(customer.email ?? ""),
    customerName: String(customer.name ?? "Customer"),
    items: products.map((item: Record<string, any>) => ({
      id: String(item.id ?? item.sku ?? item.name),
      name: String(item.name ?? "Item"),
      sku: String(item.sku ?? ""),
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      price: Number(item.net_price ?? item.price ?? 0),
      imageUrl: typeof item.images?.[0]?.origin === "string" ? item.images[0].origin : undefined,
    })),
    currency: String(order.currency_code ?? "SAR"),
  };
}
