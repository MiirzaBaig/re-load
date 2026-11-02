/** Customer collection details only. No courier booking, AI call or wallet write. */
import { decrypt, encrypt } from "./crypto.ts";
import { normalizeOrderContact } from "./order-contact.ts";
import { verifyReturnFacts } from "./return-token.ts";

type Language = "ar" | "en";
export type CollectionState = {
  id: string;
  revision: number;
  stage: "CITY" | "ADDRESS" | "BUILDING" | "POSTCODE" | "REVIEW" | "EDIT";
  expiresAt: number;
  settingsVersion: number;
  method: "PICKUP_BY_DC" | "BRANCH_DROP_OFF";
  ciphertext?: string;
};
type Details = {
  store: string;
  conversation: string;
  caseId: string;
  city?: string;
  address?: string;
  building?: string;
  postcode?: string;
};
type Facts = {
  storeId: string;
  orderId: string;
  items: Array<{ id: string; quantity: number }>;
};
export type CollectionContext = {
  caseId?: string | null;
  verificationToken?: string;
  order?: { orderId: string };
  itemId?: string;
  quantity?: number;
  collection?: CollectionState;
};
type Admin = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: any; error: any }>;
};
export type CollectionReply = {
  body: string;
  buttons?: Array<{ id: string; title: string }>;
  rows?: Array<{ id: string; title: string }>;
  state?: CollectionState;
  done?: boolean;
  confirmed?: boolean;
  help?: boolean;
  expired?: boolean;
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cities = ["Riyadh", "Jeddah", "Dammam"] as const;
const arCities = ["الرياض", "جدة", "الدمام"];
const digits = (s: string) =>
  s.replace(
    /[٠-٩۰-۹]/g,
    (c) => String(c.charCodeAt(0) - (c >= "۰" ? 1776 : 1632)),
  );
const word = (s: string) => digits(s.trim()).toLowerCase();
export function collectionEnabled(store: string, sender: string) {
  const allow = (name: string) =>
    (Deno.env.get(name) || "").split(",").map((v) => v.trim()).filter(Boolean);
  return Deno.env.get("WHATSAPP_SHIPPING_SANDBOX_ENABLED") === "true" &&
    allow("WHATSAPP_SHIPPING_SANDBOX_STORE_IDS").includes(store) &&
    allow("WHATSAPP_SHIPPING_SANDBOX_SENDERS").includes(
      normalizeOrderContact(sender),
    );
}
/** Optional exact order fence for a narrowly authorized pilot. Store/sender gates still apply. */
export function collectionOrderAllowed(orderId: unknown) {
  const orders = (Deno.env.get("WHATSAPP_SHIPPING_SANDBOX_ORDER_IDS") || "")
    .split(",").map((v) => v.trim()).filter(Boolean);
  return !orders.length ||
    (typeof orderId === "string" && orders.includes(orderId));
}
export function collectionSensitive(step: string, input: string) {
  // Mask even navigation and rejected text: a customer may paste an address anywhere in this step.
  return step === "SHIPPING_COLLECTION" || input.startsWith("rc:");
}
function action(s: CollectionState, a: string) {
  return `rc:${s.id}:${s.revision}:${a}`;
}
function buttons(s: CollectionState, l: Language) {
  return [{ id: action(s, "back"), title: l === "ar" ? "رجوع" : "Back" }, {
    id: action(s, "help"),
    title: l === "ar" ? "مساعدة" : "Help",
  }, {
    id: action(s, "cancel"),
    title: l === "ar" ? "إيقاف المتابعة" : "Stop here",
  }];
}
function cityName(city: string | undefined, l: Language) {
  const i = cities.indexOf(city as typeof cities[number]);
  return i < 0 ? "—" : l === "ar" ? arCities[i] : cities[i];
}
function prompt(
  s: CollectionState,
  d: Details,
  l: Language,
  prefix = "",
): CollectionReply {
  const foot = l === "ar"
    ? "\n\nتقدر تكتب «رجوع» أو «القائمة» في أي وقت. طلب الإرجاع محفوظ، ولم نحجز ناقلًا بعد."
    : "\n\nYou can type BACK or MENU at any time. Your return is saved; no courier has been booked.";
  const intro = prefix ? prefix + "\n\n" : "";
  if (s.stage === "CITY") {
    return {
      state: s,
      body: intro + (l === "ar"
        ? "خلّنا نجهّز تفاصيل الإرجاع. في أي مدينة يوجد الطرد الآن؟\nهذا اختبار؛ لا يوجد حجز فعلي."
        : "Let’s prepare your return details. Which city is the parcel in now?\nThis is a test; no pickup will be booked.") +
        (s.method === "BRANCH_DROP_OFF"
          ? l === "ar"
            ? "\nطريقة الإرجاع المختارة: تسليم الطرد في فرع الناقل بعد تأكيد ترتيبات الشحن."
            : "\nReturn method: branch drop-off once shipping is arranged."
          : "") +
        foot,
      buttons: cities.map((_, i) => ({
        id: action(s, `city${i}`),
        title: cityName(cities[i], l),
      })),
    };
  }
  if (s.stage === "EDIT") {
    return {
      state: s,
      body: intro + (l === "ar"
        ? "أي تفصيل تريد تعديله؟ بعد التعديل سنراجع العنوان معك من جديد."
        : "Which detail would you like to change? We’ll review the address again afterwards.") +
        foot,
      rows: [
        ...["CITY", "ADDRESS", "BUILDING", "POSTCODE"].map((v, i) => ({
          id: action(s, `edit${v}`),
          title: (l === "ar"
            ? ["المدينة", "الحي والشارع", "رقم المبنى", "الرمز البريدي"]
            : [
              "City",
              "District and street",
              "Building number",
              "Postal code",
            ])[i],
        })),
        {
          id: action(s, "review"),
          title: l === "ar" ? "العودة للمراجعة" : "Back to review",
        },
      ],
    };
  }
  if (s.stage === "REVIEW") {
    return {
      state: s,
      body: intro +
        (l === "ar"
          ? `راجع تفاصيلك\n\nالمدينة: ${
            cityName(d.city, l)
          }\nالحي والشارع: تم إدخالهما\nرقم المبنى ينتهي بـ: ••${
            d.building?.slice(-2)
          }\nالرمز البريدي ينتهي بـ: •••${
            d.postcode?.slice(-2)
          }\n\nاستخدمنا التفاصيل التي كتبتها. يمكنك تعديلها قبل التأكيد. سنستخدم رقم واتساب هذا للتواصل بشأن الإرجاع، ونشارك التفاصيل مع المتجر. لم يتأكد موعد أو حجز بعد.`
          : `Review your details\n\nCity: ${
            cityName(d.city, l)
          }\nDistrict and street: entered\nBuilding ends in: ••${
            d.building?.slice(-2)
          }\nPostal code ends in: •••${
            d.postcode?.slice(-2)
          }\n\nThese are the details you entered. You can edit them before confirming. We’ll use this WhatsApp number as your return contact and share the details with the store. No booking or collection time is confirmed.`),
      buttons: [{
        id: action(s, "confirm"),
        title: l === "ar" ? "تأكيد التفاصيل" : "Confirm details",
      }, {
        id: action(s, "edit"),
        title: l === "ar" ? "تعديل" : "Edit details",
      }, {
        id: action(s, "cancel"),
        title: l === "ar" ? "إيقاف المتابعة" : "Stop here",
      }],
    };
  }
  const body = s.stage === "ADDRESS"
    ? (l === "ar"
      ? `تمام، ${
        cityName(d.city, l)
      }. اكتب اسم الحي والشارع، ورقم الشقة إن وجد. سنطلب رقم المبنى والرمز البريدي بعد ذلك.`
      : `Thanks. For ${
        cityName(d.city, l)
      }, send the district and street, plus an apartment number if needed. We’ll ask for the building number and postal code next.`)
    : s.stage === "BUILDING"
    ? (l === "ar"
      ? "ما رقم المبنى؟ أرسل الأرقام الأربعة الموجودة في عنوانك الوطني."
      : "What is the building number? Send the four digits from your National Address.")
    : (l === "ar"
      ? "وأخيرًا، ما الرمز البريدي؟ أرسل الأرقام الخمسة الموجودة في عنوانك الوطني."
      : "Finally, what is the postal code? Send the five digits from your National Address.");
  return { state: s, body: intro + body + foot, buttons: buttons(s, l) };
}
async function rpc(admin: Admin, name: string, args: Record<string, unknown>) {
  const r = await admin.rpc(name, args);
  if (r.error) throw Error("collection_records_unavailable");
  return r.data;
}
async function verified(c: CollectionContext, store: string) {
  if (
    !c.verificationToken || !c.caseId || !c.order || !c.itemId ||
    !Number.isInteger(c.quantity)
  ) throw Error("expired_return_token");
  const f = await verifyReturnFacts<Facts>(c.verificationToken);
  const item = f.items?.find((x) => x.id === c.itemId);
  if (
    f.storeId !== store || f.orderId !== c.order.orderId || !item ||
    !c.quantity || c.quantity < 1 || c.quantity > item.quantity
  ) throw Error("expired_return_token");
}
export async function beginCollection(
  admin: Admin,
  c: CollectionContext,
  store: string,
  conversation: string,
  sender: string,
  l: Language,
): Promise<CollectionReply | null> {
  if (!collectionEnabled(store, sender) || !c.caseId || !UUID.test(c.caseId)) {
    return null;
  }
  if (!collectionOrderAllowed(c.order?.orderId)) return null;
  await verified(c, store);
  const gate = await rpc(admin, "shipping_collection_gate", {
    p_store: store,
    p_conversation: conversation,
    p_case: c.caseId,
  });
  if (gate?.confirmed) return complete(l);
  if (!gate?.allowed) return null;
  const s: CollectionState = {
    id: crypto.randomUUID(),
    revision: 1,
    stage: "CITY",
    expiresAt: Date.now() + 15 * 60_000,
    settingsVersion: gate.version,
    method: gate.method,
  };
  await encrypt("collection_configuration_check");
  return prompt(s, { store, conversation, caseId: c.caseId }, l);
}
function complete(l: Language): CollectionReply {
  return {
    done: true,
    confirmed: true,
    body: l === "ar"
      ? "تم حفظ تفاصيل الإرجاع، شكرًا لك.\n\nيحتاج المتجر إلى تأكيد بيانات الطرد قبل ترتيب الشحن. لم نحجز موعد استلام بعد. يمكنك متابعة طلبك من هنا."
      : "Your return details are saved. Thank you.\n\nThe store needs to confirm the parcel details before shipping can be arranged. No collection has been booked yet. You can check your return here.",
    buttons: [{
      id: "check_status",
      title: l === "ar" ? "متابعة الإرجاع" : "Track return",
    }, { id: "menu", title: l === "ar" ? "القائمة" : "Menu" }],
  };
}
export async function advanceCollection(
  admin: Admin,
  c: CollectionContext,
  store: string,
  conversation: string,
  sender: string,
  input: string,
  l: Language,
): Promise<CollectionReply> {
  const s = c.collection;
  if (!s && c.caseId && collectionEnabled(store, sender)) {
    return {
      expired: true,
      body: l === "ar"
        ? "انتهت مدة التحقق الآمن. طلب الإرجاع محفوظ؛ تحقّق من رقم الطلب للمتابعة."
        : "Your secure session has expired. Your return is saved; verify your order to continue.",
      buttons: [{
        id: "collection_verify",
        title: l === "ar" ? "التحقق من الطلب" : "Verify order",
      }, {
        id: "collection_help",
        title: l === "ar" ? "مساعدة المتجر" : "Ask the store",
      }, { id: "menu", title: l === "ar" ? "القائمة" : "Menu" }],
    };
  }
  if (
    !s || !UUID.test(s.id) || !c.caseId || !collectionEnabled(store, sender)
  ) {
    return {
      done: true,
      body: l === "ar"
        ? "متابعة تفاصيل الشحن غير متاحة الآن. طلب الإرجاع محفوظ لدى المتجر."
        : "Shipping details are unavailable right now. Your return is saved with the store.",
      buttons: [{
        id: "check_status",
        title: l === "ar" ? "متابعة الإرجاع" : "Track return",
      }, { id: "menu", title: l === "ar" ? "القائمة" : "Menu" }],
    };
  }
  const n = word(input), m = /^rc:([^:]+):(\d+):([a-z0-9_]+)$/i.exec(n);
  let command = m?.[3] || n;
  let d: Details = { store, conversation, caseId: c.caseId };
  try {
    if (s.ciphertext) d = JSON.parse(await decrypt(s.ciphertext));
    if (
      d.store !== store || d.conversation !== conversation ||
      d.caseId !== c.caseId
    ) throw Error("binding");
  } catch {
    throw Error("collection_details_unavailable");
  }
  // Cancel/help do not need an unexpired token; neither exposes or submits details.
  const stale = Boolean(m && (m[1] !== s.id || Number(m[2]) !== s.revision));
  if (
    ["cancel", "cancel_return", "إلغاء", "الغاء", "إيقاف", "cancel shipping"]
      .includes(command)
  ) command = "cancel";
  if (command === "cancel" && !stale) {
    return {
      done: true,
      body: l === "ar"
        ? "تم إيقاف إدخال تفاصيل الشحن. طلب الإرجاع ما زال محفوظًا لدى المتجر، ولم نحجز ناقلًا."
        : "We’ve stopped collecting shipping details. Your return is still saved with the store; no courier was booked.",
      buttons: [{
        id: "collection_continue",
        title: l === "ar" ? "متابعة التفاصيل" : "Continue details",
      }, {
        id: "check_status",
        title: l === "ar" ? "متابعة الإرجاع" : "Track return",
      }, { id: "menu", title: l === "ar" ? "القائمة" : "Menu" }],
    };
  }
  if (
    !stale &&
    ["help", "مساعدة", "store help", "مساعدة المتجر"].includes(command)
  ) {
    return {
      state: s,
      help: true,
      body: l === "ar"
        ? "أكيد، تقدر تطلب مساعدة المتجر أو تتابع إدخال التفاصيل. لا ترسل عنوانك في رسالة الدعم؛ تفاصيل الشحن تبقى محمية."
        : "Of course. You can ask the store for help or continue your details. Please leave your address out of the support message; shipping details stay protected.",
    };
  }
  try {
    if (s.expiresAt <= Date.now()) throw Error("expired_return_token");
    await verified(c, store);
  } catch {
    return {
      expired: true,
      body: l === "ar"
        ? "انتهت مدة التحقق الآمن. طلب الإرجاع محفوظ. تحقّق من رقم الطلب مرة أخرى لمتابعة تفاصيل الشحن."
        : "Your secure session has expired. Your return is saved. Verify your order again to continue the shipping details.",
      buttons: [{
        id: "collection_verify",
        title: l === "ar" ? "التحقق من الطلب" : "Verify order",
      }, {
        id: "collection_help",
        title: l === "ar" ? "مساعدة المتجر" : "Ask the store",
      }, { id: "menu", title: l === "ar" ? "القائمة" : "Menu" }],
    };
  }
  if (stale) {
    return prompt(
      s,
      d,
      l,
      l === "ar"
        ? "هذا الاختيار من خطوة سابقة. أكمل من الخيارات الحالية."
        : "That choice belongs to an earlier step. Please use the current options.",
    );
  }
  if (
    m &&
    ![
      "back",
      "help",
      "cancel",
      "edit",
      "review",
      "confirm",
      ...cities.map((_, i) => `city${i}`),
      ...["CITY", "ADDRESS", "BUILDING", "POSTCODE"].map((v) =>
        `edit${v.toLowerCase()}`
      ),
    ].includes(command)
  ) return prompt(s, d, l);
  if (
    [
      "resume_return",
      "continue",
      "متابعة",
      "start_return",
      "confirm_return",
      "edit_return",
      "check_status",
      "collection_verify",
    ].includes(command)
  ) return prompt(s, d, l);
  if (["back", "رجوع", "عودة"].includes(command)) {
    const prev = {
      CITY: "CITY",
      ADDRESS: "CITY",
      BUILDING: "ADDRESS",
      POSTCODE: "BUILDING",
      REVIEW: "POSTCODE",
      EDIT: "REVIEW",
    } as const;
    return prompt(
      { ...s, revision: s.revision + 1, stage: prev[s.stage] },
      d,
      l,
    );
  }
  if (command === "edit" && s.stage === "REVIEW") {
    return prompt({ ...s, revision: s.revision + 1, stage: "EDIT" }, d, l);
  }
  if (command === "review" && s.stage === "EDIT") {
    return prompt(
      {
        ...s,
        revision: s.revision + 1,
        stage: d.city && d.address && d.building && d.postcode
          ? "REVIEW"
          : "CITY",
      },
      d,
      l,
    );
  }
  if (
    s.stage === "EDIT" && /^edit(city|address|building|postcode)$/.test(command)
  ) {
    return prompt(
      {
        ...s,
        revision: s.revision + 1,
        stage: command.slice(4).toUpperCase() as CollectionState["stage"],
      },
      d,
      l,
    );
  }
  if (
    command === "confirm" && m && s.stage === "REVIEW" && d.city && d.address &&
    d.building && d.postcode
  ) {
    const payload = await encrypt(
      JSON.stringify({
        ...d,
        itemId: c.itemId,
        quantity: c.quantity,
        orderId: c.order!.orderId,
        recipientPhone: normalizeOrderContact(sender),
      }),
    );
    const saved = await rpc(admin, "shipping_collection_confirm", {
      p_store: store,
      p_conversation: conversation,
      p_case: c.caseId,
      p_id: s.id,
      p_version: s.settingsVersion,
      p_ciphertext: payload,
    });
    if (saved?.confirmed) return complete(l);
    return {
      done: true,
      body: l === "ar"
        ? "طلب الإرجاع محفوظ. تغيّرت إعدادات الشحن أو بيانات الطلب، لذلك يحتاج المتجر إلى مراجعتها قبل المتابعة. لم نحجز ناقلًا."
        : "Your return is saved. Shipping settings or order details have changed, so the store needs to review them before continuing. No courier was booked.",
      buttons: [{
        id: "check_status",
        title: l === "ar" ? "متابعة الإرجاع" : "Track return",
      }, {
        id: "collection_help",
        title: l === "ar" ? "مساعدة المتجر" : "Ask the store",
      }],
    };
  }
  // Side questions never enter an address field or call a model with private details.
  if (
    /[?؟]|\b(when|refund|cost|how|delivery|print|label|tracking|courier|status)\b|^(what|where|why|can|could|does|is|do)\b|متى|كم يوم|استرداد|بوليصة|طباعة|وين|أين|(?:^|\s)هل\s/i
      .test(input)
  ) {
    return prompt(
      s,
      d,
      l,
      l === "ar"
        ? "لم يتأكد الشحن أو موعد الاستلام بعد. استرداد المبلغ يخضع لمراجعة المتجر. تقدر تكمل التفاصيل، أو تختار «مساعدة»."
        : "Shipping and collection time are not confirmed yet. The store handles refund approval. You can continue your details or choose Help.",
    );
  }
  const next = { ...s, revision: s.revision + 1 };
  if (s.stage === "CITY") {
    const i = m && /^city[0-2]$/.test(command)
      ? Number(command.slice(-1))
      : cities.findIndex((v, i) => word(v) === n || arCities[i] === n);
    if (i < 0) {
      return prompt(
        s,
        d,
        l,
        l === "ar"
          ? "الاختبار يدعم المدن الظاهرة فقط. إذا كانت مدينتك مختلفة، اكتب «مساعدة» ليُراجع المتجر طلبك."
          : "This test supports only the cities shown. If yours is different, type HELP so the store can review your return.",
      );
    }
    d = { ...d, city: cities[i] };
    next.stage = "ADDRESS";
  } else if (s.stage === "ADDRESS") {
    const v = input.trim();
    if (
      m || v.length < 12 || v.length > 240 || !/[\p{L}]/u.test(v) ||
      /[<>\u0000-\u001f]|https?:\/\//i.test(v) ||
      ["menu", "confirm", "yes", "no", "نعم", "لا"].includes(n)
    ) {
      return prompt(
        s,
        d,
        l,
        l === "ar"
          ? "اكتب اسم الحي والشارع بوضوح، من 12 إلى 240 حرفًا. لا ترسل رابطًا أو رمز تحقق."
          : "Please send the district and street clearly, using 12–240 characters. Leave out links and verification codes.",
      );
    }
    d = { ...d, address: v };
    next.stage = "BUILDING";
  } else if (s.stage === "BUILDING" || s.stage === "POSTCODE") {
    const v = digits(input.trim());
    const building = s.stage === "BUILDING";
    if (m || !(building ? /^[1-9]\d{3}$/ : /^[1-9]\d{4}$/).test(v)) {
      return prompt(
        s,
        d,
        l,
        l === "ar"
          ? `أرسل ${
            building ? "أربعة" : "خمسة"
          } أرقام فقط من عنوانك الوطني. إذا لم تعرفها، اكتب «مساعدة».`
          : `Send only the ${
            building ? "four" : "five"
          } digits from your National Address. If you don’t know them, type HELP.`,
      );
    }
    d = { ...d, [building ? "building" : "postcode"]: v };
    next.stage = building ? "POSTCODE" : "REVIEW";
  } else {return prompt(
      s,
      d,
      l,
      l === "ar"
        ? "اختر زرًا من الخيارات الظاهرة حتى نتابع بأمان."
        : "Please choose one of the current buttons so we can continue safely.",
    );}
  next.ciphertext = await encrypt(JSON.stringify(d));
  return prompt(next, d, l);
}
