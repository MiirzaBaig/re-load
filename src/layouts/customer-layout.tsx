"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ReloadMark } from "@/components/reload-logo";
import { PageTransition } from "@/components/page-transition";
import { services } from "@/lib/services";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { useLanguage } from "@/components/language-provider";
import { StoreIdentity } from "@/components/store-identity";

export function CustomerLayout({ children }: { children: ReactNode }) {
  const storeName = services.getStoreName();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              <StoreIdentity name={storeName} markSize="sm" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("Customer returns", "مرتجعات العملاء")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageToggle compact className="size-8" />
            <ModeToggle className="size-8" />
            <Link
              href="/"
              className="ms-1 flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors duration-200 hover:border-border hover:bg-muted/40"
            >
              <ReloadMark className="size-5 text-primary" />
              <span className="hidden font-display text-xs font-semibold sm:inline">
                {t("Reload", "ريلود")}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[520px] px-5 py-7 sm:py-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto max-w-[520px] px-5 py-4">
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground/75">
            {t(
              "Powered by Reload · Return decisions, explained.",
              "بدعم من ريلود · قرارات إرجاع واضحة ومفسّرة.",
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
