export type CheckoutInput = {
  product: string;
  quantity: number;
  shipping: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  consent: boolean;
};
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
    address = field("address", 200);
  const phone = field("phone", 18)
    .replace(/[\s+-]/g, "")
    .replace(/^00966/, "966")
    .replace(/^966/, "")
    .replace(/^0/, "");
  const quantityText = field("quantity", 2).replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
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
    quantity: Number(quantityText),
    consent: true,
  };
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
    !Number.isFinite(total) ||
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
  };
}
