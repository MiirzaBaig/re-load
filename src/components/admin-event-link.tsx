"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FileImage, Loader2, QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { createBrandQr, DOT_R, EVENT_QR_URL, INK, PAPER, type QrTheme } from "@/lib/brand-qr";
import { renderEventPoster, renderQrPng, type PosterTheme } from "@/lib/event-poster";

type Asset = "svg" | "png" | "poster-light" | "poster-dark";

/** Event kit: the branded sign-up code, ready to download for a stand. */
export function AdminEventLink() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<QrTheme>("ink");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Asset | null>(null);
  const qr = useMemo(() => createBrandQr(), []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(EVENT_QR_URL); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { toast.error(t("Could not copy the link.", "تعذّر نسخ الرابط.")); }
  };

  const download = async (asset: Asset) => {
    setBusy(asset);
    try {
      const suffix = theme === "ink" ? "" : "-inverted";
      if (asset === "svg") save(new Blob([qr.svg(theme)], { type: "image/svg+xml" }), `reload-event-qr${suffix}.svg`);
      if (asset === "png") save(await renderQrPng(qr.svg(theme)), `reload-event-qr${suffix}.png`);
      if (asset === "poster-light" || asset === "poster-dark") {
        const posterTheme: PosterTheme = asset === "poster-light" ? "light" : "dark";
        save(await renderEventPoster(qr, posterTheme), `reload-event-poster-${posterTheme}.png`);
      }
    } catch {
      toast.error(t("Could not prepare the file. Try again.", "تعذّر تجهيز الملف. حاول مرة أخرى."));
    } finally {
      setBusy(null);
    }
  };

  const assets: Array<{ id: Asset; title: string; meta: string; icon: typeof QrCode }> = [
    { id: "svg", title: t("Code · SVG", "الرمز · SVG"), meta: t("Vector. Send this to the printer.", "ملف متجه. أرسله للمطبعة."), icon: QrCode },
    { id: "png", title: t("Code · PNG", "الرمز · PNG"), meta: t("2048 px. For slides and posts.", "2048 بكسل. للعروض والمنشورات."), icon: FileImage },
    { id: "poster-light", title: t("Poster · Light", "الملصق · فاتح"), meta: t("A4 or A5, 300 dpi.", "مقاس A4 أو A5، بدقة 300."), icon: ScanLine },
    { id: "poster-dark", title: t("Poster · Dark", "الملصق · داكن"), meta: t("A4 or A5, 300 dpi.", "مقاس A4 أو A5، بدقة 300."), icon: ScanLine },
  ];

  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}><QrCode className="size-4" />{t("Event kit", "حزمة الفعاليات")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl bg-card p-0 sm:max-w-3xl">
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col items-center gap-5 border-b border-border bg-muted/40 p-6 sm:p-8 md:border-b-0 md:border-e">
            <QrPreview key={theme} qr={qr} theme={theme} label={t("QR code for the Reload event sign-up page", "رمز الاستجابة السريعة لصفحة تسجيل ريلود")} />
            <div role="radiogroup" aria-label={t("Code colour", "لون الرمز")} className="inline-flex rounded-full border border-border bg-background p-1 text-xs font-medium">
              {(["ink", "inverted"] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={theme === option} onClick={() => setTheme(option)} className={cn("rounded-full px-3.5 py-1.5 transition-colors duration-200", theme === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{option === "ink" ? t("Ink", "داكن") : t("Inverted", "معكوس")}</button>)}
            </div>
            <p className="text-center text-xs leading-5 text-muted-foreground">{theme === "ink" ? t("Best for print. Dark on light scans on every phone.", "الأفضل للطباعة. الداكن على الفاتح يُقرأ على كل الهواتف.") : t("For screens and dark booths. Test a print before ordering.", "للشاشات والأجنحة الداكنة. جرّب نسخة مطبوعة قبل الطلب.")}</p>
          </div>
          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <DialogHeader className="text-start">
              <DialogTitle className="text-xl">{t("Event kit", "حزمة الفعاليات")}</DialogTitle>
              <DialogDescription className="leading-6">{t("Print the code for your stand. A scan opens the sign-up form, and every entry lands in Leads.", "اطبع الرمز لجناحك. المسح يفتح نموذج التسجيل، وكل تسجيل يصل إلى قائمة العملاء المحتملين.")}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-medium" dir="ltr">{EVENT_QR_URL.replace(/^https:\/\//, "")}</span><button type="button" onClick={() => void copy()} className="rounded-md p-1.5 transition-colors hover:bg-muted" aria-label={t("Copy event link", "نسخ رابط الفعالية")}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {assets.map(({ id, title, meta, icon: Icon }) => <li key={id}><button type="button" disabled={busy !== null} onClick={() => void download(id)} className="group flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-200 hover:bg-muted/60 disabled:cursor-wait">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}{(id === "svg" || id === "png") && theme === "inverted" ? <span className="text-muted-foreground"> · {t("inverted", "معكوس")}</span> : null}</span><span className="block text-xs text-muted-foreground">{meta}</span></span>
                {busy === id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Download className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5 group-hover:text-foreground" />}
              </button></li>)}
            </ul>
            <p className="text-xs leading-5 text-muted-foreground">{t("The code points to reload.sa/qr, which forwards to the form. If the form moves, update the forward. Printed codes keep working.", "يشير الرمز إلى reload.sa/qr الذي يحوّل إلى النموذج. إذا تغيّر النموذج، حدّث التحويل فقط وتبقى الرموز المطبوعة صالحة.")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

/** The code, assembled once: dots rise in from the symbol outward, then
 *  everything stays still (Brand System 3.0: resolve once, then remain).
 *  The tile reads as a solid block (layered shadow, lit top edge, a darker
 *  bottom edge for thickness) and, on desktop, tilts gently toward the
 *  pointer. Only the tile moves; the code itself is never altered. */
function QrPreview({ qr, theme, label }: { qr: ReturnType<typeof createBrandQr>; theme: QrTheme; label: string }) {
  const frame = useMemo(() => qr.svg(theme, { dots: false }), [qr, theme]);
  const mid = qr.size / 2;
  const tileRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const tile = tileRef.current;
    if (!tile || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      tile.dataset.tilting = "";
      // Up to 6° each way; the shadow slides the opposite way to the tilt.
      tile.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
      tile.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
      tile.style.setProperty("--sx", `${(-x * 14).toFixed(1)}px`);
      tile.style.setProperty("--sy", `${(-y * 10).toFixed(1)}px`);
    });
  };
  const settle = () => {
    const tile = tileRef.current;
    if (!tile) return;
    cancelAnimationFrame(frameRef.current);
    delete tile.dataset.tilting;
    for (const name of ["--rx", "--ry", "--sx", "--sy"]) tile.style.removeProperty(name);
  };

  return <div className="qr-stage w-full max-w-[300px]" onPointerMove={tilt} onPointerLeave={settle}>
    <div ref={tileRef} role="img" aria-label={label} data-theme={theme} className="qr-preview qr-tile relative aspect-square w-full overflow-hidden rounded-[22px]" style={{ background: theme === "ink" ? PAPER : INK }}>
      <div className="qr-frame absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: frame }} />
      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="absolute inset-0 size-full" fill={theme === "ink" ? INK : PAPER} aria-hidden="true">
        {qr.dots.map(([x, y]) => <circle key={`${x}-${y}`} className="qr-dot" cx={x} cy={y} r={DOT_R} style={{ ["--d" as string]: Math.round(Math.hypot(x - mid, y - mid) * 26) }} />)}
      </svg>
    </div>
  </div>;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
