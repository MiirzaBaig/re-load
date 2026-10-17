"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Download } from "lucide-react";
import { TWEEN } from "@/components/desk/primitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/locale-server";
import { cn } from "@/lib/utils";

/** Saudi-friendly: 05x… or 5x… becomes 9665x…; 00 and + prefixes are dropped. */
export function normalizeWhatsAppNumber(raw: string) {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = "966" + d.slice(1);
  else if (/^5\d{8}$/.test(d)) d = "966" + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}

export function WhatsAppLinkTool({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const reduce = useReducedMotion();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    t("Hello, I have a question about my order.", "السلام عليكم، عندي استفسار عن طلبي."),
  );
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  const number = normalizeWhatsAppNumber(phone);
  const link = useMemo(
    () => (number ? `https://wa.me/${number}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}` : ""),
    [number, message],
  );

  useEffect(() => {
    let live = true;
    if (!link) {
      setSvg("");
      return;
    }
    QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f0f12", light: "#ffffff" } })
      .then((out) => live && setSvg(out))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [link]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function download() {
    if (!link) return;
    const url = await QRCode.toDataURL(link, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatsapp-qr.png";
    a.click();
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="wa-phone" className="text-sm font-medium">
            {t("Store WhatsApp number", "رقم واتساب المتجر")}
          </label>
          <Input
            id="wa-phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 20))}
            placeholder="05x xxx xxxx"
            className="mt-2 h-11 rounded-xl text-start tabular-nums"
          />
          <p className={cn("mt-2 text-xs transition-colors", phone && !number ? "text-review" : "text-muted-foreground")}>
            {phone && !number
              ? t("Enter a full number, e.g. 05x xxx xxxx or +966 5x xxx xxxx.", "أدخل رقمًا كاملًا، مثل 05x xxx xxxx أو ‎+966 5x xxx xxxx.")
              : t("Saudi numbers starting with 05 are converted automatically.", "الأرقام السعودية التي تبدأ بـ 05 تُحوَّل تلقائيًا.")}
          </p>
        </div>
        <div>
          <label htmlFor="wa-msg" className="text-sm font-medium">
            {t("Ready message (optional)", "رسالة جاهزة (اختياري)")}
          </label>
          <Textarea
            id="wa-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 300))}
            rows={3}
            className="mt-2 rounded-xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Customers can edit it before sending.", "يمكن للعميل تعديلها قبل الإرسال.")}
          </p>
        </div>
      </form>

      <section aria-live="polite" className="lg:border-s lg:ps-10">
        <AnimatePresence mode="wait" initial={false}>
          {link ? (
            <motion.div
              key="ready"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ ...TWEEN, duration: 0.3 }}
            >
              <p className="text-sm font-medium">{t("Your link", "رابطك")}</p>
              {/* Readable on screen; the copy button copies the encoded link. */}
              <p dir="ltr" className="mt-2 line-clamp-3 break-all text-start text-sm text-muted-foreground">
                {decodeURIComponent(link)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium transition-[transform,background-color] duration-200 active:scale-[.97]",
                    copied ? "bg-eligible text-white" : "bg-foreground text-background hover:bg-foreground/90",
                  )}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? t("Copied", "تم النسخ") : t("Copy link", "نسخ الرابط")}
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-xl border px-3.5 text-xs font-medium transition-colors hover:bg-muted/50"
                >
                  {t("Test it", "جرّب الرابط")}
                </a>
              </div>
              {svg && (
                <motion.div
                  key={link}
                  initial={reduce ? false : { opacity: 0.4, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...TWEEN, duration: 0.25 }}
                  className="mt-8"
                >
                  <div
                    role="img"
                    aria-label={t("QR code for your WhatsApp link", "رمز QR لرابط واتساب")}
                    className="w-52 overflow-hidden rounded-2xl bg-white p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <button
                    type="button"
                    onClick={() => void download()}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
                  >
                    <Download className="size-3.5" />
                    {t("Download QR (PNG)", "تنزيل رمز QR (PNG)")}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              className="text-sm leading-7 text-muted-foreground"
            >
              {t(
                "Your link and QR code appear here as soon as you enter a number.",
                "يظهر رابطك ورمز QR هنا بمجرد إدخال الرقم.",
              )}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="mt-10 border-t pt-4 text-xs leading-6 text-muted-foreground">
          {t(
            "Built in your browser. Your number isn't sent or saved.",
            "يُنشأ في متصفحك. لا يُرسل رقمك ولا يُحفظ.",
          )}
        </p>
      </section>
    </div>
  );
}
