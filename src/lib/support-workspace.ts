export type SupportWorkspace = {
  store: { id: string; name: string; created_at: string };
  connections: Array<{
    platform: string;
    name: string | null;
    status: string;
    connected_at: string | null;
  }>;
  whatsapp: {
    status: string;
    connected_at: string | null;
    last_webhook_at: string | null;
  } | null;
  policies: Array<{
    version_label: string;
    published_at: string;
    rule_count: number;
  }>;
  knowledge: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    language: string;
    published: boolean;
    updated_at: string;
  }>;
  conversations: Array<{
    id: string;
    language: string;
    created_at: string;
    last_message_at: string;
    step: string;
    message_count: number;
  }>;
  messages: Array<{
    id: string;
    conversation_id: string;
    direction: string;
    message_type: string;
    status: string;
    occurred_at: string;
    body: string;
    processing_failed: boolean;
  }>;
  steps: Array<{
    id: string;
    conversation_id: string;
    kind: string;
    step: string;
    created_at: string;
  }>;
  audit: Array<{
    id: string;
    event_type: string;
    entity_type: string;
    created_at: string;
  }>;
  reviews: Array<{
    id: string;
    conversation_id: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
  }>;
  cases: Array<{
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    conversation_ids: string[];
  }>;
  tickets: Array<{
    id: string;
    conversation_id: string;
    kind: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  issues: Array<{
    id: string;
    provider: string;
    event_type: string;
    status: string;
    received_at: string;
    reason: string;
  }>;
};
export const SUPPORT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type T = (en: string, ar: string) => string;
export function journeyLabel(step: string, t: T) {
  const labels: Record<string, [string, string]> = {
    MENU: ["Choosing a service", "اختيار الخدمة"],
    AWAITING_LANGUAGE: ["Choosing a language", "اختيار اللغة"],
    AWAITING_ORDER: ["Waiting for an order number", "بانتظار رقم الطلب"],
    AWAITING_EMAIL_OTP: [
      "Waiting for email verification",
      "بانتظار التحقق بالبريد",
    ],
    AWAITING_IDENTITY_REVIEW: [
      "Waiting for the merchant to verify identity",
      "بانتظار تحقق المتجر من الهوية",
    ],
    AWAITING_ITEM: ["Choosing an item", "اختيار المنتج"],
    AWAITING_QUANTITY: ["Choosing a quantity", "اختيار الكمية"],
    AWAITING_REASON: ["Explaining the return reason", "توضيح سبب الإرجاع"],
    AWAITING_CONDITION: ["Describing the item condition", "وصف حالة المنتج"],
    AWAITING_PHOTO: ["Adding an optional photo", "إضافة صورة اختيارية"],
    AWAITING_CONFIRMATION: [
      "Reviewing the return request",
      "مراجعة طلب الإرجاع",
    ],
    COMPLETE: ["Return decision ready", "قرار الإرجاع جاهز"],
    AWAITING_TICKET_CONFIRMATION: [
      "Reviewing a support request",
      "مراجعة طلب دعم",
    ],
    AWAITING_TICKET_DETAILS: [
      "Waiting for issue details",
      "بانتظار تفاصيل المشكلة",
    ],
    HANDED_TO_HUMAN: ["Waiting for the store team", "بانتظار فريق المتجر"],
    AWAITING_FEEDBACK: ["Waiting for feedback", "بانتظار الملاحظات"],
  };
  const pair = labels[step];
  return pair
    ? t(...pair)
    : t(
        "Waiting for the next customer message",
        "بانتظار رسالة العميل التالية",
      );
}
export function customerActionLabel(body: string, t: T, interactive = false) {
  if (!interactive)
    return body
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        t("[reference hidden]", "[مرجع مخفي]"),
      )
      .replace(/\bRL-[0-9A-F]{10}\b/gi, t("[store link]", "[رابط المتجر]"));
  const labels: Record<string, [string, string]> = {
    language_ar: ["Arabic selected", "اختيار العربية"],
    language_en: ["English selected", "اختيار الإنجليزية"],
    track_order: ["Order tracking requested", "طلب متابعة الطلب"],
    start_return: ["Return requested", "طلب إرجاع"],
    identity_request: ["Merchant verification requested", "طلب تحقق المتجر"],
    identity_status: ["Verification status checked", "التحقق من حالة الهوية"],
    email_request: ["Email verification requested", "طلب التحقق بالبريد"],
    email_resend: ["New email code requested", "طلب رمز بريد جديد"],
    ask_question: ["Store question selected", "اختيار سؤال للمتجر"],
    shop_products: ["Product help requested", "طلب معلومات منتج"],
    open_ticket: ["Issue reported", "الإبلاغ عن مشكلة"],
    human_support: ["Store assistance requested", "طلب مساعدة المتجر"],
    check_status: ["Return status checked", "التحقق من حالة الإرجاع"],
    feedback_options: ["Feedback selected", "اختيار الملاحظات"],
    track_tickets: ["Support status checked", "التحقق من حالة الدعم"],
    ticket_confirm: ["Support request confirmed", "تأكيد طلب الدعم"],
    ticket_edit: ["Editing the support request", "تعديل طلب الدعم"],
    skip_photo: ["Photo skipped", "تجاوز الصورة"],
    resume_return: ["Return resumed", "استكمال الإرجاع"],
  };
  const pair = labels[body];
  if (pair) return t(...pair);
  const namespace = body.split(":")[0];
  const selections: Record<string, [string, string]> = {
    item: ["Item selected", "اختيار منتج"],
    item_page: ["More items requested", "طلب المزيد من المنتجات"],
    qty: ["Quantity selected", "اختيار الكمية"],
    reason: ["Return reason selected", "اختيار سبب الإرجاع"],
    condition: ["Item condition selected", "اختيار حالة المنتج"],
    track: ["Return status requested", "طلب حالة الإرجاع"],
  };
  return selections[namespace]
    ? t(...selections[namespace])
    : t("Customer selected an option", "اختار العميل خيارًا");
}
export function auditLabel(kind: string, t: T) {
  const labels: Record<string, [string, string]> = {
    SUPPORT_WORKSPACE_VIEWED: [
      "Merchant support workspace opened",
      "فتح مساحة مساعدة التاجر",
    ],
    SUPPORT_DRAFT_PREPARED: [
      "Answer draft prepared for a merchant",
      "تجهيز مسودة إجابة للتاجر",
    ],
    DASHBOARD_VIEWED: ["Team desk opened", "فتح مساحة الفريق"],
    TEAM_INVITED: ["Teammate invited", "دعوة زميل"],
    TEAM_ROLE_CHANGED: ["Team permissions changed", "تغيير صلاحيات الفريق"],
    TEAM_INVITE_CANCELLED: ["Team invite cancelled", "إلغاء دعوة الفريق"],
    TEAM_MEMBER_REMOVED: ["Team access removed", "إزالة وصول زميل"],
    LEADS_IMPORTED: ["Contacts imported", "استيراد جهات اتصال"],
    LEADS_EXPORTED: ["Contacts exported", "تصدير جهات اتصال"],
    LEAD_VIEWED: ["Contact reviewed", "مراجعة جهة اتصال"],
    LEAD_UPDATED: ["Contact updated", "تحديث جهة اتصال"],
    LEAD_NOTE_ADDED: ["Follow-up note added", "إضافة ملاحظة متابعة"],
    POLICY_PUBLISHED: ["Return policy approved", "اعتماد سياسة الإرجاع"],
    COMMERCE_STORE_CONNECTED: ["Store connected", "ربط المتجر"],
    "knowledge.import.started": [
      "Knowledge import started",
      "بدء استيراد المعلومات",
    ],
    "knowledge.import.completed": [
      "Knowledge drafts imported",
      "استيراد مسودات المعلومات",
    ],
    "knowledge.import.failed": [
      "Knowledge import failed",
      "تعذّر استيراد المعلومات",
    ],
    "knowledge.published": ["Answer approved", "اعتماد إجابة"],
    "knowledge.saved": ["Answer draft saved", "حفظ مسودة إجابة"],
    "knowledge.staff.draft_prepared": [
      "Staff prepared an answer draft",
      "جهّز الفريق مسودة إجابة",
    ],
    ORDER_OTP_EMAIL_ACCEPTED: [
      "Verification email accepted for sending",
      "قبول إرسال بريد التحقق",
    ],
    ORDER_OTP_EMAIL_FAILED: [
      "Verification email could not be sent",
      "تعذّر إرسال بريد التحقق",
    ],
    ORDER_EMAIL_VERIFIED: ["Order email verified", "التحقق من بريد الطلب"],
    "workspace.issue": [
      "Workspace screen needs attention",
      "شاشة مساحة العمل تحتاج مراجعة",
    ],
    "support.reply.queued": ["Store reply queued", "رد المتجر بانتظار الإرسال"],
  };
  return labels[kind]
    ? t(...labels[kind])
    : t("Store activity recorded", "تسجيل نشاط المتجر");
}
