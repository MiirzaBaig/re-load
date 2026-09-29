"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDelayedLoad } from "@/hooks/use-delayed-load";
import { OverviewPageSkeleton } from "@/components/merchant-skeletons";
import { Button } from "@/components/ui/button";
import { OutcomeBadge, CaseStatusBadge } from "@/components/outcome-badge";
import { services } from "@/lib/services";
import { formatDate } from "@/lib/domain";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Circle,
  FileText,
  Link2,
  Package,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { StoreIdentity } from "@/components/store-identity";
import { Tone } from "@/components/heading-accent";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SetupStepId = "policy" | "store" | "return";

export function OverviewPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const loaded = useDelayedLoad(280);

  const cases = useMemo(() => services.getCases(), []);
  const policy = useMemo(() => services.getPublishedPolicy(), []);
  const connections = useMemo(() => services.getConnections(), []);
  const drafts = useMemo(() => services.getDrafts(), []);
  const storeName = services.getStoreName();

  const sallaConn = connections.find((c) => c.platformId === "salla");
  const storeConnected = sallaConn?.state === "connected";
  const hasPolicy = Boolean(policy);
  const setupComplete = hasPolicy;

  const manualReviewCases = cases.filter(
    (c) => c.outcome === "MANUAL_REVIEW" && c.caseStatus === "OPEN",
  );
  const openCases = cases.filter((c) => c.caseStatus === "OPEN");
  const resolvedCases = cases.filter((c) => c.caseStatus === "RESOLVED");
  const recentCases = [...cases]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const eligibleCount = cases.filter((c) => c.outcome === "ELIGIBLE").length;
  const notEligibleCount = cases.filter(
    (c) => c.outcome === "NOT_ELIGIBLE",
  ).length;
  const reviewCount = cases.filter((c) => c.outcome === "MANUAL_REVIEW").length;
  const caseTotal = cases.length;
  const eligiblePct =
    caseTotal === 0 ? null : Math.round((eligibleCount / caseTotal) * 100);

  const setupSteps: {
    id: SetupStepId;
    done: boolean;
    title: string;
    body: string;
    cta: string;
    href: string;
    icon: typeof FileText;
  }[] = [
    {
      id: "policy",
      done: hasPolicy,
      title: t("Publish a return policy", "انشر سياسة إرجاع"),
      body: t(
        "Turn your rules into decisions customers can trust.",
        "حوّل قواعدك إلى قرارات يثق بها العملاء.",
      ),
      cta: drafts.length
        ? t("Review drafts", "مراجعة المسودات")
        : t("Create policy", "إنشاء سياسة"),
      href: drafts.length ? "/app/policies" : "/app/policies/new",
      icon: FileText,
    },
    {
      id: "store",
      done: storeConnected,
      title: t("Connect your store", "اربط متجرك"),
      body: t(
        "Pull order facts from your store so answers stay grounded.",
        "اسحب بيانات الطلب من متجرك لتبقى الإجابات مبنية على حقائق.",
      ),
      cta: storeConnected
        ? t("Manage connection", "إدارة الربط")
        : t("Connect store", "ربط المتجر"),
      href: "/app/integrations",
      icon: Plug,
    },
    {
      id: "return",
      done: caseTotal > 0,
      title: t("Try a customer return", "جرّب طلب إرجاع"),
      body: t(
        "Walk the customer path with a sample order.",
        "جرّب مسار العميل بطلب تجريبي.",
      ),
      cta: t("Open return flow", "فتح مسار الإرجاع"),
      href: "/return",
      icon: Link2,
    },
  ];

  const doneCount = setupSteps.filter((s) => s.done).length;
  const nextStep = setupSteps.find((s) => !s.done) ?? setupSteps[0];

  const readiness = !hasPolicy
    ? {
        label: t("Setup incomplete", "الإعداد غير مكتمل"),
        tone: "warn" as const,
      }
    : !storeConnected
      ? {
          label: t("Ready for returns", "جاهز للإرجاع"),
          tone: "ok" as const,
        }
      : {
          label: t("Live", "مباشر"),
          tone: "live" as const,
        };

  if (!loaded) {
    return <OverviewPageSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-4 sm:gap-9 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-display text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-3xl">
            {setupComplete ? (
              <>
                {t("Your returns, ", "مرتجعاتك ")}
                <Tone>{t("in focus.", "في لمحة واحدة.")}</Tone>
              </>
            ) : (
              <>
                {t("Get your workspace ", "جهّز ")}
                <Tone>{t("ready.", "مساحة عملك.")}</Tone>
              </>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            <StoreIdentity name={storeName} markSize="sm" />
          </p>
        </div>
        <StatusChip tone={readiness.tone} label={readiness.label} />
      </header>

      {/* Day-0 setup */}
      {!setupComplete && (
        <section
          aria-labelledby="setup-heading"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-1">
              <h2
                id="setup-heading"
                className="font-display text-base font-semibold text-foreground"
              >
                {t("Finish setup", "أكمل الإعداد")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  `${doneCount} of ${setupSteps.length} complete`,
                  `${doneCount} من ${setupSteps.length} مكتمل`,
                )}
              </p>
            </div>
            <SetupProgress done={doneCount} total={setupSteps.length} />
          </div>

          <ol className="border-t border-border">
            {setupSteps.map((step, index) => {
              const isNext = step.id === nextStep.id;
              const Icon = step.icon;
              const isLast = index === setupSteps.length - 1;
              return (
                <li
                  key={step.id}
                  className={cn(!isLast && "border-b border-border")}
                >
                  <button
                    type="button"
                    onClick={() => router.push(step.href)}
                    className={cn(
                      "group flex w-full items-start gap-3.5 px-5 py-4 text-start transition-colors duration-200 sm:items-center sm:gap-4 sm:px-6 sm:py-5",
                      "hover:bg-muted/40 active:bg-muted/55",
                      isNext && "bg-primary/[0.03]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 sm:mt-0",
                        step.done
                          ? "border-eligible/40 bg-eligible-muted text-eligible"
                          : isNext
                            ? "setup-next-dot border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {step.done ? (
                        <Check className="size-4" strokeWidth={2.25} />
                      ) : (
                        <span className="text-xs font-semibold tabular-nums">
                          {index + 1}
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            step.done
                              ? "text-muted-foreground line-through decoration-border"
                              : "text-foreground",
                          )}
                        >
                          {step.title}
                        </span>
                        {isNext && !step.done && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {t("Next", "التالي")}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary sm:hidden">
                        <Icon className="size-3.5 opacity-70" strokeWidth={2} />
                        {step.cta}
                        <ArrowRight
                          className={cn(
                            "size-3.5 transition-transform duration-200 group-hover:translate-x-0.5",
                            isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
                          )}
                        />
                      </span>
                    </span>

                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 group-hover:border-primary/30 group-hover:text-primary">
                        <Icon className="size-3.5 opacity-70" strokeWidth={2} />
                        {step.cta}
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5",
                          isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
                        )}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Attention — live only when there is something to do */}
      {manualReviewCases.length > 0 && (
        <button
          type="button"
          onClick={() => router.push("/app/cases")}
          className="group flex w-full items-center gap-3.5 rounded-2xl border border-review/25 bg-review-muted/80 px-4 py-4 text-start transition-colors duration-200 hover:border-review/40 sm:gap-4 sm:px-5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-review text-review-foreground">
            <AlertCircle className="size-4.5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {manualReviewCases.length === 1
                ? t("1 case needs a closer look", "حالة واحدة تحتاج مراجعة أدق")
                : t(
                    `${manualReviewCases.length} cases need a closer look`,
                    `${manualReviewCases.length} حالات تحتاج مراجعة أدق`,
                  )}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t(
                "Review missing information before deciding",
                "راجع المعلومات الناقصة قبل اتخاذ القرار",
              )}
            </span>
          </span>
          <ArrowRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5",
              isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
            )}
          />
        </button>
      )}

      {/* KPIs — only once cases exist */}
      {caseTotal > 0 && (
        <section
          aria-label={t("Return metrics", "مؤشرات الإرجاع")}
          className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
        >
          <StatTile
            label={t("Open", "مفتوحة")}
            value={openCases.length}
            icon={Package}
          />
          <StatTile
            label={t("Needs review", "تحتاج مراجعة")}
            hint={t(
              "Open cases missing order data. Reload sent them to you instead of guessing.",
              "حالات مفتوحة تنقصها بيانات الطلب، فأحالها ريلود إليك بدلًا من التخمين.",
            )}
            value={manualReviewCases.length}
            icon={AlertCircle}
            emphasis={manualReviewCases.length > 0 ? "review" : undefined}
          />
          <StatTile
            label={t("Resolved", "مغلقة")}
            value={resolvedCases.length}
            icon={ShieldCheck}
          />
          <StatTile
            label={t("Eligibility", "الأهلية")}
            hint={t(
              "Share of all return cases that met your published policy.",
              "نسبة حالات الإرجاع التي استوفت سياستك المنشورة.",
            )}
            value={eligiblePct === null ? "—" : `${eligiblePct}%`}
            icon={Circle}
          />
        </section>
      )}

      {/* Live shortcuts when setup is done */}
      {setupComplete && (
        <section
          aria-label={t("Shortcuts", "اختصارات")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          <Shortcut
            icon={FileText}
            label={t("Policies", "السياسات")}
            hint={
              drafts.length
                ? t(
                    `${drafts.length} draft${drafts.length > 1 ? "s" : ""}`,
                    `${drafts.length} مسودة`,
                  )
                : t("Published rules", "قواعد منشورة")
            }
            onClick={() => router.push("/app/policies")}
            isArabic={isArabic}
          />
          <Shortcut
            icon={Plug}
            label={t("Integrations", "التكاملات")}
            hint={
              storeConnected
                ? t("Salla connected", "سلة متصلة")
                : t("Connect store", "ربط المتجر")
            }
            onClick={() => router.push("/app/integrations")}
            isArabic={isArabic}
          />
          <Shortcut
            icon={Link2}
            label={t("Customer return", "إرجاع العميل")}
            hint={t("Try the flow", "جرّب المسار")}
            onClick={() => router.push("/return")}
            isArabic={isArabic}
          />
        </section>
      )}

      {/* Main + side */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t("Recent activity", "النشاط الأخير")}
            </h2>
            {caseTotal > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/app/cases")}
                className="group h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
              >
                {t("View all", "عرض الكل")}
                <ArrowRight
                  className={cn(
                    "size-3.5 transition-transform duration-200 group-hover:translate-x-0.5",
                    isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
                  )}
                />
              </Button>
            )}
          </div>

          {recentCases.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 sm:px-6">
              <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                <Package className="size-4.5" strokeWidth={1.75} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {setupComplete
                    ? t("No return cases yet", "لا توجد حالات إرجاع بعد")
                    : t(
                        "Cases will show up here",
                        "ستظهر الحالات هنا",
                      )}
                </p>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {setupComplete
                    ? t(
                        "When customers request returns, decisions and evidence land in this queue.",
                        "عندما يطلب العملاء الإرجاع، تظهر القرارات والأدلة في هذه القائمة.",
                      )
                    : (
                      <>
                        {t("Finish ", "")}
                        <Link href={setupSteps[0].href} className="link-underline link-inline font-medium text-foreground">
                          {t("publishing a policy", "انشر سياسة")}
                        </Link>
                        {t(" first, then try a sample return.", " أولًا، ثم جرّب طلب إرجاع تجريبيًا.")}
                      </>
                    )}
                </p>
              </div>
              {setupComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/return")}
                  className="group"
                >
                  {t("Try a customer return", "تجربة طلب إرجاع")}
                  <ArrowRight
                    className={cn(
                      "size-3.5 transition-transform duration-200 group-hover:translate-x-0.5",
                      isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
                    )}
                  />
                </Button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentCases.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/cases/${c.id}`)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-start transition-colors duration-200 hover:border-primary/25 hover:bg-muted/20 sm:gap-3.5 sm:px-4"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        c.outcome === "ELIGIBLE" &&
                          "bg-eligible-muted text-eligible",
                        c.outcome === "NOT_ELIGIBLE" &&
                          "bg-not-eligible-muted text-not-eligible",
                        c.outcome === "MANUAL_REVIEW" &&
                          "bg-review-muted text-review",
                      )}
                    >
                      <Package className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {c.orderId}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {c.customerName}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {c.itemName}
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      <OutcomeBadge outcome={c.outcome} size="sm" />
                      <CaseStatusBadge status={c.caseStatus} size="sm" />
                    </span>
                    <ArrowRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground opacity-40 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 sm:opacity-0 sm:group-hover:opacity-100",
                        isArabic &&
                          "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-col">
          {caseTotal > 0 && (
            <SideCard title={t("Outcomes", "النتائج")}>
              <div className="space-y-3">
                <OutcomeRow
                  label={t("Eligible", "مؤهل")}
                  count={eligibleCount}
                  total={caseTotal}
                  color="bg-eligible"
                />
                <OutcomeRow
                  label={t("Manual review", "مراجعة بشرية")}
                  count={reviewCount}
                  total={caseTotal}
                  color="bg-review"
                />
                <OutcomeRow
                  label={t("Not eligible", "غير مؤهل")}
                  count={notEligibleCount}
                  total={caseTotal}
                  color="bg-not-eligible"
                />
              </div>
            </SideCard>
          )}

          <SideCard title={t("Policy", "السياسة")}>
            {policy ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-eligible-muted text-eligible">
                    <ShieldCheck className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {policy.versionLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(
                        `Published ${formatDate(policy.publishedAt)}`,
                        `نُشرت في ${formatDate(policy.publishedAt)}`,
                      )}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t(
                        `${policy.rules.length} active rules`,
                        `${policy.rules.length} قاعدة مفعّلة`,
                      )}
                    </p>
                  </div>
                </div>
                {drafts.length > 0 && (
                  <p className="text-xs text-review">
                    {t(
                      `${drafts.length} draft${drafts.length > 1 ? "s" : ""} pending`,
                      `${drafts.length} مسودة بانتظار المراجعة`,
                    )}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/app/policies")}
                >
                  {t("View policies", "عرض السياسات")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "No policy published yet.",
                    "لم تُنشر أي سياسة بعد.",
                  )}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    router.push(
                      drafts.length ? "/app/policies" : "/app/policies/new",
                    )
                  }
                >
                  {drafts.length
                    ? t("Review drafts", "مراجعة المسودات")
                    : t("Create policy", "إنشاء سياسة")}
                </Button>
              </div>
            )}
          </SideCard>

          <SideCard title={t("Store", "المتجر")}>
            {sallaConn ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        storeConnected
                          ? "bg-eligible-muted text-eligible"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Plug className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {sallaConn.platformName}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                      storeConnected
                        ? "bg-eligible-muted text-eligible"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {storeConnected
                      ? t("Connected", "متصل")
                      : t("Not connected", "غير متصل")}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/app/integrations")}
                >
                  {storeConnected
                    ? t("Manage", "إدارة")
                    : t("Connect", "ربط")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("No platforms available.", "لا توجد منصات متاحة.")}
              </p>
            )}
          </SideCard>
        </aside>
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  label,
}: {
  tone: "warn" | "ok" | "live";
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-2 self-start rounded-lg border px-2.5 py-1.5 sm:self-auto",
        tone === "warn" && "border-review/30 bg-review-muted/60",
        tone === "ok" && "border-border bg-card",
        tone === "live" && "border-eligible/30 bg-eligible-muted/50",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "warn" && "bg-review",
          tone === "ok" && "bg-primary",
          tone === "live" && "bg-eligible",
        )}
      />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}

function SetupProgress({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex w-full items-center gap-3 sm:w-44">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

function StatTile({
  label,
  hint,
  value,
  icon: Icon,
  emphasis,
}: {
  label: string;
  /** Shown on hover; the label gets a dotted underline to signal it. */
  hint?: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  emphasis?: "review";
}) {
  return (
    <div
      className={cn(
        "stat-tile rounded-xl border border-border bg-card px-3.5 py-3.5 sm:px-4",
        emphasis === "review" && "border-review/25 bg-review-muted/40",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} />
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="term-hint text-[11px] font-medium uppercase tracking-wide">
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-center leading-relaxed">
              {hint}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-[11px] font-medium uppercase tracking-wide">
            {label}
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground",
          emphasis === "review" && "text-review",
        )}
      >
        <CountUp value={value} />
      </p>
    </div>
  );
}

function Shortcut({
  icon: Icon,
  label,
  hint,
  onClick,
  isArabic,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint: string;
  onClick: () => void;
  isArabic: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-start transition-colors duration-200 hover:border-primary/25 hover:bg-muted/20 active:bg-muted/35"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <ArrowRight
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-70 group-hover:translate-x-0.5",
          isArabic && "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0",
        )}
      />
    </button>
  );
}

function SideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function OutcomeRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{count}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            color,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Counts a stat up from zero on first render ("62%" counts too). Numbers that
 *  aren't numeric ("—") render as they are. */
function CountUp({ value }: { value: string | number }) {
  const match = typeof value === "number" ? null : /^(\d+)(\D*)$/.exec(value);
  const target = typeof value === "number" ? value : match ? Number(match[1]) : null;
  const suffix = match ? match[2] : "";
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = Math.min(900, 420 + target * 12);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  if (target === null) return <>{value}</>;
  return <>{shown}{suffix}</>;
}
