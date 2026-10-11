/*
 * Turning a raw Zid product into what a customer may be told. Pure functions,
 * no network: everything here is unit-tested.
 *
 * A raw Zid product carries things a customer must never see (the merchant's
 * cost price, warehouse addresses, sales counts, internal ids). Nothing is
 * copied across by default; only the fields named below leave this file.
 */

export type Language = "ar" | "en";

export type ZidPublicVariant = {
  id: string;
  sku: string;
  /** e.g. [{ option: "Size", name: "42" }, { option: "Color", name: "Black" }] */
  options: Array<{ option: string; name: string }>;
  price: number | null;
  salePrice: number | null;
  /** true = can be bought now, false = sold out, null = Zid didn't say. */
  available: boolean | null;
  quantity: number | null;
  unlimited: boolean;
};

export type ZidPublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  salePrice: number | null;
  currency: string;
  available: boolean | null;
  quantity: number | null;
  unlimited: boolean;
  /** Public storefront link, https only. */
  url: string | null;
  images: string[];
  options: Array<{ name: string; values: Array<{ name: string }> }>;
  variants: ZidPublicVariant[];
};

const text = (value: unknown, language: Language): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const both = value as Record<string, unknown>;
    const other = language === "ar" ? "en" : "ar";
    return String(both[language] || both[other] || "");
  }
  return "";
};

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const httpsUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
};

/**
 * Stock as three honest states. "Unlimited" is in stock. A missing quantity
 * with no "unlimited" flag is unknown, never sold out.
 */
export function zidAvailability(source: Record<string, any>): { available: boolean | null; quantity: number | null; unlimited: boolean } {
  if (source.is_infinite === true) return { available: true, quantity: null, unlimited: true };
  const stocks = Array.isArray(source.stocks) ? source.stocks : [];
  if (stocks.some((stock: Record<string, any>) => stock?.is_infinite === true)) return { available: true, quantity: null, unlimited: true };
  let quantity = number(source.quantity);
  if (quantity === null) {
    const counted = stocks.map((stock: Record<string, any>) => number(stock?.available_quantity)).filter((n: number | null): n is number => n !== null);
    if (counted.length) quantity = counted.reduce((sum: number, n: number) => sum + n, 0);
  }
  if (quantity === null) return { available: null, quantity: null, unlimited: false };
  return { available: quantity > 0, quantity: Math.max(0, quantity), unlimited: false };
}

/** Visible to shoppers: published and not a draft. */
export function zidIsVisible(product: Record<string, any>) {
  return product.is_published === true && product.is_draft !== true;
}

function variantOptions(variant: Record<string, any>, language: Language) {
  const attributes = Array.isArray(variant.attributes) ? variant.attributes : [];
  return attributes.slice(0, 6).map((attribute: Record<string, any>) => ({
    option: text(attribute.name, language) || String(attribute.slug ?? ""),
    name: text(attribute.value, language),
  })).filter((entry: { option: string; name: string }) => entry.name);
}

export function zidPublicProduct(product: Record<string, any>, language: Language): ZidPublicProduct {
  const rawVariants = (Array.isArray(product.variants) ? product.variants : []).filter((variant: Record<string, any>) => variant && variant.is_published !== false && variant.is_draft !== true);
  const variants: ZidPublicVariant[] = rawVariants.slice(0, 60).map((variant: Record<string, any>) => ({
    id: String(variant.id ?? ""),
    sku: String(variant.sku ?? ""),
    options: variantOptions(variant, language),
    price: number(variant.price),
    salePrice: number(variant.sale_price),
    ...zidAvailability(variant),
  }));

  // Options (Size: 41, 42, 43) are read from the variants themselves, so the
  // list can never name a size that has no variant behind it.
  const grouped = new Map<string, Set<string>>();
  for (const variant of variants) for (const entry of variant.options) {
    if (!grouped.has(entry.option)) grouped.set(entry.option, new Set());
    grouped.get(entry.option)!.add(entry.name);
  }
  const options = [...grouped].slice(0, 8).map(([name, values]) => ({ name, values: [...values].slice(0, 30).map((value) => ({ name: value })) }));

  // With variants, the product is available if any variant is; unknown only
  // if none is known to be available and at least one is unknown.
  const own = zidAvailability(product);
  const stock = variants.length
    ? {
        available: variants.some((v) => v.available === true) ? true : variants.some((v) => v.available === null) ? null : false,
        quantity: variants.some((v) => v.unlimited || v.quantity === null) ? null : variants.reduce((sum, v) => sum + (v.quantity ?? 0), 0),
        unlimited: variants.some((v) => v.unlimited),
      }
    : own;

  const images = (Array.isArray(product.images) ? product.images : [])
    .map((entry: Record<string, any>) => httpsUrl(entry?.image?.medium ?? entry?.image?.full_size ?? entry?.image?.thumbnail ?? entry?.["image.thumbnail"]))
    .filter((url: string | null): url is string => Boolean(url)).slice(0, 4);

  return {
    id: String(product.id ?? ""),
    name: text(product.name, language),
    description: (text(product.description, language) || text(product.short_description, language)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
    price: number(product.price),
    salePrice: number(product.sale_price),
    currency: typeof product.currency === "string" && product.currency ? product.currency : "SAR",
    ...stock,
    url: httpsUrl(product.html_url),
    images,
    options,
    variants,
  };
}

/* ── Search text ────────────────────────────────────────────────────────── */

/** Fold Arabic spelling variants and case so "أحذية" finds "احذيه". */
export function zidNormalize(value: string) {
  return value.toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Words that say nothing about which product is meant.
const STOPWORDS = new Set(["do", "you", "have", "has", "the", "and", "any", "for", "with", "this", "that", "these", "those", "there", "are", "can", "get", "want", "need", "price", "much", "how", "size", "color", "colour", "stock", "available",
  "هل", "عندكم", "عندك", "لديكم", "في", "من", "هذا", "هذه", "ابي", "ابغي", "اريد", "كم", "سعر", "مقاس", "لون", "متوفر", "متوفره", "يوجد", "فيه", "على", "او", "مع"]);

/** Words to look for: short stems, so "shoes" finds "shoe" and "الحذاء" finds "حذاء". */
export function zidSearchTokens(query: string) {
  const tokens = zidNormalize(query).split(" ").filter((token) => !STOPWORDS.has(token)).map((token) => {
    if (/^[a-z]+$/.test(token) && token.length > 3) return /(ss|x|z|ch|sh)es$/.test(token) ? token.slice(0, -2) : /[^s]s$/.test(token) ? token.slice(0, -1) : token;
    if (/^ال/.test(token) && token.length > 4) return token.slice(2);
    return token;
  }).filter((token) => !STOPWORDS.has(token) && (/^[a-z]+$/.test(token) ? token.length >= 3 : token.length >= 2));
  return [...new Set(tokens)].slice(0, 6);
}

/**
 * How well a product's search text answers the query; 0 means no match.
 * A word matches from its start ("shoe" finds "shoes", but "جري" does not
 * find "تجريبي"). Numbers ("42") only count as whole words, and never on
 * their own when the query also names something, so a size can't match
 * digits inside a SKU. The tens digit is how many named words matched.
 */
export function zidSearchScore(searchText: string, tokens: string[]) {
  const words = searchText.split(" ").flatMap((word) => (/^ال/.test(word) && word.length > 4 ? [word, word.slice(2)] : [word]));
  const isNumber = (token: string) => /^\d+$/.test(token);
  const named = tokens.filter((token) => !isNumber(token));
  const namedHits = named.filter((token) => words.some((word) => word.startsWith(token))).length;
  if (named.length && !namedHits) return 0;
  const numberHits = tokens.filter((token) => isNumber(token) && words.includes(token)).length;
  if (!namedHits && !numberHits) return 0;
  return namedHits * 10 + Math.min(numberHits, 3) * 2 + (named.length > 1 && searchText.includes(named.join(" ")) ? 3 : 0);
}

/* ── Order tracking ─────────────────────────────────────────────────────── */

export type ZidOrderTracking = {
  orderNumber: string;
  status: "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  /** Zid's own wording for the status, in the store's language. */
  statusLabel: string | null;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
};

const plain = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160);
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string") return plain((value as Record<string, unknown>).name);
  return null;
};

/**
 * Where a verified order is. Only shipping facts: no address, no customer
 * details, no payment data. `status` and `deliveredAt` come from the caller,
 * which already maps Zid's codes and Saudi-time dates.
 */
export function zidTrackingFromOrder(order: Record<string, any>, status: ZidOrderTracking["status"], deliveredAt: string | null): ZidOrderTracking {
  const method = order.shipping?.method ?? {};
  const tracking = method.tracking ?? {};
  return {
    orderNumber: String(order.id ?? ""),
    status,
    statusLabel: plain(order.order_status?.name),
    courier: plain(method.courier) ?? plain(method.display_name) ?? plain(method.name),
    trackingNumber: plain(tracking.number) ?? plain(method.waybill_tracking_id),
    trackingUrl: httpsUrl(tracking.url),
    estimatedDelivery: plain(method.estimated_delivery_time),
    deliveredAt,
  };
}
