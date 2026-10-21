import type {
  Language,
  ZidPublicProduct,
  ZidPublicVariant,
} from "./zid-product.ts";

// A selection is not a platform cart or an order. No payment/fulfilment action lives here.
export type ShoppingSelection = {
  storeId: string;
  conversationId: string;
  expiresAt: number;
  token: string;
  stage: "PRODUCT" | "VARIANT" | "QUANTITY" | "REVIEW" | "CONFIRMED";
  candidates: Array<{ id: string; name: string; description?: string }>;
  productId?: string;
  variantId?: string;
  quantity?: number;
  page?: number;
  quote?: { name: string; variant: string; unit: number; currency: string };
};
export type ShoppingReply = {
  state: ShoppingSelection | null;
  body: string;
  buttons?: Array<{ id: string; title: string }>;
  rows?: Array<{ id: string; title: string; description?: string }>;
};
type Lookup = (
  id: string,
) => Promise<
  { ok: true; product: ZidPublicProduct } | { ok: false; error: string }
>;
const TTL = 30 * 60_000;
const token = () => crypto.randomUUID().slice(0, 8);
const safeId = (id: string) => /^[A-Za-z0-9-]{1,64}$/.test(id);
const clean = (s: string) =>
  s.replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 100);
const amount = (value: number | null) =>
  value !== null && Number.isFinite(value) && value >= 0 &&
  Number.isSafeInteger(Math.round(value * 100));
const price = (item: ZidPublicProduct | ZidPublicVariant) => {
  const value = item.salePrice ?? item.price;
  return amount(value) ? Math.round(value! * 100) : null;
};
export function stockAllows(
  item: Pick<ZidPublicProduct, "available" | "unlimited" | "quantity">,
  quantity: number,
) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 20 &&
    item.available === true &&
    (item.unlimited ||
      (typeof item.quantity === "number" && Number.isFinite(item.quantity) &&
        item.quantity >= quantity));
}
export function publicShoppingLink(value: string | null) {
  try {
    const url = new URL(value ?? "");
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      !url.hostname.includes(".") ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/
        .test(url.hostname)
    ) return null;
    return url.href.length <= 350 ? url.href : null;
  } catch {
    return null;
  }
}
const id = (s: ShoppingSelection, action: string) =>
  `shop:${s.token}:${action}`;
function options(s: ShoppingSelection, ar: boolean) {
  return [
    { id: id(s, "edit"), title: ar ? "تعديل الاختيار" : "Edit selection" },
    { id: id(s, "cancel"), title: ar ? "إلغاء الاختيار" : "Cancel selection" },
  ];
}
function productPrompt(s: ShoppingSelection, ar: boolean): ShoppingReply {
  return {
    state: s,
    body: ar
      ? "أي منتج تقصد؟ اختره عشان نراجع خياراته وتوفّره."
      : "Which product did you mean? Choose one to check its options and availability.",
    rows: s.candidates.map((p, i) => ({
      id: id(s, `product:${i}`),
      title: clean(p.name).slice(0, 24) || (ar ? "منتج" : "Product"),
      description: p.description,
    })),
  };
}
export function startShopping(
  storeId: string,
  conversationId: string,
  products: ZidPublicProduct[],
  language: Language,
  now = Date.now(),
): ShoppingReply | null {
  const candidates = products.filter((p) => safeId(p.id) && p.name).filter((
    p,
    i,
    all,
  ) => all.findIndex((x) => x.id === p.id) === i)
    .slice(0, 4).map((p) => ({
      id: p.id,
      name: clean(p.name),
      description: p.variants.length
        ? (language === "ar" ? "اختر المقاس واللون" : "Choose size and colour")
        : [
          price(p) !== null && /^[A-Z]{3}$/.test(p.currency)
            ? `${(price(p)! / 100).toFixed(2)} ${p.currency}`
            : "",
          p.available === false
            ? (language === "ar" ? "غير متوفر" : "Out of stock")
            : "",
        ].filter(Boolean).join(" · ").slice(0, 72),
    }));
  if (!candidates.length) return null;
  return productPrompt({
    storeId,
    conversationId,
    expiresAt: now + TTL,
    token: token(),
    stage: "PRODUCT",
    candidates,
  }, language === "ar");
}
function summary(
  s: ShoppingSelection,
  product: ZidPublicProduct,
  ar: boolean,
  confirmed = false,
): ShoppingReply {
  const q = s.quote!;
  const url = publicShoppingLink(product.url);
  const body = [
    ar
      ? (confirmed ? "تأكدنا من التوفّر الآن ✅" : "راجع اختيارك:")
      : (confirmed
        ? "Availability checked just now ✅"
        : "Check your selection:"),
    "",
    clean(q.name),
    q.variant ? clean(q.variant) : "",
    `${ar ? "الكمية" : "Quantity"}: ${s.quantity}`,
    `${ar ? "مجموع المنتجات" : "Item subtotal"}: ${
      ((q.unit * s.quantity!) / 100).toFixed(2)
    } ${q.currency}`,
    "",
    ar
      ? "الشحن والضرائب النهائية تظهر في المتجر. ما حجزنا المنتج أو أنشأنا طلب."
      : "Final shipping and tax are shown by the store. Nothing is reserved and no order has been placed.",
    confirmed && url
      ? `\n${
        ar
          ? "تقدر تكمل من صفحة المنتج في المتجر:"
          : "You can continue on the store’s product page:"
      }\n${url}`
      : "",
    confirmed && !url
      ? (ar
        ? "رابط المنتج غير متاح الآن. تواصل مع المتجر من القائمة."
        : "The product link isn’t available right now. Use Menu to contact the store.")
      : "",
  ].filter(Boolean).join("\n");
  return {
    state: s,
    body,
    buttons: confirmed ? options(s, ar) : [
      {
        id: id(s, "confirm"),
        title: ar ? "تأكيد الاختيار" : "Confirm selection",
      },
      ...options(s, ar),
    ],
  };
}
function variantPrompt(
  s: ShoppingSelection,
  product: ZidPublicProduct,
  ar: boolean,
): ShoppingReply {
  const variants = product.variants.filter((v) => safeId(v.id));
  const page = Math.max(
    0,
    Math.min(s.page ?? 0, Math.ceil(variants.length / 8) - 1),
  );
  const rows = variants.slice(page * 8, page * 8 + 8).map((v) => ({
    id: id(s, `variant:${v.id}`),
    title:
      clean(v.options.map((o) => o.name).join(" / ") || v.sku).slice(0, 24) ||
      (ar ? "خيار" : "Option"),
    description: v.available === false
      ? (ar ? "غير متوفر" : "Out of stock")
      : v.available === null
      ? (ar ? "نحتاج نتحقق من التوفّر" : "Availability needs checking")
      : undefined,
  }));
  if (page > 0) {
    rows.push({
      id: id(s, `page:${page - 1}`),
      title: ar ? "السابق" : "Previous",
      description: undefined,
    });
  }
  if ((page + 1) * 8 < variants.length) {
    rows.push({
      id: id(s, `page:${page + 1}`),
      title: ar ? "المزيد" : "More options",
      description: undefined,
    });
  }
  return {
    state: { ...s, page },
    body: ar
      ? "اختر المقاس واللون بالضبط. تقدر تكتب «إلغاء» في أي وقت."
      : "Choose the exact size and colour. You can type CANCEL at any time.",
    rows,
  };
}
export async function advanceShopping(
  s: ShoppingSelection | undefined,
  scope: { storeId: string; conversationId: string },
  input: string,
  language: Language,
  lookup: Lookup,
  now = Date.now(),
): Promise<ShoppingReply | null> {
  const ar = language === "ar";
  const raw = input.trim();
  const normal = raw.toLowerCase();
  const actionInput = normal.startsWith("shop:");
  if (!s) {
    return actionInput
      ? {
        state: null,
        body: ar
          ? "هذا الاختيار قديم. اكتب اسم المنتج ونبدأ من جديد."
          : "That selection is no longer current. Send the product name to start again.",
      }
      : null;
  }
  if (
    s.storeId !== scope.storeId || s.conversationId !== scope.conversationId ||
    !Number.isFinite(s.expiresAt) || now >= s.expiresAt
  ) {
    return {
      state: null,
      body: ar
        ? "انتهت مدة الاختيار. اكتب اسم المنتج عشان نراجع أحدث التفاصيل."
        : "Your selection has expired. Send the product name so we can check the latest details.",
    };
  }
  const prefix = `shop:${s.token}:`;
  if (actionInput && !raw.startsWith(prefix)) {
    return {
      state: s,
      body: ar
        ? "هذا الزر من اختيار سابق. استخدم أحدث رسالة أو اكتب «تعديل»."
        : "That button belongs to an earlier selection. Use the latest message or type EDIT.",
    };
  }
  const action = raw.startsWith(prefix) ? raw.slice(prefix.length) : normal;
  if (["cancel", "إلغاء", "الغاء", "cancel selection"].includes(action)) {
    return {
      state: null,
      body: ar
        ? "تم، ألغينا الاختيار. ما أنشأنا أي طلب."
        : "Selection cleared. No order was placed.",
    };
  }
  if (["edit", "تعديل", "edit selection"].includes(action)) {
    return productPrompt({
      ...s,
      token: token(),
      stage: "PRODUCT",
      productId: undefined,
      variantId: undefined,
      quantity: undefined,
      quote: undefined,
      page: 0,
    }, ar);
  }
  const quantityInput = raw.replace(
    /[٠-٩]/g,
    (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
  const quantityChange = /^(?:quantity|qty|الكمية|make it)\s+(\d{1,2})$/i.exec(
    quantityInput,
  );
  if (["REVIEW", "CONFIRMED"].includes(s.stage) && quantityChange) {
    return advanceShopping(
      { ...s, stage: "QUANTITY", quote: undefined },
      scope,
      quantityChange[1],
      language,
      lookup,
      now,
    );
  }
  // Unrelated natural conversation still reaches the assistant; it must not be
  // trapped behind a shopping menu. Buttons remain the unambiguous selection route.
  if (
    !actionInput && !["QUANTITY"].includes(s.stage) &&
    !["confirm", "yes", "نعم", "تأكيد", "تاكيد"].includes(action) &&
    !(s.stage === "PRODUCT" && /^[1-4]$/.test(action))
  ) return null;
  let next = { ...s };
  if (s.stage === "PRODUCT") {
    const index = /^product:(\d)$/.exec(action);
    const numeric = /^[1-4]$/.test(action) ? Number(action) - 1 : -1;
    const candidate = s.candidates[index ? Number(index[1]) : numeric];
    if (!candidate) return productPrompt(s, ar);
    next = {
      ...s,
      productId: candidate.id,
      variantId: undefined,
      quote: undefined,
      quantity: undefined,
      page: 0,
    };
  }
  if (!next.productId || !safeId(next.productId)) {
    return {
      state: null,
      body: ar
        ? "اكتب اسم المنتج ونبدأ من جديد."
        : "Send the product name to start again.",
    };
  }
  const result = await lookup(next.productId);
  if (!result.ok || result.product.id !== next.productId) {
    return {
      state: s,
      body: ar
        ? "ما قدرنا نتحقق من المنتج الآن. جرّب بعد شوي أو اكتب «إلغاء»."
        : "I couldn’t check this product just now. Please try again shortly or type CANCEL.",
    };
  }
  const product = result.product;
  if (product.options.length && !product.variants.length) {
    return {
      state: s,
      body: ar
        ? "نحتاج نتأكد من خيارات المنتج مع المتجر قبل المتابعة. اكتب «إلغاء» أو تواصل مع المتجر من القائمة."
        : "The store needs to confirm this product’s options before we continue. Type CANCEL or contact the store from Menu.",
    };
  }
  if (s.stage === "PRODUCT" && product.variants.length) {
    return variantPrompt(
      { ...next, token: token(), stage: "VARIANT" },
      product,
      ar,
    );
  }
  if (s.stage === "VARIANT") {
    const page = /^page:(\d{1,2})$/.exec(action);
    if (page) {
      return variantPrompt(
        { ...next, page: Number(page[1]), token: token() },
        product,
        ar,
      );
    }
    const selected = action.startsWith("variant:")
      ? product.variants.find((v) => v.id === action.slice(8))
      : null;
    if (!selected) return variantPrompt(next, product, ar);
    next.variantId = selected.id;
  }
  if (product.variants.length && !next.variantId) {
    return variantPrompt(
      { ...next, token: token(), stage: "VARIANT" },
      product,
      ar,
    );
  }
  const item = next.variantId
    ? product.variants.find((v) => v.id === next.variantId)
    : product;
  if (
    !item || item.available !== true || price(item) === null ||
    !/^[A-Z]{3}$/.test(product.currency)
  ) {
    return {
      state: s,
      body: ar
        ? "ما نقدر نؤكد توفّر هذا الخيار وسعره الآن. اختر «تعديل» لتغيير المنتج أو الخيار."
        : "I can’t confirm this option’s availability and price right now. Type EDIT to choose another product or option.",
      buttons: options(s, ar),
    };
  }
  if (["PRODUCT", "VARIANT"].includes(s.stage)) {
    const state = { ...next, token: token(), stage: "QUANTITY" as const };
    return {
      state,
      body: ar
        ? "كم قطعة تحتاج؟ أرسل رقم من 1 إلى 20. بنتحقق من الكمية المتوفرة قبل التأكيد."
        : "How many would you like? Send a number from 1 to 20. We’ll check the available quantity before confirmation.",
    };
  }
  if (s.stage === "QUANTITY") {
    const digits = raw.replace(
      /[٠-٩]/g,
      (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
    );
    const matched = /^(?:quantity\s*|qty\s*|الكمية\s*)?(\d{1,2})$/i.exec(
      digits,
    );
    const quantity = matched ? Number(matched[1]) : 0;
    if (!stockAllows(item, quantity)) {
      return {
        state: s,
        body: ar
          ? "ما قدرنا نؤكد هذه الكمية. أرسل كمية أخرى من 1 إلى 20 أو اكتب «تعديل»."
          : "I couldn’t confirm that quantity. Send another number from 1 to 20 or type EDIT.",
      };
    }
    next.quantity = quantity;
  } else if (!["confirm", "yes", "نعم", "تأكيد", "تاكيد"].includes(action)) {
    if (s.quote) return summary(s, product, ar, s.stage === "CONFIRMED");
    return {
      state: s,
      body: ar
        ? "اكتب «تعديل» لتغيير الاختيار."
        : "Type EDIT to change your selection.",
    };
  }
  if (!stockAllows(item, next.quantity ?? 0)) {
    return {
      state: { ...s, token: token(), stage: "QUANTITY", quote: undefined },
      body: ar
        ? "تغيّر المخزون. أرسل كمية جديدة عشان نراجعها."
        : "Stock has changed. Send a new quantity so we can check it.",
    };
  }
  const quote = {
    name: clean(product.name),
    variant: next.variantId
      ? clean((item as ZidPublicVariant).options.map((o) => o.name).join(" / "))
      : "",
    unit: price(item)!,
    currency: product.currency,
  };
  const changed = s.quote && JSON.stringify(s.quote) !== JSON.stringify(quote);
  next = {
    ...next,
    quote,
    token: token(),
    stage: s.stage === "QUANTITY" || changed ? "REVIEW" : "CONFIRMED",
  };
  const reply = summary(next, product, ar, next.stage === "CONFIRMED");
  if (changed) {
    reply.body = (ar
      ? "تغيّرت تفاصيل المنتج. راجع الاختيار وأكّده مرة ثانية.\n\n"
      : "The product details changed. Please review and confirm again.\n\n") +
      reply.body;
  }
  return reply;
}
