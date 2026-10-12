"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, BookOpen, LayoutDashboard, ArrowRight, Check, Copy, FileText, Inbox, Link2, Loader2, Package, ShieldCheck, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";
import { useDelayedLoad } from "@/hooks/use-delayed-load";
import { OverviewPageSkeleton } from "@/components/merchant-skeletons";
import { Button } from "@/components/ui/button";
import { OutcomeBadge } from "@/components/outcome-badge";
import { needsDecision, setCaseStatus, useWorkspaceData, workspaceKey } from "@/lib/workspace-data";
import { useAuth } from "@/components/auth-provider";
import { CaseDrawer, useOpenCase } from "@/components/case-drawer";
import { EmptyState, Metric, Panel, QUICK, TWEEN } from "@/components/desk/primitives";
import { SetupChecklist, type SetupStep } from "@/components/setup-checklist";
import { HeaderChip, Key, PageHeader } from "@/components/desk/page-header";
import { SuccessMark } from "@/components/integrations/connect-stepper";
import { WhatsAppLogo } from "@/components/phone-frame";
import { dailySeries } from "@/components/admin/use-labels";
import type { ReturnCase } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

/*
 * Overview has two moods.
 *   Setting up: one "next up" card with a small preview of what the step
 *   unlocks, the rest as pills. Nothing else competes with it.
 *   Live: what needs you (with one-tap accept), four numbers, the activity
 *   feed, and a health strip for store, policy, return page and WhatsApp.
 */

type T = (en: string, ar: string) => string;

export function OverviewPage() {
  const router = useRouter();
  const { t, isArabic, locale } = useLanguage();
  const delayPassed = useDelayedLoad(280);
  const auth = useAuth();
  const live = useWorkspaceData(workspaceKey(auth));
  const loaded = delayPassed && live.ready;
  const [openCase, setOpenCase] = useOpenCase();
  const [accepting, setAccepting] = useState<string | null>(null);

  const { cases, policy, draftCount, store } = live;
  const storeConnected = store?.status === "CONNECTED";
  const hasPolicy = Boolean(policy);
  const setupComplete = storeConnected && hasPolicy;
  const caseTotal = cases.length;
  const returnPath = live.returnCode ? `/return?store=${encodeURIComponent(live.returnCode)}` : "/return";

  const queue = useMemo(() => needsDecision(cases), [cases]);
  const series = useMemo(() => dailySeries(cases.map((c) => c.createdAt)), [cases]);
  const weekCount = series.slice(-7).reduce((sum, n) => sum + n, 0);
  const lastWeek = series.slice(0, 7).reduce((sum, n) => sum + n, 0);
  const reviewCount = cases.filter((c) => c.outcome === "MANUAL_REVIEW" && c.caseStatus === "OPEN").length;
  const autoPct = caseTotal ? Math.round((cases.filter((c) => c.outcome !== "MANUAL_REVIEW").length / caseTotal) * 100) : 0;
  const resolved = cases.filter((c) => c.caseStatus === "RESOLVED").length;
  const recent = useMemo(() => [...cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [cases]);

  const firstName = (() => {
    const meta = auth.user?.user_metadata as { full_name?: string; name?: string } | undefined;
    const name = meta?.full_name ?? meta?.name ?? auth.user?.email?.split("@")[0] ?? "";
    return name.split(/[\s._-]/)[0].replace(/^\w/, (c) => c.toUpperCase());
  })();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("Good morning", "صباح الخير") : hour < 18 ? t("Good afternoon", "مساء الخير") : t("Good evening", "مساء الخير");

  const { knowledge } = live;
  const whatsAppOn = live.whatsApp === "CONNECTED";
  const platformName = store?.platform === "salla" ? t("Salla", "سلة") : t("Zid", "زد");
  const steps: SetupStep[] = [
    { id: "store", done: storeConnected, minutes: 2, title: t("Connect your store", "اربط متجرك"),
      status: storeConnected ? t(`${platformName} connected${store?.storeName ? ` · ${store.storeName}` : ""}`, `${platformName} مربوط${store?.storeName ? ` · ${store.storeName}` : ""}`) : t("So Reload can read the real order behind every request", "ليقرأ ريلود الطلب الفعلي خلف كل طلب"),
      body: t("Reload checks what was bought, when it arrived and who bought it. It reads orders and creates returns, nothing else.", "يتحقق ريلود مما اشتُري ومتى وصل ومن اشتراه. يقرأ الطلبات وينشئ المرتجعات فقط."),
      cta: storeConnected ? t("Manage connection", "إدارة الربط") : t("Connect Zid or Salla", "اربط زد أو سلة"), href: "/app/integrations" },
    { id: "policy", done: hasPolicy, minutes: 5, title: t("Publish your return policy", "انشر سياسة الإرجاع"),
      status: policy ? t(`${policy.versionLabel} published · ${policy.ruleCount} rules`, `${policy.versionLabel} منشورة · ${policy.ruleCount} قواعد`) : t("Your rules, applied the same way to every return", "قواعدك تُطبّق بالطريقة نفسها على كل إرجاع"),
      body: t("Write your rules once: the return window, what can come back and what can't. Reload uses them to say yes or no, with the reason.", "اكتب قواعدك مرة واحدة: مدة الإرجاع، وما يُقبل وما لا يُقبل. يستخدمها ريلود للقبول أو الرفض مع ذكر السبب."),
      cta: hasPolicy ? t("View policy", "عرض السياسة") : draftCount ? t("Finish your draft", "أكمل المسودة") : t("Create policy", "إنشاء سياسة"), href: hasPolicy || draftCount ? "/app/policies" : "/app/policies/new" },
    { id: "knowledge", done: knowledge.approved > 0, minutes: 5, title: t("Add your store's answers", "أضف إجابات متجرك"),
      status: knowledge.approved > 0
        ? t(`${knowledge.approved} approved${knowledge.drafts ? ` · ${knowledge.drafts} waiting for you` : ""}`, `${knowledge.approved} معتمدة${knowledge.drafts ? ` · ${knowledge.drafts} بانتظارك` : ""}`)
        : knowledge.drafts ? t(`${knowledge.drafts} drafts waiting for your approval`, `${knowledge.drafts} مسودات بانتظار اعتمادك`) : t("Delivery, warranty, how to reach you", "التوصيل، الضمان، وطريقة التواصل"),
      body: t("Your WhatsApp assistant only says what you approve here. Import a help page, paste your answers, or answer a few guided questions.", "مساعد واتساب لا يقول إلا ما تعتمده هنا. استورد صفحة مساعدة، أو الصق إجاباتك، أو أجب عن أسئلة موجّهة."),
      cta: knowledge.approved > 0 || knowledge.drafts ? t("Review answers", "مراجعة الإجابات") : t("Add answers", "إضافة إجابات"), href: "/app/knowledge" },
    { id: "whatsapp", done: whatsAppOn, minutes: 1, title: t("Turn on WhatsApp", "فعّل واتساب"),
      status: whatsAppOn ? t("Active. Customers can message you.", "مفعّل. يستطيع العملاء مراسلتك.") : t("Where your customers will reach you", "حيث يصل إليك عملاؤك"),
      body: t("One tap gives your store its own WhatsApp link and QR code on Reload's number. No new number, no app to install.", "بضغطة واحدة يحصل متجرك على رابط واتساب ورمز QR خاص به على رقم ريلود. بدون رقم جديد ولا تطبيق.") ,
      cta: whatsAppOn ? t("Get your link and QR", "احصل على الرابط والرمز") : t("Activate WhatsApp", "تفعيل واتساب"), href: "/app/integrations",
      locked: !storeConnected ? t("Connect your store first", "اربط متجرك أولًا") : !hasPolicy ? t("Publish your policy first", "انشر سياستك أولًا") : undefined },
    { id: "try", done: caseTotal > 0, minutes: 2, title: t("Try it as a customer", "جرّبه كعميل"),
      status: caseTotal > 0 ? t("Your first return came through", "وصل أول طلب إرجاع") : t("See exactly what your customers will see", "شاهد ما سيراه عملاؤك تمامًا"),
      body: t("Start a return with one of your real order numbers and watch the decision land on this page.", "ابدأ إرجاعًا برقم طلب حقيقي من متجرك وشاهد القرار يصل إلى هذه الصفحة."),
      cta: t("Open the return page", "افتح صفحة الإرجاع"), href: returnPath, external: true,
      locked: !storeConnected ? t("Connect your store first", "اربط متجرك أولًا") : !hasPolicy ? t("Publish your policy first", "انشر سياستك أولًا") : undefined },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const accept = async (c: ReturnCase) => {
    if (!supabase) return;
    setAccepting(c.id);
    const { error } = await supabase.rpc("update_return_case_status", { p_case_id: c.id, p_status: "AWAITING_ITEM" });
    setAccepting(null);
    if (error) return toast.error(t("Couldn't accept this return. Please try again.", "تعذّر قبول الإرجاع. حاول مرة أخرى."));
    setCaseStatus(c.id, "AWAITING_ITEM");
    toast.success(t(`Accepted. Waiting for ${c.customerName}'s item.`, `تم القبول. بانتظار منتج ${c.customerName}.`));
  };

  if (!loaded) return <OverviewPageSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-4 sm:gap-8">
      {/* ── Greeting ── */}
      <PageHeader icon={LayoutDashboard} helpId="overview"
        eyebrow={<>{greeting}{firstName && `${isArabic ? "،" : ","} ${firstName}`} <span className="inline-block origin-[70%_70%] motion-safe:animate-[wave_1.6s_ease-in-out_0.4s_1]">👋</span></>}
        title={setupComplete ? t("Here's your returns today", "هذه مرتجعاتك اليوم") : t("Let's get you live", "لنجهّزك للانطلاق")}
        meta={<HeaderChip tone={setupComplete ? "ok" : "attention"} pulse={setupComplete}>{setupComplete ? t("Live", "مباشر") : t(`Setup ${doneCount} of ${steps.length}`, `الإعداد ${doneCount} من ${steps.length}`)}</HeaderChip>}
        help={t("This is your home page. While you set up, it lists every step in order. Once you're live, it shows which returns need you and how the rest were decided.", "هذه صفحتك الرئيسية. أثناء الإعداد تعرض كل خطوة بالترتيب. وبعد التفعيل تعرض المرتجعات التي تحتاجك وكيف تقرّر الباقي.")}>
        {setupComplete
          ? <><Key>{t("Start with what needs you.", "ابدأ بما يحتاجك.")}</Key> {t("Everything else was decided by your policy.", "كل ما عداه قرّرته سياستك.")}</>
          : <><Key>{t("A few short steps", "خطوات قصيرة")}</Key> {t("and your customers can return items on their own.", "ويستطيع عملاؤك إرجاع المنتجات بأنفسهم.")}</>}
      </PageHeader>

      {!setupComplete ? (
        <>
          <SetupChecklist steps={steps} />

          {/* ── How it works ── */}
          <section aria-label={t("How Reload works", "كيف يعمل ريلود")} className="desk-stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            {[
              { icon: Link2, title: t("Customer asks", "العميل يطلب"), text: t("They enter their order number on your return page or WhatsApp.", "يدخل رقم طلبه في صفحة الإرجاع أو واتساب.") },
              { icon: ShieldCheck, title: t("Reload checks", "ريلود يتحقق"), text: t("The real order from your store, against your published policy.", "الطلب الفعلي من متجرك مقابل سياستك المنشورة.") },
              { icon: Inbox, title: t("You see a decision", "ترى القرار"), text: t("Eligible, not eligible, or flagged for you, with the reasons.", "مؤهل أو غير مؤهل أو محال إليك، مع الأسباب.") },
            ].map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="admin-card flex gap-3.5 rounded-2xl border border-border bg-card p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold"><span className="me-1.5 text-muted-foreground tabular-nums">{index + 1}</span>{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          {/* ── Health strip ── */}
          <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.05 }}
            aria-label={t("Connections", "الاتصالات")} className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-5">
            <HealthItem href="/app/integrations" ok icon={store?.platform === "zid" ? <Image src="/zid-logo.png" alt="" width={20} height={20} className="size-5 rounded-md" /> : <Store className="size-4" />}
              label={store?.platform === "zid" ? t("Zid", "زد") : t("Salla", "سلة")} value={store?.storeName ?? t("Connected", "متصل")} />
            <HealthItem href="/app/policies" ok icon={<FileText className="size-4" />} label={t("Policy", "السياسة")}
              value={policy ? t(`${policy.versionLabel} · ${policy.ruleCount} rules`, `${policy.versionLabel} · ${policy.ruleCount} قواعد`) : ""} />
            <HealthItem href="/app/knowledge" ok={knowledge.approved > 0} icon={<BookOpen className="size-4" />} label={t("Knowledge", "المعلومات")}
              value={knowledge.approved > 0 ? t(`${knowledge.approved} answers`, `${knowledge.approved} إجابات`) : t("No answers yet", "لا توجد إجابات")} />
            <ReturnLinkItem path={returnPath} t={t} />
            <HealthItem href="/app/integrations" ok={whatsAppOn} icon={<WhatsAppLogo className="size-4" />} label="WhatsApp"
              value={whatsAppOn ? t("Active", "مفعّل") : t("Not active yet", "غير مفعّل بعد")} />
          </motion.section>

          {doneCount < steps.length && <SetupChecklist steps={steps} compact />}

          {caseTotal === 0 ? (
            /* ── Just went live ── */
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.1 }}
              className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-10 text-center sm:py-12">
              <SuccessMark />
              <h2 className="mt-5 font-display text-xl font-semibold tracking-tight sm:text-2xl">{t("You're live.", "أنت مباشر الآن.")}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("Your store and policy are connected. Try a return with one of your real order numbers and the decision lands here.", "متجرك وسياستك مربوطان. جرّب إرجاعًا برقم طلب حقيقي وسيظهر القرار هنا.")}</p>
              <Button asChild className="group mt-6 h-11 rounded-xl px-5"><Link href={returnPath} target="_blank">{t("Try a customer return", "جرّب طلب إرجاع")}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" /></Link></Button>
            </motion.section>
          ) : (
            <>
              {/* ── Numbers ── */}
              <section aria-label={t("Return metrics", "مؤشرات الإرجاع")} className="desk-stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Metric icon={Package} label={t("This week", "هذا الأسبوع")} value={weekCount} series={series}
                  note={lastWeek ? t(`vs ${lastWeek} last week`, `مقابل ${lastWeek} الأسبوع الماضي`) : t("last 7 days", "آخر ٧ أيام")} onClick={() => router.push("/app/cases")} />
                <Metric icon={AlertCircle} label={t("To review", "للمراجعة")} value={reviewCount} tone="review"
                  note={reviewCount ? t("order data was incomplete", "بيانات الطلب ناقصة") : t("nothing waiting", "لا شيء بانتظارك")} onClick={() => router.push("/app/cases")} />
                <Metric icon={Sparkles} label={t("Auto-decided", "قرار تلقائي")} value={autoPct} suffix="%" note={t("no manual work", "دون عمل يدوي")} />
                <Metric icon={ShieldCheck} label={t("Resolved", "مغلقة")} value={resolved} note={t(`of ${caseTotal} cases`, `من ${caseTotal} حالة`)} />
              </section>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* ── Needs you ── */}
                <Panel title={t("Needs you", "بانتظارك")} subtitle={t("Reviews first, then the oldest open cases.", "المراجعات أولًا، ثم أقدم الحالات المفتوحة.")} bodyClassName="px-2 pb-2 pt-3 sm:px-3"
                  action={queue.length > 0 ? <span className="rounded-full bg-review-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-review">{queue.length}</span> : undefined}>
                  {queue.length ? (
                    <ul>
                      <AnimatePresence initial={false}>
                        {queue.slice(0, 5).map((c) => (
                          <motion.li key={c.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, x: isArabic ? -24 : 24 }} transition={QUICK} className="overflow-hidden">
                            <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50">
                              <button type="button" onClick={() => setOpenCase(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                                <CaseIcon c={c} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold"><bdi>{c.orderId}</bdi><span className="font-normal text-muted-foreground"> · {c.customerName}</span></span>
                                  <span className="block truncate text-xs text-muted-foreground">{c.caseStatus === "RECEIVED" ? t("Item received, ready to close", "استُلم المنتج، جاهزة للإغلاق") : c.outcome === "MANUAL_REVIEW" ? t("Order data incomplete, your call", "بيانات الطلب ناقصة، القرار لك") : c.itemName}</span>
                                </span>
                              </button>
                              {c.caseStatus === "OPEN" && c.outcome === "ELIGIBLE" ? (
                                <Button size="sm" variant="outline" disabled={accepting !== null} onClick={() => void accept(c)} className="h-8 shrink-0 rounded-lg px-3 text-xs transition-transform active:scale-[.97]">
                                  {accepting === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{t("Accept", "قبول")}
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setOpenCase(c.id)} className="h-8 shrink-0 rounded-lg px-3 text-xs">{c.caseStatus === "RECEIVED" ? t("Close", "إغلاق") : t("Review", "مراجعة")}</Button>
                              )}
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  ) : <EmptyState icon={Check} title={t("All caught up", "لا شيء متأخر")} text={t("Every open case has a next step. New ones show up here.", "كل الحالات المفتوحة لها خطوة تالية. تظهر الجديدة هنا.")} />}
                  {queue.length > 5 && (
                    <button type="button" onClick={() => router.push("/app/cases")} className="mt-1 w-full rounded-xl py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                      {t(`${queue.length - 5} more in Return cases`, `${queue.length - 5} أخرى في طلبات الإرجاع`)}
                    </button>
                  )}
                </Panel>

                {/* ── Activity ── */}
                <Panel title={t("Latest activity", "آخر النشاط")} bodyClassName="px-2 pb-2 pt-3 sm:px-3"
                  action={<Link href="/app/cases" className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">{t("View all", "عرض الكل")}<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" /></Link>}>
                  <ol className="relative">
                    {recent.map((c, index) => (
                      <motion.li key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.1 + index * 0.04 }}>
                        <button type="button" onClick={() => setOpenCase(c.id)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-150 hover:bg-muted/50">
                          <CaseIcon c={c} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm"><span className="font-medium">{c.customerName}</span><span className="text-muted-foreground"> {t("asked to return", "طلب إرجاع")} </span><span className="font-medium">{c.itemName}</span></span>
                            <span className="block truncate text-xs text-muted-foreground"><bdi>{c.orderId}</bdi> · {relative(c.createdAt, locale)}</span>
                          </span>
                          <span className="hidden shrink-0 sm:block"><OutcomeBadge outcome={c.outcome} size="sm" /></span>
                        </button>
                      </motion.li>
                    ))}
                  </ol>
                </Panel>
              </div>
            </>
          )}
        </>
      )}
      <CaseDrawer caseId={openCase} onOpenChange={setOpenCase} />
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function relative(iso: string, locale: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(0, "minute");
}

function CaseIcon({ c }: { c: ReturnCase }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl",
      c.outcome === "MANUAL_REVIEW" ? "bg-review-muted text-review" : c.outcome === "ELIGIBLE" ? "bg-eligible-muted text-eligible" : "bg-not-eligible-muted text-not-eligible")}>
      {c.outcome === "MANUAL_REVIEW" ? <AlertCircle className="size-4" /> : <Package className="size-4" strokeWidth={1.75} />}
    </span>
  );
}

function HealthItem({ href, ok, icon, label, value }: { href: string; ok: boolean; icon: ReactNode; label: string; value: string }) {
  return (
    <Link href={href} className="store-tile group flex min-w-0 items-center gap-3 border-b border-e border-border p-4 transition-colors last:border-b-0 hover:bg-muted/40 max-lg:last:col-span-2 [&:nth-child(2n)]:border-e-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-e lg:last:border-e-0">
      <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground sm:grid">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-1.5 rounded-full", ok ? "bg-eligible" : "bg-review")} />{label}</span>
        <span className="block truncate text-sm font-medium" dir="auto">{value}</span>
      </span>
    </Link>
  );
}

function ReturnLinkItem({ path, t }: { path: string; t: T }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { toast.error(t("Couldn't copy the link.", "تعذّر نسخ الرابط.")); }
  };
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-e border-border p-4 [&:nth-child(2n)]:border-e-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-e">
      <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground sm:grid"><Link2 className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 shrink-0 rounded-full bg-eligible" />{t("Return link", "رابط الإرجاع")}</span>
        <span className="block truncate text-sm font-medium">{t("Live", "مفعّلة")}</span>
      </span>
      <button type="button" onClick={() => void copy()} aria-label={t("Copy return link", "نسخ رابط الإرجاع")} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95">
        <AnimatePresence initial={false} mode="wait">
          {copied
            ? <motion.span key="ok" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Check className="size-3.5 text-eligible" /></motion.span>
            : <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}><Copy className="size-3.5" /></motion.span>}
        </AnimatePresence>
      </button>
    </div>
  );
}
