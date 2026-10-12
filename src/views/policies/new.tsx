"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { QUICK, Segmented, TWEEN } from "@/components/desk/primitives";
import { ProgressChecklist } from "@/components/integrations/connect-stepper";
import { services } from "@/lib/services";
import { type PolicyRule, type RuleApprovalState } from "@/lib/domain";
import { toast } from "sonner";
import { FileText, Link2, PencilLine, Sparkles, Check, X, Edit3, ArrowRight, ChevronDown, ClipboardPaste, Minus, Plus, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/components/language-provider";
import { describeRule } from "@/components/policy-rule-labels";
import { Key, PageHeader } from "@/components/desk/page-header";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

/*
 * New policy: the merchant gives us their return policy (pasted, by link, or
 * a starter draft), Reload proposes rules from it, and the merchant approves,
 * edits or rejects each one. Nothing is published from this page; the last
 * button leads to the publication review.
 *
 * While reviewing, opening a rule's wording highlights the sentence it came
 * from in the policy text beside it, so every rule can be checked at a glance.
 */

const FOLD = { ...TWEEN, duration: 0.34 } as const;

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
  const [ticks, setTicks] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(true);
  const reviewRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
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
    setSelectedRuleId(null);
    setTicks(0);
    // The steps mirror the work; the last one waits for the real answer.
    const timers = [window.setTimeout(() => setTicks(1), 1400), window.setTimeout(() => setTicks(2), 6000)];
    const stop = () => timers.forEach(window.clearTimeout);

    setExtractionState("proposing");
    if (!supabase || !workspace) {
      stop(); setExtractionState("error"); setExtracting(false);
      toast.error(t("Your workspace is not ready. Please sign in again.", "مساحة العمل غير جاهزة. يرجى تسجيل الدخول مجددًا."));
      return;
    }
    const { data, error } = await supabase.functions.invoke("policy-extract", {
      body: { storeId: workspace.storeId, name: policyName.trim() || t("Returns Policy", "سياسة الإرجاع"), sourceText: text },
    });
    if (error || !data?.draft?.id || !Array.isArray(data.draft.rules)) {
      stop(); setExtractionState("error"); setExtracting(false);
      toast.error(t("We could not extract this policy. Check the text and try again.", "تعذّر استخراج هذه السياسة. تحقق من النص وحاول مرة أخرى."));
      return;
    }
    setDraftId(data.draft.id);
    setRules(data.draft.rules as PolicyRule[]);
    setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    stop(); setTicks(3);
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    setExtractionState("ready"); setExtracting(false); setSourceOpen(false);
    window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
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
    // Rules the merchant left out are dropped here: a policy only publishes
    // when every rule in it is approved, so "left out" has to mean gone.
    const kept = rules.filter((r) => r.approvalState !== "rejected");
    if (!kept.length) {
      toast.error(t("Approve at least one rule to continue", "اعتمد قاعدة واحدة على الأقل للمتابعة"));
      return;
    }
    const { error } = await supabase.from("policy_drafts").update({ rules: kept }).eq("id", draftId);
    if (error) {
      toast.error(t("Could not save your review. Please try again.", "تعذّر حفظ المراجعة. يرجى المحاولة مرة أخرى."));
      return;
    }
    router.push(`/app/policies/review/${draftId}${onboardingToken ? `?onboarding=${encodeURIComponent(onboardingToken)}` : ""}`);
  };

  const pendingCount = rules.filter((r) => r.approvalState === "pending").length;
  const approvedCount = rules.filter((r) => r.approvalState === "approved" || r.approvalState === "edited").length;
  const reviewedCount = rules.length - pendingCount;
  const ready = rules.length > 0 && extractionState === "ready";
  const stage = ready ? 1 : 0;
  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;
  const urlValid = /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url.trim());
  const days = Math.min(365, Math.max(1, Number.parseInt(returnWindow, 10) || 14));

  // After a decision, bring the next rule that still needs one into view.
  const decide = (ruleId: string, action: () => void) => {
    action();
    const nextPending = rules.find((r) => r.id !== ruleId && r.approvalState === "pending");
    if (nextPending) window.setTimeout(() => document.getElementById(`rule-${nextPending.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 260);
  };
  const approveAll = () => setRules((prev) => prev.map((r) => (r.approvalState === "pending" ? { ...r, approvalState: "approved" } : r)));
  const pasteClipboard = async (apply: (value: string) => void) => {
    try { apply((await navigator.clipboard.readText()).trim()); } catch { /* the field is there to type into */ }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4">
      {/* ── Header ── */}
      <PageHeader icon={FileText} title={t("New return policy", "سياسة إرجاع جديدة")}
        actions={<>
        <ol className="flex items-center gap-1.5 text-xs" aria-label={t("Steps", "الخطوات")}>
          {[t("Add policy", "إضافة السياسة"), t("Review rules", "مراجعة القواعد"), t("Publish", "النشر")].map((label, index) => (
            <li key={label} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true" className={cn("h-px w-4 transition-colors duration-500", index <= stage ? "bg-eligible" : "bg-border")} />}
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors duration-300",
                index < stage ? "border-eligible/25 bg-eligible-muted text-eligible" : index === stage ? "border-foreground/20 bg-foreground/[.06] text-foreground" : "border-transparent text-muted-foreground")}>
                {index < stage ? <Check className="size-3.5" strokeWidth={2.75} /> : <span className="tabular-nums opacity-70">{index + 1}</span>}{label}
              </span>
            </li>
          ))}
        </ol>
        </>}>
        {t("Give us your policy and Reload turns it into clear rules.", "أعطنا سياستك ويحوّلها ريلود إلى قواعد واضحة.")} <Key>{t("Nothing is used until you approve it.", "لا يُستخدم شيء حتى تعتمده.")}</Key>
      </PageHeader>

      {/* ── 1. The policy ── */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.05 }} className="admin-card overflow-hidden rounded-2xl border border-border bg-card">
        {ready && !extracting && (
          <button type="button" aria-expanded={sourceOpen} onClick={() => setSourceOpen((value) => !value)}
            className="flex w-full items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-muted/40 sm:px-6">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-eligible text-eligible-foreground"><Check className="size-4" strokeWidth={3} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{policyName.trim() || t("Returns Policy", "سياسة الإرجاع")}</span>
              <span className="block text-xs text-muted-foreground">{t(`${rules.length} rules found. Change the text and extract again if something is missing.`, `عُثر على ${rules.length} قواعد. عدّل النص واستخرج مجددًا إن نقص شيء.`)}</span>
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", sourceOpen && "rotate-180")} />
          </button>
        )}
        <AnimatePresence initial={false}>
          {extracting && (
            <motion.div key="reading" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="overflow-hidden">
              <p className="flex items-center gap-3 px-5 py-4 text-sm sm:px-6">
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{policyName.trim() || t("Returns Policy", "سياسة الإرجاع")}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t(`${sourceText.trim().split(/\s+/).length} words`, `${sourceText.trim().split(/\s+/).length} كلمة`)}</span>
              </p>
            </motion.div>
          )}
          {!extracting && (!ready || sourceOpen) && (
            <motion.div key="source" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="overflow-hidden">
              <div className={cn("space-y-5 p-5 sm:p-6", ready && "border-t border-border")}>
                <AnimatePresence initial={false}>
                  {discoveryMessage && (
                    <motion.p key="notice" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={QUICK} className="overflow-hidden">
                      <span className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm leading-6"><Sparkles className="mt-1 size-4 shrink-0 text-muted-foreground" />{discoveryMessage}</span>
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-0 flex-1 space-y-2 sm:max-w-xs">
                    <label htmlFor="policy-name" className="block text-sm font-medium">{t("Policy name", "اسم السياسة")}</label>
                    <Input id="policy-name" value={policyName} onChange={(e) => setPolicyName(e.target.value)} placeholder={t("Returns Policy", "سياسة الإرجاع")} className="h-10 rounded-xl" disabled={extracting} />
                  </div>
                  <Segmented<InputMethod> value={method} onChange={setMethod} label={t("How to add your policy", "طريقة إضافة السياسة")} className="max-sm:flex max-sm:w-full [&>button]:h-9 max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center max-sm:[&>button]:px-2"
                    options={[
                      { value: "paste", label: t("Paste text", "لصق النص"), icon: FileText },
                      { value: "url", label: t("From a link", "من رابط"), icon: Link2 },
                      { value: "manual", label: t("No policy yet", "لا توجد سياسة"), icon: PencilLine },
                    ]} />
                </div>

                <AnimatePresence initial={false}>
                  {method === "paste" && (
                    <motion.div key="paste" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="-mx-1 overflow-hidden px-1">
                      <div className="space-y-3 py-1">
                        <div className="relative">
                          <Textarea id="source" ref={sourceRef} value={sourceText} onChange={(e) => setSourceText(e.target.value)} dir="auto" disabled={extracting}
                            aria-label={t("Your return policy text", "نص سياسة الإرجاع")}
                            placeholder={t("Paste your store's return and refund policy here…", "الصق سياسة الإرجاع واسترداد الأموال لمتجرك هنا…")}
                            className="max-h-[420px] min-h-[220px] overflow-y-auto rounded-2xl leading-7" />
                          <AnimatePresence>
                            {!sourceText && !extracting && (
                              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} className="absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-2 px-4">
                                <Button type="button" size="sm" variant="outline" className="rounded-xl bg-background transition-transform active:scale-[.97]" onClick={() => void pasteClipboard(setSourceText)}><ClipboardPaste className="size-4" />{t("Paste from clipboard", "لصق من الحافظة")}</Button>
                                <Button type="button" size="sm" variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => setSourceText(sampleText)}>{t("Try a sample policy", "جرّب سياسة نموذجية")}</Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs tabular-nums text-muted-foreground">{sourceText ? t(`${sourceText.trim().split(/\s+/).length} words`, `${sourceText.trim().split(/\s+/).length} كلمة`) : t("Any language. Arabic and English both work.", "بأي لغة. العربية والإنجليزية كلاهما مدعوم.")}</p>
                          <Button onClick={() => void extractText()} disabled={extracting || !sourceText.trim()} className="group h-11 rounded-xl px-5 transition-transform active:scale-[.98]">
                            {extracting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 transition-transform duration-300 group-hover:rotate-12" />}
                            {ready ? t("Extract again", "استخراج مجددًا") : t("Extract rules", "استخراج القواعد")}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {method === "url" && (
                    <motion.div key="url" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="-mx-1 overflow-hidden px-1">
                      <form className="space-y-3 py-1" onSubmit={(event) => { event.preventDefault(); if (urlValid && !sourceLoading) void fetchPolicySource("fetch"); }}>
                        <div className={cn("flex items-center gap-2 rounded-2xl border bg-background p-1.5 ps-3.5 transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)]", urlValid ? "border-eligible/50" : "border-border")}>
                          <Link2 className="size-4 shrink-0 text-muted-foreground" />
                          <input id="url" dir="ltr" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://yourstore.sa/policies/returns" aria-label={t("Policy link", "رابط السياسة")}
                            className="field-bare h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
                          <AnimatePresence initial={false} mode="popLayout">
                            {urlValid
                              ? <motion.span key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={QUICK} className="me-1 grid size-8 place-items-center rounded-full bg-eligible-muted text-eligible"><Check className="size-4" /></motion.span>
                              : <motion.button key="paste" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} onClick={() => void pasteClipboard(setUrl)}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium transition-colors hover:bg-muted/70 active:scale-[.98]"><ClipboardPaste className="size-3.5" />{t("Paste", "لصق")}</motion.button>}
                          </AnimatePresence>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="max-w-md text-xs leading-5 text-muted-foreground">{t("We read the public page and show you its text first. Nothing is extracted until you say so.", "نقرأ الصفحة العامة ونعرض نصها عليك أولًا. لا يُستخرج شيء حتى توافق.")}</p>
                          <Button type="submit" disabled={sourceLoading || !urlValid} className="h-11 rounded-xl px-5 transition-transform active:scale-[.98]">
                            {sourceLoading ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                            {sourceLoading ? t("Reading the page…", "جارٍ قراءة الصفحة…") : t("Import policy", "استيراد السياسة")}
                          </Button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                  {method === "manual" && (
                    <motion.div key="manual" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="-mx-1 overflow-hidden px-1">
                      <div className="space-y-4 py-1">
                        <div>
                          <p className="text-sm font-medium">{t("How many days can customers return an item?", "كم يومًا يحق للعميل إرجاع المنتج؟")}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("We write a simple, fair policy around it. You can change every sentence before any rule is created.", "نكتب سياسة بسيطة وعادلة حولها. يمكنك تعديل كل جملة قبل إنشاء أي قاعدة.")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center rounded-2xl border border-border bg-background p-1">
                            <button type="button" aria-label={t("Fewer days", "أيام أقل")} onClick={() => setReturnWindow(String(Math.max(1, days - 1)))} className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"><Minus className="size-4" /></button>
                            <input id="return-window" inputMode="numeric" aria-label={t("Return window in days", "مدة الإرجاع بالأيام")} value={returnWindow} onChange={(event) => setReturnWindow(event.target.value.replace(/\D/g, "").slice(0, 3))}
                              className="field-bare h-9 w-14 bg-transparent text-center font-display text-xl font-semibold tabular-nums outline-none" />
                            <button type="button" aria-label={t("More days", "أيام أكثر")} onClick={() => setReturnWindow(String(Math.min(365, days + 1)))} className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"><Plus className="size-4" /></button>
                          </div>
                          <span className="text-sm text-muted-foreground">{t("days from delivery", "يومًا من التسليم")}</span>
                          <div className="flex gap-1.5">
                            {[7, 14, 30].map((preset) => (
                              <button key={preset} type="button" onClick={() => setReturnWindow(String(preset))} aria-pressed={days === preset}
                                className={cn("h-8 rounded-full border px-3 text-xs font-medium tabular-nums transition-[background-color,border-color,color] duration-200 active:scale-[.97]", days === preset ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>{preset}</button>
                            ))}
                          </div>
                        </div>
                        <Button onClick={createStarterDraft} className="h-11 rounded-xl px-5 transition-transform active:scale-[.98]"><PencilLine className="size-4" />{t("Write my starter policy", "اكتب سياستي المبدئية")}</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ── Working ── */}
      <AnimatePresence initial={false}>
        {extracting && (
          <motion.section key="working" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={FOLD} className="overflow-hidden" aria-live="polite">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                <ProgressChecklist done={ticks} items={[t("Reading your policy", "قراءة سياستك"), t("Finding the rules in it", "استخراج القواعد منها"), t("Preparing them for your review", "تجهيزها لمراجعتك")]} />
                <p className="px-1 text-xs leading-5 text-muted-foreground">{t("Usually under a minute. You approve everything before it is used.", "عادةً أقل من دقيقة. تعتمد كل شيء قبل استخدامه.")}</p>
              </div>
              <div className="space-y-3" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1 - index * 0.25, y: 0 }} transition={{ ...TWEEN, delay: 0.25 + index * 0.18 }} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-xl" /><Skeleton className="h-4 w-36" /><Skeleton className="ms-auto h-5 w-20 rounded-full" /></div>
                    <div className="mt-4 flex gap-2"><Skeleton className="h-7 w-28 rounded-lg" /><Skeleton className="h-7 w-36 rounded-lg" /></div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {!extracting && extractionState === "error" && (
        <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={QUICK} role="alert" className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6">
          <AlertTriangle className="mt-1 size-4 shrink-0 text-destructive" />{t("We couldn't turn this text into rules. Check that it is your return policy, then try again.", "تعذّر تحويل هذا النص إلى قواعد. تأكد أنه سياسة الإرجاع ثم حاول مجددًا.")}
        </motion.p>
      )}

      {/* ── 2. Review ── */}
      {ready && (
        <motion.div ref={reviewRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, duration: 0.4 }} className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">{t("Review your rules", "راجع قواعدك")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("Approve what's right, edit what's close, reject what's wrong.", "اعتمد الصحيح، وعدّل القريب، وارفض الخاطئ.")}</p>
            </div>
            <AnimatePresence initial={false}>
              {pendingCount > 1 && (
                <motion.div key="all" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={QUICK}>
                  <Button variant="outline" size="sm" onClick={approveAll} className="rounded-xl transition-transform active:scale-[.97]"><Check className="size-4" />{t(`Approve all ${pendingCount}`, `اعتماد الكل (${pendingCount})`)}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {warnings.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-review/25 bg-review-muted/50 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-review" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{t("Your policy doesn't say", "سياستك لا توضّح")}</p>
                <ul className="mt-1 space-y-1 text-[13px] leading-6 text-muted-foreground">{warnings.map((warning, index) => <li key={index} dir="auto">{warning}</li>)}</ul>
                <p className="mt-1.5 text-xs text-muted-foreground">{t("Add it to the text above and extract again, or leave it out.", "أضفها إلى النص أعلاه واستخرج مجددًا، أو اتركها.")}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <aside className="hidden lg:block">
              <div className="admin-card sticky top-20 overflow-hidden rounded-2xl border border-border bg-card">
                <p className="flex items-center gap-2 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><FileText className="size-3.5" />{t("Your policy text", "نص سياستك")}</p>
                <SourceText text={sourceText} excerpt={selectedRule?.sourceExcerpt ?? null} />
              </div>
            </aside>

            <ul className="space-y-3">
              {rules.map((rule, index) => (
                <motion.li key={rule.id} id={`rule-${rule.id}`} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.08 + index * 0.06 }} className="scroll-mt-24">
                  <RuleRow
                    rule={rule}
                    isSelected={selectedRuleId === rule.id}
                    onSelect={() => setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)}
                    onApprove={() => decide(rule.id, () => handleApprove(rule.id))}
                    onReject={() => decide(rule.id, () => handleReject(rule.id))}
                    onRestore={() => setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, approvalState: "pending" } : r)))}
                    onEditValue={(val) => handleEditValue(rule.id, val)}
                  />
                </motion.li>
              ))}
            </ul>
          </div>

          {/* ── Progress + next ── */}
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card/95 p-3 ps-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)] backdrop-blur max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:ps-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium tabular-nums">
                {pendingCount > 0 ? t(`${reviewedCount} of ${rules.length} reviewed`, `تمت مراجعة ${reviewedCount} من ${rules.length}`) : t(`All ${rules.length} reviewed · ${approvedCount} approved`, `تمت مراجعة الكل (${rules.length}) · ${approvedCount} معتمدة`)}
              </p>
              <span className="mt-1.5 block h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
                <motion.span className="block h-full origin-left rounded-full bg-eligible rtl:origin-right" initial={false} animate={{ scaleX: rules.length ? reviewedCount / rules.length : 0 }} transition={{ ...TWEEN, duration: 0.45 }} />
              </span>
            </div>
            <Button onClick={() => void handlePublish()} disabled={pendingCount > 0 || !draftId} className="group h-11 rounded-xl px-5 transition-transform active:scale-[.98]">
              {pendingCount > 0 ? t(`${pendingCount} left to review`, `بقي ${pendingCount} للمراجعة`) : t("Continue to publish", "المتابعة إلى النشر")}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** The policy text, with the sentence a rule came from highlighted and brought into view. */
function SourceText({ text, excerpt }: { text: string; excerpt: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const needle = excerpt?.trim() ?? "";
  const at = needle ? text.indexOf(needle) : -1;
  useEffect(() => {
    const box = boxRef.current;
    const mark = markRef.current;
    if (box && mark) box.scrollTo({ top: Math.max(0, mark.offsetTop - box.clientHeight / 3), behavior: "smooth" });
  }, [at, needle]);
  return (
    <div ref={boxRef} dir="auto" className="relative max-h-[calc(100svh-13rem)] overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-7">
      {at < 0 ? <span className={cn("transition-opacity duration-300", needle && "opacity-60")}>{text}</span> : (
        <>
          <span className="opacity-50 transition-opacity duration-300">{text.slice(0, at)}</span>
          <motion.mark key={needle} ref={markRef} initial={{ backgroundColor: "rgba(52,211,153,0)" }} animate={{ backgroundColor: "rgba(52,211,153,.2)" }} transition={{ ...TWEEN, duration: 0.5 }}
            className="rounded bg-transparent box-decoration-clone px-0.5 text-foreground">{text.slice(at, at + needle.length)}</motion.mark>
          <span className="opacity-50 transition-opacity duration-300">{text.slice(at + needle.length)}</span>
        </>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onRestore,
  onEditValue,
}: {
  rule: PolicyRule;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRestore: () => void;
  onEditValue: (val: string) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(rule.value);

  const { values, ...presentation } = describeRule(rule, t);
  const Icon = presentation.icon;

  const state = rule.approvalState;
  const decided = state === "approved" || state === "edited";
  const stateConfig: Record<RuleApprovalState, { label: string; pill: string; dot: string }> = {
    pending: { label: t("Needs your review", "بانتظار مراجعتك"), pill: "bg-review-muted text-review", dot: "bg-review" },
    approved: { label: t("Approved", "معتمدة"), pill: "bg-eligible-muted text-eligible", dot: "bg-eligible" },
    edited: { label: t("Edited and approved", "معدّلة ومعتمدة"), pill: "bg-eligible-muted text-eligible", dot: "bg-eligible" },
    rejected: { label: t("Left out", "مستبعدة"), pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  };
  const save = () => { if (editValue.trim()) { onEditValue(editValue.trim()); setEditing(false); } };

  return (
    <div className={cn("admin-card rounded-2xl border bg-card transition-[border-color,opacity] duration-300",
      isSelected ? "border-foreground/30" : decided ? "border-eligible/25" : "border-border", state === "rejected" && "opacity-60")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-300", decided ? "bg-eligible text-eligible-foreground" : "bg-muted text-muted-foreground")}>
            <AnimatePresence initial={false} mode="wait">
              {decided
                ? <motion.span key="ok" initial={{ scale: 0.3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.3, opacity: 0 }} transition={QUICK}><Check className="size-4" strokeWidth={3} /></motion.span>
                : <motion.span key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Icon className="size-4" aria-hidden="true" /></motion.span>}
            </AnimatePresence>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className={cn("text-[15px] font-semibold tracking-tight", state === "rejected" && "line-through decoration-muted-foreground/50")}>{presentation.title}</p>
              <AnimatePresence initial={false} mode="wait">
                <motion.span key={state} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={QUICK}
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", stateConfig[state].pill)}>
                  <span className={cn("size-1.5 rounded-full", stateConfig[state].dot)} />{stateConfig[state].label}
                </motion.span>
              </AnimatePresence>
            </div>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{presentation.help}</p>

            <AnimatePresence initial={false} mode="wait">
              {editing ? (
                <motion.form key="edit" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="mt-3 flex flex-wrap items-center gap-2"
                  onSubmit={(event) => { event.preventDefault(); save(); }}>
                  <Input autoFocus aria-label={t("Rule value", "قيمة القاعدة")} value={editValue} onChange={(e) => setEditValue(e.target.value)} dir="ltr"
                    onKeyDown={(event) => { if (event.key === "Escape") { setEditing(false); setEditValue(rule.value); } }} className="h-9 min-w-0 flex-1 rounded-xl text-sm" />
                  <Button type="submit" size="sm" className="h-9 rounded-xl" disabled={!editValue.trim()}><Check className="size-4" />{t("Save", "حفظ")}</Button>
                  <Button type="button" size="sm" variant="ghost" className="h-9 rounded-xl" onClick={() => { setEditing(false); setEditValue(rule.value); }}>{t("Cancel", "إلغاء")}</Button>
                  <p className="w-full text-[11px] leading-4 text-muted-foreground">{rule.category === "window" || rule.category === "quantity" ? t("A number.", "رقم.") : t("Separate several values with commas.", "افصل بين القيم بفواصل.")}</p>
                </motion.form>
              ) : (
                <motion.div key="values" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} className="mt-3 flex flex-wrap items-center gap-1.5">
                  {values.map((value, index) => <span key={index} className="max-w-full break-words rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium leading-5"><bdi>{value}</bdi></span>)}
                </motion.div>
              )}
            </AnimatePresence>

            {rule.sourceExcerpt && (
              <>
                <button type="button" onClick={onSelect} aria-expanded={isSelected}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                  <FileText className="size-3.5" aria-hidden="true" />{isSelected ? t("Hide where this came from", "إخفاء المصدر") : t("Show where this came from", "عرض المصدر في السياسة")}
                  <ChevronDown className={cn("size-3.5 transition-transform duration-300", isSelected && "rotate-180")} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {isSelected && (
                    <motion.div key="quote" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
                      <blockquote dir="auto" className="mt-2.5 border-s-2 border-eligible/50 ps-3 text-xs leading-6 text-muted-foreground">{rule.sourceExcerpt}</blockquote>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>

      {!editing && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 px-4 py-2.5 sm:px-5">
          {state === "pending" && (
            <>
              <Button size="sm" onClick={onApprove} className="h-8 rounded-lg bg-eligible text-eligible-foreground transition-transform hover:bg-eligible/90 active:scale-[.97]"><Check className="size-4" />{t("Approve", "اعتماد")}</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setEditing(true)}><Edit3 className="size-3.5" />{t("Edit", "تعديل")}</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={onReject}><X className="size-3.5" />{t("Leave out", "استبعاد")}</Button>
            </>
          )}
          {decided && (
            <>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setEditing(true)}><Edit3 className="size-3.5" />{t("Edit", "تعديل")}</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground" onClick={onRestore}><RotateCcw className="size-3.5" />{t("Undo", "تراجع")}</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto" onClick={onReject}><X className="size-3.5" />{t("Leave out", "استبعاد")}</Button>
            </>
          )}
          {state === "rejected" && (
            <>
              <p className="flex-1 text-xs text-muted-foreground">{t("This rule won't be part of your policy.", "لن تكون هذه القاعدة ضمن سياستك.")}</p>
              <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={onRestore}><RotateCcw className="size-3.5" />{t("Bring back", "استرجاع")}</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
