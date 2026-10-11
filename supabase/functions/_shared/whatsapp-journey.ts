import { reviseTicketDraft } from "./ticket-draft.ts";
import { whatsappRouteInput } from "./whatsapp-route-input.ts";
import { extractOrderReference } from "./return-photo.ts";
import { answerStoreQuestion } from "./customer-assistant.ts";
import { zidOrderTracking } from "./zid-catalog.ts";
import { trackingMessage } from "./customer-tracking.ts";
import { sha256 } from "./crypto.ts";
import { env, json } from "./http.ts";
import { adminClient } from "./supabase.ts";
import { downloadWhatsAppImage, sendWhatsAppButtons as deliverButtons, sendWhatsAppList as deliverList, sendWhatsAppText as deliverText, sentMessageId, verifyWhatsAppSignature, type WhatsAppSendResult } from "./whatsapp.ts";

type ReplyPlan = { kind: "text"; to: string; body: string } | { kind: "buttons"; to: string; body: string; buttons: Array<{ id: string; title: string }> } | { kind: "list"; to: string; body: string; label: string; rows: Array<{ id: string; title: string; description?: string }> };
const sendWhatsAppText = async (to: string, body: string): Promise<ReplyPlan> => ({ kind: "text", to, body });
const sendWhatsAppButtons = async (to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<ReplyPlan> => ({ kind: "buttons", to, body, buttons });
const sendWhatsAppList = async (to: string, body: string, label: string, rows: Array<{ id: string; title: string; description?: string }>): Promise<ReplyPlan> => ({ kind: "list", to, body, label, rows });

async function deliver(plan: ReplyPlan) {
  if (plan.kind === "text") return deliverText(plan.to, plan.body);
  if (plan.kind === "buttons") return deliverButtons(plan.to, plan.body, plan.buttons);
  return deliverList(plan.to, plan.body, plan.label, plan.rows);
}

async function persistAndDeliver(admin: Admin, messageId: string, plan: ReplyPlan, storeId: string | null = null, conversationId: string | null = null, accepted?: WhatsAppSendResult) {
  const reply = { plan, storeId, conversationId };
  const saved = await admin.rpc("save_whatsapp_reply", { p_id: messageId, p_reply: reply });
  if (saved.error) throw saved.error;
  if (!accepted) {
    const started = await admin.rpc("mark_whatsapp_send_started", { p_id: messageId });
    if (started.error || !started.data) throw started.error ?? new Error("inbox_lease_missing");
  }
  let result: WhatsAppSendResult;
  try { result = accepted ?? await deliver(plan); }
  catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError", "TypeError"].includes(error.name)) throw new Error("send_receipt_unknown");
    throw error;
  }
  const receipt = await admin.rpc("save_whatsapp_reply", { p_id: messageId, p_reply: reply, p_accepted: result });
  if (receipt.error) throw new Error("send_receipt_unknown");
  if (storeId && conversationId) await saveOutbound(admin, storeId, conversationId, result, plan.body, plan.kind === "text" ? "TEXT" : "INTERACTIVE");
  return result;
}

type Admin = ReturnType<typeof adminClient>;
type MetaMessage = { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; image?: { id?: string; mime_type?: string; caption?: string }; interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } } };
type Item = { id: string; name: string; sku: string; quantity: number; price: number };
type Context = { generalHistory?: Array<{role:string;content:string}>; extractedOrder?: string; serviceMode?: "QUESTION" | "PRODUCT" | "TRACK" | "COMPLAINT" | "HUMAN"; ticketDraft?: string; ticketEditing?: boolean; returnResume?: { step: string; context: Record<string, unknown> }; caseId?: string | null; orderNumber?: string; identityReviewId?: string; verificationToken?: string; order?: { orderId: string; customerName: string; orderStatus?: string; customerEmail?: string; items: Item[] }; itemId?: string; quantity?: number; reason?: string; condition?: string; photoEvidenceId?: string; photoReviewRequired?: boolean; decisionId?: string; reportType?: "BUG" | "FEEDBACK"; reportMessage?: string; itemPage?: number };
type Conversation = { id: string; language: string; contact_id: string; return_case_id: string | null };
type Store = { id: string; name: string; return_code: string };

const textOf = (message: MetaMessage) => message.text?.body?.trim() || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || "";

async function invoke(name: string, body: Record<string, unknown>) {
  const key = body.whatsappMessageId || name === "salla-order-lookup"
    ? Deno.env.get("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY")
    : Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
  const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${name}_${payload?.error ?? response.status}`);
  return payload;
}

async function getFlow(admin: Admin, id: string) {
  const { data, error } = await admin.rpc("get_whatsapp_flow_state", { p_conversation_id: id });
  if (error) throw error;
  return (data?.[0] ?? { step: "MENU", context: {} }) as { step: string; context: Context };
}

async function setFlow(admin: Admin, id: string, step: string, context: Context = {}) {
  const { error } = await admin.rpc("set_whatsapp_flow_state", { p_conversation_id: id, p_step: step, p_context: context });
  if (error) throw error;
}

async function saveOutbound(admin: Admin, storeId: string, conversationId: string, result: WhatsAppSendResult, body: string, type: "TEXT" | "INTERACTIVE") {
  const { error } = await admin.from("whatsapp_messages").upsert({
    store_id: storeId, conversation_id: conversationId, external_message_id: sentMessageId(result), direction: "OUTBOUND",
    message_type: type, body, status: "SENT", occurred_at: new Date().toISOString(),
  }, { onConflict: "external_message_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function claim(admin: Admin, storeId: string | null, messageId: string, eventType: string) {
  const { data: existing } = await admin.from("integration_events").select("id,status,attempts")
    .eq("provider", "whatsapp").eq("external_event_id", messageId).maybeSingle();
  if (existing?.status === "PROCESSED" || existing?.status === "PROCESSING") return false;
  if (existing) {
    const { error } = await admin.from("integration_events").update({ status: "PROCESSING", attempts: Number(existing.attempts) + 1, last_error: null }).eq("id", existing.id);
    if (error) throw error;
    return true;
  }
  const { error } = await admin.from("integration_events").insert({
    store_id: storeId, provider: "whatsapp", external_event_id: messageId, event_type: eventType,
    payload_digest: await sha256(messageId), status: "PROCESSING", attempts: 1,
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

function firstName(value?: string) {
  return value?.trim().split(/\s+/)[0]?.slice(0, 40) || "";
}

async function languagePrompt(to: string, profileName?: string) {
  const name = firstName(profileName);
  const body = [
    `يا هلا${name ? ` ${name}` : ""}، حيّاك الله في ريلود 👋`,
    "نساعدك في استفسارات المنتجات، متابعة طلبك، والإرجاع. خطوة بخطوة.",
    "",
    `Hi${name ? ` ${name}` : ""}, welcome to Reload 👋`,
    "We can help with product questions, your order, and returns—all here in WhatsApp.",
    "",
    "اختر لغتك للمتابعة · Choose your language",
  ].join("\n");
  return {
    body,
    result: await sendWhatsAppButtons(to, body, [
      { id: "language_ar", title: "العربية" },
      { id: "language_en", title: "English" },
    ]),
    type: "INTERACTIVE" as const,
  };
}

async function menu(to: string, language: "ar" | "en", profileName?: string, resume=false) {
  const name = profileName || "";
  const body = language === "ar"
    ? `حيّاك الله${name ? ` في ${name}` : ""} 👋\nوش نقدر نساعدك فيه اليوم؟ تقدر تختار من القائمة أو تكتب سؤالك مباشرة.`
    : `Welcome${name ? ` to ${name}` : ""} 👋\nChoose an option below, or just type your question.`;
  const rows = language === "ar" ? [
    { id: "ask_question", title: "عندي سؤال", description: "التوصيل، الضمان، وخدمة العملاء" },
    { id: "shop_products", title: "استفسار عن منتج", description: "الأسعار، المقاسات، والتوفّر" },
    { id: "track_order", title: "متابعة طلبي", description: "نتحقق من الطلب قبل عرض التفاصيل" },
    { id: "open_ticket", title: "شكوى أو مشكلة", description: "نحفظ التفاصيل لفريق المتجر" },
    { id: "human_support", title: "التواصل مع المتجر", description: "نرسل طلبك لفريق المتجر" },
    { id: "start_return", title: "طلب إرجاع جديد", description: "نراجع الطلب وسياسة المتجر" },
    { id: "check_status", title: "متابعة طلب سابق", description: "اعرف آخر تحديث على طلبك" },
    { id: "feedback_options", title: "ملاحظات عن التجربة", description: "شاركنا رأيك أو بلّغ عن خلل" },
    { id: "track_tickets", title: "متابعة طلب دعم", description: "اطّلع على حالة طلبك لدى المتجر" },
  ] : [
    { id: "ask_question", title: "Ask a question", description: "Delivery, warranty and store support" },
    { id: "shop_products", title: "Product help", description: "Prices, sizes and availability" },
    { id: "track_order", title: "Track my order", description: "Verify your order to see its details" },
    { id: "open_ticket", title: "Complaint or issue", description: "Share the details with the store" },
    { id: "human_support", title: "Talk to the store", description: "Send a request to the store team" },
    { id: "start_return", title: "Start a return", description: "Check your order against store policy" },
    { id: "check_status", title: "Track a return", description: "See the latest update on your case" },
    { id: "feedback_options", title: "Feedback & bugs", description: "Tell us about your experience" },
    { id: "track_tickets", title: "Track a support ticket", description: "Check a request saved with the store" },
  ];
  if(resume) rows.unshift({id:"resume_return",title:language === "ar"?"إكمال طلب الإرجاع":"Continue your return",description:language === "ar"?"نرجع للخطوة اللي وقفت عندها":"Pick up where you left off"});
  return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختر الخدمة" : "Choose an option", rows), type: "INTERACTIVE" as const };
}

async function reasons(to: string, language: "ar" | "en") {
  const body = language === "ar" ? "3 من 5 · وش سبب الإرجاع؟" : "3 of 5 · What’s the reason for the return?";
  const values = language === "ar"
    ? [["defective", "المنتج معيب"], ["wrong_item", "منتج غير صحيح"], ["not_as_described", "غير مطابق للوصف"], ["changed_mind", "تغيير الرأي"], ["damaged_in_transit", "تضرر أثناء الشحن"]]
    : [["defective", "Defective"], ["wrong_item", "Wrong item"], ["not_as_described", "Not as described"], ["changed_mind", "Changed my mind"], ["damaged_in_transit", "Damaged in transit"]];
  return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختيار السبب" : "Choose reason", values.map(([id, title]) => ({ id: `reason:${id}`, title }))), type: "INTERACTIVE" as const };
}

function reasonLabel(value: string, language: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    defective: ["المنتج معيب", "Defective"], wrong_item: ["وصل منتج غير صحيح", "Wrong item"],
    not_as_described: ["غير مطابق للوصف", "Not as described"], changed_mind: ["تغيير الرأي", "Changed my mind"],
    damaged_in_transit: ["تضرر أثناء الشحن", "Damaged in transit"],
  };
  return labels[value]?.[language === "ar" ? 0 : 1] ?? value;
}

function conditionLabel(value: string, language: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    new_unopened: ["جديد وغير مفتوح", "New and unopened"],
    opened_unused: ["مفتوح من دون استخدام", "Opened but unused"], used: ["مستخدم", "Used"],
  };
  return labels[value]?.[language === "ar" ? 0 : 1] ?? value;
}

function decisionExplanation(decision: { explanation?: string; reasonCodes?: string[] } | undefined, language: "ar" | "en") {
  if (language === "en") return decision?.explanation || "One of the store’s return conditions was not met.";
  const code = decision?.reasonCodes?.[0] ?? "";
  const messages: Record<string, string> = {
    OUTSIDE_WINDOW: "انتهت مدة الإرجاع المحددة في سياسة المتجر.",
    REASON_NOT_ALLOWED: "سبب الإرجاع المختار غير مشمول في سياسة المتجر.",
    CONDITION_NOT_ALLOWED: "حالة المنتج لا تنطبق عليها شروط الإرجاع.",
    ITEM_EXCLUDED: "هذا المنتج مستثنى من الإرجاع حسب سياسة المتجر.",
    ORDER_STATUS_FAIL: "حالة الطلب الحالية لا تسمح ببدء الإرجاع.",
    QUANTITY_EXCEEDED: "الكمية المطلوبة أكبر من الكمية المتاحة للإرجاع.",
  };
  return messages[code] ?? "أحد شروط الإرجاع المعتمدة لدى المتجر غير متحقق.";
}

async function itemPrompt(to: string, language: "ar" | "en", order: NonNullable<Context["order"]>, page = 0) {
  const body = language === "ar"
    ? `2 من 5 · تم التحقق من الطلب ${order.orderId}. اختر المنتج اللي تبي ترجعه.`
    : `2 of 5 · Order ${order.orderId} is verified. Which item would you like to return?`;
  const pageCount = Math.ceil(order.items.length / 8);
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const rows = order.items.slice(currentPage * 8, currentPage * 8 + 8).map((item) => ({ id: `item:${item.id}`, title: item.name, description: language === "ar" ? `الكمية: ${item.quantity}` : `Quantity: ${item.quantity}` }));
  if (currentPage > 0) rows.push({ id: `item_page:${currentPage - 1}`, title: language === "ar" ? "المنتجات السابقة" : "Previous items", description: "" });
  if (currentPage < pageCount - 1) rows.push({ id: `item_page:${currentPage + 1}`, title: language === "ar" ? "المزيد من المنتجات" : "More items", description: "" });
  return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختيار المنتج" : "Choose item", rows), type: "INTERACTIVE" as const };
}

async function saveReturnPhoto(admin: Admin, store: Store, conversation: Conversation, message: MetaMessage, context: Context) {
  if (!message.id || !message.image?.id) throw new Error("whatsapp_image_missing");
  const { data: existing } = await admin.from("return_evidence")
    .select("id,review_required").eq("external_message_id", message.id).maybeSingle();
  if (existing) return { id: existing.id as string, reviewRequired: Boolean(existing.review_required) };
  const { bytes, mimeType } = await downloadWhatsAppImage(message.image.id);
  const path = `${store.id}/${conversation.id}/${message.id}.${mimeType === "image/png" ? "png" : "jpg"}`;
  const uploaded = await admin.storage.from("return-evidence").upload(path, bytes, { contentType: mimeType, upsert: true });
  if (uploaded.error) throw uploaded.error;
  const { data, error } = await admin.from("return_evidence").insert({
    store_id: store.id, conversation_id: conversation.id, external_message_id: message.id,
    storage_path: path, mime_type: mimeType,
    assessment: { state: "pending", itemName: context.order?.items.find((entry) => entry.id === context.itemId)?.name ?? "item", statedCondition: context.condition ?? "not stated" },
    review_required: true,
  }).select("id,review_required").single();
  if (error) throw error;
  return { id: data.id as string, reviewRequired: Boolean(data.review_required) };
}

async function discardUnsubmittedPhoto(admin: Admin, store: Store, conversation: Conversation, evidenceId?: string) {
  if (!evidenceId) return;
  const { data } = await admin.from("return_evidence").select("storage_path")
    .eq("id", evidenceId).eq("store_id", store.id).eq("conversation_id", conversation.id).is("case_id", null).maybeSingle();
  if (!data?.storage_path) return;
  await admin.from("return_evidence").delete().eq("id", evidenceId).is("case_id", null);
  await admin.storage.from("return-evidence").remove([data.storage_path]);
}

export async function processFlow(admin: Admin, store: Store, conversation: Conversation, to: string, input: string, profileName?: string, message?: MetaMessage) {
  let transition: { step: string; context: Context } | null = null;
  const buffered = new Proxy(admin, {
    get(target, property) {
      if (property === "rpc") return async (name: string, args: Record<string, unknown>) => {
        if (name === "get_whatsapp_flow_state" && transition) return { data: [transition], error: null };
        if (name === "set_whatsapp_flow_state") { transition = { step: String(args.p_step), context: args.p_context as Context }; return { error: null }; }
        return target.rpc(name, args);
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const response = await processFlowInner(buffered, store, conversation, to, input, profileName, message);
  if (message?.id) {
    const change = transition as { step: string; context: Context } | null;
    const { error } = await admin.rpc("commit_whatsapp_transition", { p_message: message.id, p_conversation: conversation.id, p_step: change?.step ?? null, p_context: change?.context ?? {}, p_reply: { plan: response.result, storeId: store.id, conversationId: conversation.id } });
    if (error) throw error;
  } else if (transition) {
    const change = transition as { step: string; context: Context };
    await setFlow(admin, conversation.id, change.step, change.context);
  }
  return response;
}

async function orderTrackingReply(admin: Admin, verifier: string, to: string, language: "ar" | "en", store: Store, order: NonNullable<Context["order"]>) {
 const { data: connection, error } = await admin.from("commerce_connections").select("platform").eq("store_id", store.id).eq("status", "CONNECTED").maybeSingle();
 if (error) throw error;
 if (connection?.platform === "zid") {
   // Called only after the normal order check or conversation-bound identity approval.
   // Zid checks the original order contact again before exposing shipment details.
   const result = await zidOrderTracking(admin, store.id, order.orderId, verifier);
   const body = result.ok ? trackingMessage(store.name, result.tracking, language)
     : language === "ar" ? "تحققنا من طلبك، لكن ما قدرنا نجيب تحديث الشحنة الآن. جرّب مرة ثانية بعد قليل، أو اكتب «القائمة» للتواصل مع المتجر."
     : "Your order is verified, but I couldn’t get the shipment update just now. Please try again shortly, or type MENU to contact the store.";
   return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
 }
 const labels:Record<string,[string,string]>={delivered:["تم التوصيل","Delivered"],shipped:["تم الشحن","Shipped"],cancelled:["ملغي","Cancelled"],processing:["قيد التجهيز","Processing"]};
 const values=labels[order.orderStatus??""];
 const status=values?values[language === "ar"?0:1]:language === "ar"?"الحالة تحتاج تأكيد من المتجر":"Status needs confirmation from the store";
 const body=language === "ar"?`تحققنا من طلبك لدى ${store.name} ✅\nرقم الطلب: ${order.orderId}\nالحالة: ${status}\n\n${order.items.map(i=>`${i.name} × ${i.quantity}`).join("\n")}\n\nاكتب «القائمة» إذا تحتاج مساعدة ثانية.`:`Verified with ${store.name} ✅\nOrder: ${order.orderId}\nStatus: ${status}\n\n${order.items.map(i=>`${i.name} × ${i.quantity}`).join("\n")}\n\nType MENU if you need anything else.`;
 return {body:body.slice(0,3500),result:await sendWhatsAppText(to,body.slice(0,3500)),type:"TEXT" as const};
}

function ticketPreview(storeName:string,draft:string,language:"ar"|"en") {
 const name=storeName.slice(0,60);const preview=draft.slice(0,700);const shortened=draft.length>700;
 return language === "ar"?`هذه رسالتك لفريق ${name}:\n\n${preview}${shortened?"…\n\nمعاينة مختصرة؛ الرسالة كاملة محفوظة.":""}\n\nراجعها، ثم اختر إرسال أو تعديل.`:`Here’s your message for ${name}:\n\n${preview}${shortened?"…\n\nPreview shortened; your full message is saved.":""}\n\nCheck it, then choose Send or Edit.`;
}

function ticketButtons(language:"ar"|"en") {return [{id:"send_ticket",title:language === "ar"?"إرسال للمتجر":"Send to store"},{id:"edit_ticket",title:language === "ar"?"تعديل الرسالة":"Edit message"},{id:"cancel_ticket",title:language === "ar"?"إلغاء":"Cancel"}];}

async function processFlowInner(admin: Admin, store: Store, conversation: Conversation, to: string, input: string, profileName?: string, message?: MetaMessage) {
  let language: "ar" | "en" = conversation.language === "en" ? "en" : "ar";
  const normalized = input.trim().toLowerCase();
  const flow = await getFlow(admin, conversation.id);
  if (normalized === "resume_return" && flow.context.returnResume) {
    await setFlow(admin, conversation.id, flow.context.returnResume.step, flow.context.returnResume.context as Context);
    return processFlowInner(admin, store, conversation, to, input, profileName, message);
  }
  const isWelcomeMessage =
    /^(start|restart|start over)(\s|$)/i.test(normalized) ||
    ["hello", "hi", "hey", "مرحبا", "مرحباً", "هلا", "السلام عليكم", "ابدأ", "ابدأ من جديد"].includes(normalized);
  if (isWelcomeMessage && flow.step !== "AWAITING_LANGUAGE" && (!["MENU", "COMPLETE"].includes(flow.step) || Boolean(flow.context.returnResume))) {
    const body = language === "ar" ? `حاضرين. أنت تتابع طلبك مع ${store.name}.
اختر «متابعة» لإكماله، أو «طلب جديد» للبدء من جديد.` : `You’re continuing with ${store.name}.
Choose Continue to pick up where you left off, or New return to start again.`;
    return { body, result: await sendWhatsAppButtons(to, body, [{ id: "resume_return", title: language === "ar" ? "متابعة" : "Continue" }, { id: "start_return", title: language === "ar" ? "طلب جديد" : "New return" }]), type: "INTERACTIVE" as const };
  }
  if (isWelcomeMessage && flow.step !== "AWAITING_LANGUAGE") {
    await setFlow(admin, conversation.id, "MENU");
    return menu(to, language, store.name, Boolean(flow.context.returnResume));
  }
  if (isWelcomeMessage) {
    await setFlow(admin, conversation.id, "AWAITING_LANGUAGE");
    return languagePrompt(to, profileName);
  }
  if (["english", "en", "language_en"].includes(normalized) || ["العربية", "عربي", "ar", "language_ar"].includes(normalized)) {
    language = ["english", "en", "language_en"].includes(normalized) ? "en" : "ar";
    await admin.from("whatsapp_conversations").update({ language }).eq("id", conversation.id);
    await admin.from("whatsapp_contacts").update({ locale: language }).eq("id", conversation.contact_id);
    await setFlow(admin, conversation.id, "MENU");
    return menu(to, language, store.name, Boolean(flow.context.returnResume));
  }
  if (flow.step === "AWAITING_LANGUAGE") return languagePrompt(to, profileName);
  if(normalized === "feedback_options") {
    const body=language === "ar" ? "كيف كانت تجربتك؟ اختر ملاحظة أو بلاغ عن خلل في ريلود. للشكوى عن طلبك، اختر «شكوى أو مشكلة» من القائمة." : "How was your experience? Share feedback or report a Reload issue. For a problem with your order, choose Complaint or issue from the menu.";
    return {body,result:await sendWhatsAppButtons(to,body,[{id:"send_feedback",title:language === "ar"?"ملاحظة أو اقتراح":"Feedback"},{id:"report_bug",title:language === "ar"?"بلاغ عن خلل":"Report a bug"}]),type:"INTERACTIVE" as const};
  }
  if (flow.step === "MENU" && flow.context.ticketDraft) {
    if (normalized === "send_ticket" && !flow.context.ticketEditing) {
      const {data:ticketId,error}=await admin.rpc("create_support_ticket", {p_store:store.id,p_conversation:conversation.id,p_message_id:message?.id ?? `ticket:${conversation.id}:${await sha256(flow.context.ticketDraft)}`,p_kind:flow.context.serviceMode === "HUMAN" ? "HUMAN" : flow.context.serviceMode === "COMPLAINT" ? "COMPLAINT" : "QUESTION",p_message:flow.context.ticketDraft});
      if(error || !ticketId) throw error ?? new Error("ticket_not_created");
      await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume});
      const ref=`RL-${String(ticketId).slice(0,8).toUpperCase()}`;
      const body=language === "ar" ? `وصل طلبك لفريق ${store.name} ✅\nرقم المتابعة: ${ref}\n\nالتفاصيل محفوظة عندهم، ويقدرون يردّون عليك هنا. وقت الرد يعتمد على دوام المتجر.` : `Your request is saved for ${store.name} ✅\nReference: ${ref}\n\nThe team can read the details and reply here. Reply times depend on the store’s working hours.`;
      return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};
    }
    if(normalized !== "cancel_ticket" && !["menu","القائمة"].includes(normalized)) {
      const revision=reviseTicketDraft(flow.context.ticketDraft,input);
      if(revision.kind === "EDIT" || (flow.context.ticketEditing && normalized === "send_ticket")) {
        await setFlow(admin,conversation.id,"MENU",{...flow.context,ticketEditing:true});
        const body=language === "ar"?"أكيد، اكتب الرسالة الجديدة كاملة هنا. ما أرسلنا شيء للمتجر إلى الآن.":"Of course. Type your updated message here. Nothing has been sent to the store yet.";
        return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};
      }
      const revised=revision.kind === "CONFIRM"?flow.context.ticketDraft:revision.text;
      if(revised.length>4096){const body=language === "ar"?"الرسالة طويلة شوي. اختصرها إلى 4096 حرف أو أقل، ثم أرسلها هنا.":"That message is a little long. Please shorten it to 4,096 characters or fewer.";return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};}
      await setFlow(admin,conversation.id,"MENU",{...flow.context,ticketDraft:revised,ticketEditing:false});
      const body=ticketPreview(store.name,revised,language);
      return {body,result:await sendWhatsAppButtons(to,body,ticketButtons(language)),type:"INTERACTIVE" as const};
    }
    await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume});
    return menu(to,language,store.name,Boolean(flow.context.returnResume));
  }
  if (["ask_question","shop_products","track_order","open_ticket","human_support"].includes(normalized)) {
    const serviceMode=normalized === "shop_products" ? "PRODUCT" : normalized === "track_order" ? "TRACK" : normalized === "open_ticket" ? "COMPLAINT" : normalized === "human_support" ? "HUMAN" : "QUESTION";
    await setFlow(admin,conversation.id,serviceMode === "TRACK" ? "AWAITING_ORDER" : "MENU",{serviceMode,returnResume:flow.context.returnResume});
    const body=language === "ar" ? serviceMode === "TRACK" ? "أكيد. أرسل رقم الطلب مثل ما هو في تأكيد الشراء، ونتحقق منه قبل نعرض لك التفاصيل." : ["COMPLAINT","HUMAN"].includes(serviceMode) ? "اكتب لنا التفاصيل اللي تبي توصل لفريق المتجر. بنعرضها عليك قبل الإرسال." : serviceMode === "PRODUCT" ? "وش المنتج اللي تبحث عنه؟ وإذا عندك مقاس أو لون معيّن، اذكره لنا." : "حاضرين، اكتب سؤالك وبنساعدك بالمعلومات المعتمدة من المتجر." : serviceMode === "TRACK" ? "Send the order number from your purchase confirmation. We’ll verify it before showing the details." : ["COMPLAINT","HUMAN"].includes(serviceMode) ? "Tell us what you’d like the store team to know. You’ll review it before we send it." : serviceMode === "PRODUCT" ? "Which product are you looking for? Include the size or colour if you have one in mind." : "What would you like to know? We’ll use the store’s approved information to help.";
    return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};
  }
  if (["menu", "القائمة", "مساعدة", "help"].includes(normalized)) {
    await setFlow(admin, conversation.id, "MENU", ["MENU", "COMPLETE", "AWAITING_LANGUAGE"].includes(flow.step) ? flow.context : { returnResume: { step: flow.step, context: flow.context } });
    return menu(to, language, store.name, Boolean(flow.context.returnResume));
  }
  if (["report_bug", "send_feedback"].includes(normalized)) {
    const reportType = normalized === "report_bug" ? "BUG" : "FEEDBACK";
    await setFlow(admin, conversation.id, "AWAITING_REPORT_MESSAGE", { reportType, returnResume: flow.context.returnResume ?? (!["MENU", "COMPLETE", "AWAITING_LANGUAGE"].includes(flow.step) ? { step: flow.step, context: flow.context } : undefined) });
    const body = language === "ar"
      ? reportType === "BUG" ? "أكيد. اكتب لنا وش صار، وفي أي خطوة توقفت. ما تحتاج ترسل أي بيانات سرية أو معلومات طلب كاملة." : "يسعدنا نسمع منك. اكتب ملاحظتك أو اقتراحك بطريقتك، وبنعرضه عليك قبل الإرسال."
      : reportType === "BUG" ? "Tell us what happened and where you got stuck. Please don’t include passwords, access tokens, or full order details." : "We’d love to hear it. Write your feedback in your own words and we’ll show it back before sending.";
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (flow.step === "AWAITING_REPORT_MESSAGE") {
    if (input.trim().length < 2) {
      const body = language === "ar" ? "اكتب تفاصيل أكثر شوي عشان نقدر نفهمها ونتابعها." : "Please add a little more detail so the team can understand and follow up.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const context = { ...flow.context, reportMessage: input.trim().slice(0, 4000) };
    await setFlow(admin, conversation.id, "AWAITING_REPORT_CONFIRMATION", context);
    const body = language === "ar" ? `هذا اللي بنرسله لفريق ريلود:\n\n“${context.reportMessage}”\n\nتأكد أنه ما يحتوي على كلمة مرور أو بيانات حساسة.` : `Here’s what we’ll send to the Reload team:\n\n“${context.reportMessage}”\n\nPlease check that it contains no passwords or sensitive information.`;
    return { body, result: await sendWhatsAppButtons(to, body, language === "ar" ? [{ id: "report_send", title: "إرسال" }, { id: "report_edit", title: "تعديل" }, { id: "report_cancel", title: "إلغاء" }] : [{ id: "report_send", title: "Send" }, { id: "report_edit", title: "Edit" }, { id: "report_cancel", title: "Cancel" }]), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_REPORT_CONFIRMATION") {
    if (normalized === "report_edit") {
      await setFlow(admin, conversation.id, "AWAITING_REPORT_MESSAGE", { reportType: flow.context.reportType, returnResume: flow.context.returnResume });
      const body = language === "ar" ? "تمام، اكتب الرسالة المعدّلة." : "Of course—send the updated message.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized === "report_cancel") {
      await setFlow(admin, conversation.id, "MENU", { returnResume: flow.context.returnResume });
      const body = language === "ar" ? "تم الإلغاء، وما أرسلنا شيء." : "Cancelled. Nothing was sent.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized !== "report_send") {
      const body = language === "ar" ? "اختر «إرسال» أو «تعديل» أو «إلغاء»." : "Choose Send, Edit, or Cancel.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const reportData = { store_id: store.id, conversation_id: conversation.id, report_type: flow.context.reportType, message: flow.context.reportMessage, source_channel: "WHATSAPP", context: { flow_step: flow.step, language, conversation_state: "ACTIVE" } };
    const { data: reportId, error } = await admin.rpc("record_whatsapp_report", { p_message: message?.id, p_report: reportData });
    if (error || !reportId) throw error ?? new Error("report_not_saved");
    const report = { id: reportId };
    await setFlow(admin, conversation.id, "MENU", { returnResume: flow.context.returnResume });
    const reference = `RL-${String(report.id).slice(0, 8).toUpperCase()}`;
    const body = language === "ar" ? `وصلت، شكرًا لك ✅\n\nرقم المتابعة: ${reference}\nسجّلناها عند الفريق وبنراجعها مع سياق الخطوة اللي كنت فيها.` : `Received—thank you ✅\n\nReference: ${reference}\nIt’s saved for the team with the step you were on, so you won’t need to explain everything again.`;
    return { body, result: await sendWhatsAppButtons(to, body, [{ id: flow.context.returnResume ? "resume_return" : "menu", title: language === "ar" ? "متابعة" : "Continue" }]), type: "INTERACTIVE" as const };
  }
  if (normalized === "human_help") {
    return processFlowInner(admin, store, conversation, to, "human_support", profileName, message);
  }
  if (normalized === "merchant_setup") {
    const link = `${env("APP_URL").replace(/\/$/, "")}/app`;
    const body = language === "ar" ? `إعداد المتجر وإدارة السياسة تتم من مساحة عمل ريلود:\n${link}\n\nواتساب مخصص لاستفسارات العملاء ومتابعة الطلبات والإرجاع.` : `Store setup and policy management are handled in the Reload workspace:\n${link}\n\nWhatsApp helps customers with store questions, orders and returns.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (["ONBOARDING_PAUSED", "POLICY_READY", "AWAITING_POLICY_METHOD", "AWAITING_POLICY_URL", "AWAITING_POLICY_TEXT", "AWAITING_POLICY_WINDOW", "REVIEWING_POLICY_RULE", "AWAITING_RULE_EDIT", "AWAITING_POLICY_PUBLISH"].includes(flow.step)) {
    await setFlow(admin, conversation.id, "MENU");
    return menu(to, language, store.name, Boolean(flow.context.returnResume));
  }
  if ((normalized === "check_status" || normalized.startsWith("track:")) && !(flow.step === "AWAITING_ORDER" && flow.context.identityReviewId)) {
    const { data: linkedCases, error: casesError } = await admin.rpc("get_whatsapp_cases", { p_conversation: conversation.id });
    if (casesError) throw casesError;
    const cases = (linkedCases ?? []) as Array<{ id: string; order_id: string; status: string }>;
    if (!cases.length && conversation.return_case_id) {
      const { data: legacy } = await admin.from("return_cases").select("id,order_id,status").eq("id", conversation.return_case_id).eq("store_id", store.id).maybeSingle();
      if (legacy) cases.push(legacy);
    }
    if (normalized === "check_status" && cases.length > 1) {
      const body = language === "ar" ? `أي طلب تبي تتابعه مع ${store.name}؟` : `Which return with ${store.name} would you like to track?`;
      return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختيار الطلب" : "Choose return", cases.map((entry) => ({ id: `track:${entry.id}`, title: `RL-${entry.id.slice(0, 8).toUpperCase()}`, description: `${language === "ar" ? "الطلب" : "Order"}: ${entry.order_id}` }))), type: "INTERACTIVE" as const };
    }
    const activeCase = normalized.startsWith("track:") ? cases.find((entry) => entry.id === input.slice(6)) : cases[0];
    if (!activeCase) {
      const body = language === "ar" ? "ما لقينا طلب إرجاع مرتبط بهذه المحادثة. اختر «طلب إرجاع جديد» للبدء." : "We couldn’t find a return linked to this conversation. Choose Start a return to begin.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const statusLabels: Record<string, [string, string]> = {
      OPEN: ["مفتوح لدى المتجر", "Open with the store"], AWAITING_ITEM: ["بانتظار استلام المنتج", "Waiting for the item"],
      RECEIVED: ["استلم المتجر المنتج", "Item received by the store"], RESOLVED: ["مكتمل", "Completed"], CANCELLED: ["ملغي", "Cancelled"],
    };
    const label = statusLabels[activeCase?.status ?? ""]?.[language === "ar" ? 0 : 1] ?? (language === "ar" ? "قيد المتابعة" : "In progress");
    const reference = activeCase?.id ? `RL-${activeCase.id.slice(0, 8).toUpperCase()}` : "—";
    const body = language === "ar" ? `آخر تحديث لطلبك ${reference} مع ${store.name}:\n${label}\n\nبنرسل لك هنا إذا تغيّرت الحالة.` : `Latest update for ${reference} with ${store.name}:\n${label}\n\nWe’ll message you here when the status changes.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (normalized === "track_tickets" || /^ticket:[0-9a-f-]{36}$/i.test(normalized)) {
    let query=admin.from("support_tickets").select("id,message,status").eq("store_id",store.id).eq("conversation_id",conversation.id);
    if(normalized.startsWith("ticket:"))query=query.eq("id",normalized.slice(7));
    const {data:tickets,error}=await query.order("created_at",{ascending:false}).limit(10);
    if(error)throw error;
    if(tickets?.length===1 || normalized.startsWith("ticket:")) {
      const ticket=tickets?.[0];
      const state=ticket?.status === "RESOLVED"?(language === "ar"?"تم الحل":"Resolved"):ticket?.status === "IN_PROGRESS"?(language === "ar"?"قيد المتابعة":"In progress"):(language === "ar"?"بانتظار المتجر":"Waiting for the store");
      const body=ticket?`RL-${ticket.id.slice(0,8).toUpperCase()} · ${store.name}\n${state}`:language === "ar"?"ما لقينا تذكرة مرتبطة بهذه المحادثة.":"No ticket was found for this conversation.";
      return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};
    }
    if(!tickets?.length){const body=language === "ar"?"ما عندك تذاكر مسجلة في هذه المحادثة.":"There are no tickets in this conversation yet.";return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};}
    const body=language === "ar"?"اختر الطلب اللي تبي تتابعه.":"Choose the request you’d like to check.";
    return {body,result:await sendWhatsAppList(to,body,language === "ar"?"طلبات الدعم":"Support requests",tickets.map(t=>({id:`ticket:${t.id}`,title:`RL-${t.id.slice(0,8).toUpperCase()}`,description:t.message.slice(0,70)}))),type:"INTERACTIVE" as const};
  }
  if (normalized === "start_return") {
    await setFlow(admin, conversation.id, "AWAITING_ORDER");
    await admin.from("whatsapp_conversations").update({ state: "VERIFYING_ORDER" }).eq("id", conversation.id);
    const body = language === "ar" ? `1 من 5 · خلّنا نبدأ برقم الطلب من ${store.name}.\n\nأرسله مثل ما هو ظاهر في تأكيد الطلب، وإحنا نتحقق منه بأمان.` : `1 of 5 · Let’s start with your ${store.name} order number.\n\nSend it exactly as it appears in your order confirmation.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (flow.step === "AWAITING_ORDER" && flow.context.identityReviewId) {
    const { data: review, error } = await admin.from("identity_reviews").select("status").eq("id", flow.context.identityReviewId).eq("conversation_id", conversation.id).single();
    if (error) throw error;
    if (review.status === "APPROVED") {
      const { data: facts, error: factsError } = await admin.rpc("get_identity_review_facts", { p_id: flow.context.identityReviewId, p_conversation: conversation.id });
      if (factsError) throw factsError;
      if (facts?.items?.length && typeof facts._verificationContact === "string") {
        // Re-read the live order after approval; a 24-hour identity grant is
        // permission to continue, not permission to use stale order facts.
        const refreshed = await invoke("salla-order-lookup", { returnCode: store.return_code, orderNumber: facts.orderId, verifier: facts._verificationContact });
        if (!refreshed.order?.items?.length || typeof refreshed.verificationToken !== "string") throw new Error("approved_order_unavailable");
        const context = { identityReviewId: flow.context.identityReviewId, order: refreshed.order as NonNullable<Context["order"]>, verificationToken: refreshed.verificationToken };
        if (flow.context.serviceMode === "TRACK") {
          await setFlow(admin,conversation.id,"MENU",{});
          return orderTrackingReply(admin,facts._verificationContact,to,language,store,context.order);
        }
        await setFlow(admin, conversation.id, "AWAITING_ITEM", context);
        await admin.from("whatsapp_conversations").update({ state: "CAPTURING_RETURN" }).eq("id", conversation.id);
        return itemPrompt(to, language, context.order);
      }
    }
    if (review.status === "DECLINED" || review.status === "APPROVED") {
      await setFlow(admin, conversation.id, "AWAITING_ORDER");
      const body = language === "ar" ? "ما نقدر نكمل بهذا التحقق. راجع بياناتك مع المتجر، ثم أرسل رقم الطلب من جديد." : "We can’t continue with this verification. Please check your details with the store, then send your order number again.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const body = language === "ar" ? `طلب التحقق عند ${store.name}. تقدر ترجع هنا وتضغط «التحقق من الحالة». ما أرسلنا طلب إرجاع إلى الآن.` : `Your identity check is waiting with ${store.name}. Come back here and tap Check status. A return hasn’t been submitted yet.`;
    return { body, result: await sendWhatsAppButtons(to, body, [{ id: "identity_status", title: language === "ar" ? "التحقق من الحالة" : "Check status" }]), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_ORDER" && normalized === "identity_request" && flow.context.orderNumber) {
    const { data: reviewId, error } = await admin.rpc("request_identity_review", { p_conversation: conversation.id, p_order: flow.context.orderNumber });
    if (error || !reviewId) {
      const body = language === "ar" ? "ما قدرنا نسجل طلب تحقق جديد الآن. تواصل مع المتجر لمراجعة بياناتك." : "We can’t open another identity check right now. Please contact the store to check your details.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const existing = { id: reviewId as string };
    await setFlow(admin, conversation.id, "AWAITING_ORDER", { ...flow.context, identityReviewId: existing.id });
    const body = language === "ar" ? `وصل طلب التحقق إلى ${store.name}.
رقم المتابعة: ID-${existing.id.slice(0, 8).toUpperCase()}
بعد مراجعة المتجر، ارجع هنا واضغط «متابعة». بيانات الطلب تبقى مخفية إلى أن يتم التحقق.` : `Your identity-check request is with ${store.name}.
Reference: ID-${existing.id.slice(0, 8).toUpperCase()}
After the store reviews it, come back and tap Continue. Your order details stay private until verification is complete.`;
    return { body, result: await sendWhatsAppButtons(to, body, [{ id: "identity_status", title: language === "ar" ? "متابعة" : "Continue" }]), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_ORDER") {
    if (normalized === "resume_return") {
      const body = language === "ar" ? "أرسل رقم الطلب من تأكيد الشراء عشان نكمل." : "Send the order number from your purchase confirmation to continue.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if(message?.type === "image" && message.image?.id) {
      let reference:string|null=null;
      try {const downloaded=await downloadWhatsAppImage(message.image.id);reference=await extractOrderReference(downloaded.bytes);}catch{/* Ask for typed order number if reading is unavailable. */}
      if(reference){await setFlow(admin,conversation.id,"AWAITING_ORDER",{...flow.context,extractedOrder:reference});const body=language === "ar"?`قرأت رقم الطلب من الصورة: ${reference}\nهل هو صحيح؟ بنتحقق من ملكية الطلب بعد تأكيدك.`:`I read this order number: ${reference}\nIs it correct? We’ll verify the order belongs to you after you confirm.`;return {body,result:await sendWhatsAppButtons(to,body,[{id:"confirm_order",title:language === "ar"?"نعم، صحيح":"Yes, correct"},{id:"type_order",title:language === "ar"?"كتابة الرقم":"Type the number"}]),type:"INTERACTIVE" as const};}
      const body=language === "ar"?"ما قدرت أقرأ رقم الطلب بوضوح. اكتبه هنا مثل ما هو في تأكيد الشراء.":"I couldn’t read the order number clearly. Please type it exactly as it appears in your confirmation.";return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};
    }
    if(normalized === "type_order") {await setFlow(admin,conversation.id,"AWAITING_ORDER",{...flow.context,extractedOrder:undefined});const body=language === "ar"?"أكيد، اكتب رقم الطلب هنا.":"Sure—type your order number here.";return {body,result:await sendWhatsAppText(to,body),type:"TEXT" as const};}
    const orderNumber = normalized === "confirm_order" ? flow.context.extractedOrder ?? "" : input.trim().slice(0,100);
    if (!orderNumber || message?.type === "image") {
      const body = language === "ar" ? "نحتاج رقم الطلب أولًا، وبعد التحقق نطلب منك الصورة." : "We need your order number first. We’ll ask for the photo after verification.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    try {
      const lookup = await invoke("salla-order-lookup", { returnCode: store.return_code, orderNumber, verifier: to });
      const order = lookup.order as Context["order"];
      if (!order?.items?.length || typeof lookup.verificationToken !== "string") throw new Error("order_not_verified");
      if(flow.context.serviceMode === "TRACK") {
        await setFlow(admin,conversation.id,"MENU",{});
        return orderTrackingReply(admin,to,to,language,store,order);
      }
      await setFlow(admin, conversation.id, "AWAITING_ITEM", { order, verificationToken: lookup.verificationToken });
      await admin.from("whatsapp_conversations").update({ state: "CAPTURING_RETURN" }).eq("id", conversation.id);
      return itemPrompt(to, language, order);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.endsWith("order_not_verified")) {
        const body = language === "ar" ? "تعذّر الاتصال بالمتجر الآن. حاول مرة ثانية بعد قليل؛ ما أرسلنا أي طلب." : "We couldn’t reach the store just now. Please try again shortly; nothing was submitted.";
        return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
      }
      await setFlow(admin, conversation.id, "AWAITING_ORDER", { orderNumber, serviceMode: flow.context.serviceMode });
      const body = language === "ar" ? "ما قدرنا نطابق رقم الطلب مع رقم واتساب. راجع رقم الطلب وأرسله مرة ثانية.\nإذا رقمك تغيّر، اطلب من المتجر التحقق من هويتك." : "We couldn’t match that order to your WhatsApp number. Check the order number and send it again.\nIf your number has changed, ask the store to verify your identity.";
      return { body, result: await sendWhatsAppButtons(to, body, [{ id: "identity_request", title: language === "ar" ? "طلب تحقق من المتجر" : "Ask store to verify" }]), type: "INTERACTIVE" as const };
    }
  }
  if (flow.step === "AWAITING_ITEM") {
    if (normalized.startsWith("item_page:") || normalized === "resume_return") {
      const page = normalized === "resume_return" ? flow.context.itemPage ?? 0 : Number(input.slice(10));
      if (flow.context.order && Number.isInteger(page) && page >= 0 && page < Math.ceil(flow.context.order.items.length / 8)) {
        await setFlow(admin, conversation.id, flow.step, { ...flow.context, itemPage: page });
        return itemPrompt(to, language, flow.context.order, page);
      }
    }
    const itemId = normalized.startsWith("item:") ? input.slice(5) : "";
    const item = flow.context.order?.items.find((entry) => entry.id === itemId);
    if (!item) return { body: language === "ar" ? "اختر منتجًا من القائمة." : "Choose an item from the list.", result: await sendWhatsAppText(to, language === "ar" ? "اختر منتجًا من القائمة." : "Choose an item from the list."), type: "TEXT" as const };
    const context = { ...flow.context, itemId };
    if (item.quantity > 1) {
      await setFlow(admin, conversation.id, "AWAITING_QUANTITY", context);
      const body = language === "ar" ? `كم قطعة تبي ترجع؟ اختر من القائمة أو اكتب الكمية من 1 إلى ${item.quantity}.` : `How many units would you like to return? Choose from the list or type a quantity from 1 to ${item.quantity}.`;
      return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختيار الكمية" : "Choose quantity", Array.from({ length: Math.min(item.quantity, 10) }, (_, index) => ({ id: `qty:${index + 1}`, title: String(index + 1) }))), type: "INTERACTIVE" as const };
    }
    await setFlow(admin, conversation.id, "AWAITING_REASON", { ...context, quantity: 1 });
    return reasons(to, language);
  }
  if (flow.step === "AWAITING_QUANTITY") {
    const quantity = normalized.startsWith("qty:") ? Number(input.slice(4)) : Number(input);
    const item = flow.context.order?.items.find((entry) => entry.id === flow.context.itemId);
    if (!Number.isInteger(quantity) || quantity < 1 || !item || quantity > item.quantity) {
      const body = language === "ar" ? "اختر كمية صحيحة." : "Choose a valid quantity.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    await setFlow(admin, conversation.id, "AWAITING_REASON", { ...flow.context, quantity });
    return reasons(to, language);
  }
  if (flow.step === "AWAITING_REASON") {
    if (normalized === "resume_return") return reasons(to, language);
    const reason = normalized.startsWith("reason:") ? input.slice(7) : "";
    if (!["defective", "wrong_item", "not_as_described", "changed_mind", "damaged_in_transit"].includes(reason)) return reasons(to, language);
    await setFlow(admin, conversation.id, "AWAITING_CONDITION", { ...flow.context, reason });
    const body = language === "ar" ? "4 من 5 · وش حالة المنتج الآن؟" : "4 of 5 · What condition is the item in?";
    const buttons = language === "ar"
      ? [{ id: "condition:new_unopened", title: "جديد وغير مفتوح" }, { id: "condition:opened_unused", title: "مفتوح دون استخدام" }, { id: "condition:used", title: "مستخدم" }]
      : [{ id: "condition:new_unopened", title: "New, unopened" }, { id: "condition:opened_unused", title: "Opened, unused" }, { id: "condition:used", title: "Used" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_CONDITION") {
    const condition = normalized.startsWith("condition:") ? input.slice(10) : "";
    if (!["new_unopened", "opened_unused", "used"].includes(condition)) {
      const body = language === "ar" ? "وش حالة المنتج الآن؟" : "What condition is the item in?";
      return { body, result: await sendWhatsAppButtons(to, body, language === "ar" ? [{ id: "condition:new_unopened", title: "جديد وغير مفتوح" }, { id: "condition:opened_unused", title: "مفتوح دون استخدام" }, { id: "condition:used", title: "مستخدم" }] : [{ id: "condition:new_unopened", title: "New, unopened" }, { id: "condition:opened_unused", title: "Opened, unused" }, { id: "condition:used", title: "Used" }]), type: "INTERACTIVE" as const };
    }
    const context = { ...flow.context, condition };
    await setFlow(admin, conversation.id, "AWAITING_PHOTO", context);
    const body = language === "ar"
      ? "5 من 5 · إذا عندك صورة للمنتج، أرسلها هنا عشان توضح التفاصيل للمتجر. الصورة اختيارية، وتقدر تتخطّاها."
      : "5 of 5 · Have a photo of the item? You can send it to help the store understand the request. It’s optional—you can skip this step.";
    return { body, result: await sendWhatsAppButtons(to, body, [{id:"skip_photo",title:language === "ar" ? "متابعة بدون صورة" : "Skip photo"}]), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_PHOTO" || (flow.step === "AWAITING_CONFIRMATION" && normalized === "resume_return")) {
    if (flow.step === "AWAITING_PHOTO" && normalized !== "skip_photo" && (message?.type !== "image" || !message.image?.id)) {
      const body = language === "ar" ? "أرسل الصورة كصورة واتساب، وبعدها نراجع التفاصيل معك." : "Please send the photo as a WhatsApp image. Then we’ll review the details with you.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    let evidence: { id?: string; reviewRequired: boolean };
    try {
      evidence = normalized === "skip_photo" || (flow.step === "AWAITING_CONFIRMATION" && !flow.context.photoEvidenceId)
        ? { reviewRequired: false }
        : flow.step === "AWAITING_CONFIRMATION" && flow.context.photoEvidenceId
        ? { id: flow.context.photoEvidenceId, reviewRequired: Boolean(flow.context.photoReviewRequired) }
        : await saveReturnPhoto(admin, store, conversation, message!, flow.context);
    } catch {
      const body = language === "ar" ? "ما قدرنا نحفظ الصورة. أرسلها مرة ثانية بصيغة JPG أو PNG، وحجمها أقل من 5 ميجابايت." : "We couldn’t save that photo. Please try again with a JPG or PNG under 5 MB.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const context = { ...flow.context, photoEvidenceId: evidence.id, photoReviewRequired: evidence.reviewRequired };
    await setFlow(admin, conversation.id, "AWAITING_CONFIRMATION", context);
    const item = context.order?.items.find((entry) => entry.id === context.itemId);
    const body = language === "ar" ? [
      context.photoEvidenceId ? "وصلتنا الصورة. راجع التفاصيل قبل نرسل الطلب:" : "راجع التفاصيل قبل نرسل الطلب:", "", `الطلب: ${context.order?.orderId ?? "—"}`,
      `المنتج: ${item?.name ?? "—"}`, `الكمية: ${context.quantity ?? 1}`,
      `السبب: ${reasonLabel(context.reason ?? "", language)}`, `حالة المنتج: ${conditionLabel(context.condition ?? "", language)}`,
      "", "إذا كل شيء صحيح، اختر «تأكيد وإرسال».",
    ].join("\n") : [
      context.photoEvidenceId ? "Photo received. Please review before we submit:" : "Please review before we submit:", "", `Order: ${context.order?.orderId ?? "—"}`,
      `Item: ${item?.name ?? "—"}`, `Quantity: ${context.quantity ?? 1}`,
      `Reason: ${reasonLabel(context.reason ?? "", language)}`, `Condition: ${conditionLabel(context.condition ?? "", language)}`,
      "", "If everything looks right, choose “Confirm and submit”.",
    ].join("\n");
    const buttons = language === "ar"
      ? [{ id: "confirm_return", title: "تأكيد وإرسال" }, { id: "edit_return", title: "تعديل التفاصيل" }, { id: "cancel_return", title: "إلغاء" }]
      : [{ id: "confirm_return", title: "Confirm and submit" }, { id: "edit_return", title: "Edit details" }, { id: "cancel_return", title: "Cancel" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_CONFIRMATION") {
    if (normalized === "edit_return" && flow.context.order) {
      await discardUnsubmittedPhoto(admin, store, conversation, flow.context.photoEvidenceId);
      await setFlow(admin, conversation.id, "AWAITING_ITEM", { order: flow.context.order, verificationToken: flow.context.verificationToken });
      return itemPrompt(to, language, flow.context.order);
    }
    if (normalized === "cancel_return") {
      await discardUnsubmittedPhoto(admin, store, conversation, flow.context.photoEvidenceId);
      await setFlow(admin, conversation.id, "MENU");
      const body = language === "ar" ? "تم، ألغينا العملية وما أرسلنا أي طلب." : "Done. Nothing was submitted.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized !== "confirm_return") {
      const body = language === "ar" ? "اختر «تأكيد وإرسال» أو «تعديل التفاصيل» عشان نكمل." : "Choose “Confirm and submit” or “Edit details” to continue.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const context = flow.context;
    let evaluated;
    if (context.decisionId) {
      const { data: decision, error } = await admin.from("eligibility_decisions").select("outcome,reason_codes").eq("id", context.decisionId).eq("store_id", store.id).single();
      if (error) throw error;
      evaluated = { decisionId: context.decisionId, decision: { ...decision, reasonCodes: decision.reason_codes } };
    } else {
      try {
        evaluated = await invoke("return-decide", { verificationToken: context.verificationToken, itemId: context.itemId, quantity: context.quantity, reason: context.reason, condition: context.condition, action: "evaluate", whatsappMessageId: message?.id });
      } catch (error) {
        if (error instanceof Error && error.message.includes("expired_return_token")) {
          await discardUnsubmittedPhoto(admin, store, conversation, context.photoEvidenceId);
          await setFlow(admin, conversation.id, "AWAITING_ORDER");
          const body = language === "ar" ? "انتهت مدة التحقق الآمن. أرسل رقم الطلب مرة ثانية عشان نراجع بياناته الحالية؛ ما أرسلنا أي طلب." : "Your secure verification has expired. Send your order number again so we can check its current details. Nothing was submitted.";
          return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
        }
        throw error;
      }
      await setFlow(admin, conversation.id, "AWAITING_CONFIRMATION", { ...context, decisionId: evaluated.decisionId });
    }
    let caseId: string | null = null;
    if (["ELIGIBLE", "MANUAL_REVIEW"].includes(evaluated.decision?.outcome)) {
      const selectedItem = context.order?.items.find((entry) => entry.id === context.itemId);
      if (!selectedItem || !evaluated.decisionId) throw new Error("verified_item_missing");
      const { data: createdCaseId, error: caseError } = await admin.rpc("create_return_case_from_decision", {
        p_decision_id: evaluated.decisionId,
        p_customer_snapshot: { name: context.order?.customerName, email: context.order?.customerEmail },
        p_item_snapshot: { ...selectedItem, quantity: context.quantity, reason: context.reason, condition: context.condition },
      });
      if (caseError) throw caseError;
      caseId = createdCaseId ?? null;
      if (caseId) await admin.from("whatsapp_conversations").update({ return_case_id: caseId }).eq("id", conversation.id);
    }
    if (caseId && context.photoEvidenceId) {
      const { error } = await admin.from("return_evidence").update({ case_id: caseId })
        .eq("id", context.photoEvidenceId).eq("store_id", store.id).eq("conversation_id", conversation.id);
      if (error) throw error;
    }
    if (!caseId) await discardUnsubmittedPhoto(admin, store, conversation, context.photoEvidenceId);
    await setFlow(admin, conversation.id, "COMPLETE", { ...context, caseId, decisionId: evaluated.decisionId });
    await admin.from("whatsapp_conversations").update({ state: "ANSWERED" }).eq("id", conversation.id);
    const outcome = evaluated.decision?.outcome;
    const reference = caseId ? `RL-${caseId.slice(0, 8).toUpperCase()}` : null;
    const body = language === "ar"
      ? outcome === "ELIGIBLE" ? `طلبك مستوفٍ لشروط الإرجاع ✅\n\nرقم المتابعة: ${reference}\nأرسلنا الطلب إلى ${store.name} لتأكيد الخطوة التالية. بنبلغك هنا بأي تحديث.` : outcome === "MANUAL_REVIEW" ? `طلبك يحتاج مراجعة من المتجر.\n\nرقم المتابعة: ${reference}\nأرسلنا التفاصيل إلى ${store.name}، وبنبلغك هنا بعد المراجعة.` : `هذا الطلب ما يستوفي أحد شروط الإرجاع لدى ${store.name}.\n\n${decisionExplanation(evaluated.decision, language)}`
      : outcome === "ELIGIBLE" ? `Your request meets the return policy ✅\n\nReference: ${reference}\nWe’ve sent the request to ${store.name} to confirm the next step. We’ll update you here.` : outcome === "MANUAL_REVIEW" ? `Your request needs the store’s review.\n\nReference: ${reference}\nWe’ve sent the details to ${store.name}. We’ll update you here after they review it.` : `This request doesn’t meet one of ${store.name}’s return conditions.\n\n${decisionExplanation(evaluated.decision, language)}`;
    const buttons = language === "ar"
      ? [{ id: "feedback_clear", title: "واضح، شكرًا" }, { id: "report_bug", title: "الإبلاغ عن مشكلة" }]
      : [{ id: "feedback_clear", title: "Clear, thank you" }, { id: "report_bug", title: "Report a problem" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "COMPLETE" && normalized === "feedback_clear") {
    const body = language === "ar" ? "العفو، حاضرين. تقدر تكتب «القائمة» في أي وقت." : "You’re welcome. Type MENU whenever you need us.";
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if(["MENU","COMPLETE"].includes(flow.step) && input.trim() && message?.type !== "image") {
    if(flow.context.serviceMode === "COMPLAINT" || flow.context.serviceMode === "HUMAN" || normalized === "create_ticket") {
      const draft=normalized === "create_ticket" ? flow.context.reportMessage : input.trim().slice(0,4096);
      if(!draft) return menu(to,language,store.name,Boolean(flow.context.returnResume));
      await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume,serviceMode:flow.context.serviceMode ?? "QUESTION",ticketDraft:draft});
      const body=ticketPreview(store.name,draft,language);
      return {body,result:await sendWhatsAppButtons(to,body,ticketButtons(language)),type:"INTERACTIVE" as const};
    }
    const answer=await answerStoreQuestion(store.id,store.name,input,language,flow.context.generalHistory??[]);
    if(answer.intent === "RETURN") return processFlowInner(admin,store,conversation,to,"start_return",profileName,message);
    if(answer.intent === "TRACK") return processFlowInner(admin,store,conversation,to,"track_order",profileName,message);
    if(answer.intent === "COMPLAINT" || answer.intent === "HUMAN") {
      await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume,serviceMode:answer.intent,ticketDraft:input.slice(0,4096)});
      const body=ticketPreview(store.name,input.slice(0,4096),language);
      return {body,result:await sendWhatsAppButtons(to,body,ticketButtons(language)),type:"INTERACTIVE" as const};
    }
    if(answer.text){await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume,generalHistory:[...(flow.context.generalHistory??[]),{role:"user",content:input.slice(0,1000)},{role:"assistant",content:answer.text}].slice(-6)});return {body:answer.text,result:await sendWhatsAppText(to,answer.text),type:"TEXT" as const};}
    await setFlow(admin,conversation.id,"MENU",{returnResume:flow.context.returnResume,reportMessage:input.slice(0,4096)});
    const body=language === "ar" ? `ما عندي معلومة مؤكدة عن هذا الآن، وما أبي أعطيك إجابة غير دقيقة. تبغى نرسل سؤالك لفريق ${store.name}؟` : `I don’t have a confirmed answer to that right now. Would you like to send your question to ${store.name} so they can check?`;
    return {body,result:await sendWhatsAppButtons(to,body,[{id:"create_ticket",title:language === "ar"?"إرسال السؤال":"Send my question"},{id:"menu",title:language === "ar"?"القائمة":"Menu"}]),type:"INTERACTIVE" as const};
  }
  const body = language === "ar" ? "ما فهمت اختيارك بشكل واضح. اكتب «القائمة» ونبدأ من المكان المناسب." : "I didn’t catch that. Type MENU and we’ll get you to the right place.";
  return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
}

export async function handleMessage(phoneNumberId: string, message: MetaMessage, profileName?: string, preparedReply?: { plan: ReplyPlan; storeId: string | null; conversationId: string | null }, accepted?: WhatsAppSendResult) {
  if (phoneNumberId !== env("WHATSAPP_PHONE_NUMBER_ID")) return;
  const messageId = message.id ?? "";
  const waId = (message.from ?? "").replace(/\D/g, "");
  if (!messageId || !waId) return;
  const admin = adminClient();
  const publicInput = textOf(message).trim().toLowerCase();
  const publicEntry = ["reload", "public_language_ar", "public_language_en"].includes(publicInput);
  if (!await claim(admin, null, messageId, `MESSAGE_${String(message.type ?? "unknown").toUpperCase()}`)) return;
  if (preparedReply) {
    if(message.type === "staff_reply") {
      const {data:conv}=await admin.from("whatsapp_conversations").select("service_window_expires_at,store_id,whatsapp_contacts!inner(wa_id)").eq("id",preparedReply.conversationId).eq("store_id",preparedReply.storeId).maybeSingle();
      const contact=Array.isArray(conv?.whatsapp_contacts)?conv.whatsapp_contacts[0]:conv?.whatsapp_contacts;
      const {data:channel}=await admin.from("whatsapp_connections").select("id").eq("store_id",preparedReply.storeId).eq("phone_number_id",phoneNumberId).eq("status","CONNECTED").maybeSingle();
      if(!conv || !channel || contact?.wa_id !== waId || !conv.service_window_expires_at || new Date(conv.service_window_expires_at).getTime()<=Date.now()) throw new Error("staff_reply_window_or_channel_closed");
    }
    if (message.type !== "staff_reply" && textOf(message).toLowerCase() === "send_ticket" && preparedReply.conversationId) {
      const {data:ticket}=await admin.from("support_tickets").select("id").eq("store_id",preparedReply.storeId).eq("conversation_id",preparedReply.conversationId).eq("source_message_id",messageId).maybeSingle();
      if(ticket){const changed=await admin.from("whatsapp_conversations").update({state:"HANDED_TO_HUMAN"}).eq("id",preparedReply.conversationId);if(changed.error)throw changed.error;}
    }
    await persistAndDeliver(admin, messageId, preparedReply.plan, preparedReply.storeId, preparedReply.conversationId, accepted);
    const done = await admin.from("integration_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("provider", "whatsapp").eq("external_event_id", messageId);
    if (done.error) throw done.error;
    return;
  }
  const routeCode = whatsappRouteInput(publicInput);
  const { data: routedStoreId, error: routeError } = await admin.rpc("whatsapp_route_code", { p_phone: phoneNumberId, p_sender: waId, p_code: routeCode });
  if (routeError) throw routeError;
  const connection = routedStoreId ? { store_id: routedStoreId as string } : null;
  if (publicEntry || !connection) {
    try {
      let plan: ReplyPlan;
      if (publicInput === "public_language_ar") {
        plan = await sendWhatsAppText(waId, [
          "للتواصل مع متجرك، افتح رابط واتساب اللي شاركه معك المتجر. نساعدك في استفسارات المنتجات، متابعة الطلبات، والإرجاع.",
          "",
          "عندك متجر؟ سجّل اهتمامك ونتواصل معك: https://www.reload.sa/#contact",
        ].join("\n"));
      } else if (publicInput === "public_language_en") {
        plan = await sendWhatsAppText(waId, [
          "Need help with your store? Open the WhatsApp link it shared. We can help with products, orders and returns here.",
          "",
          "Run a store? Leave your details and we’ll get in touch: https://www.reload.sa/#contact",
        ].join("\n"));
      } else {
        plan = await sendWhatsAppButtons(waId, "يا هلا، حيّاك الله في ريلود 👋\nHi, welcome to Reload.\n\nاختر لغتك · Choose your language", [
          { id: "public_language_ar", title: "العربية" },
          { id: "public_language_en", title: "English" },
        ]);
      }
      await persistAndDeliver(admin, messageId, plan);
      const done = await admin.from("integration_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() })
        .eq("provider", "whatsapp").eq("external_event_id", messageId);
      if (done.error) throw done.error;
      return;
    } catch (error) {
      await admin.from("integration_events").update({ status: "FAILED", last_error: error instanceof Error ? error.message.slice(0, 180) : "unknown", processed_at: new Date().toISOString() })
        .eq("provider", "whatsapp").eq("external_event_id", messageId);
      throw error;
    }
  }
  const { error: storeEventError } = await admin.from("integration_events").update({ store_id: connection.store_id }).eq("provider", "whatsapp").eq("external_event_id", messageId);
  if (storeEventError) throw storeEventError;
  try {
    const { data: store, error: storeError } = await admin.from("stores").select("id,name,return_code").eq("id", connection.store_id).single();
    if (storeError || !store?.return_code) throw storeError ?? new Error("store_return_code_missing");
    const { data: contact, error: contactError } = await admin.from("whatsapp_contacts").upsert({ store_id: store.id, wa_id: waId, display_name: profileName?.slice(0, 120) || null, updated_at: new Date().toISOString() }, { onConflict: "store_id,wa_id" }).select("id,locale,display_name").single();
    if (contactError) throw contactError;
    let { data: conversation } = await admin.from("whatsapp_conversations").select("id,state,language,contact_id,return_case_id").eq("store_id", store.id).eq("contact_id", contact.id).neq("state", "CLOSED").order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (!conversation) {
      const created = await admin.from("whatsapp_conversations").insert({ store_id: store.id, contact_id: contact.id, state: "VERIFYING_ORDER", language: contact.locale, service_window_expires_at: new Date(Date.now() + 86_400_000).toISOString() }).select("id,state,language,contact_id,return_case_id").single();
      if (created.error) throw created.error;
      conversation = created.data;
      await setFlow(admin, conversation.id, "AWAITING_LANGUAGE");
    } else await admin.from("whatsapp_conversations").update({ service_window_expires_at: new Date(Date.now() + 86_400_000).toISOString(), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
    const input = routeCode ? "hello" : textOf(message);
    const { error: messageError } = await admin.from("whatsapp_messages").upsert({ store_id: store.id, conversation_id: conversation.id, external_message_id: messageId, direction: "INBOUND", message_type: message.type === "interactive" ? "INTERACTIVE" : message.type === "image" ? "IMAGE" : message.type === "text" ? "TEXT" : "UNSUPPORTED", body: message.type === "image" ? null : input.slice(0, 4096) || null, status: "RECEIVED", occurred_at: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString() }, { onConflict: "external_message_id", ignoreDuplicates: true });
    if (messageError) throw messageError;
    if(conversation.state === "HANDED_TO_HUMAN") {
      const done=await admin.from("integration_events").update({status:"PROCESSED",processed_at:new Date().toISOString()}).eq("provider","whatsapp").eq("external_event_id",messageId);
      if(done.error)throw done.error;
      return; // A human owns the conversation; do not compete with their replies.
    }
    const response = await processFlow(admin, store, conversation, waId, input, profileName ?? contact.display_name ?? undefined, message);
    // The reply and flow transition were committed first. A retry can now
    // recover the acknowledgement even if human takeover interrupts this worker.
    if (input.trim().toLowerCase() === "send_ticket") {
      const {data:ticket}=await admin.from("support_tickets").select("id").eq("store_id",store.id).eq("conversation_id",conversation.id).eq("source_message_id",messageId).maybeSingle();
      if(ticket){const changed=await admin.from("whatsapp_conversations").update({state:"HANDED_TO_HUMAN"}).eq("id",conversation.id);if(changed.error)throw changed.error;}
    }
    await persistAndDeliver(admin, messageId, response.result, store.id, conversation.id);
    const done = await admin.from("integration_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("provider", "whatsapp").eq("external_event_id", messageId);
    if (done.error) throw done.error;
  } catch (error) {
    await admin.from("integration_events").update({ status: "FAILED", last_error: error instanceof Error ? error.message.slice(0, 180) : "unknown", processed_at: new Date().toISOString() }).eq("provider", "whatsapp").eq("external_event_id", messageId);
    throw error;
  }
}
