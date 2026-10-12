"use client";

import Image from "next/image";
import { Fragment, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, ExternalLink, HelpCircle, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { QUICK, Segmented, TWEEN } from "@/components/desk/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * "Where do I find my page link?" inside the knowledge import dialog.
 * The dashboard path is drawn as the menu items the merchant will click, and
 * what to paste is shown as real-looking links: the right one, and the three
 * people paste by mistake. Zid and Salla's own help pages are linked only as
 * directions; they are never imported as a store's knowledge.
 */

const SALLA_GUIDE = "https://help.salla.sa/article/%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A7%D8%AA-%D8%A7%D9%84%D8%AA%D8%B9%D8%B1%D9%8A%D9%81%D9%8A%D8%A9/kdcldn0jro4n50amy4zwusga";
const ZID_GUIDE = "https://help.zid.sa/faq/";

type Platform = "zid" | "salla";

export function KnowledgeLinkGuide({ platform, onPasteText, onGuided }: {
  platform?: Platform;
  onPasteText: () => void;
  onGuided: () => void;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Platform>(platform ?? "zid");

  const guide = choice === "zid"
    ? {
        path: [t("Online store", "المتجر الإلكتروني"), t("FAQs or Pages", "الأسئلة الشائعة أو الصفحات")],
        then: t("Open the page on your storefront, then copy its address from the browser.", "افتح الصفحة في واجهة متجرك، ثم انسخ رابطها من المتصفح."),
        dashboard: "web.zid.sa/…", help: "help.zid.sa/…", href: ZID_GUIDE, name: t("Zid", "زد"),
      }
    : {
        path: [t("Store & sales channels", "المتجر وقنوات البيع"), t("Informational pages", "الصفحات التعريفية"), t("⋯ Copy link", "⋯ نسخ الرابط")],
        then: t("Pick a published page, open its ⋯ menu and copy the link.", "اختر صفحة منشورة، افتح قائمة ⋯ وانسخ الرابط."),
        dashboard: "s.salla.sa/…", help: "help.salla.sa/…", href: SALLA_GUIDE, name: t("Salla", "سلة"),
      };

  const logo = (which: Platform) => which === "zid"
    ? <Image src="/zid-logo.png" alt="" width={16} height={16} className="size-4 rounded" />
    : <span className="grid size-4 place-items-center rounded bg-[#004d5a]"><Image src="/salla-logo.png" alt="" width={11} height={11} /></span>;

  return (
    <div className="min-w-0 rounded-2xl border border-border">
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { if (!open && platform) setChoice(platform); setOpen(!open); }}
        className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-start text-sm transition-colors hover:bg-muted/40">
        <HelpCircle className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 font-medium">{t("Where do I find my page link?", "وين ألقى رابط صفحتي؟")}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...TWEEN, duration: 0.3 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-border p-3.5">
              <Segmented value={choice} onChange={setChoice} label={t("Store platform", "منصة المتجر")} className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                options={[
                  { value: "zid", label: <span className="inline-flex items-center gap-1.5">{logo("zid")}{t("Zid", "زد")}</span> },
                  { value: "salla", label: <span className="inline-flex items-center gap-1.5">{logo("salla")}{t("Salla", "سلة")}</span> },
                ]} />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={choice} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="space-y-4">
                  {/* The clicks, in order */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t(`In your ${guide.name} dashboard`, `في لوحة تحكم ${guide.name}`)}</p>
                    <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                      {guide.path.map((step, index) => (
                        <Fragment key={step}>
                          {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />}
                          <motion.li initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ ...QUICK, delay: 0.06 + index * 0.07 }}
                            className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium">{step}</motion.li>
                        </Fragment>
                      ))}
                    </ol>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {guide.then}{" "}
                      <a href={guide.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap underline underline-offset-4 hover:text-foreground">
                        {t(`${guide.name}'s guide`, `دليل ${guide.name}`)}<ExternalLink className="size-3" />
                      </a>
                    </p>
                  </div>

                  {/* What to paste, by example */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{t("What to paste", "ما الذي تلصقه")}</p>
                    <ul className="mt-2 space-y-1">
                      <Example good url="your-store.com/faq" note={t("One of your own public pages", "صفحة عامة من متجرك")} />
                      <Example url="your-store.com" note={t("Your homepage", "الصفحة الرئيسية")} />
                      <Example url={guide.dashboard} note={t("Your dashboard", "لوحة التحكم")} />
                      <Example url={guide.help} note={t(`${guide.name}'s help centre`, `مركز مساعدة ${guide.name}`)} />
                    </ul>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("One page per import. It must open without signing in.", "صفحة واحدة لكل استيراد، ويجب أن تفتح دون تسجيل دخول.")}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* No page */}
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <p className="text-xs font-medium sm:flex-1">{t("No page yet? No problem.", "ما عندك صفحة؟ عادي.")}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-background text-xs transition-transform active:scale-[.97]" onClick={onPasteText}>{t("Paste my answers", "نسخ إجاباتي")}</Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-background text-xs transition-transform active:scale-[.97]" onClick={onGuided}>{t("Guided setup", "إعداد خطوة بخطوة")}</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Example({ url, note, good = false }: { url: string; note: string; good?: boolean }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs", good ? "bg-eligible-muted/60" : "")}>
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-full", good ? "bg-eligible text-eligible-foreground" : "bg-muted text-muted-foreground")}>
        {good ? <Check className="size-2.5" strokeWidth={3.5} /> : <X className="size-2.5" strokeWidth={3} />}
      </span>
      <span dir="ltr" className={cn("shrink-0 whitespace-nowrap font-mono", good ? "font-semibold" : "text-muted-foreground line-through decoration-muted-foreground/40")}>{url}</span>
      <span className="ms-auto min-w-0 text-end leading-4 text-muted-foreground">{note}</span>
    </li>
  );
}
