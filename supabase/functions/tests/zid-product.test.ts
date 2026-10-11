import { zidAvailability, zidIsVisible, zidPublicProduct, zidSearchScore, zidSearchTokens, zidTrackingFromOrder } from "../_shared/zid-product.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }

const shoe = {
  id: "p1", name: { ar: "حذاء جري", en: "Running Shoes" }, description: { ar: "<p>خفيف</p>", en: "<p>Light &amp; fast</p>" },
  price: 300, sale_price: null, currency: "SAR", is_published: true, is_draft: false, html_url: "https://shop.example/products/shoe",
  cost: 120, store_id: 99, sold_products_count: 40, waiting_customers_count: 3, metafields: { secret: "x" },
  stocks: [{ id: "s", location: { full_address: "Warehouse 7, Riyadh" }, available_quantity: 5, is_infinite: false }],
  images: [{ id: "i", image: { medium: "https://cdn.example/m.jpg", thumbnail: "https://cdn.example/t.jpg" } }],
  variants: [
    { id: "v1", sku: "S-42-B", price: 300, sale_price: 250, quantity: 5, is_infinite: false, cost: 120, attributes: [{ name: { ar: "المقاس", en: "Size" }, slug: "size", value: { ar: "42", en: "42" } }, { name: { ar: "اللون", en: "Color" }, slug: "color", value: { ar: "أسود", en: "Black" } }] },
    { id: "v2", sku: "S-42-W", price: 300, sale_price: null, quantity: 0, is_infinite: false, attributes: [{ name: { en: "Size" }, slug: "size", value: { en: "42" } }, { name: { en: "Color" }, slug: "color", value: { en: "White" } }] },
    { id: "v3", sku: "S-41-B", price: 300, sale_price: null, quantity: 0, is_infinite: true, attributes: [{ name: { en: "Size" }, slug: "size", value: { en: "41" } }, { name: { en: "Color" }, slug: "color", value: { en: "Black" } }] },
  ],
};

Deno.test("internal fields never reach the customer", () => {
  const out = JSON.stringify(zidPublicProduct(shoe, "en"));
  for (const secret of ["cost", "120", "store_id", "Warehouse", "sold_products_count", "waiting_customers", "metafields"]) assert(!out.includes(secret), `leaked ${secret}`);
});

Deno.test("each variant keeps its own price, sale price and stock", () => {
  const product = zidPublicProduct(shoe, "en");
  const [black42, white42, black41] = product.variants;
  assert(black42.available === true && black42.quantity === 5 && black42.salePrice === 250);
  assert(white42.available === false && white42.quantity === 0);
  assert(black41.available === true && black41.unlimited && black41.quantity === null, "unlimited is in stock, whatever the number says");
  assert(product.available === true && product.unlimited);
  assert(JSON.stringify(product.options) === JSON.stringify([{ name: "Size", values: [{ name: "42" }, { name: "41" }] }, { name: "Color", values: [{ name: "Black" }, { name: "White" }] }]));
});

Deno.test("language picks the right text and falls back", () => {
  assert(zidPublicProduct(shoe, "ar").name === "حذاء جري");
  assert(zidPublicProduct({ ...shoe, name: { ar: "", en: "Only English" } }, "ar").name === "Only English");
  assert(zidPublicProduct(shoe, "en").description === "Light &amp; fast");
});

Deno.test("stock is in stock, sold out, or unknown; never guessed", () => {
  assert(zidAvailability({ quantity: null, is_infinite: true }).available === true);
  assert(zidAvailability({ quantity: 0, is_infinite: false }).available === false);
  assert(zidAvailability({ quantity: 3, is_infinite: false }).quantity === 3);
  assert(zidAvailability({ quantity: null, is_infinite: false }).available === null, "missing quantity is unknown, not sold out");
  assert(zidAvailability({}).available === null);
  assert(zidAvailability({ quantity: null, stocks: [{ available_quantity: 2 }, { available_quantity: 4 }] }).quantity === 6);
  assert(zidAvailability({ quantity: null, stocks: [{ available_quantity: null, is_infinite: true }] }).unlimited);
});

Deno.test("a product with only sold-out and unknown variants is unknown", () => {
  const product = zidPublicProduct({ ...shoe, variants: [{ id: "a", quantity: 0, is_infinite: false }, { id: "b", quantity: null, is_infinite: false }] }, "en");
  assert(product.available === null);
});

Deno.test("hidden and draft products are not visible", () => {
  assert(zidIsVisible({ is_published: true, is_draft: false }));
  assert(!zidIsVisible({ is_published: false, is_draft: false }));
  assert(!zidIsVisible({ is_published: true, is_draft: true }));
  assert(!zidIsVisible({}));
});

Deno.test("only https links are shared", () => {
  assert(zidPublicProduct({ ...shoe, html_url: "javascript:alert(1)" }, "en").url === null);
  assert(zidPublicProduct({ ...shoe, html_url: "http://shop.example/x" }, "en").url === null);
  assert(zidPublicProduct(shoe, "en").url === "https://shop.example/products/shoe");
});

Deno.test("search folds Arabic spelling, plurals and the definite article", () => {
  assert(JSON.stringify(zidSearchTokens("Do you have Running SHOES?")).includes("shoe"));
  assert(zidSearchTokens("الأحذية").includes("احذيه"));
  assert(zidSearchTokens("؟ a").length === 0);
  assert(JSON.stringify(zidSearchTokens("Do you have these dresses in size 42?")) === JSON.stringify(["dress", "42"]));
  assert(JSON.stringify(zidSearchTokens("هل عندكم الحذاء مقاس ٤٢")) === JSON.stringify(["حذاء", "42"]));
  assert(zidSearchScore("حذاء جري running shoes s 42", zidSearchTokens("running shoes")) > zidSearchScore("حذاء جري running shoes s 42", zidSearchTokens("shoes")));
  assert(zidSearchScore("coffee mug", zidSearchTokens("shoes")) === 0);
  assert(zidSearchScore("قبعه تجريبيه test cap", zidSearchTokens("حذاء جري")) === 0, "a word must match from its start");
  assert(zidSearchScore("الحذاء الرياضي", zidSearchTokens("حذاء")) > 0);
  assert(zidSearchScore("mug z 17916760192142086", zidSearchTokens("shoes size 42")) === 0, "a size must not match digits inside a SKU");
  assert(zidSearchScore("running shoe sku 5531", zidSearchTokens("5531")) > 0, "a SKU on its own still finds the product");
});

Deno.test("tracking shares shipping facts only", () => {
  const order = { id: 7, code: "ABC123", order_status: { name: "In delivery", code: "indelivery" }, customer: { name: "Sara", mobile: "966500000000", email: "s@example.com" },
    shipping: { method: { name: "Aramex", tracking: { number: "TRK1", url: "https://track.example/TRK1" }, estimated_delivery_time: "2-3 days" }, address: { street: "Private Street 5" } } };
  const tracking = zidTrackingFromOrder(order, "shipped", null);
  const out = JSON.stringify(tracking);
  assert(tracking.trackingNumber === "TRK1" && tracking.trackingUrl === "https://track.example/TRK1" && tracking.courier === "Aramex" && tracking.orderNumber === "7");
  assert(!out.includes("Sara") && !out.includes("966500000000") && !out.includes("Private Street") && !out.includes("s@example.com"));
  assert(zidTrackingFromOrder({ id: 1, shipping: { method: { tracking: { url: "http://insecure" } } } }, "processing", null).trackingUrl === null);
});
