"use client";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, FileText, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeImportDialog } from "@/components/knowledge-import-dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase";

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
const empty: Entry = {
  id: "",
  title: "",
  content: "",
  category: "FAQ",
  language: "ar",
  published: false,
};
export function KnowledgePage() {
  const { workspace } = useAuth();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => {
    if (!workspace || !supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("store_knowledge")
      .select(
        "id,title,content,category,language,published,source_url,source_excerpt,source_type",
      )
      .eq("store_id", workspace.storeId)
      .order("updated_at", { ascending: false });
    if (error)
      toast.error(
        t("Could not load store knowledge.", "تعذّر تحميل معلومات المتجر."),
      );
    else setEntries(data ?? []);
    setLoading(false);
  }, [workspace, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function select(entry: Entry) {
    if (
      dirty &&
      !window.confirm(
        t("Discard your unsaved changes?", "تجاهل التعديلات غير المحفوظة؟"),
      )
    )
      return;
    setDraft(entry);
    setDirty(false);
  }
  function change(patch: Partial<Entry>) {
    setDraft((v) => ({ ...v, ...patch, published: false }));
    setDirty(true);
  }
  async function save(published: boolean) {
    if (!supabase || !workspace) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke(
      "customer-service",
      {
        body: {
          action: "knowledge_save",
          storeId: workspace.storeId,
          ...draft,
          published,
        },
      },
    );
    if (error)
      toast.error(
        t(
          "Could not save. Please try again.",
          "ما قدرنا نحفظ التعديلات. جرّب مرة ثانية.",
        ),
      );
    else {
      setDraft((v) => ({ ...v, id: data.id, published }));
      setDirty(false);
      toast.success(
        published
          ? t(
              "Approved and available to your assistant.",
              "تم الاعتماد، والمعلومة متاحة للمساعد.",
            )
          : t("Draft saved.", "تم حفظ المسودة."),
      );
      await load();
    }
    setBusy(false);
  }
  async function remove() {
    if (
      !supabase ||
      !workspace ||
      !window.confirm(
        t(
          "Delete this entry? The assistant will stop using it.",
          "حذف هذه المعلومة؟ سيتوقف المساعد عن استخدامها.",
        ),
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("customer-service", {
      body: {
        action: "knowledge_delete",
        storeId: workspace.storeId,
        id: draft.id,
      },
    });
    if (error)
      toast.error(t("Could not delete this entry.", "تعذّر حذف المعلومة."));
    else {
      setDraft(empty);
      setDirty(false);
      await load();
    }
    setBusy(false);
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 motion-safe:animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("Your store, in your words", "متجرك، بطريقتك")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            {t("Store knowledge", "معلومات المتجر")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t(
              "Give your assistant answers you trust. Only entries you approve are used in customer conversations.",
              "زوّد مساعدك بإجابات تثق فيها. ما يستخدم المعلومة مع العملاء إلا بعد اعتمادك.",
            )}
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
                  const { data } = await supabase
                    .from("store_knowledge")
                    .select("*")
                    .eq("store_id", workspace.storeId)
                    .eq("id", ids[0])
                    .single();
                  if (data) select(data);
                }
              }}
            />
          )}
          <Button variant="outline" onClick={() => select({ ...empty })}>
            <Plus className="size-4" />
            {t("New answer", "إجابة جديدة")}
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
        <Input
          className="min-w-0 flex-1 sm:max-w-sm"
          aria-label={t("Search answers", "البحث في الإجابات")}
          placeholder={t("Search your answers…", "ابحث في إجاباتك…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {["ALL", "DRAFT", "APPROVED"].map((v) => (
            <Button
              key={v}
              size="sm"
              variant={filter === v ? "secondary" : "ghost"}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v === "ALL"
                ? t("All", "الكل")
                : v === "DRAFT"
                  ? t("Drafts", "المسودات")
                  : t("Approved", "المعتمدة")}{" "}
              <span className="text-xs text-muted-foreground">
                {
                  entries.filter(
                    (e) =>
                      v === "ALL" ||
                      (v === "APPROVED" ? e.published : !e.published),
                  ).length
                }
              </span>
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside
          className="space-y-2 rounded-2xl border bg-card p-3 lg:self-start"
          aria-label={t("Knowledge entries", "المعلومات المحفوظة")}
        >
          {loading ? (
            <div className="grid h-32 place-items-center">
              <Spinner />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <BookOpen className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm">
                {t("Start with a common question", "ابدأ بسؤال يتكرر عندك")}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t(
                  "Delivery, warranties and how to reach your team.",
                  "التوصيل، الضمان، وطريقة التواصل مع فريقك.",
                )}
              </p>
            </div>
          ) : (
            entries
              .filter(
                (e) =>
                  (filter === "ALL" ||
                    (filter === "APPROVED" ? e.published : !e.published)) &&
                  `${e.title} ${e.content}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => select(e)}
                  className={`w-full rounded-xl p-3 text-start transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draft.id === e.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span
                      className="min-w-0 flex-1 text-sm font-medium"
                      dir="auto"
                    >
                      {e.title}
                    </span>
                    {e.published && (
                      <Check
                        className="size-4 text-eligible"
                        aria-label={t("Published", "منشور")}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.language === "ar" ? "العربية" : "English"} ·{" "}
                    {e.published ? t("Approved", "معتمد") : t("Draft", "مسودة")}
                  </p>
                </button>
              ))
          )}
        </aside>
        <form
          className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              {draft.id
                ? t("Edit answer", "تعديل الإجابة")
                : t("Add an answer", "إضافة إجابة")}
            </h2>
            <Badge variant="outline">
              {dirty
                ? t("Unsaved", "غير محفوظ")
                : draft.published
                  ? t("Approved", "معتمد")
                  : t("Draft", "مسودة")}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>{t("Topic", "الموضوع")}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.category}
                onChange={(e) => change({ category: e.target.value })}
              >
                {[
                  ["FAQ", t("Common questions", "الأسئلة الشائعة")],
                  ["DELIVERY", t("Delivery", "التوصيل")],
                  ["WARRANTY", t("Warranty", "الضمان")],
                  ["SUPPORT", t("Customer support", "خدمة العملاء")],
                  ["RETURNS", t("Return guidance", "معلومات الإرجاع")],
                  ["SIZING", t("Size guides", "دليل المقاسات")],
                  ["CARE", t("Product care", "العناية بالمنتج")],
                  ["PAYMENTS", t("Payment methods", "طرق الدفع")],
                  [
                    "LOCATIONS",
                    t("Locations and hours", "الفروع وأوقات العمل"),
                  ],
                  ["CANCELLATION", t("Cancellation", "إلغاء الطلب")],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>{t("Answer language", "لغة الإجابة")}</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.language}
                onChange={(e) => change({ language: e.target.value })}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm">
            <span>{t("Question or title", "السؤال أو العنوان")}</span>
            <Input
              dir="auto"
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
              placeholder={t(
                "How long does delivery take?",
                "كم يستغرق التوصيل؟",
              )}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>{t("Approved store answer", "إجابة المتجر")}</span>
            <Textarea
              dir="auto"
              required
              maxLength={6000}
              className="min-h-56 leading-7"
              value={draft.content}
              onChange={(e) => change({ content: e.target.value })}
              placeholder={t(
                "Write the facts your customers should know. Include any exceptions.",
                "اكتب التفاصيل اللي يحتاجها العميل، ووضّح أي استثناءات.",
              )}
            />
            <span className="block text-end text-xs text-muted-foreground">
              {draft.content.length}/6000
            </span>
          </label>
          <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
            {t(
              "Changing an approved answer makes it a draft until you approve it again. Return eligibility still follows your published return policy.",
              "تعديل الإجابة يلغي اعتماد النسخة المعدّلة إلى أن تعتمدها مرة ثانية. أهلية الإرجاع تبقى حسب سياسة الإرجاع المنشورة.",
            )}
          </p>
          {draft.source_excerpt && (
            <details className="rounded-xl border p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                {t(
                  "Original source · review before approving",
                  "المصدر الأصلي · راجعه قبل الاعتماد",
                )}
              </summary>
              {draft.source_url ? (
                <a
                  className="mt-3 block break-all underline underline-offset-4"
                  href={draft.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {draft.source_url}
                </a>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("Pasted store text", "نص المتجر المنسوخ")}
                </p>
              )}
              <blockquote
                dir="auto"
                className="mt-3 whitespace-pre-wrap border-s-2 ps-3 text-muted-foreground leading-7"
              >
                {draft.source_excerpt}
              </blockquote>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !draft.title.trim() || !draft.content.trim()}
            >
              <Save className="size-4" />
              {t("Save draft", "حفظ المسودة")}
            </Button>
            <Button
              type="button"
              disabled={busy || !draft.title.trim() || !draft.content.trim()}
              onClick={() => void save(true)}
            >
              {busy ? <Spinner /> : <Check className="size-4" />}
              {t("Approve and publish", "اعتماد ونشر")}
            </Button>
            {draft.id && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:ms-auto"
                onClick={() => void remove()}
                disabled={busy}
              >
                <Trash2 className="size-4" />
                {t("Delete", "حذف")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
