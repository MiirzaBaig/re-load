"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CornerDownLeft,
  ExternalLink,
  FilePlus2,
  FileText,
  Inbox,
  Languages,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  Plug,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";

/*
 * ⌘K for the workspace: navigation plus language and theme. Deliberately no
 * case actions and no case search yet — search arrives once it queries real
 * case data reliably, and changing a case stays on the case itself.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, isArabic, toggleLocale } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback((action: () => void) => {
    setOpen(false);
    // Let the dialog start closing before navigating, so it doesn't flash.
    requestAnimationFrame(action);
  }, []);

  const pages: { label: string; href: string; icon: LucideIcon; keywords: string[] }[] = [
    { label: t("Overview", "نظرة عامة"), href: "/app", icon: LayoutDashboard, keywords: ["home", "dashboard"] },
    { label: t("Return cases", "طلبات الإرجاع"), href: "/app/cases", icon: Inbox, keywords: ["returns", "orders", "queue"] },
    { label: t("Policies", "السياسات"), href: "/app/policies", icon: FileText, keywords: ["rules", "policy"] },
    { label: t("Feedback", "الملاحظات"), href: "/app/reports", icon: MessageSquareText, keywords: ["reports", "issues"] },
    { label: t("Integrations", "التكاملات"), href: "/app/integrations", icon: Plug, keywords: ["store", "whatsapp", "connect"] },
    { label: t("Settings", "الإعدادات"), href: "/app/settings", icon: Settings, keywords: ["account", "workspace"] },
  ];

  const shortcut = isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="palette-trigger"
        aria-label={t("Open command menu", "فتح قائمة الأوامر")}
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">{t("Jump to…", "انتقل إلى…")}</span>
        <kbd className="palette-trigger-kbd hidden sm:inline" dir="ltr">{shortcut}</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("Command menu", "قائمة الأوامر")}
        description={t("Jump to a page or change a setting", "انتقل إلى صفحة أو غيّر إعدادًا")}
        className="palette"
        showCloseButton={false}
      >
        <CommandInput placeholder={t("Where to?", "إلى أين؟")} />
        <CommandList className="palette-list">
          <CommandEmpty>{t("Nothing matches.", "لا توجد نتائج.")}</CommandEmpty>

          <CommandGroup heading={t("Go to", "انتقل إلى")}>
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                value={`${page.label} ${page.keywords.join(" ")}`}
                onSelect={() => run(() => router.push(page.href))}
                className="palette-item"
              >
                <page.icon className="size-4" />
                <span>{page.label}</span>
                {pathname === page.href && (
                  <CommandShortcut>{t("Here", "هنا")}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t("Create", "إنشاء")}>
            <CommandItem
              value={`${t("New policy", "سياسة جديدة")} create draft`}
              onSelect={() => run(() => router.push("/app/policies/new"))}
              className="palette-item"
            >
              <FilePlus2 className="size-4" />
              <span>{t("New policy", "سياسة جديدة")}</span>
            </CommandItem>
            <CommandItem
              value={`${t("Try the customer return flow", "جرّب مسار إرجاع العميل")} test preview`}
              onSelect={() => run(() => window.open("/return", "_blank", "noopener,noreferrer"))}
              className="palette-item"
            >
              <ExternalLink className="size-4" />
              <span>{t("Try the customer return flow", "جرّب مسار إرجاع العميل")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t("Preferences", "التفضيلات")}>
            <CommandItem
              value="language arabic english العربية لغة"
              onSelect={() => run(toggleLocale)}
              className="palette-item"
            >
              <Languages className="size-4" />
              <span>{isArabic ? "Switch to English" : "التبديل إلى العربية"}</span>
            </CommandItem>
            <CommandItem
              value={`${t("theme dark light mode", "المظهر داكن فاتح")}`}
              onSelect={() => run(toggleTheme)}
              className="palette-item"
            >
              {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span>
                {resolvedTheme === "dark"
                  ? t("Switch to light theme", "التبديل إلى المظهر الفاتح")
                  : t("Switch to dark theme", "التبديل إلى المظهر الداكن")}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("move", "تنقّل")}</span>
          <span><kbd><CornerDownLeft className="size-3" /></kbd> {t("open", "فتح")}</span>
          <span><kbd>esc</kbd> {t("close", "إغلاق")}</span>
        </div>
      </CommandDialog>
    </>
  );
}
