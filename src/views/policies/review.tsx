"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, ArrowRight, Check, ChevronDown, FileText, Loader2, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { Key, PageHeader } from "@/components/desk/page-header";
import { SuccessMark } from "@/components/integrations/connect-stepper";
import { useLanguage } from "@/components/language-provider";
import { customerSentence, describeRule } from "@/components/policy-rule-labels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PolicyRule } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { refreshWorkspace } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

/*
 * The last look before a policy goes live. It reads as what will actually
 * happen: first in plain sentences ("what a customer will be told"), then the
 * rules behind them. Rules the merchant left out are shown apart, so nobody
 * mistakes them for part of the policy.
 */

type Draft = { id: string; name: string; rules: PolicyRule[] };
type T = (en: string, ar: string) => string;

const isApproved = (rule: PolicyRule) => rule.approvalState === "approved" || rule.approvalState === "edited";

export function PolicyReviewPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [showLeftOut, setShowLeftOut] = useState(false);

  useEffect(() => {
    let active = true;
    if (!supabase || !draftId) { setLoading(false); return; }
    void supabase.from("policy_drafts").select("id, name, rules").eq("id", draftId).maybeSingle()
      .then((result: { data: unknown }) => { if (active) { setDraft(result.data as Draft | null); setLoading(false); } });
    return () => { active = false; };
  }, [draftId]);

  if (loading) return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-2.5"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80 max-w-full" /></div>
      <Skeleton className="h-44 rounded-2xl" />
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[68px] rounded-2xl" />)}</div>
    </div>
  );
  if (!draft) return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t("Draft not found.", "لم يتم العثور على المسودة.")}</p>
      <Button variant="outline" onClick={() => router.push("/app/policies")}>{t("Back to policies", "العودة إلى السياسات")}</Button>
    </div>
  );

  const live = draft.rules.filter(isApproved);
  const pending = draft.rules.filter((rule) => rule.approvalState === "pending");
  const leftOut = draft.rules.filter((rule) => rule.approvalState === "rejected");
  // Unchanged rule: nothing publishes while any rule is still undecided or rejected.
  const unresolved = draft.rules.some((rule) => !isApproved(rule));
  const sentences = live.map((rule) => ({ id: rule.id, text: customerSentence(rule, t), toYou: rule.category === "fallback" })).filter((entry) => entry.text);

  const publish = async () => {
    if (!supabase || unresolved || publishing) return;
    setPublishing(true);
    const { data, error } = await supabase.rpc("publish_policy_draft", { p_draft_id: draft.id });
    setPublishing(false);
    const version = data?.[0]?.version_label as string | undefined;
    if (error || !version) return toast.error(t("Could not publish this policy.", "تعذّر نشر هذه السياسة."));
    const onboardingToken = searchParams.get("onboarding");
    if (onboardingToken) {
      const { error: notifyError } = await supabase.functions.invoke("whatsapp-onboarding", {
        body: { token: onboardingToken, action: "policy_published" },
      });
      if (notifyError) toast.info(t("The policy is live, but WhatsApp confirmation could not be delivered.", "تم نشر السياسة، لكن تعذّر إرسال التأكيد عبر واتساب."));
    }
    setPublishedVersion(version);
    void refreshWorkspace();
  };

  /* ── Published ── */
  if (publishedVersion) return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN}
      className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-12 text-center">
      <SuccessMark />
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">{t("Your policy is live", "سياستك مفعّلة الآن")}</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {t(`${publishedVersion} now decides every return request, with ${live.length} rules.`, `الإصدار ${publishedVersion} يقرر الآن كل طلب إرجاع، بعدد ${live.length} قواعد.`)}
      </p>
      <div className="mt-6 grid w-full max-w-sm gap-2 text-start">
        {[t("Applied the same way to every customer", "تُطبّق بالطريقة نفسها على كل عميل"), t("Every decision keeps the wording it was based on", "كل قرار يحتفظ بالنص الذي استند إليه"), t("Editing later creates a new version", "أي تعديل لاحق ينشئ إصدارًا جديدًا")].map((line, index) => (
          <motion.p key={line} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...QUICK, delay: 0.4 + index * 0.08 }}
            className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm"><Check className="size-4 shrink-0 text-eligible" />{line}</motion.p>
        ))}
      </div>
      <div className="mt-7 flex w-full max-w-sm flex-col gap-2">
        <Button asChild className="group h-11 rounded-xl"><Link href="/app">{t("Continue setup", "متابعة الإعداد")}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" /></Link></Button>
        <Button asChild variant="ghost" className="h-10 rounded-xl text-muted-foreground"><Link href="/app/policies">{t("View policies", "عرض السياسات")}</Link></Button>
      </div>
    </motion.div>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4">
      {/* ── Header ── */}
      <PageHeader icon={FileText} title={t("One last look", "نظرة أخيرة")}
        actions={<>
        <ol className="flex items-center gap-1.5 text-xs" aria-label={t("Steps", "الخطوات")}>
          {[t("Add policy", "إضافة السياسة"), t("Review rules", "مراجعة القواعد"), t("Publish", "النشر")].map((label, index) => (
            <li key={label} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-eligible" />}
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium", index < 2 ? "border-eligible/25 bg-eligible-muted text-eligible" : "border-foreground/20 bg-foreground/[.06] text-foreground")}>
                {index < 2 ? <Check className="size-3.5" strokeWidth={2.75} /> : <span className="tabular-nums opacity-70">3</span>}{label}
              </span>
            </li>
          ))}
        </ol>
        </>}>
        <span dir="auto"><Key>{draft.name}</Key>{" · "}{t(`${live.length} rules ready to go live`, `${live.length} قواعد جاهزة للتفعيل`)}{leftOut.length > 0 && t(`, ${leftOut.length} left out`, `، و${leftOut.length} مستبعدة`)}</span>
      </PageHeader>

      {unresolved && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={QUICK} role="alert" className="flex gap-3 rounded-2xl border border-review/25 bg-review-muted/50 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-review" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{pending.length > 0 ? t(`${pending.length} rules still need your decision`, `${pending.length} قواعد ما زالت بانتظار قرارك`) : t("A rule was left out", "توجد قاعدة مستبعدة")}</p>
            <p className="mt-0.5 text-[13px] leading-6 text-muted-foreground">{t("A policy can only be published when every rule is approved. Create the policy again without the rules you don't want.", "لا تُنشر السياسة إلا إذا كانت كل قاعدة معتمدة. أنشئ السياسة من جديد من دون القواعد التي لا تريدها.")}</p>
          </div>
        </motion.div>
      )}

      {/* ── In plain words ── */}
      {sentences.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.05 }} className="admin-card rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("What this means for a customer", "ماذا يعني هذا للعميل")}</p>
          <ul className="mt-3.5 space-y-2.5">
            {sentences.map((entry, index) => (
              <motion.li key={entry.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...QUICK, delay: 0.15 + index * 0.07 }} className="flex items-start gap-3 text-[15px] leading-6">
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", entry.toYou ? "bg-review-muted text-review" : "bg-eligible-muted text-eligible")}>
                  {entry.toYou ? <UserRound className="size-3" /> : <Check className="size-3" strokeWidth={3} />}
                </span>
                <span>{entry.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* ── The rules behind it ── */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("The rules behind it", "القواعد التي تقف خلفها")}</h2>
        <ul className="admin-card mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {[...live, ...pending].map((rule, index) => (
            <motion.li key={rule.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.2 + index * 0.05 }} className="border-b border-border last:border-b-0">
              <RuleLine rule={rule} open={openRule === rule.id} onToggle={() => setOpenRule(openRule === rule.id ? null : rule.id)} t={t} />
            </motion.li>
          ))}
        </ul>

        {leftOut.length > 0 && (
          <div className="mt-3">
            <button type="button" aria-expanded={showLeftOut} onClick={() => setShowLeftOut((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              {t(`${leftOut.length} left out of this policy`, `${leftOut.length} مستبعدة من هذه السياسة`)}
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", showLeftOut && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {showLeftOut && (
                <motion.ul key="left-out" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
                  {leftOut.map((rule) => (
                    <li key={rule.id} className="mt-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground line-through decoration-muted-foreground/40">{describeRule(rule, t).title}</li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Publish ── */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card/95 p-3 ps-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)] backdrop-blur max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:ps-5">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {t("Once published, this version is frozen. Every decision keeps the exact rules it was made with.", "بعد النشر يُثبَّت هذا الإصدار. كل قرار يحتفظ بالقواعد التي صدر بها.")}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-11 rounded-xl text-muted-foreground" onClick={() => router.push("/app/policies")} disabled={publishing}>{t("Not now", "ليس الآن")}</Button>
          <Button onClick={() => void publish()} disabled={unresolved || publishing} className="group h-11 rounded-xl px-5 transition-transform active:scale-[.98]">
            {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
            {publishing ? t("Publishing…", "جارٍ النشر…") : t("Publish policy", "نشر السياسة")}
            {!publishing && <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RuleLine({ rule, open, onToggle, t }: { rule: PolicyRule; open: boolean; onToggle: () => void; t: T }) {
  const { title, icon: Icon, values } = describeRule(rule, t);
  const pending = rule.approvalState === "pending";
  return (
    <>
      <button type="button" aria-expanded={open} onClick={onToggle} disabled={!rule.sourceExcerpt}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition-colors enabled:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", pending ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}><Icon className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {title}
            {rule.approvalState === "edited" && <span className="rounded-full bg-muted px-2 py-px text-[10px] font-medium text-muted-foreground">{t("Edited by you", "عدّلتها أنت")}</span>}
            {pending && <span className="rounded-full bg-review-muted px-2 py-px text-[10px] font-medium text-review">{t("Not decided", "لم يُقرَّر")}</span>}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {values.map((value, index) => <span key={index} className="max-w-full break-words rounded-lg border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium leading-5"><bdi>{value}</bdi></span>)}
          </span>
        </span>
        {rule.sourceExcerpt && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && rule.sourceExcerpt && (
          <motion.div key="quote" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 ps-[4.125rem] sm:px-5 sm:ps-[4.375rem]">
              <p className="text-[11px] font-medium text-muted-foreground">{t("From your policy", "من سياستك")}</p>
              <blockquote dir="auto" className="mt-1 border-s-2 border-eligible/50 ps-3 text-[13px] leading-6 text-muted-foreground">{rule.sourceExcerpt}</blockquote>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
