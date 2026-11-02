"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  // AlertTriangle, UserRound: used by the old warning and summary (commented out)
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { QUICK, TWEEN } from "@/components/desk/primitives";
import { Key, PageHeader } from "@/components/desk/page-header";
import { SuccessMark } from "@/components/integrations/connect-stepper";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  customerSentence,
  describeRule,
} from "@/components/policy-rule-labels";
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

type Draft = {
  id: string;
  name: string;
  rules: PolicyRule[];
  updated_at: string;
};
type T = (en: string, ar: string) => string;

const isApproved = (rule: PolicyRule) =>
  rule.approvalState === "approved" || rule.approvalState === "edited";

export function PolicyReviewPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { workspace, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  // Rule that was just approved: its row glows briefly and its check draws in.
  const [flashRule, setFlashRule] = useState<string | null>(null);
  const [showLeftOut, setShowLeftOut] = useState(false);

  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  // Latest draft for callbacks that run later (the Undo in a toast).
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const activeScope = useRef("");
  const scope = `${workspace?.storeId ?? ""}:${draftId}`;
  activeScope.current = scope;
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  useEffect(() => {
    let active = true;
    setDraft(null);
    setLoading(true);
    setLoadError(false);
    setActionError(null);
    setSavingRule(null);
    setPublishing(false);
    setPublishedVersion(null);
    lock.current = false;
    if (authLoading)
      return () => {
        active = false;
      };
    if (!supabase || !draftId || !workspace?.storeId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase!
          .from("policy_drafts")
          .select("id,name,rules,updated_at")
          .eq("id", draftId)
          .eq("store_id", workspace.storeId)
          .maybeSingle();
        if (error) throw error;
        if (active) {
          setDraft(data as Draft | null);
          setLoading(false);
        }
      } catch {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [draftId, workspace?.storeId, authLoading, reload]);

  // Writes the draft's rules, guarded by updated_at so a change made in
  // another tab is never overwritten. `key` is "<ruleId>:<action>" so each
  // button can show its own progress. Returns true when saved.
  const saveRules = async (rules: PolicyRule[], key: string) => {
    const snapshot = draftRef.current;
    if (!supabase || !snapshot || !workspace || !canManage || lock.current) return false;
    if (!rules.length) {
      setActionError("rules_required");
      return false;
    }
    const target = scope;
    lock.current = true;
    setSavingRule(key);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from("policy_drafts")
        .update({ rules })
        .eq("id", snapshot.id)
        .eq("store_id", workspace.storeId)
        .eq("updated_at", snapshot.updated_at)
        .select("id,name,rules,updated_at")
        .maybeSingle();
      if (activeScope.current !== target) return false;
      if (error) throw error;
      if (!data) {
        setActionError("draft_changed");
        return false;
      }
      setDraft(data as Draft);
      return true;
    } catch {
      if (activeScope.current === target) setActionError("save_failed");
      return false;
    } finally {
      if (activeScope.current === target) {
        lock.current = false;
        setSavingRule(null);
      }
    }
  };

  const reviewRule = async (ruleId: string, approve: boolean) => {
    const snapshot = draftRef.current;
    if (!snapshot || lock.current) return;
    const index = snapshot.rules.findIndex((r) => r.id === ruleId);
    const removed = snapshot.rules[index];
    const rules = approve
      ? snapshot.rules.map((r) =>
          r.id === ruleId ? { ...r, approvalState: "approved" as const } : r,
        )
      : snapshot.rules.filter((r) => r.id !== ruleId);
    const saved = await saveRules(rules, `${ruleId}:${approve ? "approve" : "leave"}`);
    if (!saved) return;
    if (approve) {
      setFlashRule(ruleId);
      window.setTimeout(() => setFlashRule((id) => (id === ruleId ? null : id)), 1400);
      return;
    }
    if (removed)
      toast(t("Rule left out", "تم استبعاد القاعدة"), {
        description: describeRule(removed, t).title,
        action: {
          label: t("Undo", "تراجع"),
          onClick: () => void restoreRule(removed, index),
        },
      });
  };

  // Undo of "Leave out": put the rule back where it was, with its state.
  const restoreRule = async (rule: PolicyRule, index: number) => {
    const current = draftRef.current;
    if (!current || current.rules.some((r) => r.id === rule.id)) return;
    const rules = [...current.rules];
    rules.splice(Math.min(index, rules.length), 0, rule);
    await saveRules(rules, `${rule.id}:restore`);
  };

  if (loading)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  if (loadError)
    return (
      <div
        translate="no"
        role="alert"
        className="flex flex-col items-center gap-4 py-20 text-center"
      >
        <AlertCircle className="size-8 text-review" />
        <p className="text-sm">
          {t(
            "We couldn’t load this policy. Your draft has not been changed.",
            "تعذّر تحميل السياسة. لم تتغير المسودة.",
          )}
        </p>
        <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
          <span>{t("Try again", "إعادة المحاولة")}</span>
        </Button>
      </div>
    );
  if (!draft)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("Draft not found.", "لم يتم العثور على المسودة.")}
        </p>
        <Button variant="outline" onClick={() => router.push("/app/policies")}>
          {t("Back to policies", "العودة إلى السياسات")}
        </Button>
      </div>
    );

  const live = draft.rules.filter(isApproved);
  const pending = draft.rules.filter(
    (rule) => !isApproved(rule) && rule.approvalState !== "rejected",
  );
  const leftOut = draft.rules.filter(
    (rule) => rule.approvalState === "rejected",
  );
  // Unchanged rule: nothing publishes while any rule is still undecided or rejected.
  const unresolved =
    draft.rules.length === 0 || draft.rules.some((rule) => !isApproved(rule));
  /* Plain sentences for the old summary list (now shown inside each rule):
  const sentences = live
    .map((rule) => ({
      id: rule.id,
      text: customerSentence(rule, t),
      toYou: rule.category === "fallback",
    }))
    .filter((entry) => entry.text); */

  const publish = async () => {
    if (!supabase || unresolved || !canManage || lock.current || !workspace)
      return;
    const target = scope;
    lock.current = true;
    setPublishing(true);
    setActionError(null);
    try {
      const { data, error } = await supabase.rpc("publish_policy_draft", {
        p_draft_id: draft.id,
      });
      if (activeScope.current !== target) return;
      const version = data?.[0]?.version_label as string | undefined;
      if (error || !version) {
        setActionError("publish_failed");
        return;
      }
      // Success is recorded before the optional WhatsApp notification. It must never invite a second publish.
      setPublishedVersion(version);
      void refreshWorkspace();
      const onboardingToken = searchParams.get("onboarding");
      if (onboardingToken) {
        try {
          const { error: notifyError } = await supabase.functions.invoke(
            "whatsapp-onboarding",
            { body: { token: onboardingToken, action: "policy_published" } },
          );
          if (notifyError) throw notifyError;
        } catch {
          toast.info(
            t(
              "The policy is live, but WhatsApp confirmation could not be delivered.",
              "تم نشر السياسة، لكن تعذّر إرسال التأكيد عبر واتساب.",
            ),
          );
        }
      }
    } catch {
      if (activeScope.current === target) setActionError("publish_failed");
    } finally {
      if (activeScope.current === target) {
        lock.current = false;
        setPublishing(false);
      }
    }
  };

  // Approve turns into "Approved" with a check that draws in; Leave out
  // shows its own progress. Both sit on the rule's line, not under it.
  const ruleActions = (rule: PolicyRule) => {
    const approving = savingRule === `${rule.id}:approve`;
    const leaving = savingRule === `${rule.id}:leave`;
    return (
      <div className="flex shrink-0 items-center gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {isApproved(rule) ? (
            <motion.span
              key="approved"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={QUICK}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-eligible"
            >
              <DrawnCheck play={flashRule === rule.id} />
              {t("Approved", "معتمدة")}
            </motion.span>
          ) : (
            <motion.span
              key="approve"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={QUICK}
            >
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full px-3.5"
                onClick={() => void reviewRule(rule.id, true)}
                disabled={Boolean(savingRule) || publishing}
              >
                {approving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>
                  {approving ? t("Saving…", "جارٍ الحفظ…") : t("Approve rule", "اعتماد القاعدة")}
                </span>
              </Button>
            </motion.span>
          )}
        </AnimatePresence>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 rounded-full px-3 text-muted-foreground hover:text-foreground"
          disabled={Boolean(savingRule) || publishing || draft.rules.length <= 1}
          onClick={() => void reviewRule(rule.id, false)}
        >
          {leaving && <Loader2 className="size-3.5 animate-spin" />}
          <span>{leaving ? t("Removing…", "جارٍ الاستبعاد…") : t("Leave out", "استبعاد")}</span>
        </Button>
      </div>
    );
  };

  /* ── Published ── */
  if (publishedVersion)
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={TWEEN}
        translate="no"
        className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-12 text-center"
      >
        <SuccessMark />
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          {t("Your policy is live", "سياستك مفعّلة الآن")}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {t(
            `${publishedVersion} now decides every return request, with ${live.length} rules.`,
            `الإصدار ${publishedVersion} يقرر الآن كل طلب إرجاع، بعدد ${live.length} قواعد.`,
          )}
        </p>
        <div className="mt-6 grid w-full max-w-sm gap-2 text-start">
          {[
            t(
              "Applied the same way to every customer",
              "تُطبّق بالطريقة نفسها على كل عميل",
            ),
            t(
              "Every decision keeps the wording it was based on",
              "كل قرار يحتفظ بالنص الذي استند إليه",
            ),
            t(
              "Editing later creates a new version",
              "أي تعديل لاحق ينشئ إصدارًا جديدًا",
            ),
          ].map((line, index) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...QUICK, delay: 0.4 + index * 0.08 }}
              className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm"
            >
              <Check className="size-4 shrink-0 text-eligible" />
              {line}
            </motion.p>
          ))}
        </div>
        <div className="mt-7 flex w-full max-w-sm flex-col gap-2">
          <Button asChild className="group h-11 rounded-xl">
            <Link href="/app">
              {t("Continue setup", "متابعة الإعداد")}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-10 rounded-xl text-muted-foreground"
          >
            <Link href="/app/policies">
              {t("View policies", "عرض السياسات")}
            </Link>
          </Button>
        </div>
      </motion.div>
    );

  return (
    <div
      translate="no"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4"
    >
      {/* ── Header ── */}
      <PageHeader
        icon={FileText}
        title={t("One last look", "نظرة أخيرة")}
        actions={
          <>
            <ol
              className="flex items-center gap-1.5 text-xs"
              aria-label={t("Steps", "الخطوات")}
            >
              {[
                t("Add policy", "إضافة السياسة"),
                t("Review rules", "مراجعة القواعد"),
                t("Publish", "النشر"),
              ].map((label, index) => (
                <li key={label} className="flex items-center gap-1.5">
                  {index > 0 && (
                    <span aria-hidden="true" className="h-px w-4 bg-eligible" />
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                      index < 2
                        ? "border-eligible/25 bg-eligible-muted text-eligible"
                        : "border-foreground/20 bg-foreground/[.06] text-foreground",
                    )}
                  >
                    {index < 2 ? (
                      <Check className="size-3.5" strokeWidth={2.75} />
                    ) : (
                      <span className="tabular-nums opacity-70">3</span>
                    )}
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </>
        }
      >
        <span dir="auto">
          {/* Was: name · "N rules ready to go live" (wrong while some were undecided). */}
          <Key>{draft.name}</Key>
        </span>
      </PageHeader>

      {/* One clear status line (owner, 2026-11-02) instead of a warning
          paragraph plus a separate "What this means for a customer" list,
          which repeated the rules. Each rule's plain sentence now opens
          with the rule itself. */}
      <ReviewProgress
        approved={live.length}
        total={draft.rules.length}
        pending={pending.length}
        canManage={canManage}
        onShowNext={() => {
          const next = pending[0];
          if (!next) return;
          setOpenRule(next.id);
          document.getElementById(`rule-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        t={t}
      />

      {!canManage && (
        <p role="status" className="border-s-2 border-border ps-4 text-sm">
          {t(
            "Only a store owner or admin can approve rules and publish this policy.",
            "يمكن لمالك المتجر أو المسؤول فقط اعتماد القواعد ونشر السياسة.",
          )}
        </p>
      )}
      {actionError && (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-review/30 bg-review-muted/40 p-4 text-sm leading-6"
        >
          <p>
            {actionError === "draft_changed"
              ? t(
                  "This draft changed in another tab. Load its latest version before reviewing again.",
                  "تغيرت المسودة في تبويب آخر. حمّل أحدث نسخة قبل مراجعتها مجددًا.",
                )
              : actionError === "rules_required"
                ? t(
                    "Keep at least one rule. You can edit the policy before publishing.",
                    "أبقِ قاعدة واحدة على الأقل. يمكنك تعديل السياسة قبل النشر.",
                  )
                : actionError === "publish_failed"
                  ? t(
                      "We couldn’t confirm publication. Reload the policies list to check whether it published before trying again.",
                      "تعذّر تأكيد النشر. أعد تحميل قائمة السياسات للتحقق من النتيجة قبل المحاولة مجددًا.",
                    )
                  : t(
                      "We couldn’t save your decision. The rule is unchanged. Please try again.",
                      "تعذّر حفظ قرارك. لم تتغير القاعدة؛ حاول مجددًا.",
                    )}
          </p>
          {actionError === "draft_changed" ? (
            <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
              <span>{t("Load latest draft", "تحميل أحدث مسودة")}</span>
            </Button>
          ) : actionError === "publish_failed" ? (
            <Button
              variant="outline"
              onClick={() => router.push("/app/policies")}
            >
              <span>{t("Check policies", "التحقق من السياسات")}</span>
            </Button>
          ) : null}
        </div>
      )}
      {/* ── In plain words ── moved into each rule (owner, 2026-11-02). Kept for revert:

      {sentences.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TWEEN, delay: 0.05 }}
          className="border-t border-border pt-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
            {t("What this means for a customer", "ماذا يعني هذا للعميل")}
          </p>
          <ul className="mt-3.5 space-y-2.5">
            <AnimatePresence>
            {sentences.map((entry, index) => (
              <motion.li
                key={entry.id}
                layout="position"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ ...QUICK, delay: 0.15 + index * 0.07, layout: { ...TWEEN, duration: 0.4 } }}
                className="flex items-start gap-3 text-[15px] leading-6"
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                    entry.toYou
                      ? "bg-review-muted text-review"
                      : "bg-eligible-muted text-eligible",
                  )}
                >
                  {entry.toYou ? (
                    <UserRound className="size-3" />
                  ) : (
                    <Check className="size-3" strokeWidth={3} />
                  )}
                </span>
                <span>{entry.text}</span>
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      )}

      */}
      {/* ── The rules behind it ── open list, decisions inline (owner, 2026-11-02).
          Previous boxed list with an action row under each rule: git 23bfbe7. */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
          {t("The rules behind it", "القواعد التي تقف خلفها")}
        </h2>
        <ul className="mt-2 border-t border-border">
          <AnimatePresence>
          {/* Draft order, so a rule stays where it is when you approve it
              (was grouped approved-first, which made rows jump under the cursor). */}
          {draft.rules.map((rule, index) => (
            <motion.li
              key={rule.id}
              id={`rule-${rule.id}`}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, x: 16, transition: { ...TWEEN, duration: 0.34 } }}
              transition={{ ...QUICK, delay: 0.2 + index * 0.05, layout: { ...TWEEN, duration: 0.4 } }}
              className="overflow-hidden border-b border-border"
            >
              <RuleLine
                rule={rule}
                open={openRule === rule.id}
                onToggle={() =>
                  setOpenRule(openRule === rule.id ? null : rule.id)
                }
                t={t}
                flash={flashRule === rule.id}
                actions={canManage ? ruleActions(rule) : null}
              />
            </motion.li>
          ))}
          </AnimatePresence>
        </ul>

        {leftOut.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              aria-expanded={showLeftOut}
              onClick={() => setShowLeftOut((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(
                `${leftOut.length} left out of this policy`,
                `${leftOut.length} مستبعدة من هذه السياسة`,
              )}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0,0,1)]",
                  showLeftOut && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {showLeftOut && (
                <motion.ul
                  key="left-out"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ ...TWEEN, duration: 0.42 }}
                  className="overflow-hidden"
                >
                  {leftOut.map((rule, n) => (
                    <motion.li
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...TWEEN, duration: 0.32, delay: 0.08 + n * 0.05 }}
                      key={rule.id}
                      className="mt-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground line-through decoration-muted-foreground/40"
                    >
                      {describeRule(rule, t).title}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Publish ── */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card/95 p-3 ps-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)] backdrop-blur max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:ps-5">
        <AnimatePresence mode="wait" initial={false}>
          {!unresolved && canManage ? (
            <motion.p
              key="ready"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={QUICK}
              className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-muted-foreground"
            >
              <span className="mt-0.5 text-eligible"><DrawnCheck play /></span>
              <span>
                <span className="font-medium text-foreground">{t("All rules decided.", "تم البت في كل القواعد.")}</span>{" "}
                {t("Publishing freezes this version.", "النشر يثبّت هذا الإصدار.")}
              </span>
            </motion.p>
          ) : (
            <motion.p
              key="frozen"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={QUICK}
              className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-muted-foreground"
            >
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {t(
                "Once published, this version is frozen. Every decision keeps the exact rules it was made with.",
                "بعد النشر يُثبَّت هذا الإصدار. كل قرار يحتفظ بالقواعد التي صدر بها.",
              )}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="h-11 rounded-xl text-muted-foreground"
            onClick={() => router.push("/app/policies")}
            disabled={publishing}
          >
            {t("Not now", "ليس الآن")}
          </Button>
          <Button
            onClick={() => void publish()}
            disabled={
              unresolved ||
              publishing ||
              Boolean(savingRule) ||
              !canManage ||
              actionError === "publish_failed" ||
              actionError === "draft_changed"
            }
            className="group h-11 rounded-xl px-5 transition-transform active:scale-[.98]"
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>
              {publishing
                ? t("Publishing…", "جارٍ النشر…")
                : t("Publish policy", "نشر السياسة")}
            </span>
            {!publishing && (
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "4 of 5 rules approved", a thin bar that fills as you decide, and a
 *  link to the next undecided rule. Turns into a calm "ready" line at 100%. */
function ReviewProgress({ approved, total, pending, canManage, onShowNext, t }: {
  approved: number; total: number; pending: number; canManage: boolean; onShowNext: () => void; t: T;
}) {
  const done = total > 0 && approved === total;
  const share = total ? approved / total : 0;
  return (
    <div className="space-y-2.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={done ? "done" : `n${approved}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={QUICK}
            className="flex items-center gap-2"
          >
            {done ? (
              <>
                <span className="text-eligible"><DrawnCheck play /></span>
                <span className="font-medium">{t("All rules approved. Ready to publish.", "كل القواعد معتمدة. جاهزة للنشر.")}</span>
              </>
            ) : (
              <>
                <span className="font-medium tabular-nums">
                  {t(`${approved} of ${total} rules approved`, `${approved} من ${total} قواعد معتمدة`)}
                </span>
                {pending > 0 && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {pending === 1
                      ? t("1 needs your decision", "قاعدة واحدة تنتظر قرارك")
                      : t(`${pending} need your decision`, `${pending} قواعد تنتظر قرارك`)}
                  </span>
                )}
              </>
            )}
          </motion.p>
        </AnimatePresence>
        {!done && pending > 0 && canManage && (
          <button
            type="button"
            onClick={onShowNext}
            className="text-sm font-medium text-review underline decoration-review/40 underline-offset-4 hover:decoration-review"
          >
            {t("Show me", "ورّني")}
          </button>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", done ? "bg-eligible" : "bg-foreground")}
          initial={false}
          animate={{ width: `${share * 100}%` }}
          transition={{ ...TWEEN, duration: 0.6 }}
        />
      </div>
    </div>
  );
}

/** A check mark that draws itself when `play` is set (just approved). */
function DrawnCheck({ play }: { play: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <motion.path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={play ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: [0.2, 0, 0, 1], delay: 0.08 }}
      />
    </svg>
  );
}

function RuleLine({
  rule,
  open,
  onToggle,
  t,
  actions,
  flash = false,
}: {
  rule: PolicyRule;
  open: boolean;
  onToggle: () => void;
  t: T;
  actions?: ReactNode;
  flash?: boolean;
}) {
  const { title, icon: Icon, values } = describeRule(rule, t);
  const pending = rule.approvalState === "pending";
  const sentence = customerSentence(rule, t);
  const expandable = Boolean(sentence || rule.sourceExcerpt);
  // Give every icon line a length of 1 so the CSS can trace it from start to
  // end over the whole animation (Lucide doesn't pass pathLength to its
  // children). Until this runs the icon simply shows, so there is no flash.
  const iconRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tile = iconRef.current;
    if (!tile) return;
    tile.querySelectorAll("path, line, polyline, polygon, rect, circle, ellipse").forEach((el) => el.setAttribute("pathLength", "1"));
    tile.dataset.draw = "";
  }, []);
  return (
    <div className={cn("rule-item", flash && "rule-item-flash")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5 sm:flex-nowrap">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          disabled={!expandable}
          data-open={open || undefined}
          className="rule-row flex min-w-0 flex-1 basis-64 items-center gap-3.5 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Round, borderless icon: it draws itself in, lifts on hover and
              turns solid while the rule is open (see .rule-icon in index.css). */}
          <span
            ref={iconRef}
            className={cn(
              "rule-icon grid size-9 shrink-0 place-items-center rounded-full",
              pending ? "text-review" : "text-muted-foreground",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {title}
              {rule.approvalState === "edited" && (
                <span className="rounded-full bg-muted px-2 py-px text-[10px] font-medium text-muted-foreground">
                  {t("Edited by you", "عدّلتها أنت")}
                </span>
              )}
              {pending && (
                <span className="rounded-full bg-review-muted px-2 py-px text-[10px] font-medium text-review">
                  {t("Not decided", "لم يُقرَّر")}
                </span>
              )}
            </span>
            {/* Values as one quiet line instead of bordered chips. */}
            <span className="mt-0.5 block break-words text-[13px] leading-6 text-muted-foreground">
              {values.map((value, index) => (
                <span key={index}>
                  {index > 0 && <span aria-hidden="true" className="mx-1.5 opacity-50">·</span>}
                  <bdi>{value}</bdi>
                </span>
              ))}
            </span>
          </span>
          {expandable && (
            <span className="rule-chevron grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground" aria-hidden="true">
              <ChevronDown className="size-4" />
            </span>
          )}
        </button>
        {actions && <div className="ms-auto">{actions}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div
            key="quote"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...TWEEN, duration: 0.42 }}
            className="overflow-hidden"
          >
            {/* The quote follows the opening a beat later, sliding in softly. */}
            <motion.div
              initial={{ opacity: 0, y: -8, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4, filter: "blur(2px)", transition: { ...TWEEN, duration: 0.18 } }}
              transition={{ ...TWEEN, duration: 0.36, delay: 0.1 }}
              className="pb-4 ps-[3.125rem]"
            >
              {sentence && (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t("What your customer gets", "وش يعني لعميلك")}
                  </p>
                  <p className="mt-1 text-sm leading-6">{sentence}</p>
                </>
              )}
              {rule.sourceExcerpt && (
                <>
                  <p className={cn("text-[11px] font-medium text-muted-foreground", sentence && "mt-3")}>
                    {t("From your policy", "من سياستك")}
                  </p>
                  <blockquote
                    dir="auto"
                    className="mt-1 border-s-2 border-eligible/50 ps-3 text-[13px] leading-6 text-muted-foreground"
                  >
                    {rule.sourceExcerpt}
                  </blockquote>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
