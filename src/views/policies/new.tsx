"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { services } from "@/lib/services";
import { type PolicyRule, type RuleApprovalState } from "@/lib/domain";
import { toast } from "sonner";
import { FileText, Link2, PencilLine, Sparkles, Check, X, Edit3, ArrowRight, CalendarDays, ListChecks, PackageCheck, PackageX, Truck, Hash, UserRound, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

type InputMethod = "paste" | "url" | "manual";

export function PolicyNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isArabic } = useLanguage();
  const { workspace } = useAuth();
  const [method, setMethod] = useState<InputMethod>("paste");
  const [policyName, setPolicyName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionState, setExtractionState] = useState<"idle" | "reading" | "proposing" | "ready" | "error">("idle");
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [returnWindow, setReturnWindow] = useState("14");
  const discoveryStarted = useRef(false);
  const onboardingToken = searchParams.get("onboarding");


  const sampleText = useMemo(() => services.getSamplePolicyText(), []);

  const extractText = async (text = sourceText) => {
    if (!text.trim()) {
      toast.error(t("Please enter policy text first", "يرجى إدخال نص السياسة أولًا"));
      return;
    }
    setExtracting(true);
    setExtractionState("reading");
    setRules([]);

    setExtractionState("proposing");
    if (!supabase || !workspace) {
      setExtractionState("error"); setExtracting(false);
      toast.error(t("Your workspace is not ready. Please sign in again.", "مساحة العمل غير جاهزة. يرجى تسجيل الدخول مجددًا."));
      return;
    }
    const { data, error } = await supabase.functions.invoke("policy-extract", {
      body: { storeId: workspace.storeId, name: policyName.trim() || t("Returns Policy", "سياسة الإرجاع"), sourceText: text },
    });
    if (error || !data?.draft?.id || !Array.isArray(data.draft.rules)) {
      setExtractionState("error"); setExtracting(false);
      toast.error(t("We could not extract this policy. Check the text and try again.", "تعذّر استخراج هذه السياسة. تحقق من النص وحاول مرة أخرى."));
      return;
    }
    setDraftId(data.draft.id);
    setRules(data.draft.rules as PolicyRule[]);
    setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    setExtractionState("ready"); setExtracting(false);
    toast.success(t("Proposed rules are ready for review", "القواعد المقترحة جاهزة للمراجعة"));
  };

  const fetchPolicySource = async (action: "fetch" | "discover") => {
    if (!supabase || !workspace) return;
    setSourceLoading(true); setDiscoveryMessage(null);
    const { data, error } = await supabase.functions.invoke("policy-source", { body: { storeId: workspace.storeId, action, url: action === "fetch" ? url : undefined } });
    setSourceLoading(false);
    if (error || !data?.found || typeof data.sourceText !== "string") {
      setDiscoveryMessage(t("We couldn’t find a clear public return policy. Paste its URL or text, or create a starter draft.", "لم نعثر على سياسة إرجاع عامة وواضحة. الصق رابطها أو نصها، أو أنشئ مسودة مبدئية."));
      return;
    }
    setUrl(data.url ?? url); setSourceText(data.sourceText); setMethod("paste");
    setDiscoveryMessage(t("We found a policy source. Review the imported text before extracting rules.", "عثرنا على مصدر للسياسة. راجع النص المستورد قبل استخراج القواعد."));
  };

  useEffect(() => {
    if (searchParams.get("discover") !== "1" || !workspace || discoveryStarted.current) return;
    discoveryStarted.current = true;
    void fetchPolicySource("discover");
  }, [workspace, searchParams]);

  const createStarterDraft = () => {
    const days = Math.min(365, Math.max(1, Number.parseInt(returnWindow, 10) || 14));
    const text = isArabic
      ? `سياسة الإرجاع\n\nيمكن للعميل طلب إرجاع المنتجات المؤهلة خلال ${days} يومًا من تاريخ التسليم. تُقبل طلبات الإرجاع إذا كان المنتج معيبًا، أو تم استلام منتج غير صحيح، أو كان المنتج غير مطابق للوصف، أو تضرر أثناء الشحن. يجب أن يكون المنتج جديدًا وغير مفتوح، أو مفتوحًا من دون استخدام مع التغليف والملحقات الأصلية. يجب أن تكون حالة الطلب «تم التسليم». إذا تعذر التحقق من تاريخ التسليم أو حالة الطلب، يُحال الطلب إلى المراجعة اليدوية.`
      : `Return Policy\n\nCustomers may request a return for eligible items within ${days} days of delivery. Returns are accepted when an item is defective, the wrong item was received, the item is not as described, or it was damaged in transit. The item must be new and unopened, or opened but unused with its original packaging and accessories. The order must have delivered status. If the delivery date or order status cannot be verified, the request is held for manual review.`;
    setSourceText(text); setMethod("paste");
    setDiscoveryMessage(t("Starter draft created. Edit it so it matches your store before extracting rules.", "تم إنشاء مسودة مبدئية. عدّلها لتطابق سياسة متجرك قبل استخراج القواعد."));
  };

  const handleApprove = (ruleId: string) => {
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, approvalState: "approved" } : r));
  };

  const handleReject = (ruleId: string) => {
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, approvalState: "rejected" } : r));
  };

  const handleEditValue = (ruleId: string, newValue: string) => {
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, value: newValue, approvalState: "edited" as RuleApprovalState, creator: "merchant" as const } : r));
  };

  const handlePublish = async () => {
    const unresolved = rules.some((r) => r.approvalState === "pending");
    if (unresolved) {
      toast.error(t("Some rules still need review", "بعض القواعد لا تزال بحاجة إلى المراجعة"));
      return;
    }
    if (!supabase || !draftId) return;
    const { error } = await supabase.from("policy_drafts").update({ rules }).eq("id", draftId);
    if (error) {
      toast.error(t("Could not save your review. Please try again.", "تعذّر حفظ المراجعة. يرجى المحاولة مرة أخرى."));
      return;
    }
    router.push(`/app/policies/review/${draftId}${onboardingToken ? `?onboarding=${encodeURIComponent(onboardingToken)}` : ""}`);
  };

  const pendingCount = rules.filter((r) => r.approvalState === "pending").length;
  const approvedCount = rules.filter((r) => r.approvalState === "approved" || r.approvalState === "edited").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">1</span>
          {t("Create", "إنشاء")}
          <span className="text-border">/</span>
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold">2</span>
          {t("Review", "مراجعة")}
          <span className="text-border">/</span>
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold">3</span>
          {t("Publish", "نشر")}
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t("New policy", "سياسة جديدة")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Create rules from your return policy text, then approve each one before publishing.", "أنشئ قواعد من نص سياسة الإرجاع، ثم راجع كل قاعدة واعتمدها قبل النشر.")}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {discoveryMessage && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">{discoveryMessage}</div>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="policy-name">{t("Policy name", "اسم السياسة")}</Label>
          <Input id="policy-name" value={policyName} onChange={(e) => setPolicyName(e.target.value)} placeholder={t("Returns Policy", "سياسة الإرجاع")} className="max-w-md" />
        </div>

        <Tabs dir={isArabic ? "rtl" : "ltr"} value={method} onValueChange={(v) => setMethod(v as InputMethod)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="paste"><FileText className="size-3.5" /> {t("Paste text", "لصق النص")}</TabsTrigger>
            <TabsTrigger value="url"><Link2 className="size-3.5" /> {t("Policy URL", "رابط السياسة")}</TabsTrigger>
            <TabsTrigger value="manual"><PencilLine className="size-3.5" /> {t("No policy yet", "لا توجد سياسة بعد")}</TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="source">{t("Paste your return policy text", "الصق نص سياسة الإرجاع")}</Label>
                  <Textarea
                    id="source"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder={t("Paste your store's return and refund policy here...", "الصق سياسة الإرجاع واسترداد الأموال لمتجرك هنا...")} dir="auto"
                    className="min-h-[200px]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={() => setSourceText(sampleText)}>
                      {t("Use sample policy", "استخدام سياسة نموذجية")}
                    </Button>
                    <Button onClick={() => void extractText()} disabled={extracting || !sourceText.trim()}>
                      {extracting ? <Spinner className="me-1" /> : <Sparkles className="size-4" />}
                      {t("Extract rules", "استخراج القواعد")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="url">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="url">{t("Policy URL", "رابط السياسة")}</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstore.sa/policies/returns" />
                  <p className="text-xs text-muted-foreground">
                    {t("Reload securely imports the public page, then shows you the text before AI proposes any rules.", "يستورد ريلود الصفحة العامة بأمان، ثم يعرض النص عليك قبل أن يقترح الذكاء الاصطناعي أي قواعد.")}
                  </p>
                  <Button onClick={() => void fetchPolicySource("fetch")} disabled={sourceLoading || !url.trim()} className="self-start">
                    {sourceLoading ? <Spinner className="me-1" /> : <Link2 className="size-4" />}
                    {t("Import policy", "استيراد السياسة")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardContent className="pt-6">
                <div className="mx-auto flex max-w-lg flex-col gap-4 py-4">
                  <div><h3 className="font-display text-lg font-semibold">{t("Create a starter draft", "إنشاء مسودة مبدئية")}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Start with the minimum policy needed for a controlled pilot. You can edit every sentence before AI proposes rules.", "ابدأ بالحد الأدنى المطلوب للتجربة الأولية. يمكنك تعديل كل جملة قبل أن يقترح الذكاء الاصطناعي القواعد.")}</p></div>
                  <div className="space-y-2"><Label htmlFor="return-window">{t("Return window", "مدة الإرجاع")}</Label><div className="flex items-center gap-2"><Input id="return-window" inputMode="numeric" value={returnWindow} onChange={(event) => setReturnWindow(event.target.value.replace(/\D/g, "").slice(0, 3))} className="max-w-28" /><span className="text-sm text-muted-foreground">{t("days from delivery", "يومًا من التسليم")}</span></div></div>
                  <Button onClick={createStarterDraft} className="self-start"><PencilLine className="size-4" />{t("Create editable draft", "إنشاء مسودة قابلة للتعديل")}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {(extracting || extractionState !== "idle") && (
        <ExtractionProgress state={extractionState} />
      )}

      {extractionState === "idle" && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{t("How it works:", "كيف يعمل:")}</span> {t("Reload proposes rules from your text. You decide what gets approved and published.", "يقترح ريلود القواعد من نصك، وأنت تقرر ما يُعتمد ويُنشر.")}</p>
        </div>
      )}

      {rules.length > 0 && extractionState === "ready" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">{t("Source text", "النص الأصلي")}</h3>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="max-h-[500px] overflow-y-auto p-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {sourceText}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t("Review your return rules", "راجع قواعد الإرجاع")}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-eligible">{t(`${approvedCount} approved`, `${approvedCount} معتمدة`)}</span>
                {pendingCount > 0 && <span className="text-review">{t(`${pendingCount} pending`, `${pendingCount} بانتظار المراجعة`)}</span>}
              </div>
            </div>
            <p className="mb-4 text-xs leading-6 text-muted-foreground">{t("Check each rule against your policy, then approve or edit it before publishing.", "قارن كل قاعدة بسياسة متجرك، ثم اعتمدها أو عدّلها قبل النشر.")}</p>
            {warnings.length > 0 && <div className="mb-4 rounded-lg border border-review/20 bg-review-muted px-3 py-2 text-xs leading-6 text-review">
              <p className="font-semibold">{t("Needs merchant clarification", "بحاجة إلى توضيح من التاجر")}</p>
              <ul className="mt-1 list-disc ps-4">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </div>}
            <div className="flex flex-col gap-3">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRuleId === rule.id}
                  onSelect={() => setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)}
                  onApprove={() => handleApprove(rule.id)}
                  onReject={() => handleReject(rule.id)}
                  onEditValue={(val) => handleEditValue(rule.id, val)}
                />
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={() => void handlePublish()} disabled={pendingCount > 0 || !draftId}>
              {pendingCount > 0 ? t(`Review remaining rules (${pendingCount})`, `راجع القواعد المتبقية (${pendingCount})`) : t("Review for publication", "مراجعة للنشر")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtractionProgress({ state }: { state: string }) {
  const { t } = useLanguage();
  const steps = [
    { key: "reading", label: t("Reading policy", "قراءة السياسة"), icon: FileText },
    { key: "proposing", label: t("Proposing rules", "اقتراح القواعد"), icon: Sparkles },
    { key: "ready", label: t("Ready for your review", "جاهزة للمراجعة"), icon: Check },
  ];
  const currentIndex = steps.findIndex((s) => s.key === state);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={cn(
              "flex size-7 items-center justify-center rounded-full text-xs transition-colors",
              isDone && "bg-eligible text-eligible-foreground",
              isActive && "bg-primary text-primary-foreground",
              !isDone && !isActive && "bg-muted text-muted-foreground",
            )}>
              {isDone ? <Check className="size-3.5" /> : <step.icon className="size-3.5" />}
            </div>
            <span className={cn("text-xs", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
            {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function RuleRow({
  rule,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onEditValue,
}: {
  rule: PolicyRule;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEditValue: (val: string) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(rule.value);

  const presentation = {
    window: { title: t("Return period", "مهلة الإرجاع"), icon: CalendarDays, help: t("Counted from the delivery date.", "تُحسب من تاريخ التسليم.") },
    reasons: { title: t("Accepted reasons", "أسباب الإرجاع المقبولة"), icon: ListChecks, help: t("Customers can request a return for these reasons.", "يمكن للعميل طلب الإرجاع للأسباب التالية.") },
    conditions: { title: t("Item condition", "حالة المنتج"), icon: PackageCheck, help: t("The item must be in one of these conditions.", "يجب أن يكون المنتج بإحدى الحالات التالية.") },
    exclusions: { title: t("Excluded product codes", "رموز المنتجات المستثناة"), icon: PackageX, help: t("Items with these exact product codes cannot be returned.", "لا يُقبل إرجاع المنتجات التي تطابق رموزها الرموز التالية تمامًا.") },
    order_status: { title: t("Order status", "حالة الطلب"), icon: Truck, help: t("Returns are accepted for orders in these states.", "يُقبل الإرجاع للطلبات في الحالات التالية.") },
    quantity: { title: t("Quantity limit", "الحد الأقصى للكمية"), icon: Hash, help: t("Cannot exceed the quantity in the order.", "لا يمكن تجاوز الكمية الموجودة في الطلب.") },
    fallback: { title: t("When information is missing", "عند نقص المعلومات"), icon: UserRound, help: t("If the delivery date or order status cannot be verified.", "إذا تعذّر التحقق من تاريخ التسليم أو حالة الطلب.") },
  }[rule.category];
  const valueLabels: Record<string, string> = {
    defective: t("Faulty item", "منتج معيب"),
    wrong_item: t("Wrong item received", "استلام منتج مختلف"),
    not_as_described: t("Not as described", "غير مطابق للوصف"),
    damaged_in_transit: t("Damaged during delivery", "تلف أثناء التوصيل"),
    changed_mind: t("Changed mind", "تغيير الرأي"),
    new_unopened: t("New and unopened", "جديد وغير مفتوح"),
    opened_unused: t("Opened but unused", "مفتوح ولم يُستخدم"),
    used: t("Used", "مستخدم"),
    delivered: t("Delivered", "تم التسليم"),
    shipped: t("Shipped", "تم الشحن"),
    processing: t("Processing", "قيد التجهيز"),
    cancelled: t("Cancelled", "ملغي"),
    manual_review: t("Ask the store to review", "إحالة الطلب إلى المتجر للمراجعة"),
  };
  const values = rule.category === "window"
    ? [t(`${rule.value} days after delivery`, `${rule.value} يومًا من التسليم`)]
    : rule.category === "quantity"
      ? [t(`Up to ${rule.value} per item`, `حتى ${rule.value} من كل منتج`)]
      : rule.value.split(",").map(value => {
        const code = value.trim();
        return rule.category === "exclusions" ? code : valueLabels[code] ?? code;
      });
  const Icon = presentation.icon;

  const stateConfig: Record<RuleApprovalState, { label: string; class: string }> = {
    pending: { label: t("Needs review", "بحاجة إلى مراجعة"), class: "bg-review-muted text-review border-review/20" },
    approved: { label: t("Approved", "معتمدة"), class: "bg-eligible-muted text-eligible border-eligible/20" },
    rejected: { label: t("Rejected", "مرفوضة"), class: "bg-not-eligible-muted text-not-eligible border-not-eligible/20" },
    edited: { label: t("Edited", "معدّلة"), class: "bg-accent text-accent-foreground border-border" },
  };

  const { label: stateLabel, class: stateClass } = stateConfig[rule.approvalState];

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors sm:p-5",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
            <span className="text-sm font-semibold text-foreground">{presentation.title}</span>
            <Badge variant="outline" className={cn("text-[10px] py-0", stateClass)}>{stateLabel}</Badge>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">{presentation.help}</p>
          {editing ? (
            <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Input aria-label={t("Rule value", "قيمة القاعدة")} value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 text-xs" />
              <Button aria-label={t("Save value", "حفظ القيمة")} size="xs" onClick={() => { onEditValue(editValue); setEditing(false); }}>
                <Check className="size-3" />
              </Button>
              <Button aria-label={t("Cancel editing", "إلغاء التعديل")} size="xs" variant="ghost" onClick={() => { setEditing(false); setEditValue(rule.value); }}>
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {values.map((value, index) => <span key={index} className="max-w-full break-words rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs leading-5 text-foreground"><bdi>{value}</bdi></span>)}
            </div>
          )}
          {rule.sourceExcerpt && <button type="button" onClick={onSelect} aria-expanded={isSelected} className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
            <FileText className="size-3.5" aria-hidden="true" />{t("View policy wording", "عرض نص السياسة")}<ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", isSelected && "rotate-180")} aria-hidden="true" />
          </button>}
          {isSelected && rule.sourceExcerpt && (
            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2">
              <div className="text-[10px] font-medium text-primary">{t("Source clause", "البند الأصلي")}</div>
              <blockquote dir="auto" className="mt-1 text-xs leading-6 text-muted-foreground">{rule.sourceExcerpt}</blockquote>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          {rule.approvalState === "pending" && (
            <>
              <Button size="sm" variant="outline" className="border-eligible/25 text-eligible hover:bg-eligible-muted hover:text-eligible" onClick={onApprove}>
                <Check className="size-4" />{t("Approve", "اعتماد")}
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject}>
                <X className="size-4" />{t("Reject", "رفض")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Edit3 className="size-4" />{t("Edit", "تعديل")}
              </Button>
            </>
          )}
          {(rule.approvalState === "approved" || rule.approvalState === "edited") && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Edit3 className="size-4" />{t("Edit", "تعديل")}
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject}>
                <X className="size-4" />{t("Reject", "رفض")}
              </Button>
            </>
          )}
          {rule.approvalState === "rejected" && (
            <Button size="sm" variant="outline" onClick={onApprove}>
              <Check className="size-4" />{t("Approve", "اعتماد")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
