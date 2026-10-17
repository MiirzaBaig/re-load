"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

/**
 * One tap flips the theme — no menu.
 *
 * A dropdown for two visible states is friction: picking "System" is a setting,
 * not an action people take mid-browse. The OS preference still seeds the first
 * visit; this just commits to the opposite of whatever is on screen.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={
        isDark
          ? t("Switch to light theme", "التبديل إلى المظهر الفاتح")
          : t("Switch to dark theme", "التبديل إلى المظهر الداكن")
      }
      title={
        isDark
          ? t("Switch to light theme", "التبديل إلى المظهر الفاتح")
          : t("Switch to dark theme", "التبديل إلى المظهر الداكن")
      }
      className={cn(
        "mode-toggle grid size-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      {/* Both icons stay mounted and cross-fade with a rotation, so the swap
          eases rather than popping. */}
      <Sun className="mode-toggle-icon mode-toggle-sun size-[1.1rem]" />
      <Moon className="mode-toggle-icon mode-toggle-moon size-[1.1rem]" />
    </button>
  );
}
