import { sha256 } from "../_shared/crypto.ts";
import { env, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppText, sentMessageId, verifyWhatsAppSignature, type WhatsAppSendResult } from "../_shared/whatsapp.ts";
import { discoverPolicy, extractPolicy, fetchPolicyUrl } from "../_shared/policy.ts";

type Admin = ReturnType<typeof adminClient>;
type MetaMessage = { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } } };
type Item = { id: string; name: string; sku: string; quantity: number; price: number };
type Context = { verificationToken?: string; order?: { orderId: string; customerName: string; items: Item[] }; itemId?: string; quantity?: number; reason?: string; condition?: string; decisionId?: string; onboardingToken?: string; draftId?: string; ruleIndex?: number; policyUrl?: string; policyText?: string; reportType?: "BUG" | "FEEDBACK"; reportMessage?: string };
type Conversation = { id: string; language: string; contact_id: string; return_case_id: string | null };
type Store = { id: string; name: string; return_code: string };

const textOf = (message: MetaMessage) => message.text?.body?.trim() || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || "";

async function invoke(name: string, body: Record<string, unknown>) {
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
  const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body),
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

async function claim(admin: Admin, storeId: string, messageId: string, eventType: string) {
  const { data: existing } = await admin.from("integration_events").select("id,status,attempts")
    .eq("provider", "whatsapp").eq("external_event_id", messageId).maybeSingle();
  if (existing?.status === "PROCESSED") return false;
  if (existing) {
    const { error } = await admin.from("integration_events").update({ status: "PROCESSING", attempts: Number(existing.attempts) + 1, last_error: null }).eq("id", existing.id);
    if (error) throw error;
    return true;
  }
  const { error } = await admin.from("integration_events").insert({
    store_id: storeId, provider: "whatsapp", external_event_id: messageId, event_type: eventType,
    payload_digest: await sha256(messageId), status: "PROCESSING", attempts: 1,
  });
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
    "نرتّب لك طلب الإرجاع من التحقق إلى القرار، ونوضح لك كل خطوة.",
    "",
    `Hi${name ? ` ${name}` : ""}, welcome to Reload 👋`,
    "We’ll guide your return from order verification to a clear decision.",
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

async function menu(to: string, language: "ar" | "en", profileName?: string) {
  const name = firstName(profileName);
  const body = language === "ar"
    ? `تمام${name ? ` يا ${name}` : ""}. وش تحب نساعدك فيه اليوم؟`
    : `You’re all set${name ? `, ${name}` : ""}. What can we help you with today?`;
  const rows = language === "ar" ? [
    { id: "start_return", title: "طلب إرجاع جديد", description: "نراجع الطلب وسياسة المتجر" },
    { id: "check_status", title: "متابعة طلب سابق", description: "اعرف آخر تحديث على طلبك" },
    { id: "report_bug", title: "الإبلاغ عن مشكلة", description: "أرسل لنا ما واجهته" },
    { id: "send_feedback", title: "إرسال ملاحظة", description: "شاركنا رأيك أو اقتراحك" },
  ] : [
    { id: "start_return", title: "Start a return", description: "Check your order against store policy" },
    { id: "check_status", title: "Track a return", description: "See the latest update on your case" },
    { id: "report_bug", title: "Report a problem", description: "Tell us what went wrong" },
    { id: "send_feedback", title: "Send feedback", description: "Share an idea or suggestion" },
  ];
  return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختر الخدمة" : "Choose an option", rows), type: "INTERACTIVE" as const };
}

async function reasons(to: string, language: "ar" | "en") {
  const body = language === "ar" ? "3 من 4 · وش سبب الإرجاع؟" : "3 of 4 · What’s the reason for the return?";
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

async function itemPrompt(to: string, language: "ar" | "en", order: NonNullable<Context["order"]>) {
  const body = language === "ar"
    ? `2 من 4 · تم التحقق من الطلب ${order.orderId}. اختر المنتج اللي تبي ترجعه.`
    : `2 of 4 · Order ${order.orderId} is verified. Which item would you like to return?`;
  return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "اختيار المنتج" : "Choose item", order.items.slice(0, 10).map((item) => ({ id: `item:${item.id}`, title: item.name, description: `${item.sku || "SKU —"} · Qty ${item.quantity}` }))), type: "INTERACTIVE" as const };
}

function policyMethodPrompt(to: string, language: "ar" | "en", foundUrl?: string) {
  const body = foundUrl
    ? language === "ar" ? `لقينا سياسة إرجاع منشورة في متجرك:\n${foundUrl}\n\nتبغى نستخدمها؟ ما راح ننشر أي قاعدة قبل موافقتك.` : `We found a return policy on your store:\n${foundUrl}\n\nWould you like us to use it? Nothing becomes active without your approval.`
    : language === "ar" ? "ما لقينا سياسة إرجاع واضحة في المتجر، ولا راح نخمن. اختر الطريقة الأنسب لك ونكمل من هنا." : "We couldn’t find a readable return policy, so we won’t guess. Choose the easiest way to continue.";
  const rows = foundUrl
    ? language === "ar" ? [{ id: "policy_import_found", title: "استخدام السياسة", description: "نحوّلها لمسودة للمراجعة" }, { id: "policy_url", title: "إرسال رابط آخر" }, { id: "policy_text", title: "لصق نص السياسة" }, { id: "policy_starter", title: "إنشاء سياسة مبدئية" }]
      : [{ id: "policy_import_found", title: "Use this policy", description: "Turn it into a draft for review" }, { id: "policy_url", title: "Send another URL" }, { id: "policy_text", title: "Paste policy text" }, { id: "policy_starter", title: "Create a starter policy" }]
    : language === "ar" ? [{ id: "policy_url", title: "إرسال رابط السياسة" }, { id: "policy_text", title: "لصق نص السياسة" }, { id: "policy_starter", title: "إنشاء سياسة مبدئية" }]
      : [{ id: "policy_url", title: "Send policy URL" }, { id: "policy_text", title: "Paste policy text" }, { id: "policy_starter", title: "Create starter policy" }];
  return { body, rows };
}

async function createPolicyDraft(admin: Admin, storeId: string, sourceText: string, language: "ar" | "en") {
  const extracted = await extractPolicy(sourceText);
  const { data: owner } = await admin.from("memberships").select("user_id").eq("store_id", storeId).in("role", ["owner", "admin"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!owner?.user_id) throw new Error("store_owner_required");
  const { data: draft, error } = await admin.from("policy_drafts").insert({ store_id: storeId, name: language === "ar" ? "سياسة الإرجاع" : "Returns Policy", source_text: sourceText, rules: extracted.rules, extraction_state: "ready", created_by: owner.user_id }).select("id,rules").single();
  if (error) throw error;
  return { draftId: draft.id as string, rules: draft.rules as Array<Record<string, unknown>>, publisherId: owner.user_id as string };
}

async function rulePrompt(admin: Admin, to: string, language: "ar" | "en", conversationId: string, context: Context) {
  const { data: draft } = await admin.from("policy_drafts").select("rules").eq("id", context.draftId).maybeSingle();
  const rules = (draft?.rules ?? []) as Array<Record<string, unknown>>;
  const index = Math.max(0, context.ruleIndex ?? 0);
  const rule = rules[index];
  if (!rule) {
    await setFlow(admin, conversationId, "AWAITING_POLICY_PUBLISH", { ...context, ruleIndex: rules.length });
    const body = language === "ar" ? `راجعنا ${rules.length} قواعد معك. كل شيء جاهز للنشر. بعد النشر، تصبح هذه القواعد هي المرجع الفعلي لقرارات الإرجاع.` : `You’ve reviewed all ${rules.length} rules. Everything is ready to publish. Once published, these rules become the source used for return decisions.`;
    return { body, result: await sendWhatsAppButtons(to, body, language === "ar" ? [{ id: "policy_publish", title: "نشر السياسة" }, { id: "policy_review_again", title: "مراجعة مرة أخرى" }, { id: "onboarding_later", title: "أكمل لاحقًا" }] : [{ id: "policy_publish", title: "Publish policy" }, { id: "policy_review_again", title: "Review again" }, { id: "onboarding_later", title: "Do this later" }]), type: "INTERACTIVE" as const };
  }
  const body = language === "ar" ? `القاعدة ${index + 1} من ${rules.length}\n\n*${String(rule.name)}*\n${String(rule.description)}\n\nمن نص سياستك:\n“${String(rule.sourceExcerpt)}”` : `Rule ${index + 1} of ${rules.length}\n\n*${String(rule.name)}*\n${String(rule.description)}\n\nFrom your policy:\n“${String(rule.sourceExcerpt)}”`;
  return { body, result: await sendWhatsAppButtons(to, body, language === "ar" ? [{ id: "rule_approve", title: "اعتماد" }, { id: "rule_edit", title: "تعديل" }, { id: "onboarding_later", title: "أكمل لاحقًا" }] : [{ id: "rule_approve", title: "Approve" }, { id: "rule_edit", title: "Change" }, { id: "onboarding_later", title: "Do this later" }]), type: "INTERACTIVE" as const };
}

function editedRuleValue(category: string, input: string) {
  const text = input.trim().toLowerCase();
  if (category === "window" || category === "quantity") return text.match(/\d{1,4}/)?.[0] ?? null;
  if (category === "fallback") return "manual_review";
  if (category === "exclusions") return input.split(",").map((part) => part.trim()).filter(Boolean).join(",") || null;
  const maps: Record<string, Array<[RegExp, string]>> = {
    reasons: [[/defect|عيب|معيب/, "defective"], [/wrong|خطأ|غير صحيح/, "wrong_item"], [/describ|وصف|مطابق/, "not_as_described"], [/mind|رأي/, "changed_mind"], [/damage|تلف|تضرر/, "damaged_in_transit"]],
    conditions: [[/unopened|غير مفتوح|جديد/, "new_unopened"], [/unused|دون استخدام|غير مستخدم/, "opened_unused"], [/used|مستخدم/, "used"]],
    order_status: [[/deliver|تسليم|تم التوصيل/, "delivered"], [/ship|شحن/, "shipped"], [/process|تجهيز/, "processing"], [/cancel|إلغاء|ملغي/, "cancelled"]],
  };
  const values = (maps[category] ?? []).filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
  return [...new Set(values)].join(",") || null;
}

async function processFlow(admin: Admin, store: Store, conversation: Conversation, to: string, input: string, profileName?: string) {
  let language: "ar" | "en" = conversation.language === "en" ? "en" : "ar";
  const normalized = input.trim().toLowerCase();
  const flow = await getFlow(admin, conversation.id);
  const isWelcomeMessage =
    /^(start|restart|start over)(\s|$)/i.test(normalized) ||
    ["hello", "hi", "hey", "مرحبا", "مرحباً", "هلا", "السلام عليكم", "ابدأ", "ابدأ من جديد"].includes(normalized);
  if (isWelcomeMessage) {
    await setFlow(admin, conversation.id, "AWAITING_LANGUAGE");
    return languagePrompt(to, profileName);
  }
  if (["english", "en", "language_en"].includes(normalized) || ["العربية", "عربي", "ar", "language_ar"].includes(normalized)) {
    language = ["english", "en", "language_en"].includes(normalized) ? "en" : "ar";
    await admin.from("whatsapp_conversations").update({ language }).eq("id", conversation.id);
    await admin.from("whatsapp_contacts").update({ locale: language }).eq("id", conversation.contact_id);
    await setFlow(admin, conversation.id, "MENU");
    return menu(to, language, profileName);
  }
  if (flow.step === "AWAITING_LANGUAGE") return languagePrompt(to, profileName);
  if (["menu", "القائمة", "مساعدة", "help"].includes(normalized)) {
    await setFlow(admin, conversation.id, "MENU");
    return menu(to, language, profileName);
  }
  if (["report_bug", "send_feedback"].includes(normalized)) {
    const reportType = normalized === "report_bug" ? "BUG" : "FEEDBACK";
    await setFlow(admin, conversation.id, "AWAITING_REPORT_MESSAGE", { reportType });
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
      await setFlow(admin, conversation.id, "AWAITING_REPORT_MESSAGE", { reportType: flow.context.reportType });
      const body = language === "ar" ? "تمام، اكتب الرسالة المعدّلة." : "Of course—send the updated message.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized === "report_cancel") {
      await setFlow(admin, conversation.id, "MENU");
      const body = language === "ar" ? "تم الإلغاء، وما أرسلنا شيء." : "Cancelled. Nothing was sent.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized !== "report_send") {
      const body = language === "ar" ? "اختر «إرسال» أو «تعديل» أو «إلغاء»." : "Choose Send, Edit, or Cancel.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const { data: report, error } = await admin.from("product_reports").insert({ store_id: store.id, conversation_id: conversation.id, report_type: flow.context.reportType, message: flow.context.reportMessage, source_channel: "WHATSAPP", context: { flow_step: flow.step, language, conversation_state: "ACTIVE" } }).select("id").single();
    if (error) throw error;
    await setFlow(admin, conversation.id, "MENU");
    const reference = `RL-${String(report.id).slice(0, 8).toUpperCase()}`;
    const body = language === "ar" ? `وصلت، شكرًا لك ✅\n\nرقم المتابعة: ${reference}\nسجّلناها عند الفريق وبنراجعها مع سياق الخطوة اللي كنت فيها.` : `Received—thank you ✅\n\nReference: ${reference}\nIt’s saved for the team with the step you were on, so you won’t need to explain everything again.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (normalized === "human_help") {
    const body = language === "ar" ? "الدعم المباشر غير متاح حاليًا. اختر «الإبلاغ عن مشكلة» من القائمة وأرسل لنا التفاصيل، وبنحفظها للفريق مع سياق المحادثة." : "Live support is not available yet. Choose Report a problem from the menu and send the details; we’ll save it for the team with the conversation context.";
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (normalized === "merchant_setup") {
    const link = `${env("APP_URL").replace(/\/$/, "")}/app`;
    const body = language === "ar" ? `إعداد المتجر وإدارة السياسة تتم من مساحة عمل ريلود:\n${link}\n\nواتساب مخصص لطلبات العملاء ومتابعتها.` : `Store setup and policy management are handled in the Reload workspace:\n${link}\n\nWhatsApp is reserved for customer returns and status updates.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (normalized === "onboarding_later") {
    await setFlow(admin, conversation.id, "ONBOARDING_PAUSED", flow.context);
    const body = language === "ar" ? "تم حفظ تقدمك. لما تكون جاهز، اكتب «متابعة الإعداد» ونرجع لنفس الخطوة." : "Your progress is saved. When you’re ready, type CONTINUE SETUP and we’ll pick up here.";
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (["policy_continue", "continue setup", "متابعة الإعداد"].includes(normalized)) {
    const { data: connection } = await admin.from("commerce_connections").select("public_store_url,status").eq("store_id", store.id).eq("platform", "salla").maybeSingle();
    if (connection?.status !== "CONNECTED") {
      const body = language === "ar" ? "قبل إعداد السياسة، نحتاج نربط متجرك في سلة. اختر «ربط متجر» من القائمة." : "Before setting up the policy, connect your Salla store from the main menu.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    let found: { url: string; sourceText: string } | null = null;
    try { if (connection.public_store_url) found = await discoverPolicy(connection.public_store_url); } catch { /* offer safe fallbacks */ }
    const context = { ...flow.context, policyUrl: found?.url, policyText: found?.sourceText };
    await setFlow(admin, conversation.id, "AWAITING_POLICY_METHOD", context);
    const prompt = policyMethodPrompt(to, language, found?.url);
    return { body: prompt.body, result: await sendWhatsAppList(to, prompt.body, language === "ar" ? "اختر الطريقة" : "Choose a method", prompt.rows), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_POLICY_METHOD") {
    if (normalized === "policy_url") {
      await setFlow(admin, conversation.id, "AWAITING_POLICY_URL", flow.context);
      const body = language === "ar" ? "أرسل رابط صفحة سياسة الإرجاع. لازم يكون رابطًا عامًا يبدأ بـ https://" : "Send the public return-policy page URL. It should begin with https://";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized === "policy_text") {
      await setFlow(admin, conversation.id, "AWAITING_POLICY_TEXT", flow.context);
      const body = language === "ar" ? "الصق نص سياسة الإرجاع هنا. بنحوّله إلى مسودة، وبعدها تراجع كل قاعدة قبل النشر." : "Paste your return-policy text here. We’ll create a draft, then you’ll review every rule before anything is published.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized === "policy_starter") {
      await setFlow(admin, conversation.id, "AWAITING_POLICY_WINDOW", flow.context);
      const body = language === "ar" ? "نبدأ بالأساس: كم يوم تسمح بالإرجاع بعد تسليم الطلب؟ أرسل رقمًا مثل 14." : "Let’s start with the essential rule. How many days after delivery can a customer request a return? Send a number such as 14.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized === "policy_import_found" && flow.context.policyText) {
      try {
        const draft = await createPolicyDraft(admin, store.id, flow.context.policyText, language);
        const context = { ...flow.context, draftId: draft.draftId, ruleIndex: 0, policyText: undefined };
        await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
        return rulePrompt(admin, to, language, conversation.id, context);
      } catch { /* handled below */ }
    }
    const body = language === "ar" ? "ما قدرنا نجهّز المسودة من هذا المصدر. اختر رابطًا آخر، الصق النص، أو أنشئ سياسة مبدئية." : "We couldn’t prepare a draft from that source. Try another URL, paste the text, or create a starter policy.";
    const prompt = policyMethodPrompt(to, language);
    return { body, result: await sendWhatsAppList(to, body, language === "ar" ? "طريقة أخرى" : "Another method", prompt.rows), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_POLICY_URL") {
    try {
      const source = await fetchPolicyUrl(input);
      const draft = await createPolicyDraft(admin, store.id, source.sourceText, language);
      const context = { ...flow.context, draftId: draft.draftId, ruleIndex: 0, policyUrl: source.url };
      await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
      return rulePrompt(admin, to, language, conversation.id, context);
    } catch {
      const body = language === "ar" ? "ما قدرنا نقرأ هذا الرابط. تأكد أنه عام ويبدأ بـ https://، أو اكتب «القائمة» واختر لصق النص." : "We couldn’t read that page. Check that it’s public and begins with https://, or type MENU and choose to paste the text.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
  }
  if (flow.step === "AWAITING_POLICY_TEXT" || flow.step === "AWAITING_POLICY_WINDOW") {
    let sourceText = input.trim();
    if (flow.step === "AWAITING_POLICY_WINDOW") {
      const days = Number(input.match(/\d{1,3}/)?.[0]);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        const body = language === "ar" ? "أرسل عدد الأيام بين 1 و365، مثل 14." : "Send a number from 1 to 365, such as 14.";
        return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
      }
      sourceText = language === "ar" ? `يمكن للعميل طلب إرجاع المنتجات المؤهلة خلال ${days} يومًا من تاريخ التسليم. إذا كانت بيانات التسليم غير متوفرة، تتم مراجعة الطلب يدويًا.` : `Customers may request a return for eligible items within ${days} days of delivery. If delivery information is unavailable, the request must be reviewed manually.`;
    }
    if (sourceText.length < 40) {
      const body = language === "ar" ? "النص قصير جدًا. أرسل بند السياسة كاملًا عشان نستخرج القواعد بدقة." : "That text is too short. Send the complete policy wording so we can propose accurate rules.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    try {
      const draft = await createPolicyDraft(admin, store.id, sourceText, language);
      const context = { ...flow.context, draftId: draft.draftId, ruleIndex: 0 };
      await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
      return rulePrompt(admin, to, language, conversation.id, context);
    } catch {
      const body = language === "ar" ? "تعذّر تحليل السياسة الآن، لكن ما فقدنا محادثتك. جرّب مرة ثانية أو اكتب «القائمة» لاختيار طريقة أخرى." : "We couldn’t analyse the policy just now, but your conversation is safe. Try again or type MENU to choose another method.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
  }
  if (flow.step === "REVIEWING_POLICY_RULE") {
    if (normalized === "rule_edit") {
      await setFlow(admin, conversation.id, "AWAITING_RULE_EDIT", flow.context);
      const body = language === "ar" ? "اكتب القيمة الصحيحة لهذه القاعدة. مثال: «30 يومًا» لمدة الإرجاع، أو اكتب الأسباب المقبولة مفصولة بفواصل." : "Send the corrected value. For example, “30 days” for a return window, or list the accepted reasons separated by commas.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized !== "rule_approve") return rulePrompt(admin, to, language, conversation.id, flow.context);
    const { data: draft } = await admin.from("policy_drafts").select("rules").eq("id", flow.context.draftId).maybeSingle();
    const rules = [...((draft?.rules ?? []) as Array<Record<string, unknown>>)];
    const index = flow.context.ruleIndex ?? 0;
    if (!rules[index]) throw new Error("policy_rule_missing");
    rules[index] = { ...rules[index], approvalState: "approved" };
    const { error } = await admin.from("policy_drafts").update({ rules, updated_at: new Date().toISOString() }).eq("id", flow.context.draftId);
    if (error) throw error;
    const context = { ...flow.context, ruleIndex: index + 1 };
    await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
    return rulePrompt(admin, to, language, conversation.id, context);
  }
  if (flow.step === "AWAITING_RULE_EDIT") {
    const { data: draft } = await admin.from("policy_drafts").select("rules").eq("id", flow.context.draftId).maybeSingle();
    const rules = [...((draft?.rules ?? []) as Array<Record<string, unknown>>)];
    const index = flow.context.ruleIndex ?? 0;
    const rule = rules[index];
    if (!rule) throw new Error("policy_rule_missing");
    const value = editedRuleValue(String(rule.category), input);
    if (!value) {
      const body = language === "ar" ? "ما قدرنا نفهم القيمة بشكل آمن. جرّب صياغة أوضح، أو اكتب «القائمة» واحفظ الإعداد لوقت لاحق." : "We couldn’t interpret that safely. Try a clearer value, or type MENU and continue later.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    rules[index] = { ...rule, value, description: input.trim().slice(0, 500), approvalState: "edited", creator: "merchant" };
    const { error } = await admin.from("policy_drafts").update({ rules, updated_at: new Date().toISOString() }).eq("id", flow.context.draftId);
    if (error) throw error;
    const context = { ...flow.context, ruleIndex: index + 1 };
    await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
    return rulePrompt(admin, to, language, conversation.id, context);
  }
  if (flow.step === "AWAITING_POLICY_PUBLISH") {
    if (normalized === "policy_review_again") {
      const context = { ...flow.context, ruleIndex: 0 };
      await setFlow(admin, conversation.id, "REVIEWING_POLICY_RULE", context);
      return rulePrompt(admin, to, language, conversation.id, context);
    }
    if (normalized !== "policy_publish") {
      const body = language === "ar" ? "اختر «نشر السياسة» لما تكون جاهز، أو «مراجعة مرة أخرى»." : "Choose Publish policy when you’re ready, or Review again.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const { data: owner } = await admin.from("memberships").select("user_id").eq("store_id", store.id).in("role", ["owner", "admin"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner?.user_id) throw new Error("store_owner_required");
    const { data: published, error } = await admin.rpc("publish_policy_draft_as_service", { p_draft_id: flow.context.draftId, p_published_by: owner.user_id });
    if (error || !published?.[0]) throw error ?? new Error("policy_publish_failed");
    if (flow.context.onboardingToken) {
      await admin.rpc("advance_whatsapp_onboarding_token", { p_token_hash: await sha256(flow.context.onboardingToken), p_expected_stage: "POLICY_PENDING", p_next_stage: "TEST_PENDING", p_extend_until: new Date(Date.now() + 24 * 60 * 60_000).toISOString() });
    }
    await setFlow(admin, conversation.id, "MENU");
    const version = published[0].version_label;
    const body = language === "ar" ? `تم نشر سياسة الإرجاع ${version} ✅\n\nأصبحت القواعد معتمدة ومزامنة مع مساحة العمل. ريلود جاهز الآن للتحقق من الطلبات وإعطاء قرارات إرجاع واضحة.` : `Return policy ${version} is now live ✅\n\nThe approved rules are synced with your workspace. Reload is ready to verify orders and give customers clear return decisions.`;
    return { body, result: await sendWhatsAppButtons(to, body, language === "ar" ? [{ id: "start_return", title: "بدء أول تجربة" }, { id: "menu", title: "القائمة الرئيسية" }] : [{ id: "start_return", title: "Run first test" }, { id: "menu", title: "Main menu" }]), type: "INTERACTIVE" as const };
  }
  if (normalized === "check_status") {
    if (!conversation.return_case_id) {
      const body = language === "ar" ? "ما لقينا طلب إرجاع مرتبط بهذه المحادثة إلى الآن. إذا عندك طلب جديد، اختر «طلب إرجاع جديد»." : "There isn’t a return case linked to this conversation yet. Choose “Start a return” if you’d like to create one.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const { data: activeCase } = await admin.from("return_cases").select("id,order_id,status").eq("id", conversation.return_case_id).maybeSingle();
    const statusLabels: Record<string, [string, string]> = {
      OPEN: ["مفتوح لدى المتجر", "Open with the store"], AWAITING_ITEM: ["بانتظار استلام المنتج", "Waiting for the item"],
      RECEIVED: ["استلم المتجر المنتج", "Item received by the store"], RESOLVED: ["مكتمل", "Completed"], CANCELLED: ["ملغي", "Cancelled"],
    };
    const label = statusLabels[activeCase?.status ?? ""]?.[language === "ar" ? 0 : 1] ?? (language === "ar" ? "قيد المتابعة" : "In progress");
    const reference = activeCase?.id ? `RL-${activeCase.id.slice(0, 8).toUpperCase()}` : "—";
    const body = language === "ar" ? `آخر تحديث لطلبك ${reference}:\n${label}\n\nبنرسل لك هنا إذا تغيّرت الحالة.` : `Latest update for ${reference}:\n${label}\n\nWe’ll message you here when the status changes.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (normalized === "start_return") {
    await setFlow(admin, conversation.id, "AWAITING_ORDER");
    await admin.from("whatsapp_conversations").update({ state: "VERIFYING_ORDER" }).eq("id", conversation.id);
    const body = language === "ar" ? `1 من 4 · خلّنا نبدأ برقم الطلب من ${store.name}.\n\nأرسله مثل ما هو ظاهر في تأكيد الطلب، وإحنا نتحقق منه بأمان.` : `1 of 4 · Let’s start with your ${store.name} order number.\n\nSend it exactly as it appears in your order confirmation.`;
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  if (flow.step === "AWAITING_ORDER") {
    try {
      const lookup = await invoke("salla-order-lookup", { returnCode: store.return_code, orderNumber: input.trim(), verifier: to });
      const order = lookup.order as Context["order"];
      if (!order?.items?.length || typeof lookup.verificationToken !== "string") throw new Error("order_not_verified");
      const context = { order, verificationToken: lookup.verificationToken };
      await setFlow(admin, conversation.id, "AWAITING_ITEM", context);
      await admin.from("whatsapp_conversations").update({ state: "CAPTURING_RETURN" }).eq("id", conversation.id);
      return itemPrompt(to, language, order);
    } catch {
      const body = language === "ar" ? "ما قدرنا نتحقق من الطلب. تأكد أن هذا هو نفس رقم الجوال المسجل في طلب سلة، ثم أرسل رقم الطلب مرة ثانية." : "We couldn’t verify that order. Make sure this is the same mobile number used on the Salla order, then send the order number again.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
  }
  if (flow.step === "AWAITING_ITEM") {
    const itemId = normalized.startsWith("item:") ? input.slice(5) : "";
    const item = flow.context.order?.items.find((entry) => entry.id === itemId);
    if (!item) return { body: language === "ar" ? "اختر منتجًا من القائمة." : "Choose an item from the list.", result: await sendWhatsAppText(to, language === "ar" ? "اختر منتجًا من القائمة." : "Choose an item from the list."), type: "TEXT" as const };
    const context = { ...flow.context, itemId };
    if (item.quantity > 1) {
      await setFlow(admin, conversation.id, "AWAITING_QUANTITY", context);
      const body = language === "ar" ? "كم قطعة تبي ترجع؟" : "How many units would you like to return?";
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
    const reason = normalized.startsWith("reason:") ? input.slice(7) : "";
    if (!["defective", "wrong_item", "not_as_described", "changed_mind", "damaged_in_transit"].includes(reason)) return reasons(to, language);
    await setFlow(admin, conversation.id, "AWAITING_CONDITION", { ...flow.context, reason });
    const body = language === "ar" ? "4 من 4 · وش حالة المنتج الآن؟" : "4 of 4 · What condition is the item in?";
    const buttons = language === "ar"
      ? [{ id: "condition:new_unopened", title: "جديد وغير مفتوح" }, { id: "condition:opened_unused", title: "مفتوح دون استخدام" }, { id: "condition:used", title: "مستخدم" }]
      : [{ id: "condition:new_unopened", title: "New, unopened" }, { id: "condition:opened_unused", title: "Opened, unused" }, { id: "condition:used", title: "Used" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_CONDITION") {
    const condition = normalized.startsWith("condition:") ? input.slice(10) : "";
    if (!["new_unopened", "opened_unused", "used"].includes(condition)) {
      const body = language === "ar" ? "اختر حالة المنتج من الأزرار." : "Choose the condition using the buttons.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const context = { ...flow.context, condition };
    await setFlow(admin, conversation.id, "AWAITING_CONFIRMATION", context);
    const item = context.order?.items.find((entry) => entry.id === context.itemId);
    const body = language === "ar" ? [
      "راجع التفاصيل قبل نرسل الطلب:", "", `الطلب: ${context.order?.orderId ?? "—"}`,
      `المنتج: ${item?.name ?? "—"}`, `الكمية: ${context.quantity ?? 1}`,
      `السبب: ${reasonLabel(context.reason ?? "", language)}`, `حالة المنتج: ${conditionLabel(condition, language)}`,
      "", "إذا كل شيء صحيح، اختر «تأكيد وإرسال».",
    ].join("\n") : [
      "Please review before we submit:", "", `Order: ${context.order?.orderId ?? "—"}`,
      `Item: ${item?.name ?? "—"}`, `Quantity: ${context.quantity ?? 1}`,
      `Reason: ${reasonLabel(context.reason ?? "", language)}`, `Condition: ${conditionLabel(condition, language)}`,
      "", "If everything looks right, choose “Confirm and submit”.",
    ].join("\n");
    const buttons = language === "ar"
      ? [{ id: "confirm_return", title: "تأكيد وإرسال" }, { id: "edit_return", title: "تعديل التفاصيل" }, { id: "cancel_return", title: "إلغاء" }]
      : [{ id: "confirm_return", title: "Confirm and submit" }, { id: "edit_return", title: "Edit details" }, { id: "cancel_return", title: "Cancel" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "AWAITING_CONFIRMATION") {
    if (normalized === "edit_return" && flow.context.order) {
      await setFlow(admin, conversation.id, "AWAITING_ITEM", { order: flow.context.order, verificationToken: flow.context.verificationToken });
      return itemPrompt(to, language, flow.context.order);
    }
    if (normalized === "cancel_return") {
      await setFlow(admin, conversation.id, "MENU");
      const body = language === "ar" ? "تم، ألغينا العملية وما أرسلنا أي طلب." : "Done. Nothing was submitted.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    if (normalized !== "confirm_return") {
      const body = language === "ar" ? "اختر «تأكيد وإرسال» أو «تعديل التفاصيل» عشان نكمل." : "Choose “Confirm and submit” or “Edit details” to continue.";
      return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
    }
    const context = flow.context;
    const evaluated = await invoke("return-decide", { verificationToken: context.verificationToken, itemId: context.itemId, quantity: context.quantity, reason: context.reason, condition: context.condition, action: "evaluate" });
    let caseId: string | null = null;
    if (["ELIGIBLE", "MANUAL_REVIEW"].includes(evaluated.decision?.outcome)) {
      const created = await invoke("return-decide", { verificationToken: context.verificationToken, decisionId: evaluated.decisionId, itemId: context.itemId, quantity: context.quantity, reason: context.reason, condition: context.condition, action: "create_case" });
      caseId = created.caseId ?? null;
      if (caseId) await admin.from("whatsapp_conversations").update({ return_case_id: caseId }).eq("id", conversation.id);
    }
    await setFlow(admin, conversation.id, "COMPLETE", { ...context, decisionId: evaluated.decisionId });
    await admin.from("whatsapp_conversations").update({ state: "ANSWERED" }).eq("id", conversation.id);
    const outcome = evaluated.decision?.outcome;
    const reference = caseId ? `RL-${caseId.slice(0, 8).toUpperCase()}` : null;
    const body = language === "ar"
      ? outcome === "ELIGIBLE" ? `طلبك مؤهل للإرجاع ✅\n\nرقم المتابعة: ${reference}\nأنشأنا الحالة لدى ${store.name}، وبنرسل لك هنا أي تحديث جديد.` : outcome === "MANUAL_REVIEW" ? `طلبك يحتاج مراجعة من المتجر.\n\nرقم المتابعة: ${reference}\nما رفضنا الطلب؛ فقط نحتاج من ${store.name} يتأكدون من بعض البيانات، وبنبلغك هنا.` : `للأسف، الطلب ما ينطبق عليه شرط الإرجاع في سياسة ${store.name}.\n\n${decisionExplanation(evaluated.decision, language)}`
      : outcome === "ELIGIBLE" ? `Your request is eligible for return ✅\n\nReference: ${reference}\nA case has been created with ${store.name}. We’ll send any updates here.` : outcome === "MANUAL_REVIEW" ? `Your request needs a quick review by the store.\n\nReference: ${reference}\nIt hasn’t been rejected—${store.name} just needs to confirm some details. We’ll update you here.` : `This request doesn’t meet one of ${store.name}’s published return conditions.\n\n${decisionExplanation(evaluated.decision, language)}`;
    const buttons = language === "ar"
      ? [{ id: "feedback_clear", title: "واضح، شكرًا" }, { id: "report_bug", title: "الإبلاغ عن مشكلة" }]
      : [{ id: "feedback_clear", title: "Clear, thank you" }, { id: "report_bug", title: "Report a problem" }];
    return { body, result: await sendWhatsAppButtons(to, body, buttons), type: "INTERACTIVE" as const };
  }
  if (flow.step === "COMPLETE" && normalized === "feedback_clear") {
    const body = language === "ar" ? "العفو، حاضرين. تقدر تكتب «القائمة» في أي وقت." : "You’re welcome. Type MENU whenever you need us.";
    return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
  }
  const body = language === "ar" ? "ما فهمت اختيارك بشكل واضح. اكتب «القائمة» ونبدأ من المكان المناسب." : "I didn’t catch that. Type MENU and we’ll get you to the right place.";
  return { body, result: await sendWhatsAppText(to, body), type: "TEXT" as const };
}

async function handleMessage(phoneNumberId: string, message: MetaMessage, profileName?: string) {
  const messageId = message.id ?? "";
  const waId = (message.from ?? "").replace(/\D/g, "");
  if (!messageId || !waId) return;
  const admin = adminClient();
  const { data: connection } = await admin.from("whatsapp_connections").select("store_id").eq("phone_number_id", phoneNumberId).eq("status", "CONNECTED").maybeSingle();
  if (!connection) throw new Error("whatsapp_connection_not_found");
  if (!await claim(admin, connection.store_id, messageId, `MESSAGE_${String(message.type ?? "unknown").toUpperCase()}`)) return;
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
    const input = textOf(message);
    const { error: messageError } = await admin.from("whatsapp_messages").insert({ store_id: store.id, conversation_id: conversation.id, external_message_id: messageId, direction: "INBOUND", message_type: message.type === "interactive" ? "INTERACTIVE" : message.type === "text" ? "TEXT" : "UNSUPPORTED", body: input.slice(0, 4096) || null, status: "RECEIVED", occurred_at: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString() });
    if (messageError) throw messageError;
    const response = await processFlow(admin, store, conversation, waId, input, profileName ?? contact.display_name ?? undefined);
    await saveOutbound(admin, store.id, conversation.id, response.result, response.body, response.type);
    await admin.from("integration_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("provider", "whatsapp").eq("external_event_id", messageId);
  } catch (error) {
    await admin.from("integration_events").update({ status: "FAILED", last_error: error instanceof Error ? error.message.slice(0, 180) : "unknown", processed_at: new Date().toISOString() }).eq("provider", "whatsapp").eq("external_event_id", messageId);
    throw error;
  }
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const valid = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env("WHATSAPP_VERIFY_TOKEN");
    return valid ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : json({ error: "verification_failed" }, 403);
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const rawBody = await request.text();
  try {
    if (!await verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256") ?? "")) return json({ error: "invalid_signature" }, 401);
    const payload = JSON.parse(rawBody);
    const admin = adminClient();
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
      for (const status of value.statuses ?? []) {
        const next = String(status.status ?? "").toUpperCase();
        if (["SENT", "DELIVERED", "READ", "FAILED"].includes(next)) await admin.from("whatsapp_messages").update({ status: next, failure_code: status.errors?.[0]?.code ? String(status.errors[0].code) : null }).eq("external_message_id", String(status.id ?? ""));
      }
      for (const message of value.messages ?? []) await handleMessage(phoneNumberId, message, value.contacts?.[0]?.profile?.name);
      if (phoneNumberId) await admin.from("whatsapp_connections").update({ last_webhook_at: new Date().toISOString() }).eq("phone_number_id", phoneNumberId);
    }
    return json({ received: true });
  } catch (error) {
    console.error("whatsapp_webhook_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
