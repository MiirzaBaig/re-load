export type CheckoutInput = {
  product: string;
  quantity: number;
  shipping: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  addressExtra: string;
  consent: boolean;
};
export const latinDigits = (value: string) =>
  value.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit <= "٩" ? 0x660 : 0x6f0)),
  );
export function checkoutInput(form: FormData): CheckoutInput {
  const field = (key: string, max: number) => {
    const value = String(form.get(key) ?? "").trim();
    if (!value || value.length > max || /[\u0000-\u001f]/.test(value))
      throw new Error("invalid_" + key);
    return value;
  };
  const product = field("product", 64),
    shipping = field("shipping", 20),
    name = field("name", 100),
    email = field("email", 160),
    city = field("city", 80),
    address = field("address", 200),
    addressExtra = field("addressExtra", 200);
  const phone = latinDigits(field("phone", 18))
    .replace(/[\s+-]/g, "")
    .replace(/^00966/, "966")
    .replace(/^966/, "")
    .replace(/^0/, "");
  const quantityText = latinDigits(field("quantity", 2));
  if (
    !/^[a-zA-Z0-9-]+$/.test(product) ||
    !/^\d+$/.test(shipping) ||
    !/^5\d{8}$/.test(phone) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\d+$/.test(quantityText) ||
    Number(quantityText) < 1 ||
    Number(quantityText) > 20 ||
    form.get("consent") !== "yes"
  )
    throw new Error("invalid_contact_or_selection");
  return {
    product,
    shipping,
    name,
    email,
    phone,
    city,
    address,
    addressExtra,
    quantity: Number(quantityText),
    consent: true,
  };
}
/** Translate only known provider fields; never return raw validation text or submitted values. */
export function zidValidationCode(value: unknown) {
  const rows = (value as { message?: { validations?: unknown } })?.message
    ?.validations;
  return Array.isArray(rows) &&
    rows.length <= 50 &&
    rows.some((row) => row?.field === "consignee.address.line_2")
    ? "address_details_required"
    : "validation_failed";
}
export function safePaymentUrl(
  value: unknown,
  storeUrl: string,
  extraHosts: string[] = [],
) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value),
      store = new URL(storeUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      /^(?:localhost|[\d.]+)$/.test(url.hostname) ||
      url.hostname.includes(":") ||
      url.hostname.endsWith(".local") ||
      !url.hostname.includes(".") ||
      ![store.hostname, ...extraHosts].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function developmentOrder(
  value: unknown,
  storeId: string,
  expectedId?: string,
) {
  const row = (value as { order?: Record<string, unknown> })?.order;
  if (
    !row ||
    String(row.store_id) !== storeId ||
    !/^\d{1,20}$/.test(String(row.id)) ||
    (expectedId && String(row.id) !== expectedId) ||
    row.currency_code !== "SAR"
  )
    throw new Error("order_identity_mismatch");
  const total = Number(row.order_total);
  if (
    row.order_total === null ||
    row.order_total === "" ||
    !["string", "number"].includes(typeof row.order_total) ||
    !Number.isFinite(total) ||
    !Number.isSafeInteger(Math.round(total * 100)) ||
    total <= 0
  )
    throw new Error("order_total_unknown");
  return {
    id: String(row.id),
    total,
    payment:
      row.payment_status === "paid"
        ? "paid"
        : row.payment_status === "pending"
          ? "pending"
          : "unknown",
    link: typeof row.payment_link === "string" ? row.payment_link : null,
    closed: [
      "cancelled",
      "canceled",
      "reversed",
      "reverse_in_progress",
      "partially_reversed",
    ].includes(
      String((row.order_status as { code?: unknown } | undefined)?.code ?? ""),
    ),
    guest:
      row.is_guest_customer === 1 || row.is_guest_customer === true
        ? true
        : row.is_guest_customer === 0 || row.is_guest_customer === false
          ? false
          : null,
    invoice: invoiceAmounts(row.payment),
    items:
      Array.isArray(row.products) && row.products.length <= 20
        ? row.products.map((item: Record<string, unknown>) => ({
            sku: typeof item?.sku === "string" ? item.sku.slice(0, 200) : null,
            quantity:
              Number.isSafeInteger(item?.quantity) && Number(item.quantity) > 0
                ? Number(item.quantity)
                : null,
          }))
        : null,
  };
}

export type InvoiceAmount = {
  kind: "subtotal" | "vat" | "total";
  amount: number;
};
function invoiceAmounts(payment: unknown): InvoiceAmount[] {
  const rows = (payment as { invoice?: unknown } | undefined)?.invoice;
  if (!Array.isArray(rows) || rows.length > 30) return [];
  const codes: Record<string, InvoiceAmount["kind"]> = {
    sub_totals_before_vat: "subtotal",
    vat: "vat",
    total: "total",
  };
  const result: InvoiceAmount[] = [];
  for (const [code, kind] of Object.entries(codes)) {
    const matches = rows.filter((row) => row?.code === code);
    if (matches.length !== 1) continue;
    const raw = matches[0].value;
    if (
      (typeof raw !== "string" && typeof raw !== "number") ||
      String(raw).trim() === ""
    )
      continue;
    const amount = Number(raw);
    if (
      Number.isFinite(amount) &&
      amount >= 0 &&
      Number.isSafeInteger(Math.round(amount * 100))
    )
      result.push({ kind, amount });
  }
  return result;
}

/** Read only the exact selected product; stock differences are observations, not reservation proof. */
export function stockSample(
  raw: Record<string, unknown>,
  productId: string,
  storeId: string,
  sku: string,
) {
  if (
    String(raw?.id) !== productId ||
    String(raw?.store_id) !== storeId ||
    raw?.sku !== sku
  )
    return null;
  if (raw.is_infinite === true) return { unlimited: true, quantity: null };
  if (
    raw.is_infinite === false &&
    Number.isSafeInteger(raw.quantity) &&
    Number(raw.quantity) >= 0
  )
    return { unlimited: false, quantity: Number(raw.quantity) };
  return null;
}

export function matchesSelection(
  items: ReturnType<typeof developmentOrder>["items"],
  sku: string,
  quantity: number,
) {
  if (items === null) return "unknown" as const;
  return items.length === 1 &&
    items[0].sku === sku &&
    items[0].quantity === quantity
    ? ("matched" as const)
    : ("changed" as const);
}
