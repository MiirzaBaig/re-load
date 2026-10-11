"use client";
import { useMemo, useState } from "react";
import { Copy, Check, Eye, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { createBrandQr } from "@/lib/brand-qr";
import { getWhatsAppStartUrl, RELOAD_WHATSAPP_NUMBER } from "@/lib/whatsapp";
const SAMPLE_CODE = "00000000-0000-4000-8000-000000000000";
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
      toast.error(
        t("Couldn’t copy the sample link.", "تعذّر نسخ الرابط التجريبي."),
      );
    }
  }
  return (
    <div className="mt-4 rounded-2xl border border-dashed bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye className="size-4 shrink-0" />
        <span className="flex-1 text-sm font-medium">
          {t("Preview a sample customer link", "معاينة رابط عميل تجريبي")}
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          {t("Preview only", "معاينة فقط")}
        </span>
      </button>
      {open && (
        <div className="grid gap-5 border-t p-4 motion-safe:animate-fade-in sm:grid-cols-[160px_1fr]">
          <div>
            <div
              className="rounded-xl bg-[#f8f7f4] p-2 [&>svg]:w-full"
              role="img"
              aria-label={t("Sample WhatsApp QR code", "رمز واتساب تجريبي")}
              dangerouslySetInnerHTML={{ __html: qr.svg("ink") }}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              <QrCode className="me-1 inline size-3" />
              {t("Sample Nova Store", "متجر نوفا التجريبي")}
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {t(
                "This shows the real link format using a dummy store code. It doesn’t activate a store or create customer records. Scanning it opens WhatsApp; sending this dummy code won’t start a return.",
                "هذه صيغة الرابط الفعلية برمز متجر وهمي. ما تفعّل متجر ولا تنشئ سجلات عملاء. مسح الرمز يفتح واتساب، لكن إرسال الرمز الوهمي ما يبدأ طلب إرجاع.",
              )}
            </p>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">
                {t(
                  "Prefilled message · the customer presses Send",
                  "الرسالة الجاهزة · العميل يضغط إرسال",
                )}
              </p>
              <p dir="ltr" className="mt-2 break-all font-mono text-xs">
                return {SAMPLE_CODE}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {t("WhatsApp link", "رابط واتساب")}
              </p>
              <p dir="ltr" className="mt-2 break-all text-xs leading-5">
                {link}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied
                  ? t("Copied", "تم النسخ")
                  : t("Copy sample", "نسخ النموذج")}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  {t("Preview in WhatsApp", "معاينة في واتساب")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
