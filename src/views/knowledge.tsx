"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ExternalLink, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { QUICK, Segmented, TWEEN } from "@/components/desk/primitives";
import { KnowledgeImportDialog } from "@/components/knowledge-import-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
 * Store knowledge: the answers the WhatsApp assistant is allowed to give.
 * A searchable list on one side, one answer open on the other. Nothing is
 * used with customers until the merchant approves it, and editing an approved
 * answer turns it back into a draft.
 */

type Entry = {
  id: string;
  title: string;
  content: string;
  category: string;
  language: string;
  published: boolean;
  source_url?: string | null;
  source_excerpt?: string | null;
  source_type?: string | null;
};
type Filter = "ALL" | "DRAFT" | "APPROVED";
type T = (en: string, ar: string) => string;

const empty: Entry = { id: "", title: "", content: "", category: "FAQ", language: "ar", published: false };
const MAX_CONTENT = 6000;

const topics = (t: T): Array<[string, string]> => [
  ["FAQ", t("Common questions", "الأسئلة الشائعة")],
  ["DELIVERY", t("Delivery", "التوصيل")],
  ["WARRANTY", t("Warranty", "الضمان")],
  ["SUPPORT", t("Customer support", "خدمة العملاء")],
  ["RETURNS", t("Return guidance", "معلومات الإرجاع")],
  ["SIZING", t("Size guides", "دليل المقاسات")],
  ["CARE", t("Product care", "العناية بالمنتج")],
  ["PAYMENTS", t("Payment methods", "طرق الدفع")],
  ["LOCATIONS", t("Locations and hours", "الفروع وأوقات العمل")],
  ["CANCELLATION", t("Cancellation", "إلغاء الطلب")],
];

/** One tap to start a common answer: the question and topic are filled in. */
const starters = (t: T): Array<{ category: string; title: string }> => [
  { category: "DELIVERY", title: t("How long does delivery take?", "كم يستغرق التوصيل؟") },
  { category: "WARRANTY", title: t("What does the warranty cover?", "ماذا يشمل الضمان؟") },
  { category: "SUPPORT", title: t("How can I reach your team?", "كيف أتواصل مع فريقكم؟") },
  { category: "PAYMENTS", title: t("Which payment methods do you accept?", "ما طرق الدفع المتاحة؟") },
];

const selectItem = "min-h-10 rounded-lg rtl:pl-8 rtl:pr-2 rtl:[&>[data-slot=select-item-indicator]]:right-auto rtl:[&>[data-slot=select-item-indicator]]:left-2";

export function KnowledgePage() {
  const { workspace } = useAuth();
  const { t, isArabic } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>(empty);
  const [busy, setBusy] = useState<"draft" | "publish" | "delete" | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pending, setPending] = useState<Entry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    if (!workspace || !supabase) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("store_knowledge")
      .select("id,title,content,category,language,published,source_url,source_excerpt,source_type")
      .eq("store_id", workspace.storeId)
      .order("updated_at", { ascending: false });
    if (error) toast.error(t("Could not load store knowledge.", "تعذّر تحميل معلومات المتجر."));
    else setEntries(data ?? []);
    setLoading(false);
  }, [workspace, t]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);

  const topicLabels = useMemo(() => Object.fromEntries(topics(t)), [t]);
  const counts = useMemo(() => ({
    ALL: entries.length,
    DRAFT: entries.filter((entry) => !entry.published).length,
    APPROVED: entries.filter((entry) => entry.published).length,
  }), [entries]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) =>
      (filter === "ALL" || (filter === "APPROVED" ? entry.published : !entry.published)) &&
      (!needle || `${entry.title} ${entry.content}`.toLowerCase().includes(needle)));
  }, [entries, filter, search]);

  const canSave = Boolean(draft.title.trim() && draft.content.trim()) && busy === null;

  function open(entry: Entry) {
    setDraft(entry);
    setDirty(false);
    // On a phone the editor sits below the list; bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    if (!entry.id) window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 120);
  }
  function select(entry: Entry) {
    if (dirty) setPending(entry);
    else open(entry);
  }
  function change(patch: Partial<Entry>) {
    setDraft((value) => ({ ...value, ...patch, published: false }));
    setDirty(true);
  }

  const save = useCallback(async (published: boolean) => {
    if (!supabase || !workspace || !draft.title.trim() || !draft.content.trim()) return;
    setBusy(published ? "publish" : "draft");
    const { data, error } = await supabase.functions.invoke("customer-service", {
      body: { action: "knowledge_save", storeId: workspace.storeId, ...draft, published },
    });
    if (error) toast.error(t("Could not save. Please try again.", "ما قدرنا نحفظ التعديلات. جرّب مرة ثانية."));
    else {
      setDraft((value) => ({ ...value, id: data.id, published }));
      setDirty(false);
      toast.success(published
        ? t("Approved and available to your assistant.", "تم الاعتماد، والمعلومة متاحة للمساعد.")
        : t("Draft saved.", "تم حفظ المسودة."));
      await load();
    }
    setBusy(null);
  }, [draft, load, t, workspace]);

  async function remove() {
    setConfirmDelete(false);
    if (!supabase || !workspace) return;
    setBusy("delete");
    const { error } = await supabase.functions.invoke("customer-service", {
      body: { action: "knowledge_delete", storeId: workspace.storeId, id: draft.id },
    });
    if (error) toast.error(t("Could not delete this entry.", "تعذّر حذف المعلومة."));
    else {
      setDraft(empty);
      setDirty(false);
      toast.success(t("Answer deleted.", "تم حذف الإجابة."));
      await load();
    }
    setBusy(null);
  }

  // Cmd/Ctrl+S saves the draft, Cmd/Ctrl+Enter approves it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || busy !== null) return;
      // Not while a dialog (import, confirm) is open on top of the page.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void save(false); }
      if (event.key === "Enter" && editorRef.current?.contains(event.target as Node)) { event.preventDefault(); void save(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, save]);

  const status = dirty ? "unsaved" : draft.published ? "approved" : draft.id ? "draft" : "new";
  const used = draft.content.length / MAX_CONTENT;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4">
      {/* ── Header ── */}
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TWEEN} className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">{t("Store knowledge", "معلومات المتجر")}</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("The answers your WhatsApp assistant may give. It only uses what you approve.", "الإجابات التي يُسمح لمساعد واتساب بتقديمها. لا يستخدم إلا ما تعتمده.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workspace && (
            <KnowledgeImportDialog
              storeId={workspace.storeId}
              onImported={async (ids) => {
                await load();
                setFilter("DRAFT");
                setSearch("");
                if (ids.length && !dirty && supabase) {
                  const { data } = await supabase.from("store_knowledge").select("*").eq("store_id", workspace.storeId).eq("id", ids[0]).single();
                  if (data) select(data);
                }
              }}
            />
          )}
          <Button variant="outline" onClick={() => select({ ...empty })} className="transition-transform active:scale-[.98]">
            <Plus className="size-4" />{t("New answer", "إجابة جديدة")}
          </Button>
        </div>
      </motion.header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ── List ── */}
        <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.05 }}
          aria-label={t("Knowledge entries", "المعلومات المحفوظة")} className="admin-card flex flex-col rounded-2xl border border-border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100svh-7rem)] lg:self-start">
          <div className="space-y-3 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("Search answers", "البحث في الإجابات")}
                placeholder={t("Search your answers…", "ابحث في إجاباتك…")} className="h-10 rounded-xl ps-9 pe-9" />
              <AnimatePresence>
                {search && (
                  <motion.button type="button" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={QUICK}
                    onClick={() => setSearch("")} aria-label={t("Clear search", "مسح البحث")}
                    className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></motion.button>
                )}
              </AnimatePresence>
            </div>
            <Segmented<Filter> value={filter} onChange={setFilter} label={t("Filter answers", "تصفية الإجابات")} className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
              options={[
                { value: "ALL", label: <>{t("All", "الكل")}<Count n={counts.ALL} /></> },
                { value: "DRAFT", label: <>{t("Drafts", "المسودات")}<Count n={counts.DRAFT} /></> },
                { value: "APPROVED", label: <>{t("Approved", "المعتمدة")}<Count n={counts.APPROVED} /></> },
              ]} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-1">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[62px] rounded-xl" />)}</div>
            ) : entries.length === 0 ? (
              <div className="px-3 py-6">
                <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><BookOpen className="size-4" /></span>
                <p className="mt-3 text-sm font-medium">{t("Start with a question customers ask a lot", "ابدأ بسؤال يتكرر من عملائك")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Pick one to begin, or write your own.", "اختر واحدًا للبدء، أو اكتب سؤالك.")}</p>
                <div className="mt-4 space-y-1.5">
                  {starters(t).map((starter, index) => (
                    <motion.button key={starter.title} type="button" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.1 + index * 0.05 }}
                      onClick={() => { open({ ...empty, ...starter, language: isArabic ? "ar" : "en" }); setDirty(true); }}
                      className="group flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-start text-sm transition-[border-color,background-color,transform] duration-200 hover:border-foreground/25 hover:bg-muted/40 active:scale-[.99]">
                      <Plus className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:rotate-90" />
                      <span className="min-w-0 flex-1 leading-5">{starter.title}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium">{t("No answers match", "لا توجد إجابات مطابقة")}</p>
                <button type="button" onClick={() => { setSearch(""); setFilter("ALL"); }} className="mt-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{t("Clear search and filter", "مسح البحث والتصفية")}</button>
              </div>
            ) : (
              <ul className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {visible.map((entry) => {
                    const active = draft.id === entry.id;
                    return (
                      <motion.li key={entry.id} layout="position" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={QUICK}>
                        <button type="button" onClick={() => select(entry)} aria-current={active ? "true" : undefined}
                          className={cn("relative w-full rounded-xl px-3 py-2.5 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-muted" : "hover:bg-muted/50")}>
                          {active && <motion.span layoutId="knowledge-active" transition={TWEEN} className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-foreground" />}
                          <span className="block truncate text-sm font-medium" dir="auto">{entry.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className={cn("size-1.5 shrink-0 rounded-full", entry.published ? "bg-eligible" : "bg-review")} />
                            {entry.published ? t("Approved", "معتمد") : t("Draft", "مسودة")}
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{topicLabels[entry.category] ?? entry.category}</span>
                            <span aria-hidden="true">·</span>
                            {entry.language === "ar" ? "ع" : "EN"}
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.aside>

        {/* ── Editor ── */}
        <motion.form ref={editorRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TWEEN, delay: 0.1 }}
          className="admin-card flex scroll-mt-20 flex-col rounded-2xl border border-border bg-card"
          onSubmit={(event) => { event.preventDefault(); void save(false); }}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2 key={draft.id || "new"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={QUICK} className="text-[15px] font-semibold tracking-tight">
                {draft.id ? t("Edit answer", "تعديل الإجابة") : t("New answer", "إجابة جديدة")}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={status} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={QUICK} aria-live="polite"
                className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                  status === "approved" ? "bg-eligible-muted text-eligible" : status === "unsaved" ? "bg-review-muted text-review" : "bg-muted text-muted-foreground")}>
                <span className={cn("size-1.5 rounded-full", status === "approved" ? "bg-eligible" : status === "unsaved" ? "bg-review" : "bg-muted-foreground/60")} />
                {status === "unsaved" ? t("Unsaved changes", "تعديلات غير محفوظة") : status === "approved" ? t("Approved, in use", "معتمدة ومستخدمة") : status === "draft" ? t("Draft, not in use", "مسودة، غير مستخدمة") : t("Not saved yet", "لم تُحفظ بعد")}
              </motion.span>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={draft.id || "new"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
              <div className="space-y-2">
                <label htmlFor="knowledge-title" className="block text-sm font-medium">{t("Customer's question", "سؤال العميل")}</label>
                <Input id="knowledge-title" ref={titleRef} dir="auto" required maxLength={160} value={draft.title} onChange={(event) => change({ title: event.target.value })}
                  placeholder={t("How long does delivery take?", "كم يستغرق التوصيل؟")} className="h-11 rounded-xl text-[15px]" />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="knowledge-content" className="block text-sm font-medium">{t("Your answer", "إجابتك")}</label>
                  <span className={cn("text-[11px] tabular-nums transition-colors duration-200", used > 0.9 ? "font-medium text-review" : "text-muted-foreground")}>{draft.content.length.toLocaleString("en-US")} / {MAX_CONTENT.toLocaleString("en-US")}</span>
                </div>
                <Textarea id="knowledge-content" dir="auto" required maxLength={MAX_CONTENT} value={draft.content} onChange={(event) => change({ content: event.target.value })}
                  placeholder={t("Write the facts your customers should know. Include any exceptions.", "اكتب التفاصيل اللي يحتاجها العميل، ووضّح أي استثناءات.")}
                  className="min-h-48 rounded-xl leading-7 sm:min-h-56" />
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <label htmlFor="knowledge-topic" className="block text-sm font-medium">{t("Topic", "الموضوع")}</label>
                  <Select name="category" dir={isArabic ? "rtl" : "ltr"} value={draft.category} onValueChange={(category) => change({ category })}>
                    <SelectTrigger id="knowledge-topic" className="w-full rounded-xl bg-background data-[size=default]:h-11 hover:bg-muted/40"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" align="start" sideOffset={4} className="rounded-xl p-1 shadow-lg motion-reduce:animate-none">
                      {topics(t).map(([value, label]) => <SelectItem key={value} value={value} className={selectItem}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium" id="knowledge-language">{t("Answer language", "لغة الإجابة")}</p>
                  <Segmented value={draft.language === "en" ? "en" : "ar"} onChange={(language) => change({ language })} label={t("Answer language", "لغة الإجابة")}
                    className="h-11 [&>button]:h-full [&>button]:px-4 [&>button]:text-sm"
                    options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
                </div>
              </div>

              {draft.source_excerpt && (
                <details className="group rounded-xl border border-border text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    {t("Where this came from. Review before approving.", "مصدر هذه الإجابة. راجعه قبل الاعتماد.")}
                    <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <div className="border-t border-border px-4 py-3">
                    {draft.source_url
                      ? <a className="inline-flex items-center gap-1.5 break-all text-xs underline underline-offset-4 hover:text-foreground" href={draft.source_url} target="_blank" rel="noopener noreferrer" dir="ltr">{draft.source_url}<ExternalLink className="size-3 shrink-0" /></a>
                      : <p className="text-xs text-muted-foreground">{t("Pasted store text", "نص المتجر المنسوخ")}</p>}
                    <blockquote dir="auto" className="mt-3 whitespace-pre-wrap border-s-2 border-border ps-3 leading-7 text-muted-foreground">{draft.source_excerpt}</blockquote>
                  </div>
                </details>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Actions ── */}
          <div className="mt-auto flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3.5 backdrop-blur sm:px-7 lg:sticky lg:bottom-0">
            <Button type="button" disabled={!canSave} onClick={() => void save(true)} className="h-10 rounded-xl transition-transform active:scale-[.98]">
              {busy === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {t("Approve and publish", "اعتماد ونشر")}
              <kbd className="ms-1 hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 lg:inline">⌘↵</kbd>
            </Button>
            <Button type="submit" variant="outline" disabled={!canSave} className="h-10 rounded-xl transition-transform active:scale-[.98]">
              {busy === "draft" && <Loader2 className="size-4 animate-spin" />}
              {t("Save draft", "حفظ المسودة")}
              <kbd className="ms-1 hidden rounded border border-border px-1 font-sans text-[10px] text-muted-foreground lg:inline">⌘S</kbd>
            </Button>
            {draft.id && (
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(true)}
                className="h-10 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ms-auto">
                {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{t("Delete", "حذف")}
              </Button>
            )}
            <p className="w-full text-[11px] leading-5 text-muted-foreground">
              {t("Editing an approved answer makes it a draft until you approve it again. Return decisions still follow your published return policy.", "تعديل إجابة معتمدة يعيدها مسودة حتى تعتمدها من جديد. قرارات الإرجاع تبقى حسب سياسة الإرجاع المنشورة.")}
            </p>
          </div>
        </motion.form>
      </div>

      {/* ── Confirmations ── */}
      <AlertDialog open={pending !== null} onOpenChange={(value) => { if (!value) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Discard your changes?", "تجاهل تعديلاتك؟")}</AlertDialogTitle>
            <AlertDialogDescription>{t("You have edits that haven't been saved. Opening another answer will lose them.", "لديك تعديلات لم تُحفظ. فتح إجابة أخرى سيفقدها.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (pending) open(pending); setPending(null); }}>{t("Discard", "تجاهل")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete this answer?", "حذف هذه الإجابة؟")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Your assistant will stop using it straight away. This can't be undone.", "سيتوقف مساعدك عن استخدامها فورًا. لا يمكن التراجع.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep it", "إبقاؤها")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>{t("Delete", "حذف")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular-nums text-muted-foreground">{n}</span>;
}
