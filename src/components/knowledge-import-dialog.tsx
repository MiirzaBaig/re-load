"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ClipboardPaste, Download, FileText, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUICK, Segmented, TWEEN } from "@/components/desk/primitives";
import { ProgressChecklist, SuccessMark } from "@/components/integrations/connect-stepper";
import { useLanguage } from "@/components/language-provider";
import { supabase } from "@/lib/supabase";
import { KnowledgeLinkGuide } from "@/components/knowledge-link-guide";
import { cn } from "@/lib/utils";

/** The link field and the text box trade places: one folds, the other opens. */
const SWAP = { ...TWEEN, duration: 0.34 } as const;
const MIN_TEXT = 40;
const MAX_TEXT = 30000;

function isPublicUrl(value: string) {
  try { const url = new URL(value.trim()); return url.protocol === "https:" || url.protocol === "http:" ? url.hostname.includes(".") : false; } catch { return false; }
}

export function KnowledgeImportDialog({
  storeId,
  onImported,
  platform,
  onGuidedSetup,
}: {
  storeId: string;
  platform?: "zid" | "salla";
  onGuidedSetup: () => void;
  onImported: (ids: string[]) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"URL" | "TEXT">("URL");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestInFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    created: number;
    duplicates: number;
    warnings: string[];
    sourceLabel: string;
  } | null>(null);
  async function run() {
    if (!supabase || requestInFlight.current) return;
    requestInFlight.current = true;
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
        sourceLabel: kind === "URL" ? (typeof data.sourceUrl === "string" ? data.sourceUrl : source.trim()) : "",
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

      requestInFlight.current = false;
      setBusy(false);
    }
  }
  const valid = kind === "URL" ? isPublicUrl(source) : source.trim().length >= MIN_TEXT;
  const paste = async () => {
    try { setSource((await navigator.clipboard.readText()).trim()); setError(""); }
    catch { inputRef.current?.focus(); }
  };
  return (
    <>
      <Button onClick={() => { setOpen(true); setResult(null); setError(""); }} className="transition-transform active:scale-[.98]">
        <Download className="size-4" />
        {t("Import and review", "استيراد ومراجعة")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-6 pb-5 pt-6 text-start">
            <DialogTitle className="font-display text-xl tracking-tight">{t("Import what you already have", "استورد ما لديك")}</DialogTitle>
            <DialogDescription className="leading-6">
              {t("Bring a page from your own store, or paste your answers. We’ll prepare drafts for you to approve.", "أضف صفحة من متجرك أو انسخ إجاباتك. نجهّز مسودات تراجعها وتعتمدها.")}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait" initial={false}>
            {result ? (
              <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="flex flex-col items-center px-6 py-8 text-center">
                <SuccessMark />
                <p className="mt-4 font-display text-lg font-semibold tracking-tight">
                  {result.created > 0 ? t(`${result.created} drafts ready to review`, `${result.created} مسودات جاهزة للمراجعة`) : t("No new drafts added", "ما أضفنا مسودات جديدة")}
                </p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  {result.duplicates
                    ? t(`${result.duplicates} existing answers were left untouched.`, `${result.duplicates} إجابات موجودة بقيت بدون تغيير.`)
                    : t("Open each answer, check its source, then edit or approve it.", "افتح كل إجابة، راجع مصدرها، ثم عدّلها أو اعتمدها.")}
                </p>
                <div className="mt-4 w-full rounded-xl border border-border bg-muted/30 p-3 text-start">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("Source", "المصدر")}</p>
                  <p dir={result.sourceLabel ? "ltr" : "auto"} className="mt-1 break-words text-xs leading-5 [overflow-wrap:anywhere]">{result.sourceLabel || t("Your pasted store text", "نص متجرك المنسوخ")}</p>
                </div>
                {result.warnings.length > 0 && (
                  <div className="mt-5 w-full space-y-1.5 rounded-xl border border-review/25 bg-review-muted/40 p-4 text-start">
                    <p className="text-xs font-semibold text-review">{t("Worth checking", "تحتاج مراجعة")}</p>
                    {result.warnings.map((warning, index) => <p key={index} dir="auto" className="text-sm leading-6 text-muted-foreground">{warning}</p>)}
                  </div>
                )}
                <Button className="mt-6 h-11 w-full rounded-xl" onClick={() => setOpen(false)}>
                  {t("Review answers", "مراجعة الإجابات")}<ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </motion.div>
            ) : busy ? (
              <motion.div key="busy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="space-y-4 px-6 py-6">
                <ProgressChecklist done={0} items={[t("Preparing drafts from your source", "تجهيز مسودات من مصدرك")]} />
                <p aria-live="polite" className="text-center text-xs text-muted-foreground">{t("This can take about a minute. Please keep this window open.", "قد يستغرق حوالي دقيقة. خلّ النافذة مفتوحة.")}</p>
              </motion.div>
            ) : (
              <motion.form key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="space-y-4 px-6 py-6"
                onSubmit={(event) => { event.preventDefault(); if (valid) void run(); }}>
                <Segmented value={kind} label={t("Source", "المصدر")} className="flex w-full [&>button]:h-9 [&>button]:flex-1 [&>button]:justify-center [&>button]:text-sm"
                  onChange={(next) => { setKind(next); setSource(""); setError(""); }}
                  options={[{ value: "URL", label: t("Page link", "رابط الصفحة"), icon: Link2 }, { value: "TEXT", label: t("Paste text", "نسخ النص"), icon: FileText }]} />

                <AnimatePresence initial={false}>
                {kind === "URL" ? (
                  <motion.div key="url" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SWAP} className="-mx-1 overflow-hidden px-1">
                  <div className={cn("my-1 flex items-center gap-2 rounded-2xl border bg-background p-1.5 ps-3.5 transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)]",
                    error ? "border-destructive/50" : valid ? "border-eligible/50" : "border-border")}>
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <input ref={inputRef} dir="ltr" type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2000} value={source}
                      onChange={(event) => { setSource(event.target.value); setError(""); }}
                      placeholder="https://your-store.com/help" aria-label={t("Public page URL", "رابط الصفحة العامة")}
                      className="field-bare h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
                    <AnimatePresence initial={false} mode="popLayout">
                      {valid
                        ? <motion.span key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={QUICK} className="me-1 grid size-8 place-items-center rounded-full bg-eligible-muted text-eligible"><Check className="size-4" /></motion.span>
                        : <motion.button key="paste" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK} onClick={() => void paste()}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium transition-colors hover:bg-muted/70 active:scale-[.98]"><ClipboardPaste className="size-3.5" />{t("Paste", "لصق")}</motion.button>}
                    </AnimatePresence>
                  </div>
                  <p className="mb-3 mt-1 text-xs leading-5 text-muted-foreground">{t("A public FAQ, delivery or support page from your own store.", "صفحة عامة من متجرك: أسئلة شائعة أو توصيل أو دعم.")}</p>
                  <KnowledgeLinkGuide platform={platform} onPasteText={() => { setKind("TEXT"); setSource(""); setError(""); }} onGuided={() => { setOpen(false); onGuidedSetup(); }} />
                  </motion.div>
                ) : (
                  <motion.div key="text" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SWAP} className="-mx-1 overflow-hidden px-1">
                    <div className="py-1">
                    <Textarea dir="auto" className="min-h-44 rounded-2xl leading-7" maxLength={MAX_TEXT} value={source}
                      aria-label={t("Store information", "معلومات المتجر")}
                      placeholder={t("Paste delivery, warranty, FAQs or store contact information…", "انسخ معلومات التوصيل أو الضمان أو الأسئلة الشائعة أو التواصل…")}
                      onChange={(event) => { setSource(event.target.value); setError(""); }} />
                    <p className={cn("mt-1.5 text-end text-[11px] tabular-nums transition-colors duration-200", valid ? "text-muted-foreground" : "text-muted-foreground/70")}>
                      {source.trim().length < MIN_TEXT
                        ? t(`${MIN_TEXT - source.trim().length} more characters needed`, `تحتاج ${MIN_TEXT - source.trim().length} حرفًا إضافيًا`)
                        : `${source.length.toLocaleString("en-US")} / ${MAX_TEXT.toLocaleString("en-US")}`}
                    </p>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.p key="error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden text-sm leading-6 text-destructive">{error}</motion.p>
                  )}
                </AnimatePresence>

                <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {[
                    t("Nothing is published until you approve it.", "لا يُنشر شيء حتى تعتمده."),
                    t("We keep the original wording and its source next to each draft.", "نحفظ النص الأصلي ومصدره بجانب كل مسودة."),
                    t("Prices, stock and return rules still come from your store and policy.", "الأسعار والمخزون وقواعد الإرجاع تبقى من متجرك وسياستك."),
                  ].map((line) => <li key={line} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-eligible" />{line}</li>)}
                </ul>

                <Button type="submit" className="h-11 w-full rounded-xl transition-transform active:scale-[.99]" disabled={!valid}>
                  {t("Create drafts", "إنشاء المسودات")}<ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
