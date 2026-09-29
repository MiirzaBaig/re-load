"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OutcomeBadge } from "@/components/outcome-badge";
import { services } from "@/lib/services";
import {
  type EligibilityDecision,
  type DeliveryFacts,
  REASON_LABELS,
  CONDITION_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/domain";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  FileText,
  ArrowRight,
  Check,
  ShieldCheck,
  Clock,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { ReturnProgress } from "@/components/return-progress";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/spinner";
import { getReturnStartPath } from "@/lib/return-url";

export function ReturnResultPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const [decision, setDecision] = useState<EligibilityDecision | null>(null);
  const [order, setOrder] = useState<DeliveryFacts | null>(null);
  const [context, setContext] = useState<{ orderId: string; itemId: string; quantity: number; reason: string; condition: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const rawDecision = sessionStorage.getItem("relod-decision");
    const rawOrder = sessionStorage.getItem("relod-verified-order");
    const rawContext = sessionStorage.getItem("relod-return-context");
    if (!rawDecision || !rawOrder) {
      router.push(getReturnStartPath());
      return;
    }
    setDecision(JSON.parse(rawDecision));
    setOrder(JSON.parse(rawOrder));
    if (rawContext) setContext(JSON.parse(rawContext));
  }, [router]);

  if (!decision || !order) return null;

  const handleSubmit = async () => {
    if (submitted || !context) return;
    const verificationToken = sessionStorage.getItem("relod-verification-token");
    const savedDecisionId = sessionStorage.getItem("relod-decision-id");
    if (verificationToken && savedDecisionId && supabase) {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke("return-decide", {
        body: { verificationToken, decisionId: savedDecisionId, itemId: context.itemId, quantity: context.quantity, reason: context.reason, condition: context.condition, action: "create_case" },
      });
      setSubmitting(false);
      if (error || !data?.caseId) {
        toast.error(t("Could not create the return request. Please try again.", "تعذر إنشاء طلب الإرجاع. حاول مرة أخرى."));
        return;
      }
      setCaseId(data.caseId); setSubmitted(true);
      toast.success(t("Return request submitted", "تم إرسال طلب الإرجاع"));
      return;
    }
    const newCase = services.createCase(
      order,
      context.itemId,
      context.quantity,
      context.reason as never,
      context.condition as never,
      decision,
    );
    setCaseId(newCase.id);
    setSubmitted(true);
    toast.success(t("Return request submitted", "تم إرسال طلب الإرجاع"));
  };

  const outcomeConfig = {
    ELIGIBLE: {
      icon: CheckCircle2,
      headline: t("This item qualifies for return.", "هذا المنتج مؤهل للإرجاع."),
      subtext: t("All policy conditions are met.", "تم استيفاء جميع شروط السياسة."),
      color: "text-eligible",
      bg: "bg-eligible-muted",
      border: "border-eligible/30",
    },
    NOT_ELIGIBLE: {
      icon: XCircle,
      headline: t("This item is outside the return policy.", "هذا المنتج غير مشمول بسياسة الإرجاع."),
      subtext: t("One or more policy conditions were not met.", "لم يتم استيفاء شرط أو أكثر من شروط السياسة."),
      color: "text-not-eligible",
      bg: "bg-not-eligible-muted",
      border: "border-not-eligible/30",
    },
    MANUAL_REVIEW: {
      icon: AlertCircle,
      headline: t("Your store needs to take a closer look.", "يحتاج المتجر إلى مراجعة الطلب."),
      subtext: t("Some details need manual verification.", "تتطلب بعض التفاصيل تحققًا بشريًا."),
      color: "text-review",
      bg: "bg-review-muted",
      border: "border-review/30",
    },
  };

  const cfg = outcomeConfig[decision.outcome];
  const OutcomeIcon = cfg.icon;
  const appliedRules = decision.appliedRules ?? [];

  return (
    <div className="flex flex-col gap-5">
      <ReturnProgress currentStep={3} />

      <Card className={cn("border-2", cfg.border, cfg.bg)}>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className={cn("flex size-14 items-center justify-center rounded-full", cfg.bg, cfg.color)}>
            <OutcomeIcon className="size-7" />
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {cfg.headline}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">{decision.outcome === "ELIGIBLE" ? cfg.subtext : decision.outcome === "MANUAL_REVIEW" ? t(decision.explanation, "لا يتوفر تاريخ التسليم، لذلك لا يمكن حساب مدة الإرجاع. يحتاج المتجر إلى مراجعة الطلب.") : t(decision.explanation, "لا يستوفي هذا المنتج شروط سياسة الإرجاع المنشورة.")}</p>
          <OutcomeBadge outcome={decision.outcome} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Request details", "تفاصيل الطلب")}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Detail label={t("Order", "الطلب")} value={order.orderId} />
            <Detail label={t("Item", "المنتج")} value={order.items.find((i) => i.id === context?.itemId)?.name ?? "—"} />
            <Detail label={t("Quantity", "الكمية")} value={String(context?.quantity ?? 1)} />
            <Detail label={t("Reason", "السبب")} value={context ? t(REASON_LABELS[context.reason as never], ({ defective: "المنتج معيب", wrong_item: "تم استلام منتج غير صحيح", not_as_described: "غير مطابق للوصف", changed_mind: "تغيير الرأي", damaged_in_transit: "تضرر أثناء الشحن" } as Record<string,string>)[context.reason]) : "—"} />
            <Detail label={t("Condition", "الحالة")} value={context ? t(CONDITION_LABELS[context.condition as never], ({ new_unopened: "جديد وغير مفتوح", opened_unused: "مفتوح وغير مستخدم", used: "مستخدم" } as Record<string,string>)[context.condition]) : "—"} />
            <Detail label={t("Policy version", "إصدار السياسة")} value={decision.policyVersionLabel} />
            <Detail label={t("Evaluated", "وقت التقييم")} value={formatDateTime(decision.evaluatedAt)} />
            {decision.deadline && <Detail label={t("Return deadline", "آخر موعد للإرجاع")} value={formatDate(decision.deadline)} />}
          </div>
        </CardContent>
      </Card>

      <Collapsible open={showRules} onOpenChange={setShowRules}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardContent className="flex items-center justify-between py-4 cursor-pointer">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t("Applied rules", "القواعد المطبقة")}</span>
                <Badge variant="outline" className="text-[10px]">{appliedRules.length}</Badge>
              </div>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showRules && "rotate-180")} />
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border px-6 py-4">
              {appliedRules.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {appliedRules.map((ar, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <div className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                        ar.passed ? "bg-eligible text-eligible-foreground" : "bg-not-eligible text-not-eligible-foreground",
                      )}>
                        {ar.passed ? <Check className="size-3.5" /> : <XCircle className="size-3.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{ar.rule.name}</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{ar.reasonCode}</code>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{ar.rule.description}</p>
                        <div className="mt-1 text-xs">
                          <span className="text-muted-foreground">{t("Evaluated", "القيمة المقيمة")}: </span>
                          <code className="rounded bg-card px-1.5 py-0.5 text-foreground">{ar.evaluatedValue}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("No rules were applied for this evaluation.", "لم تُطبق أي قواعد في هذا التقييم.")}</p>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {submitted ? (
        <Card className="border-eligible/30 bg-eligible-muted">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-eligible text-eligible-foreground">
              <Check className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">{t("Return request submitted", "تم إرسال طلب الإرجاع")}</h2>
              <p className="text-sm text-muted-foreground">{t("Case ID", "رقم الحالة")}: <span className="font-mono">{caseId}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">{t("Your store will review this request. You'll receive an update soon.", "سيراجع المتجر طلبك، وستصلك حالة الطلب قريبًا.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {decision.outcome === "ELIGIBLE" && (
            <Button size="lg" onClick={() => void handleSubmit()} disabled={submitting} className="group">
              {submitting && <Spinner />}{submitting ? t("Creating request…", "جارٍ إنشاء الطلب…") : t("Create return request", "إنشاء طلب الإرجاع")}
              <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
            </Button>
          )}
          {decision.outcome === "MANUAL_REVIEW" && (
            <Button size="lg" onClick={() => void handleSubmit()} disabled={submitting} className="group">
              {submitting && <Spinner />}{submitting ? t("Submitting…", "جارٍ الإرسال…") : t("Submit for review", "إرسال للمراجعة")}
              <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
            </Button>
          )}
          {decision.outcome === "NOT_ELIGIBLE" && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              {t("This item does not meet the return policy conditions. If you believe this is an error, please contact the store directly.", "هذا المنتج لا يستوفي شروط سياسة الإرجاع. إذا كنت تعتقد أن هناك خطأ، فتواصل مع المتجر مباشرة.")}
            </div>
          )}
          <Button variant="outline" onClick={() => router.push(getReturnStartPath())}>
            {t("Start a new return", "بدء طلب إرجاع جديد")}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3" />
          {t("Human-approved rules", "قواعد معتمدة من التاجر")}
        </span>
        <span className="flex items-center gap-1">
          <Lock className="size-3" />
          {t("Frozen evidence", "أدلة محفوظة")}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {t("Instant evaluation", "تقييم فوري")}
        </span>
      </div>

      <p className="text-center text-[11px] text-muted-foreground/70">
        {t("Eligibility does not mean a refund has been issued. The store will process your request.", "الأهلية لا تعني إصدار المبلغ المسترد. سيتولى المتجر معالجة الطلب.")}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
