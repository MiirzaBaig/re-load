"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CaseListSkeleton } from "@/components/merchant-skeletons";
import { useDelayedLoad } from "@/hooks/use-delayed-load";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OutcomeBadge, CaseStatusBadge } from "@/components/outcome-badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { formatDateTime, type ReturnCase } from "@/lib/domain";
import { Tone } from "@/components/heading-accent";
import { Search, ArrowRight, PackageOpen, AlertCircle, X, Calendar, Bookmark, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

interface SavedView {
  id: string;
  name: string;
  filters: { search: string; outcome: string; status: string; dateRange: string };
}

const DEFAULT_VIEWS: SavedView[] = [
  { id: "all", name: "All cases", filters: { search: "", outcome: "all", status: "all", dateRange: "all" } },
  { id: "review", name: "Needs review", filters: { search: "", outcome: "MANUAL_REVIEW", status: "OPEN", dateRange: "all" } },
  { id: "open", name: "Open", filters: { search: "", outcome: "all", status: "OPEN", dateRange: "all" } },
  { id: "resolved", name: "Resolved", filters: { search: "", outcome: "all", status: "RESOLVED", dateRange: "all" } },
];

export function CaseListPage() {
  const { t, isArabic, locale } = useLanguage();
  const { workspace } = useAuth();
  // Default view names are declared outside the component; translate them by id at render time.
  const defaultViewNames: Record<string, string> = {
    all: t("All cases", "كل الحالات"),
    review: t("Needs review", "تحتاج مراجعة"),
    open: t("Open", "مفتوحة"),
    resolved: t("Resolved", "مغلقة"),
  };
  const [allCases, setAllCases] = useState<ReturnCase[]>([]);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [activeView, setActiveView] = useState<string>("all");
  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const delayPassed = useDelayedLoad(300);
  // The skeleton used to lift after a fixed 300ms, so a slow fetch briefly
  // showed "No cases match your filters" before the real cases arrived.
  const [fetched, setFetched] = useState(false);
  const loaded = delayPassed && fetched;
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!supabase) { setFetched(true); return; }
    if (!workspace) return;
    void supabase.from("return_cases").select("id, order_id, status, customer_snapshot, item_snapshot, created_at, updated_at, eligibility_decisions(outcome, reason_codes, order_facts_snapshot, policy_snapshot, evaluated_at, policy_versions(version_label))")
      .eq("store_id", workspace.storeId).order("created_at", { ascending: false }).then(({ data }: { data: unknown }) => {
        if (!active) return;
        setFetched(true);
        setAllCases(((data ?? []) as Array<Record<string, any>>).map((row) => {
          const decision = row.eligibility_decisions ?? {};
          const customer = row.customer_snapshot ?? {};
          const item = row.item_snapshot ?? {};
          const policy = decision.policy_versions ?? {};
          return {
            id: String(row.id), orderId: String(row.order_id), customerName: String(customer.name ?? "Customer"), customerEmail: String(customer.email ?? ""),
            itemId: String(item.id ?? ""), itemName: String(item.name ?? "Item"), quantity: Number(item.quantity ?? 1), reason: item.reason ?? "defective", condition: item.condition ?? "new_unopened",
            outcome: decision.outcome, caseStatus: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
            decision: { outcome: decision.outcome, reasonCodes: decision.reason_codes ?? [], explanation: "", appliedRules: decision.policy_snapshot?.rules_snapshot?.map((rule: any) => ({ rule, passed: true, evaluatedValue: "", reasonCode: "" })) ?? [], policyVersionId: "", policyVersionLabel: policy.version_label ?? "—", evaluatedAt: decision.evaluated_at, relevantFacts: [] },
            events: [], notes: [],
          } as ReturnCase;
        }));
      });
    return () => { active = false; };
  }, [workspace]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allViews = [...DEFAULT_VIEWS, ...customViews];

  const applyView = (view: SavedView) => {
    setActiveView(view.id);
    setSearch(view.filters.search);
    setOutcomeFilter(view.filters.outcome);
    setStatusFilter(view.filters.status);
    setDateFilter(view.filters.dateRange);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName,
      filters: { search, outcome: outcomeFilter, status: statusFilter, dateRange: dateFilter },
    };
    setCustomViews([...customViews, view]);
    setActiveView(view.id);
    setNewViewName("");
    setShowSaveView(false);
  };

  const now = new Date();

  const filtered = allCases.filter((c) => {
    const matchesSearch = !search ||
      c.orderId.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.itemName.toLowerCase().includes(search.toLowerCase());
    const matchesOutcome = outcomeFilter === "all" || c.outcome === outcomeFilter;
    const matchesStatus = statusFilter === "all" || c.caseStatus === statusFilter;
    let matchesDate = true;
    if (dateFilter !== "all") {
      const created = new Date(c.createdAt);
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (dateFilter === "today") matchesDate = diffDays === 0;
      else if (dateFilter === "week") matchesDate = diffDays <= 7;
      else if (dateFilter === "month") matchesDate = diffDays <= 30;
    }
    return matchesSearch && matchesOutcome && matchesStatus && matchesDate;
  });

  const hasFilters = search || outcomeFilter !== "all" || statusFilter !== "all" || dateFilter !== "all";

  /** How many cases a view would show, from its own filters. */
  const countFor = (view: SavedView) =>
    allCases.filter((c) =>
      (view.filters.outcome === "all" || c.outcome === view.filters.outcome) &&
      (view.filters.status === "all" || c.caseStatus === view.filters.status),
    ).length;
  const reviewView = DEFAULT_VIEWS[1];
  const reviewCount = countFor(reviewView);
  const clearFilters = () => { setSearch(""); setOutcomeFilter("all"); setStatusFilter("all"); setDateFilter("all"); setActiveView("all"); };

  const relative = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en", { numeric: "auto" });
  const ago = (iso: string) => {
    const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return relative.format(days, "day");
    return formatDateTime(iso);
  };
  const needsReview = (c: ReturnCase) => c.outcome === "MANUAL_REVIEW" && c.caseStatus === "OPEN";

  return (
    <div className="flex flex-col gap-6">
      <ScrollReveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {t("Return ", "طلبات ")}<Tone>{t("cases", "الإرجاع")}</Tone>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`${filtered.length} of ${allCases.length} cases`, `${filtered.length} من ${allCases.length} حالة`)}
              {hasFilters && t(" · filtered", " · مُصفّاة")}
            </p>
          </div>
          {reviewCount > 0 && activeView !== "review" && (
            <button type="button" onClick={() => applyView(reviewView)} className="cases-review-pill">
              <span className="cases-review-dot" aria-hidden="true" />
              {t(`${reviewCount} need review`, `${reviewCount} تحتاج مراجعة`)}
              <ArrowRight className={cn("size-3.5", isArabic && "rotate-180")} />
            </button>
          )}
        </div>
      </ScrollReveal>

      {/* Views, with live counts */}
      <ScrollReveal delay={50}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="cases-tabs" role="tablist" aria-label={t("Case views", "عروض الحالات")}>
            {allViews.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={activeView === view.id}
                onClick={() => applyView(view)}
                className="cases-tab"
                data-active={activeView === view.id || undefined}
              >
                {view.id === "review" && <AlertCircle className="size-3.5" />}
                {view.id !== "review" && view.id !== "all" && !DEFAULT_VIEWS.some((d) => d.id === view.id) && <Bookmark className="size-3.5" />}
                <span>{defaultViewNames[view.id] ?? view.name}</span>
                <span className="cases-tab-count">{countFor(view)}</span>
              </button>
            ))}
          </div>
          {hasFilters && !showSaveView && (
            <button
              type="button"
              onClick={() => setShowSaveView(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-3" />
              <span>{t("Save view", "حفظ العرض")}</span>
            </button>
          )}
          {showSaveView && (
            <div className="flex items-center gap-2">
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveView(); if (e.key === "Escape") { setShowSaveView(false); setNewViewName(""); } }}
                placeholder={t("View name...", "اسم العرض...")}
                className="h-8 w-36 text-xs"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={handleSaveView} disabled={!newViewName.trim()} aria-label={t("Save", "حفظ")}>
                <Check className="size-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowSaveView(false); setNewViewName(""); }} aria-label={t("Cancel", "إلغاء")}>
                <X className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="cases-search relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
              placeholder={t("Search by order, customer, or item", "ابحث برقم الطلب أو اسم العميل أو المنتج")}
              className="h-10 ps-9 pe-10"
            />
            <kbd className="cases-kbd" aria-hidden="true">/</kbd>
          </div>
          <Select value={outcomeFilter} onValueChange={(v) => { setOutcomeFilter(v); setActiveView("custom"); }}>
            <SelectTrigger className="h-10 w-[150px]">
              <SelectValue placeholder={t("Outcome", "النتيجة")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All outcomes", "كل النتائج")}</SelectItem>
              <SelectItem value="ELIGIBLE">{t("Eligible", "مؤهل")}</SelectItem>
              <SelectItem value="NOT_ELIGIBLE">{t("Not eligible", "غير مؤهل")}</SelectItem>
              <SelectItem value="MANUAL_REVIEW">{t("Manual review", "مراجعة بشرية")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setActiveView("custom"); }}>
            <SelectTrigger className="h-10 w-[150px]">
              <SelectValue placeholder={t("Status", "الحالة")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All statuses", "كل الحالات")}</SelectItem>
              <SelectItem value="OPEN">{t("Open", "مفتوحة")}</SelectItem>
              <SelectItem value="AWAITING_ITEM">{t("Awaiting item", "بانتظار استلام المنتج")}</SelectItem>
              <SelectItem value="RECEIVED">{t("Received", "تم الاستلام")}</SelectItem>
              <SelectItem value="RESOLVED">{t("Resolved", "مغلقة")}</SelectItem>
              <SelectItem value="CANCELLED">{t("Cancelled", "ملغاة")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setActiveView("custom"); }}>
            <SelectTrigger className="h-10 w-[140px]">
              <Calendar className="me-1 size-3.5 text-muted-foreground" />
              <SelectValue placeholder={t("Date", "التاريخ")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All time", "كل الفترات")}</SelectItem>
              <SelectItem value="today">{t("Today", "اليوم")}</SelectItem>
              <SelectItem value="week">{t("Past 7 days", "آخر 7 أيام")}</SelectItem>
              <SelectItem value="month">{t("Past 30 days", "آخر 30 يومًا")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-muted-foreground">
              <X className="size-4" />
              <span>{t("Clear", "مسح")}</span>
            </Button>
          )}
        </div>
      </ScrollReveal>

      {!loaded ? (
        <CaseListSkeleton />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <PackageOpen className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">
              {allCases.length === 0 ? t("No return cases yet", "لا توجد حالات إرجاع بعد") : t("No cases match these filters", "لا توجد حالات مطابقة")}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {allCases.length === 0
                ? t("When a customer starts a return, it appears here with its decision.", "عندما يبدأ عميل طلب إرجاع، يظهر هنا مع قراره.")
                : t("Try another view or clear the filters.", "جرّب عرضًا آخر أو امسح عوامل التصفية.")}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("Clear filters", "مسح عوامل التصفية")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="cases-table hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("Order", "الطلب")}</th>
                  <th>{t("Customer · item", "العميل · المنتج")}</th>
                  <th>{t("Outcome", "النتيجة")}</th>
                  <th>{t("Status", "الحالة")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className="cases-row" data-review={needsReview(c) || undefined} style={{ ["--i" as string]: Math.min(i, 12) }}>
                    <td>
                      {/* The link stretches over the whole row, so rows are
                          reachable by Tab/Enter and open in a new tab. */}
                      <Link href={`/app/cases/${c.id}`} className="cases-row-link">
                        <bdi className="font-medium text-foreground">{c.orderId}</bdi>
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground" title={formatDateTime(c.createdAt)}>{ago(c.createdAt)}</div>
                    </td>
                    <td>
                      <div className="text-foreground">{c.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.itemName}{c.quantity > 1 && ` · ×${c.quantity}`}
                      </div>
                    </td>
                    <td><OutcomeBadge outcome={c.outcome} size="sm" /></td>
                    <td><CaseStatusBadge status={c.caseStatus} size="sm" /></td>
                    <td className="w-10">
                      <ArrowRight className={cn("cases-row-chevron size-4", isArabic && "rotate-180")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/app/cases/${c.id}`}
                className="cases-card"
                data-review={needsReview(c) || undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <bdi className="text-sm font-medium text-foreground">{c.orderId}</bdi>
                  <span className="text-xs text-muted-foreground">{ago(c.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{c.customerName} · {c.itemName}</div>
                <div className="mt-3 flex items-center gap-2">
                  <OutcomeBadge outcome={c.outcome} size="sm" />
                  <CaseStatusBadge status={c.caseStatus} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
