export type CheckoutStage =
  | "details_validated"
  | "creation_requested"
  | "order_saved"
  | "result_unconfirmed"
  | "attempt_failed"
  | "recheck"
  | "create_request"
  | "check_response"
  | "save_result"
  | "payment_checked";
export type CheckoutOutcome =
  | "done"
  | "waiting"
  | "unconfirmed"
  | "failed"
  | "pending"
  | "paid"
  | "unknown";
export type CheckoutEvent = {
  stage: CheckoutStage;
  outcome: CheckoutOutcome;
  code: string | null;
  provider_status: number | null;
  occurred_at: string;
};
export type CheckoutRecord = {
  reference: string;
  state: "READY" | "CREATING" | "CREATED" | "FAILED" | "UNKNOWN";
  updated_at: string;
  review_expires_at: string;
  has_order_reference: boolean;
  events: CheckoutEvent[];
};
export type CheckoutMonitor = {
  environment: "development";
  checked_at: string;
  limit: 50;
  blocked: boolean;
  records: CheckoutRecord[];
};
const stages = [
  "details_validated",
  "creation_requested",
  "order_saved",
  "result_unconfirmed",
  "attempt_failed",
  "recheck",
  "create_request",
  "check_response",
  "save_result",
  "payment_checked",
];
const outcomes = [
  "done",
  "waiting",
  "unconfirmed",
  "failed",
  "pending",
  "paid",
  "unknown",
];
const codes = [
  "provider_unknown",
  "permission_required",
  "validation_failed",
  "address_details_required",
  "product_unavailable",
  "selection_changed",
  "review_expired",
  "payment_unavailable",
  "shipping_unavailable",
  "session_expired",
  "storage_unavailable",
  "invalid_request",
  "already_started",
  "store_unavailable",
];
function time(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 50 ||
    /[\u0000-\u001f]/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Invalid snapshot");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid snapshot");
  return value as Record<string, unknown>;
}
/** Explicit response allowlist: never forward a raw RPC/provider object to the browser. */
export function checkoutMonitor(value: unknown): CheckoutMonitor {
  const row = object(value);
  if (
    row.environment !== "development" ||
    row.limit !== 50 ||
    typeof row.blocked !== "boolean" ||
    !Array.isArray(row.records) ||
    row.records.length > 50
  )
    throw new Error("Invalid snapshot");
  const records = row.records.map((input) => {
    const r = object(input);
    if (
      typeof r.reference !== "string" ||
      !/^CT-[A-F0-9]{10}$/.test(r.reference) ||
      !["READY", "CREATING", "CREATED", "FAILED", "UNKNOWN"].includes(
        String(r.state),
      ) ||
      typeof r.has_order_reference !== "boolean" ||
      !Array.isArray(r.events) ||
      r.events.length > 30
    )
      throw new Error("Invalid snapshot");
    const events = r.events.map((input) => {
      const e = object(input);
      if (
        !stages.includes(String(e.stage)) ||
        !outcomes.includes(String(e.outcome)) ||
        (e.code !== null && !codes.includes(String(e.code))) ||
        (e.provider_status !== null &&
          !(
            typeof e.provider_status === "number" &&
            Number.isInteger(e.provider_status) &&
            e.provider_status >= 100 &&
            e.provider_status <= 599
          ))
      )
        throw new Error("Invalid snapshot");
      return {
        stage: e.stage as CheckoutStage,
        outcome: e.outcome as CheckoutOutcome,
        code: e.code as string | null,
        provider_status: e.provider_status as number | null,
        occurred_at: time(e.occurred_at),
      };
    });
    return {
      reference: r.reference,
      state: r.state as CheckoutRecord["state"],
      updated_at: time(r.updated_at),
      review_expires_at: time(r.review_expires_at),
      has_order_reference: r.has_order_reference,
      events,
    };
  });
  if (new Set(records.map((r) => r.reference)).size !== records.length)
    throw new Error("Invalid snapshot");
  return {
    environment: "development",
    checked_at: time(row.checked_at),
    limit: 50,
    blocked: row.blocked,
    records,
  };
}
export type JourneyStatus = "unconfirmed" | "failed" | "waiting" | "done";
export function journeyStatus(
  record: CheckoutRecord,
  _blocked: boolean,
): JourneyStatus {
  if (record.state === "UNKNOWN" || record.state === "CREATING")
    return "unconfirmed";
  if (record.state === "FAILED") return "failed";
  if (record.state === "CREATED") {
    const last = record.events
      .filter((e) => e.stage === "payment_checked")
      .at(-1);
    return last?.outcome === "paid" ? "done" : "waiting";
  }
  return "waiting";
}
export const stageLabels: Record<CheckoutStage, [string, string]> = {
  details_validated: ["Details accepted", "التفاصيل مقبولة"],
  creation_requested: ["Creation requested", "تم طلب الإنشاء"],
  order_saved: ["Order reference saved", "تم حفظ مرجع الطلب"],
  result_unconfirmed: [
    "Creation result unconfirmed",
    "نتيجة الإنشاء غير مؤكدة",
  ],
  attempt_failed: ["Attempt failed", "تعذّرت المحاولة"],
  recheck: [
    "Selection and settings recheck",
    "إعادة التحقق من الاختيار والإعدادات",
  ],
  create_request: ["Order creation request", "طلب إنشاء الطلب"],
  check_response: ["Checking the creation response", "فحص رد الإنشاء"],
  save_result: ["Saving the order result", "حفظ نتيجة الطلب"],
  payment_checked: ["Payment checked with Zid", "تم التحقق من الدفع لدى زد"],
};
export function eventLabel(event: CheckoutEvent, ar: boolean) {
  if (event.stage === "payment_checked")
    return event.outcome === "paid"
      ? ar
        ? "الدفع مؤكد حسب زد"
        : "Payment confirmed by Zid"
      : event.outcome === "pending"
        ? ar
          ? "الدفع لا يزال بانتظار الإتمام"
          : "Payment still pending"
        : ar
          ? "حالة الدفع غير مؤكدة"
          : "Payment status not confirmed";
  return stageLabels[event.stage][ar ? 1 : 0];
}
export function diagnosticLabel(code: string | null, ar: boolean) {
  const map: Record<string, [string, string]> = {
    provider_unknown: [
      "The provider response could not be confirmed.",
      "تعذر تأكيد رد المنصة.",
    ],
    permission_required: [
      "Check the Zid app permissions.",
      "راجع صلاحيات التطبيق في زد.",
    ],
    validation_failed: [
      "Zid rejected the submitted details.",
      "لم يقبل زد التفاصيل المرسلة.",
    ],
    address_details_required: [
      "A second address line is required.",
      "يلزم إضافة تفاصيل العنوان.",
    ],
    selection_changed: [
      "The selected price or stock changed.",
      "تغيّر السعر أو المخزون للاختيار.",
    ],
    product_unavailable: [
      "The product or quantity is unavailable.",
      "المنتج أو الكمية غير متاحة.",
    ],
    review_expired: [
      "The review needs validating again.",
      "تحتاج المراجعة إلى تحقق جديد.",
    ],
    payment_unavailable: [
      "The payment-link method is unavailable.",
      "طريقة رابط الدفع غير متاحة.",
    ],
    shipping_unavailable: [
      "The selected delivery service is unavailable.",
      "خدمة التوصيل المختارة غير متاحة.",
    ],
    storage_unavailable: [
      "The result could not be saved.",
      "تعذر حفظ النتيجة.",
    ],
    store_unavailable: [
      "The store identity could not be confirmed.",
      "تعذر تأكيد هوية المتجر.",
    ],
    session_expired: [
      "The test authorization expired.",
      "انتهت صلاحية ربط الاختبار.",
    ],
    already_started: [
      "An earlier attempt prevents a new creation.",
      "محاولة سابقة تمنع إنشاء طلب جديد.",
    ],
    invalid_request: [
      "The request could not be verified.",
      "تعذر التحقق من الطلب.",
    ],
  };
  return code && map[code]
    ? map[code][ar ? 1 : 0]
    : ar
      ? "لم تُسجّل تفاصيل خطأ لهذه المحاولة."
      : "No error details were recorded for this attempt.";
}
export function nextAction(
  record: CheckoutRecord,
  blocked: boolean,
  ar: boolean,
) {
  const pair: [string, string] =
    record.state === "UNKNOWN" || record.state === "CREATING"
      ? [
          "Confirm the original request with Zid before another creation. Do not retry or remove the lock.",
          "تحقق من الطلب الأصلي مع زد قبل إنشاء طلب آخر. لا تُعد المحاولة ولا تُزل القفل.",
        ]
      : record.state === "READY" && blocked
        ? [
            "Resolve the earlier unconfirmed attempt first. Reconnecting does not remove the lock.",
            "احسم المحاولة السابقة غير المؤكدة أولًا. إعادة الربط لا تزيل القفل.",
          ]
        : record.state === "FAILED"
          ? [
              "Check the recorded cause and correct it before a fresh review.",
              "راجع السبب المسجل وصححه قبل مراجعة جديدة.",
            ]
          : record.state === "CREATED"
            ? [
                "Review this same order in Zid. Check payment from Zid records; do not create a replacement.",
                "راجع الطلب نفسه في زد وتحقق من الدفع من سجلاته. لا تنشئ طلبًا بديلًا.",
              ]
            : [
                "Return to the test form for a fresh review and explicit confirmation.",
                "ارجع إلى نموذج الاختبار لمراجعة حديثة وموافقة واضحة.",
              ];
  return pair[ar ? 1 : 0];
}
export function journeyReport(
  record: CheckoutRecord,
  snapshot: CheckoutMonitor,
): string {
  return [
    "Reload · development checkout",
    `Support reference: ${record.reference}`,
    "Store: testing-z",
    "Environment: development",
    `Saved state: ${record.state}`,
    `Updated: ${record.updated_at}`,
    `Records checked: ${snapshot.checked_at}`,
    `Order reference saved: ${record.has_order_reference ? "yes" : "no"}`,
    `Recorded steps: ${record.events.length}`,
    ...record.events.map(
      (e) =>
        `${e.occurred_at} · ${e.stage} · ${e.outcome}${e.code ? " · " + e.code : ""}${e.provider_status ? " · HTTP " + e.provider_status : ""}`,
    ),
    record.events.length ? "" : "Earlier step history was not recorded.",
    `Next action: ${nextAction(record, snapshot.blocked, false)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
