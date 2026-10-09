"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CircleHelp,
  ImageIcon,
  FileText,
  Lock,
  Maximize2,
  Package,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { OutcomeBadge, CaseStatusBadge } from "@/components/outcome-badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import type { CaseStatus, EligibilityOutcome } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/domain";
import {
  conditionLabel,
  reasonLabel,
  receiptRules,
  statusLabel,
  type ReceiptRule,
} from "@/lib/decision-receipt";
import { supabase } from "@/lib/supabase";
import { setCaseStatus } from "@/lib/workspace-data";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CaseData = {
  id: string;
  orderId: string;
  status: CaseStatus;
  outcome: EligibilityOutcome;
  createdAt: string;
  customer: Record<string, unknown>;
  item: Record<string, unknown>;
  decision: Record<string, any>;
  evidence: { assessment: Record<string, unknown>; review_required: boolean; storage_path: string } | null;
  photoUrl: string | null;
};

const transitions: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ["AWAITING_ITEM", "RESOLVED", "CANCELLED"],
  AWAITING_ITEM: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};

/** The happy path, drawn as steps. Cancelled sits outside it. */
const PATH: CaseStatus[] = ["OPEN", "AWAITING_ITEM", "RECEIVED", "RESOLVED"];

/** Closing a case has consequences, so these ask first. */
const NEEDS_CONFIRM = new Set<CaseStatus>(["RESOLVED", "CANCELLED"]);

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  return <CaseDetail caseId={caseId} variant="page" onBack={() => router.push("/app/cases")} />;
}

/**
 * One case's decision receipt and status. Renders as the full case page, or
 * inside the case drawer (single column, status first, with a link out to
 * the full page).
 */
export function CaseDetail({ caseId, variant, onBack, onClose }: {
  caseId: string;
  variant: "page" | "drawer";
  onBack?: () => void;
  onClose?: () => void;
}) {
  const { t, isArabic } = useLanguage();
  const drawer = variant === "drawer";
  const [data, setData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<CaseStatus | null>(null);
  const [confirming, setConfirming] = useState<CaseStatus | null>(null);

  const load = async () => {
    if (!supabase || !caseId) return setLoading(false);
    setLoading(true);
    const result = await supabase
      .from("return_cases")
      .select(
        "id, order_id, status, customer_snapshot, item_snapshot, created_at, eligibility_decisions(outcome, reason_codes, order_facts_snapshot, policy_snapshot, evaluated_at, policy_versions(version_label))",
      )
      .eq("id", caseId)
      .maybeSingle();
    const row = result.data as Record<string, any> | null;
    if (row) {
      const evidenceResult = await supabase.from("return_evidence")
        .select("assessment, review_required, storage_path")
        .eq("case_id", caseId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const evidence = evidenceResult.data as CaseData["evidence"];
      const signed = evidence?.storage_path
        ? await supabase.storage.from("return-evidence").createSignedUrl(evidence.storage_path, 300)
        : null;
      setData({
        id: row.id,
        orderId: row.order_id,
        status: row.status,
        outcome: row.eligibility_decisions.outcome,
        createdAt: row.created_at,
        customer: row.customer_snapshot ?? {},
        item: row.item_snapshot ?? {},
        decision: row.eligibility_decisions ?? {},
        evidence: evidence ?? null,
        photoUrl: signed?.data?.signedUrl ?? null,
      });
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const updateStatus = async (status: CaseStatus) => {
    if (!supabase || !data) return;
    setSaving(status);
    const { error } = await supabase.rpc("update_return_case_status", {
      p_case_id: data.id,
      p_status: status,
    });
    setSaving(null);
    setConfirming(null);
    if (error) return toast.error(t("Could not update this case.", "تعذّر تحديث الحالة."));
    setData({ ...data, status });
    setCaseStatus(data.id, status);
    toast.success(t(`Marked as ${statusLabel(status, t).toLowerCase()}`, `تم التحديث إلى: ${statusLabel(status, t)}`));
  };

  const requestStatus = (status: CaseStatus) =>
    NEEDS_CONFIRM.has(status) ? setConfirming(status) : void updateStatus(status);

  if (loading)
    return drawer ? <CaseDrawerSkeleton /> : (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  if (!data)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("Case not found.", "لم يتم العثور على الحالة.")}
        </p>
        <Button variant="outline" onClick={drawer ? onClose : onBack}>
          {drawer ? t("Close", "إغلاق") : t("Back to cases", "العودة إلى الطلبات")}
        </Button>
      </div>
    );

  const policy = data.decision.policy_versions ?? {};
  const snapshot = data.decision.policy_snapshot ?? {};
  const facts = data.decision.order_facts_snapshot ?? {};
  const codes: string[] = data.decision.reason_codes ?? [];
  const rules = receiptRules(snapshot.rules_snapshot, codes);
  const failed = rules.filter((r) => r.state === "failed");
  const missing = rules.filter((r) => r.state === "missing");
  const currency = String(facts.currency ?? "SAR");
  const price = Number(data.item.price);
  const versionLabel = String(policy.version_label ?? snapshot.version_label ?? "—");

  const why =
    data.outcome === "ELIGIBLE"
      ? t(
          `All ${rules.length} rules in your published policy passed.`,
          `اجتازت جميع قواعد سياستك المنشورة (${rules.length}).`,
        )
      : data.outcome === "MANUAL_REVIEW"
        ? t(
            `Reload couldn’t check ${missing.map((r) => r.name).join(", ") || "a rule"} because the order data was incomplete, so it came to you instead of guessing.`,
            `لم يتمكن ريلود من التحقق من ${missing.map((r) => r.name).join("، ") || "إحدى القواعد"} لنقص بيانات الطلب، فأحالها إليك بدلًا من التخمين.`,
          )
        : t(
            `Didn’t meet: ${failed.map((r) => r.name).join(", ") || "a policy rule"}.`,
            `لم يستوفِ: ${failed.map((r) => r.name).join("، ") || "إحدى قواعد السياسة"}.`,
          );

  return (
    <div className={cn("flex w-full flex-col", drawer ? "gap-5" : "mx-auto max-w-5xl gap-6")}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {!drawer && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={onBack}
            aria-label={t("Back to cases", "العودة إلى الطلبات")}
          >
            <ArrowLeft className={cn("size-4", isArabic && "rotate-180")} />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={cn("font-display font-semibold tracking-tight", drawer ? "text-xl" : "text-2xl")}>
              <bdi>{data.orderId}</bdi>
            </h1>
            <OutcomeBadge outcome={data.outcome} size="sm" />
            <CaseStatusBadge status={data.status} size="sm" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Decided", "صدر القرار")} {formatDateTime(String(data.decision.evaluated_at ?? data.createdAt))}
            {" · "}
            {t("Policy", "السياسة")} <bdi>{versionLabel}</bdi>
          </p>
        </div>
        {drawer && (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Link href={`/app/cases/${data.id}`}>
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">{t("Full page", "صفحة كاملة")}</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("Close", "إغلاق")}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className={cn("grid gap-5", !drawer && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        {/* The receipt */}
        <ol className="receipt">
          <Station
            index={0}
            icon={<Package className="size-4" />}
            title={t("Return request", "طلب الإرجاع")}
          >
            <dl className="receipt-grid">
              <Fact label={t("Customer", "العميل")} value={String(data.customer.name ?? "—")} />
              <Fact label={t("Email", "البريد")} value={String(data.customer.email ?? "—")} ltr />
              <Fact label={t("Item", "المنتج")} value={String(data.item.name ?? "—")} />
              <Fact label="SKU" value={String(data.item.sku ?? "—")} ltr />
              <Fact label={t("Quantity", "الكمية")} value={String(data.item.quantity ?? "—")} />
              <Fact label={t("Reason", "السبب")} value={reasonLabel(String(data.item.reason ?? "—"), t)} />
              <Fact label={t("Condition", "الحالة")} value={conditionLabel(String(data.item.condition ?? "—"), t)} />
            </dl>
            {data.evidence && <div className="mt-5 overflow-hidden rounded-xl border border-border bg-muted/20">
              {data.photoUrl ? <img src={data.photoUrl} alt={t("Photo sent by the customer", "الصورة التي أرسلها العميل")} className="max-h-80 w-full bg-muted object-contain" />
                : <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><ImageIcon className="size-4" />{t("Photo unavailable", "الصورة غير متاحة")}</div>}
              <div className="flex flex-wrap items-start gap-3 border-t border-border px-4 py-3">
                <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("Customer photo", "صورة العميل")}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{data.evidence.assessment.state === "pending" || data.evidence.assessment.state === "processing"
                    ? t("Photo saved. Image review is in progress; please check it yourself before acting.", "حُفظت الصورة. جارٍ فحصها، وراجعها بنفسك قبل اتخاذ أي إجراء.")
                    : data.evidence.review_required
                      ? t("Please check the photo before confirming the next step. An image cannot prove the item's history or authenticity.", "راجع الصورة قبل تأكيد الخطوة التالية. لا يمكن للصورة إثبات تاريخ استخدام المنتج أو أصالته.")
                      : t("Photo saved with this case. Check it alongside the order and policy details.", "الصورة محفوظة مع الطلب. راجعها مع بيانات الطلب والسياسة.")}</p>
                  {data.evidence.assessment.state === "reviewed" && <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-1">{data.evidence.assessment.clarity === "clear" ? t("Clear image", "صورة واضحة") : t("Image unclear", "الصورة غير واضحة")}</span>
                    <span className="rounded-full border border-border px-2 py-1">{data.evidence.assessment.visibleItem === true ? t("Item visible", "المنتج ظاهر") : t("Item not clear", "المنتج غير واضح")}</span>
                    {data.evidence.assessment.visibleDamage === "yes" && <span className="rounded-full border border-border px-2 py-1">{t("Visible damage to review", "تلف ظاهر يحتاج مراجعة")}</span>}
                  </div>}
                </div>
              </div>
            </div>}
          </Station>

          <Station
            index={1}
            icon={<Lock className="size-4" />}
            title={t("Order facts", "بيانات الطلب")}
            aside={t("Frozen at decision time", "محفوظة وقت القرار")}
          >
            <dl className="receipt-grid">
              <Fact label={t("Ordered", "تاريخ الطلب")} value={facts.orderDate ? formatDate(String(facts.orderDate)) : "—"} />
              <Fact
                label={t("Delivered", "تاريخ التسليم")}
                value={facts.deliveryDate ? formatDate(String(facts.deliveryDate)) : t("Not available", "غير متوفر")}
                flag={!facts.deliveryDate}
              />
              <Fact
                label={t("Order status", "حالة الطلب")}
                value={String(facts.orderStatus || t("Not available", "غير متوفرة"))}
                flag={!facts.orderStatus}
              />
              <Fact
                label={t("Item price", "سعر المنتج")}
                value={Number.isFinite(price) ? `${currency} ${price.toLocaleString("en-US")}` : "—"}
                ltr
              />
            </dl>
          </Station>

          <Station
            index={2}
            icon={<Scale className="size-4" />}
            title={t("Policy check", "مطابقة السياسة")}
            aside={t(`Version ${versionLabel}`, `الإصدار ${versionLabel}`)}
          >
            {rules.length ? (
              <ul className="receipt-rules">
                {rules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} t={t} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("No rules were frozen with this decision.", "لم تُحفظ قواعد مع هذا القرار.")}
              </p>
            )}
          </Station>

          <Station
            index={3}
            icon={<FileText className="size-4" />}
            title={t("Decision", "القرار")}
            last
          >
            <div className="receipt-decision" data-outcome={data.outcome}>
              <OutcomeBadge outcome={data.outcome} />
              <p className="mt-3 text-[15px] leading-relaxed">{why}</p>
              {codes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {codes.map((code) => (
                    <code key={code} className="receipt-code">
                      {code}
                    </code>
                  ))}
                </div>
              )}
            </div>
          </Station>
        </ol>

        {/* Status */}
        <aside className={cn("receipt-side h-fit", drawer && "order-first")}>
          <p className="text-sm font-semibold">{t("Case status", "حالة الطلب")}</p>
          <ol className="status-path mt-4">
            {PATH.map((step, i) => {
              const reached =
                data.status !== "CANCELLED" && PATH.indexOf(data.status) >= i;
              const current = data.status === step;
              return (
                <li key={step} data-reached={reached || undefined} data-current={current || undefined}>
                  <span className="status-dot" aria-hidden="true">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span>{statusLabel(step, t)}</span>
                </li>
              );
            })}
            {data.status === "CANCELLED" && (
              <li data-cancelled="true" data-current="true">
                <span className="status-dot" aria-hidden="true">
                  <X className="size-3" strokeWidth={3} />
                </span>
                <span>{statusLabel("CANCELLED", t)}</span>
              </li>
            )}
          </ol>

          {transitions[data.status].length ? (
            <div className="mt-5 grid gap-2">
              <p className="text-xs text-muted-foreground">{t("Move to", "نقل إلى")}</p>
              {transitions[data.status].map((next) => (
                <Button
                  key={next}
                  variant={next === "CANCELLED" ? "ghost" : next === transitions[data.status][0] ? "default" : "outline"}
                  disabled={saving !== null}
                  onClick={() => requestStatus(next)}
                  className={cn("h-10 justify-center rounded-xl", next === "CANCELLED" && "text-muted-foreground")}
                >
                  {saving === next && <Spinner className="size-3.5" />}
                  <span>{statusLabel(next, t)}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              {t("This case is closed.", "هذه الحالة مغلقة.")}
            </p>
          )}

          <div className="mt-5 flex gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
            {t(
              "Status changes never alter the original decision or its evidence.",
              "تغيير الحالة لا يعدّل القرار الأصلي ولا أدلته.",
            )}
          </div>
        </aside>
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "CANCELLED"
                ? t("Cancel this return?", "إلغاء هذا الإرجاع؟")
                : t("Mark this return as resolved?", "إغلاق هذا الإرجاع؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `${data.orderId} will be closed and can’t be moved to another status afterwards.`,
                `سيتم إغلاق ${data.orderId} ولن يمكن نقله إلى حالة أخرى بعد ذلك.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep it open", "إبقاؤه مفتوحًا")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && void updateStatus(confirming)}>
              {confirming === "CANCELLED" ? t("Cancel return", "إلغاء الإرجاع") : t("Mark resolved", "تأكيد الإغلاق")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Station({
  index,
  icon,
  title,
  aside,
  last,
  children,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  aside?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="receipt-station" data-last={last || undefined} style={{ ["--i" as string]: index }}>
      <span className="receipt-node" aria-hidden="true">
        {icon}
      </span>
      <div className="receipt-card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

function Fact({
  label,
  value,
  ltr,
  flag,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  flag?: boolean;
}) {
  return (
    <div data-flag={flag || undefined} className="receipt-fact">
      <dt>{label}</dt>
      <dd dir={ltr ? "ltr" : undefined}>
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

function RuleRow({ rule, t }: { rule: ReceiptRule; t: (en: string, ar: string) => string }) {
  const icon =
    rule.state === "passed" ? (
      <Check className="size-3" strokeWidth={3} />
    ) : rule.state === "failed" ? (
      <X className="size-3" strokeWidth={3} />
    ) : (
      <CircleHelp className="size-3" strokeWidth={2.5} />
    );
  const stateText =
    rule.state === "passed"
      ? t("Passed", "مستوفاة")
      : rule.state === "failed"
        ? t("Not met", "غير مستوفاة")
        : t("Couldn’t check", "تعذّر التحقق");
  return (
    <li className="receipt-rule" data-state={rule.state}>
      <span className="receipt-rule-mark" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">{rule.name}</p>
          <span className="receipt-rule-state">{stateText}</span>
        </div>
        {rule.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{rule.description}</p>
        )}
        {rule.sourceExcerpt && (
          <blockquote className="receipt-quote">
            <span className="receipt-quote-label">{t("From your policy", "من سياستك")}</span>
            “{rule.sourceExcerpt}”
          </blockquote>
        )}
      </div>
    </li>
  );
}

function CaseDrawerSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div>
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}
