import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "./crypto.ts";
import { ZidMcp, ZidMcpError, zidDate, zidStatus, zidVerifiedOrder } from "./zid-mcp.ts";
import {
  type Language, type ZidOrderTracking, type ZidPublicProduct,
  zidIsVisible, zidNormalize, zidPublicProduct, zidSearchScore, zidSearchTokens, zidTrackingFromOrder,
} from "./zid-product.ts";

/*
 * Customer-service tools for Zid stores, for the WhatsApp assistant.
 *
 *   zidProductSearch   find products by name or SKU        (catalog index)
 *   zidProductDetails  price, sale price, variants, stock  (live from Zid)
 *   zidProductsFor     both in one call, for answering a product question
 *   zidOrderTracking   where a verified order is           (live from Zid)
 *
 * Every function takes the store id and touches only that store's connection
 * and that store's rows. Each returns { ok: true, ... } or { ok: false, error }
 * so a failed lookup can never be mistaken for "not found" or "sold out":
 *
 *   not_connected       this store has no Zid connection
 *   connection_expired  Zid refused the saved link; the merchant must reconnect
 *   lookup_failed       Zid was slow or returned an error; say "can't check now"
 *   not_found           no such product / order not found or not verified
 *   unavailable         the product exists but is hidden or a draft
 */

export type ZidToolError = "not_connected" | "connection_expired" | "lookup_failed" | "not_found" | "unavailable";
type Failure = { ok: false; error: ZidToolError };
export type ZidSearchHit = { id: string; name: string; thumbnail: string | null };

const PAGE_SIZE = 50;
const MAX_PAGES = 60; // 3,000 products per sync
const SYNC_BUDGET_MS = 25_000;
const STALE_AFTER_MS = 15 * 60_000;

async function clientFor(admin: SupabaseClient, storeId: string): Promise<ZidMcp | null> {
  const { data } = await admin.rpc("get_zid_credential", { p_store_id: storeId });
  const row = Array.isArray(data) ? data[0] : null;
  return row?.link_ciphertext ? new ZidMcp(await decrypt(row.link_ciphertext)) : null;
}

/** Map a thrown error to a tool error, and flag the connection if Zid refused the link. */
async function failure(admin: SupabaseClient, storeId: string, error: unknown): Promise<Failure> {
  const code = error instanceof ZidMcpError ? error.message : "";
  if (code === "zid_not_found") return { ok: false, error: "not_found" };
  if (code === "zid_link_invalid") {
    await admin.from("commerce_connections")
      .update({ status: "EXPIRED", last_error_code: "ZID_LINK_INVALID", updated_at: new Date().toISOString() })
      .eq("store_id", storeId).eq("platform", "zid");
    return { ok: false, error: "connection_expired" };
  }
  console.error("zid_tool_failed", code || (error instanceof Error ? error.name : "unknown"));
  return { ok: false, error: "lookup_failed" };
}

/* ── Catalog index ──────────────────────────────────────────────────────── */

/**
 * Read the store's product list from Zid (50 a page) into the search index.
 * Products that disappeared from Zid are removed, but only after a complete
 * read, so a half-finished sync never empties the index.
 */
export async function syncZidCatalog(admin: SupabaseClient, client: ZidMcp, storeId: string) {
  const startedAt = new Date();
  const deadline = Date.now() + SYNC_BUDGET_MS;
  let complete = false;
  let count = 0;
  for (let page = 1; page <= MAX_PAGES && Date.now() < deadline; page++) {
    const reply = await client.call("Products", { action: "list", page, pageSize: PAGE_SIZE });
    const results: Array<Record<string, any>> = Array.isArray(reply.results) ? reply.results : [];
    const rows = results.filter((product) => product?.id).map((product) => {
      const nameAr = typeof product.name?.ar === "string" ? product.name.ar : null;
      const nameEn = typeof product.name?.en === "string" ? product.name.en : null;
      const sku = typeof product.sku === "string" ? product.sku : null;
      const thumbnail = product.images?.[0]?.image?.thumbnail ?? product.images?.[0]?.["image.thumbnail"];
      return {
        store_id: storeId, product_id: String(product.id), name_ar: nameAr, name_en: nameEn, sku,
        search_text: zidNormalize([nameAr, nameEn, sku].filter(Boolean).join(" ")),
        thumbnail_url: typeof thumbnail === "string" && thumbnail.startsWith("https://") ? thumbnail : null,
        is_visible: zidIsVisible(product), synced_at: startedAt.toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await admin.from("zid_catalog_products").upsert(rows, { onConflict: "store_id,product_id" });
      if (error) throw new Error("zid_catalog_write_failed");
      count += rows.length;
    }
    if (!reply.next || results.length === 0) { complete = true; break; }
  }
  if (complete) await admin.from("zid_catalog_products").delete().eq("store_id", storeId).lt("synced_at", startedAt.toISOString());
  await admin.from("zid_catalog_sync").upsert({ store_id: storeId, synced_at: startedAt.toISOString(), product_count: count, complete }, { onConflict: "store_id" });
  return { count, complete };
}

/** Refresh the index if it is missing or older than 15 minutes. */
async function ensureFresh(admin: SupabaseClient, client: ZidMcp, storeId: string) {
  const { data } = await admin.from("zid_catalog_sync").select("synced_at").eq("store_id", storeId).maybeSingle();
  const age = data?.synced_at ? Date.now() - new Date(data.synced_at).getTime() : Infinity;
  if (age < STALE_AFTER_MS) return;
  try {
    await syncZidCatalog(admin, client, storeId);
  } catch (error) {
    // An older index is still useful (prices and stock are read live anyway);
    // with no index at all there is nothing to search.
    if (!data) throw error;
    if (error instanceof ZidMcpError && error.message === "zid_link_invalid") throw error;
  }
}

/* ── Tools ──────────────────────────────────────────────────────────────── */

/** Find visible products by name or SKU, best match first. An empty list is a real "no match". */
export async function zidProductSearch(admin: SupabaseClient, storeId: string, query: string, options: { limit?: number; language?: Language } = {}):
  Promise<{ ok: true; products: ZidSearchHit[] } | Failure> {
  const language = options.language ?? "ar";
  const limit = Math.min(Math.max(options.limit ?? 4, 1), 10);
  try {
    const client = await clientFor(admin, storeId);
    if (!client) return { ok: false, error: "not_connected" };
    await ensureFresh(admin, client, storeId);
    const tokens = zidSearchTokens(query);
    if (!tokens.length) return { ok: true, products: [] };
    const { data, error } = await admin.from("zid_catalog_products")
      .select("product_id, name_ar, name_en, search_text, thumbnail_url")
      .eq("store_id", storeId).eq("is_visible", true)
      .or(tokens.map((token) => `search_text.ilike.%${token}%`).join(","))
      .limit(300);
    if (error) throw new Error("zid_catalog_read_failed");
    const scored = (data ?? []).map((row) => ({ row, score: zidSearchScore(row.search_text, tokens) })).filter((entry) => entry.score > 0);
    // Keep only the products that matched the most words: asking for a
    // "test t-shirt" should not also return everything called "test".
    const best = Math.max(0, ...scored.map((entry) => Math.floor(entry.score / 10)));
    const products = scored
      .filter((entry) => Math.floor(entry.score / 10) === best)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row }) => ({
        id: row.product_id as string,
        name: String((language === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar) ?? ""),
        thumbnail: (row.thumbnail_url as string | null) ?? null,
      }));
    return { ok: true, products };
  } catch (error) {
    return failure(admin, storeId, error);
  }
}

/** Live price, sale price, variants, stock, link and images for one product. */
export async function zidProductDetails(admin: SupabaseClient, storeId: string, productId: string, language: Language = "ar"):
  Promise<{ ok: true; product: ZidPublicProduct } | Failure> {
  try {
    const client = await clientFor(admin, storeId);
    if (!client) return { ok: false, error: "not_connected" };
    return await details(client, productId, language);
  } catch (error) {
    return failure(admin, storeId, error);
  }
}

async function details(client: ZidMcp, productId: string, language: Language): Promise<{ ok: true; product: ZidPublicProduct } | Failure> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(productId)) return { ok: false, error: "not_found" };
  let raw = await client.call("Products", { action: "get", productId });
  if (!raw?.id) return { ok: false, error: "not_found" };
  // In Zid a size/colour variant is its own "child" product. Always answer
  // with the parent, which carries every variant and the real store link.
  if (typeof raw.parent_id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(raw.parent_id)) {
    raw = await client.call("Products", { action: "get", productId: raw.parent_id });
    if (!raw?.id) return { ok: false, error: "not_found" };
  }
  if (!zidIsVisible(raw)) return { ok: false, error: "unavailable" };
  return { ok: true, product: zidPublicProduct(raw, language) };
}

/**
 * Answer a product question in one call: search, then read the best matches
 * live. `products` is empty only when nothing matched. If matches were found
 * but Zid could not be read, this fails instead of returning an empty list.
 */
export async function zidProductsFor(admin: SupabaseClient, storeId: string, query: string, options: { limit?: number; language?: Language } = {}):
  Promise<{ ok: true; products: ZidPublicProduct[] } | Failure> {
  const language = options.language ?? "ar";
  const found = await zidProductSearch(admin, storeId, query, { limit: Math.min(options.limit ?? 4, 4), language });
  if (!found.ok) return found;
  if (!found.products.length) return { ok: true, products: [] };
  try {
    const client = await clientFor(admin, storeId);
    if (!client) return { ok: false, error: "not_connected" };
    const products: ZidPublicProduct[] = [];
    let failed = 0;
    // One at a time on one session: Zid's connector is not built for bursts.
    for (const hit of found.products) {
      try {
        const result = await details(client, hit.id, language);
        if (result.ok && !products.some((product) => product.id === result.product.id)) products.push(result.product);
      } catch (error) {
        if (error instanceof ZidMcpError && error.message === "zid_link_invalid") throw error;
        if (!(error instanceof ZidMcpError && error.message === "zid_not_found")) failed++;
      }
    }
    if (!products.length && failed) return { ok: false, error: "lookup_failed" };
    return { ok: true, products };
  } catch (error) {
    return failure(admin, storeId, error);
  }
}

/**
 * Where an order is, only for the customer on it (phone or email must match).
 * "not_found" covers both a wrong number and a failed verification on purpose.
 */
export async function zidOrderTracking(admin: SupabaseClient, storeId: string, orderNumber: string, verifier: string):
  Promise<{ ok: true; tracking: ZidOrderTracking } | Failure> {
  try {
    const client = await clientFor(admin, storeId);
    if (!client) return { ok: false, error: "not_connected" };
    const order = await zidVerifiedOrder(client, orderNumber, verifier);
    if (!order) return { ok: false, error: "not_found" };
    return { ok: true, tracking: zidTrackingFromOrder(order, zidStatus(order.order_status?.code) as ZidOrderTracking["status"], zidDate(order.delivered_at)) };
  } catch (error) {
    return failure(admin, storeId, error);
  }
}
