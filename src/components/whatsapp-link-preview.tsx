"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TWEEN } from "@/components/desk/primitives";
import { useLanguage } from "@/components/language-provider";
import { createBrandQr } from "@/lib/brand-qr";
import { cn } from "@/lib/utils";
import { getWhatsAppStartUrl, RELOAD_WHATSAPP_NUMBER } from "@/lib/whatsapp";

/*
 * A sample of the customer's WhatsApp link, using a dummy store code: the QR,
 * the message it pre-fills, and the link with its two meaningful parts (the
 * shared number and the store code) picked out. DEMO-NOVA is not a store, so
 * nothing here can start a real return.
 */

const SAMPLE_CODE = "DEMO-NOVA";

export function WhatsAppLinkPreview() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = getWhatsAppStartUrl(RELOAD_WHATSAPP_NUMBER, SAMPLE_CODE);
  const qr = useMemo(() => createBrandQr(link), [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("Couldn’t copy the sample link.", "تعذّر نسخ الرابط التجريبي."));
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
        <QrCode className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{t("Preview a sample customer link", "معاينة رابط عميل تجريبي")}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t("Sample", "نموذج")}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={TWEEN} className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 border-t border-border p-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 sm:p-6">
              <div className="mx-auto w-full max-w-[200px] rounded-3xl border border-black/10 bg-[#f8f7f4] p-4 text-[#0f0f12]">
                <div className="[&>svg]:block [&>svg]:w-full" role="img" aria-label={t("Sample WhatsApp QR code", "رمز واتساب تجريبي")}
                  dangerouslySetInnerHTML={{ __html: qr.svg("ink", { transparent: true }) }} />
                <p className="mt-3 text-center text-[13px] font-semibold">{t("Scan to start a return", "امسح لبدء الإرجاع")}</p>
                <p className="text-center text-[11px] opacity-55">Nova Store</p>
              </div>

              <div className="min-w-0 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("Scanning opens WhatsApp with this message ready to send", "مسح الرمز يفتح واتساب وهذه الرسالة جاهزة للإرسال")}</p>
                  <p dir="ltr" className="mt-1.5 font-mono text-sm">return <span className="font-semibold text-brand-accent">{SAMPLE_CODE}</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("The link", "الرابط")}</p>
                  <p dir="ltr" className="mt-1.5 break-all rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 font-mono text-xs leading-6 text-muted-foreground">
                    https://wa.me/<span className="font-semibold text-foreground">{RELOAD_WHATSAPP_NUMBER}</span>?text=return%20<span className="font-semibold text-brand-accent">{SAMPLE_CODE}</span>
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-foreground" />{t("Reload’s shared WhatsApp number", "رقم واتساب ريلود المشترك")}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-brand-accent" />{t("Your store code, so the chat reaches only your store", "رمز متجرك، لتصل المحادثة إلى متجرك فقط")}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copy()} className="rounded-xl">
                    {copied ? <Check className="size-4 text-eligible" /> : <Copy className="size-4" />}
                    {copied ? t("Copied", "تم النسخ") : t("Copy sample link", "نسخ الرابط التجريبي")}
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="rounded-xl text-muted-foreground">
                    <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t("Open in WhatsApp", "فتح في واتساب")}</a>
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("DEMO-NOVA is a dummy code. It can’t activate a store or start a return.", "DEMO-NOVA رمز وهمي. لا يفعّل متجرًا ولا يبدأ إرجاعًا.")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
