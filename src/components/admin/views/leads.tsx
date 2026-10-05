"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowDown, ArrowUp, CalendarClock, ChevronsLeftRight, Columns3, Download, Filter, MoreHorizontal, Rows3, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { CountUp, EmptyState, FilterChip, Initial, QUICK, Segmented, StatusDot, StatusPill } from "@/components/desk/primitives";
import { StatusMenu } from "@/components/admin/status-menu";
import { STATUSES, type Lead, type LeadChanges } from "@/components/admin/types";
import type { LeadsLayout } from "@/components/admin/use-admin-state";
import { isDue, type Labels } from "@/components/admin/use-labels";
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_LABEL, platformOf, type Platform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** platform: one of PLATFORMS, or "unknown" for leads that didn't say. */
export type LeadFilters = { query: string; source: string | null; mine: boolean; platform: Platform | "unknown" | null };

type Update = (id: string, changes: LeadChanges, options?: { message?: string; undoable?: boolean }) => Promise<boolean>;

type Props = {
  leads: Lead[];
  allLeads: Lead[];
  layout: LeadsLayout;
  status: string | null;
  filters: LeadFilters;
  selectedId: string | null;
  labels: Labels;
  canEdit: boolean;
  currentUserId: string;
  onFilters: (filters: LeadFilters) => void;
  onLayout: (layout: LeadsLayout) => void;
  onStatus: (status: string | null) => void;
  onOpen: (id: string) => void;
  onImport: () => void;
  update: Update;
};

export function LeadsView(props: Props) {
  const { leads, allLeads, layout, filters, labels, canEdit, onFilters, onLayout, onImport } = props;
  const { t } = labels;
  const sources = useMemo(() => [...new Set(allLeads.map((lead) => lead.source_label))].sort(), [allLeads]);
  const filtered = !!(filters.query || filters.source || filters.mine || filters.platform);

  return <div className="space-y-5">
    <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="admin-lead-search" className="h-9 rounded-xl ps-9 pe-10" value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.target.value })} placeholder={t("Search leads", "ابحث في العملاء")} />
        {filters.query ? <button type="button" onClick={() => onFilters({ ...filters, query: "" })} className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Clear search", "مسح البحث")}><X className="size-3.5" /></button>
          : <Kbd className="absolute end-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>}
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {canEdit && <>
          <Button variant="outline" size="sm" className="hidden rounded-xl sm:inline-flex" onClick={onImport}><Upload className="size-4" />{t("Import", "استيراد")}</Button>
          <Button variant="outline" size="sm" className="hidden rounded-xl sm:inline-flex" asChild><a href="/api/admin/leads/export"><Download className="size-4" />{t("Export", "تصدير")}</a></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition-colors active:bg-muted data-[state=open]:bg-muted sm:hidden" aria-label={t("More actions", "إجراءات أخرى")}><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onImport}><Upload className="size-4" />{t("Import CSV", "استيراد CSV")}</DropdownMenuItem>
              <DropdownMenuItem asChild><a href="/api/admin/leads/export"><Download className="size-4" />{t("Export CSV", "تصدير CSV")}</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>}
        <Segmented label={t("Layout", "طريقة العرض")} value={layout} onChange={onLayout} options={[{ value: "board", label: <span className="sr-only sm:not-sr-only">{t("Board", "اللوحة")}</span>, icon: Columns3 }, { value: "table", label: <span className="sr-only sm:not-sr-only">{t("Table", "الجدول")}</span>, icon: Rows3 }]} />
      </div>
    </div>
    <div className="admin-scroll-row flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors duration-200", filters.source ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}><Filter className="size-3.5" /><span className="max-w-[140px] truncate">{filters.source ?? t("All sources", "كل المصادر")}</span></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{t("Source", "المصدر")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, source: null })}>{t("All sources", "كل المصادر")}</DropdownMenuItem>
          {sources.map((source) => <DropdownMenuItem key={source} onSelect={() => onFilters({ ...filters, source })}><span className="truncate" dir="auto">{source}</span><span className="ms-auto text-xs tabular-nums text-muted-foreground">{allLeads.filter((lead) => lead.source_label === source).length}</span></DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors duration-200", filters.platform ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
          <span className="size-2 rounded-full" style={{ background: filters.platform ? PLATFORM_COLOR[filters.platform] : "currentColor", opacity: filters.platform ? 1 : 0.5 }} />
          {filters.platform ? platformName(filters.platform, labels) : t("All platforms", "كل المنصات")}
        </button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{t("Store platform", "منصة المتجر")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onFilters({ ...filters, platform: null })}>{t("All platforms", "كل المنصات")}</DropdownMenuItem>
          {[...PLATFORMS, "unknown" as const].map((option) => <DropdownMenuItem key={option} onSelect={() => onFilters({ ...filters, platform: option })} className="gap-2">
            <span className="size-2 rounded-full" style={{ background: PLATFORM_COLOR[option] }} />{platformName(option, labels)}
            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{allLeads.filter((lead) => (platformOf(lead.store_platform) ?? "unknown") === option).length}</span>
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <FilterChip active={filters.mine} onClick={() => onFilters({ ...filters, mine: !filters.mine })}>{t("Mine", "الخاصة بي")}</FilterChip>
      {filtered && <button type="button" onClick={() => onFilters({ query: "", source: null, mine: false, platform: null })} className="h-9 px-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t("Reset", "إعادة ضبط")}</button>}
    </div>
    </div>

    {layout === "board" ? <Board {...props} /> : <Table {...props} />}
    {!leads.length && filtered && <EmptyState icon={Search} title={t("No leads match", "لا توجد نتائج")} text={t("Try a different search or reset the filters.", "جرّب بحثًا آخر أو أعد ضبط التصفية.")} />}
  </div>;
}

/* ───────────────────────── Board ───────────────────────── */

/** Pointer first (precise for wide columns), then overlap for keyboard and
 *  touch drags, where there's no pointer position. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function Board({ leads, labels, canEdit, currentUserId, selectedId, onOpen, update }: Props) {
  const { t } = labels;
  // A stable id, so dnd-kit's accessibility ids match between server and browser.
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ not_interested: true });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );
  const columns = useMemo(() => STATUSES.map((status) => ({ status, items: leads.filter((lead) => lead.status === status) })), [leads]);
  // Phones show one column at a time: stage tabs above the board say where
  // you are and jump between columns.
  const railRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<string>(STATUSES[0]);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const edge = rail.getBoundingClientRect();
        let best: HTMLElement | null = null;
        let distance = Infinity;
        for (const col of rail.querySelectorAll<HTMLElement>("[data-status]")) {
          const r = col.getBoundingClientRect();
          const d = Math.abs((r.left + r.right) / 2 - (edge.left + edge.right) / 2);
          if (d < distance) { distance = d; best = col; }
        }
        if (best?.dataset.status) setVisible(best.dataset.status);
      });
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => { rail.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);
  const jump = (status: string) => {
    if (collapsed[status]) setCollapsed((current) => ({ ...current, [status]: false }));
    setVisible(status);
    requestAnimationFrame(() => railRef.current?.querySelector<HTMLElement>(`[data-status="${status}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }));
  };
  const active = activeId ? leads.find((lead) => lead.id === activeId) : undefined;

  const move = (lead: Lead, status: string) => {
    if (lead.status === status) return;
    void update(lead.id, { status }, { message: t(`${lead.store_name} → ${labels.status(status)}`, `${lead.store_name} ← ${labels.status(status)}`), undoable: true });
  };
  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const lead = leads.find((item) => item.id === event.active.id);
    if (lead && event.over) move(lead, String(event.over.id));
  };

  return <DndContext id={dndId} sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}
    accessibility={{ screenReaderInstructions: { draggable: t("Press space to pick up a lead, use arrow keys to move it to another stage, and space again to drop it.", "اضغط المسافة لالتقاط العميل، واستخدم الأسهم لنقله، ثم المسافة لإفلاته.") } }}>
    <div role="tablist" aria-label={t("Pipeline stages", "مراحل المسار")} className="admin-scroll-row mb-3 flex gap-1.5 lg:hidden">
      {columns.map(({ status, items }) => {
        const active = visible === status;
        return <button key={status} type="button" role="tab" aria-selected={active} onClick={() => jump(status)} className={cn("relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-200", active ? "text-background" : "text-muted-foreground")}>
          {active && <motion.span layoutId="board-stage" transition={QUICK} className="absolute inset-0 -z-0 rounded-full bg-foreground" />}
          <StatusDot status={status} className="relative size-1.5" /><span className="relative">{labels.status(status)}</span><span className={cn("relative tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>{items.length}</span>
        </button>;
      })}
    </div>
    <div ref={railRef} className="admin-board -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
      {columns.map(({ status, items }) => <Column key={status} status={status} count={items.length} labels={labels} collapsed={!!collapsed[status]} dragging={!!activeId} canDrop={canEdit} onToggle={() => setCollapsed((current) => ({ ...current, [status]: !current[status] }))}>
        <AnimatePresence initial={false}>
          {items.map((lead) => <motion.div key={lead.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={QUICK}>
            <Card lead={lead} labels={labels} canEdit={canEdit} currentUserId={currentUserId} selected={selectedId === lead.id} hidden={activeId === lead.id} onOpen={onOpen} onMove={(next) => move(lead, next)} />
          </motion.div>)}
        </AnimatePresence>
        {!items.length && <div className={cn("grid h-24 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground transition-colors duration-200", activeId ? "border-foreground/25" : "border-border")}>{activeId ? t("Drop here", "أفلت هنا") : t("Nothing here", "لا يوجد شيء")}</div>}
      </Column>)}
    </div>
    <DragOverlay dropAnimation={null}>
      {active && <div className="admin-drag-overlay"><CardBody lead={active} labels={labels} currentUserId={currentUserId} /></div>}
    </DragOverlay>
  </DndContext>;
}

function Column({ status, count, labels, collapsed, dragging, canDrop, onToggle, children }: { status: string; count: number; labels: Labels; collapsed: boolean; dragging: boolean; canDrop: boolean; onToggle: () => void; children: ReactNode }) {
  const { t } = labels;
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canDrop });
  if (collapsed) {
    return <button ref={setNodeRef} data-status={status} type="button" onClick={onToggle} aria-label={t(`Show ${labels.status(status)}`, `إظهار ${labels.status(status)}`)} className={cn("flex w-12 shrink-0 snap-start flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 py-4 transition-[background-color,border-color] duration-200 hover:bg-muted/60", isOver && "border-foreground/30 bg-muted")}>
      <StatusDot status={status} />
      <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">{labels.status(status)}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
      <ChevronsLeftRight className="mt-auto size-3.5 text-muted-foreground" />
    </button>;
  }
  return <section ref={setNodeRef} data-status={status} aria-label={labels.status(status)} className={cn("flex w-[84vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border bg-muted/30 transition-[background-color,border-color,box-shadow] duration-200 sm:w-[288px]", isOver ? "border-foreground/30 bg-muted/70 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_10%,transparent)]" : dragging ? "border-dashed border-border" : "border-border")}>
    <header className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
      <StatusDot status={status} />
      <h3 className="text-[13px] font-semibold">{labels.status(status)}</h3>
      <CountUp value={count} className="rounded-md bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground" />
      {status === "not_interested" && <button type="button" onClick={onToggle} className="ms-auto grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Collapse", "طي")}><ChevronsLeftRight className="size-3.5" /></button>}
    </header>
    <div className="flex flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
  </section>;
}

function Card({ lead, labels, canEdit, currentUserId, selected, hidden, onOpen, onMove }: { lead: Lead; labels: Labels; canEdit: boolean; currentUserId: string; selected: boolean; hidden: boolean; onOpen: (id: string) => void; onMove: (status: string) => void }) {
  const { t } = labels;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: lead.id, disabled: !canEdit });
  return <div ref={setNodeRef} {...attributes} {...listeners} role="button" tabIndex={0} aria-roledescription={canEdit ? t("draggable lead", "عميل قابل للسحب") : undefined}
    onClick={() => onOpen(lead.id)} onKeyDown={(event) => { listeners?.onKeyDown?.(event); if (event.key === "Enter" && !event.defaultPrevented) onOpen(lead.id); }}
    className={cn("admin-lead-card group relative rounded-xl border bg-card outline-none transition-[border-color,box-shadow,opacity,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring/60", canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", selected ? "border-foreground/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_25%,transparent)]" : "border-border", hidden && "opacity-35")}>
    <CardBody lead={lead} labels={labels} currentUserId={currentUserId} />
    {canEdit && <div className="absolute end-2 top-2 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <StatusMenu status={lead.status} labels={labels} onChange={onMove} align="end" trigger={<button type="button" className="grid size-7 place-items-center rounded-lg bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted" aria-label={t(`Move ${lead.store_name}`, `نقل ${lead.store_name}`)}><MoreHorizontal className="size-4" /></button>} />
    </div>}
  </div>;
}

function CardBody({ lead, labels, currentUserId }: { lead: Lead; labels: Labels; currentUserId: string }) {
  const { t } = labels;
  const due = isDue(lead);
  return <div className="p-3.5">
    <p className="truncate pe-7 text-sm font-semibold" dir="auto">{lead.store_name}</p>
    <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="auto">{lead.contact_name}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <PlatformTag value={lead.store_platform} labels={labels} />
      <span className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground" dir="auto">{lead.source_label}</span>
      {lead.interest && <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{labels.interest(lead.interest)}</span>}
    </div>
    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">{labels.age(lead.created_at)}</span>
      {lead.next_follow_up_at && !["customer", "not_interested"].includes(lead.status) && <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5", due ? "bg-review-muted font-medium text-review" : "bg-muted")}><CalendarClock className="size-3" />{labels.relative(lead.next_follow_up_at)}</span>}
      {lead.owner_user_id && <span className={cn("ms-auto grid size-5 place-items-center rounded-full text-[10px] font-semibold", lead.owner_user_id === currentUserId ? "bg-foreground text-background" : "bg-muted text-muted-foreground")} title={lead.owner_user_id === currentUserId ? t("You", "أنت") : t("Teammate", "زميل")}>{lead.owner_user_id === currentUserId ? t("Y", "أ") : "•"}</span>}
    </div>
  </div>;
}

/* ───────────────────────── Table ───────────────────────── */

type SortKey = "store_name" | "contact_name" | "status" | "store_platform" | "source_label" | "next_follow_up_at" | "created_at";

function Table({ leads, allLeads, status, labels, canEdit, selectedId, onOpen, onStatus, update }: Props) {
  const { t } = labels;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created_at", dir: -1 });
  const rows = useMemo(() => {
    const scoped = status ? leads.filter((lead) => lead.status === status) : leads;
    const order = (lead: Lead) => sort.key === "status" ? STATUSES.indexOf(lead.status as never) : sort.key === "store_platform" ? (platformOf(lead.store_platform) ?? "") : (lead[sort.key] ?? "");
    return [...scoped].sort((a, b) => {
      const x = order(a); const y = order(b);
      if (x === y) return 0;
      if (x === "") return 1;
      if (y === "") return -1;
      return (x < y ? -1 : 1) * sort.dir;
    });
  }, [leads, status, sort]);
  const head = (key: SortKey, label: string, className?: string) => <th className={cn("px-4 py-3 text-start font-medium", className)}>
    <button type="button" onClick={() => setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "created_at" ? -1 : 1 }))} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
      {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  </th>;

  return <div className="space-y-3">
    <div className="admin-scroll-row flex flex-wrap gap-2">
      <FilterChip active={!status} onClick={() => onStatus(null)} count={leads.length}>{t("All", "الكل")}</FilterChip>
      {STATUSES.map((option) => <FilterChip key={option} active={status === option} onClick={() => onStatus(status === option ? null : option)} count={leads.filter((lead) => lead.status === option).length}><StatusDot status={option} className="size-1.5" />{labels.status(option)}</FilterChip>)}
    </div>
    {/* Phones: the same rows as cards (a wide table only scrolls sideways there). */}
    <ul className="space-y-2 md:hidden">
      <AnimatePresence initial={false}>
        {rows.map((lead) => <motion.li key={lead.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}>
          <div role="button" tabIndex={0} onClick={() => onOpen(lead.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(lead.id); }} className={cn("admin-card flex items-start gap-3 rounded-2xl border bg-card p-3.5 outline-none transition-[background-color,transform] duration-150 active:scale-[.99] focus-visible:ring-2 focus-visible:ring-ring/60", selectedId === lead.id ? "border-foreground/40" : "border-border")}>
            <Initial name={lead.store_name} className="size-10 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><strong className="block truncate text-sm font-semibold" dir="auto">{lead.store_name}</strong><span className="block truncate text-xs text-muted-foreground" dir="auto">{lead.contact_name}</span></div>
                <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} className="shrink-0">{canEdit ? <StatusMenu status={lead.status} labels={labels} align="end" onChange={(next) => void update(lead.id, { status: next }, { message: t(`${lead.store_name} → ${labels.status(next)}`, `${lead.store_name} ← ${labels.status(next)}`), undoable: true })} /> : <StatusPill status={lead.status} label={labels.status(lead.status)} />}</div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <PlatformTag value={lead.store_platform} labels={labels} />
                <span className="max-w-[140px] truncate rounded-md bg-muted px-1.5 py-0.5" dir="auto">{lead.source_label}</span>
                {lead.next_follow_up_at && <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5", isDue(lead) ? "bg-review-muted font-medium text-review" : "bg-muted")}><CalendarClock className="size-3" />{labels.relative(lead.next_follow_up_at)}</span>}
                <span className="ms-auto tabular-nums">{labels.age(lead.created_at)}</span>
              </div>
            </div>
          </div>
        </motion.li>)}
      </AnimatePresence>
    </ul>
    {!rows.length && allLeads.length > 0 && <div className="admin-card rounded-2xl border border-border bg-card md:hidden"><EmptyState title={t("No leads in this view", "لا يوجد عملاء في هذا العرض")} /></div>}
    <div className="admin-card hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="sticky top-0 border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>{head("store_name", t("Store", "المتجر"))}{head("status", t("Status", "الحالة"))}{head("store_platform", t("Platform", "المنصة"))}{head("source_label", t("Source", "المصدر"))}{head("next_follow_up_at", t("Follow-up", "المتابعة"))}{head("created_at", t("Added", "أُضيف"), "text-end")}</tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            <AnimatePresence initial={false}>
              {rows.map((lead) => <motion.tr key={lead.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} onClick={() => onOpen(lead.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(lead.id); }} tabIndex={0} className={cn("cursor-pointer outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/60", selectedId === lead.id && "bg-muted/70")}>
                <td className="px-4 py-3"><span className="flex items-center gap-3"><Initial name={lead.store_name} className="size-8 rounded-lg text-xs" /><span className="min-w-0"><strong className="block truncate font-semibold" dir="auto">{lead.store_name}</strong><span className="block truncate text-xs text-muted-foreground" dir="auto">{lead.contact_name}</span></span></span></td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>{canEdit ? <StatusMenu status={lead.status} labels={labels} onChange={(next) => void update(lead.id, { status: next }, { message: t(`${lead.store_name} → ${labels.status(next)}`, `${lead.store_name} ← ${labels.status(next)}`), undoable: true })} /> : <StatusPill status={lead.status} label={labels.status(lead.status)} />}</td>
                <td className="px-4 py-3"><PlatformTag value={lead.store_platform} labels={labels} showUnknown /></td>
                <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground" dir="auto">{lead.source_label}</td>
                <td className="px-4 py-3">{lead.next_follow_up_at ? <span className={cn("text-xs", isDue(lead) ? "font-medium text-review" : "text-muted-foreground")}>{labels.relative(lead.next_follow_up_at)}</span> : <span className="text-xs text-muted-foreground/60">—</span>}</td>
                <td className="px-4 py-3 text-end text-xs tabular-nums text-muted-foreground">{labels.date(lead.created_at)}</td>
              </motion.tr>)}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      {!rows.length && allLeads.length > 0 && <EmptyState title={t("No leads in this view", "لا يوجد عملاء في هذا العرض")} />}
    </div>
  </div>;
}

export function platformName(value: Platform | "unknown", labels: Labels) {
  if (value === "unknown") return labels.t("Not given", "غير محددة");
  return labels.isArabic ? PLATFORM_LABEL[value].ar : PLATFORM_LABEL[value].en;
}

/** The lead's store platform as a small tagged chip. */
export function PlatformTag({ value, labels, showUnknown }: { value: string | null; labels: Labels; showUnknown?: boolean }) {
  const platform = platformOf(value);
  if (!platform && !showUnknown) return null;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", platform ? "border-border bg-background text-foreground" : "border-dashed border-border text-muted-foreground")}>
    <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: PLATFORM_COLOR[platform ?? "unknown"] }} />
    {platformName(platform ?? "unknown", labels)}
  </span>;
}
