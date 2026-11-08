import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DitherEdge } from "@/components/dither-edge";

/*
 * 404 (redesigned 2026-11-05): calm sand page, a large "404", both languages
 * (this page renders outside the language provider), and green ground with a
 * pixel edge at the bottom. Previous version: a centered logo, title, text and
 * "Back to home" / "Open demo" buttons on a plain background.
 */
export function NotFoundPage() {
  return (
    <div className="public-site theme-v2 flex min-h-svh flex-col bg-background">
      {/* The site navbar already shows the logo here. Bottom padding leaves room for the pixel edge. */}
      <div className="nf-content flex flex-1 flex-col items-center justify-center gap-7 px-5 pt-16 text-center">
        <p aria-hidden="true" className="font-display text-[clamp(5rem,18vw,10rem)] font-semibold leading-none tracking-[-0.05em] text-foreground/90 tabular-nums">
          404
        </p>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <p dir="rtl" lang="ar" className="mt-4 font-[family-name:var(--font-arabic)] text-base text-foreground">
            الصفحة غير موجودة
          </p>
          <p dir="rtl" lang="ar" className="mt-1 font-[family-name:var(--font-arabic)] text-sm text-muted-foreground">
            الصفحة اللي تبحث عنها غير موجودة أو تم نقلها.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full">
            <Link href="/">Back to home · الرئيسية</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/ar/faq">Help · المساعدة</Link>
          </Button>
        </div>
      </div>
      <div className="nf-ground" aria-hidden="true">
        <DitherEdge color="--brand-band" direction="up" />
      </div>
    </div>
  );
}
