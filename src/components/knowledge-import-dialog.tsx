"use client";
import { useState } from "react";
import { ArrowRight, FileText, Link2, Download, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useLanguage } from "@/components/language-provider";
import { supabase } from "@/lib/supabase";
export function KnowledgeImportDialog({
  storeId,
  onImported,
}: {
  storeId: string;
  onImported: (ids: string[]) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"URL" | "TEXT">("URL");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    duplicates: number;
    warnings: string[];
  } | null>(null);
  async function run() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "customer-service",
        {
          body: {
            action: "knowledge_import",
            storeId,
            sourceType: kind,
            source,
          },
        },
      );
      if (error) {
        const details = await (error as { context?: Response }).context
          ?.json()
          .catch(() => null);
        throw new Error(details?.error ?? "import_failed");
      }
      setResult({
        created: data.created,
        duplicates: data.duplicates ?? 0,
        warnings: data.warnings ?? [],
      });
      await onImported(data.ids ?? []);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "import_rate_limit"
          ? t(
              "You’ve imported several pages. Please try again in an hour.",
              "استوردت عدة صفحات. جرّب مرة ثانية بعد ساعة.",
            )
          : code === "invalid_import" || code === "extraction_unavailable"
            ? t(
                "We couldn’t prepare reliable drafts. Try a shorter passage or add an answer manually.",
                "ما قدرنا نجهّز مسودات موثوقة. جرّب نص أقصر أو أضف الإجابة يدويًا.",
              )
            : t(
                "We couldn’t read this source. Try the exact help page, or paste its text instead.",
                "ما قدرنا نقرأ المصدر. جرّب رابط صفحة المساعدة نفسها، أو انسخ نصها هنا.",
              ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setResult(null);
          setError("");
        }}
      >
        <Download className="size-4" />
        {t("Import and review", "استيراد ومراجعة")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t(
                "Start with what you already have",
                "ابدأ بالمعلومات الموجودة عندك",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Import one public help page or paste its text. We’ll organise the facts into drafts. Nothing is published automatically.",
                "أضف رابط صفحة مساعدة عامة أو انسخ نصها. نرتّب المعلومات في مسودات، وما ينشر شيء بدون اعتمادك.",
              )}
            </DialogDescription>
          </DialogHeader>
          {result ? (
            <div className="space-y-5 motion-safe:animate-fade-in">
              <div className="flex gap-3 rounded-xl bg-muted/60 p-4">
                <Check className="mt-1 size-5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {result.created > 0
                      ? t(
                          `${result.created} drafts ready to review`,
                          `${result.created} مسودات جاهزة للمراجعة`,
                        )
                      : t("No new drafts added", "ما أضفنا مسودات جديدة")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.duplicates
                      ? t(
                          `${result.duplicates} existing answers were left untouched.`,
                          `${result.duplicates} إجابات موجودة بقيت بدون تغيير.`,
                        )
                      : t(
                          "Open each answer, check its source, then edit or approve it.",
                          "افتح كل إجابة، راجع مصدرها، ثم عدّلها أو اعتمدها.",
                        )}
                  </p>
                </div>
              </div>
              {result.warnings.length > 0 && (
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-medium">
                    {t("Worth checking", "تحتاج مراجعة")}
                  </p>
                  {result.warnings.map((w, i) => (
                    <p
                      key={i}
                      dir="auto"
                      className="text-sm leading-6 text-muted-foreground"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}
              <Button className="w-full" onClick={() => setOpen(false)}>
                {t("Review answers", "مراجعة الإجابات")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                {(["URL", "TEXT"] as const).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    disabled={busy}
                    variant={kind === k ? "secondary" : "outline"}
                    aria-pressed={kind === k}
                    onClick={() => {
                      setKind(k);
                      setSource("");
                      setError("");
                    }}
                  >
                    {k === "URL" ? (
                      <Link2 className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    {k === "URL"
                      ? t("Page link", "رابط الصفحة")
                      : t("Paste text", "نسخ النص")}
                  </Button>
                ))}
              </div>
              <label className="block space-y-2 text-sm">
                <span>
                  {kind === "URL"
                    ? t("Public page URL", "رابط الصفحة العامة")
                    : t("Store information", "معلومات المتجر")}
                </span>
                {kind === "URL" ? (
                  <Input
                    dir="ltr"
                    type="url"
                    required
                    placeholder="https://your-store.com/help"
                    value={source}
                    maxLength={2000}
                    disabled={busy}
                    onChange={(e) => setSource(e.target.value)}
                  />
                ) : (
                  <Textarea
                    dir="auto"
                    className="min-h-48 leading-7"
                    required
                    minLength={40}
                    maxLength={30000}
                    placeholder={t(
                      "Paste delivery, warranty, FAQs or store contact information…",
                      "انسخ معلومات التوصيل أو الضمان أو الأسئلة الشائعة أو التواصل…",
                    )}
                    value={source}
                    disabled={busy}
                    onChange={(e) => setSource(e.target.value)}
                  />
                )}
              </label>
              <p className="rounded-xl bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
                {t(
                  "We keep the original wording and source. Return guidance won’t change your eligibility rules. Prices, stock and order updates still come from your connected store.",
                  "نحفظ النص الأصلي ومصدره. معلومات الإرجاع ما تغيّر قواعد الأهلية. الأسعار والمخزون وتحديثات الطلبات تبقى من متجرك المرتبط.",
                )}
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || source.trim().length < 10}
              >
                {busy ? (
                  <>
                    <Spinner />
                    {t("Preparing your drafts…", "نجهّز مسوداتك…")}
                  </>
                ) : (
                  <>
                    {t("Create review drafts", "إنشاء مسودات للمراجعة")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </>
                )}
              </Button>
              <p
                aria-live="polite"
                className="text-center text-xs text-muted-foreground"
              >
                {busy
                  ? t(
                      "This can take about a minute. Please keep this window open.",
                      "قد يستغرق حوالي دقيقة. خلّ النافذة مفتوحة.",
                    )
                  : t(
                      "You decide what your assistant can use.",
                      "أنت تحدد المعلومات اللي يستخدمها مساعدك.",
                    )}
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
