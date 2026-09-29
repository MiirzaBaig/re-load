"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { ReloadMark } from "@/components/reload-logo";
import { PageTransition } from "@/components/page-transition";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Package,
  Plug,
  Settings,
  LogOut,
  ChevronRight,
  Link2,
  Globe,
  MessageSquareWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuth } from "@/components/auth-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { CommandPalette } from "@/components/command-palette";
import { useLanguage } from "@/components/language-provider";
import { StoreIdentity } from "@/components/store-identity";
import { SidebarWorkspaceSkeleton } from "@/components/merchant-skeletons";

export function MerchantLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { t, isArabic } = useLanguage();

  const openCaseCount = useMemo(
    () =>
      services
        .getCases()
        .filter((c) => c.caseStatus === "OPEN" || c.outcome === "MANUAL_REVIEW")
        .length,
    [],
  );
  const draftCount = useMemo(() => services.getDrafts().length, []);
  const storeName = auth.workspace?.storeName ?? services.getStoreName();

  const primaryNav = [
    {
      label: t("Overview", "نظرة عامة"),
      href: "/app",
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: t("Policies", "السياسات"),
      href: "/app/policies",
      icon: FileText,
      badge: draftCount > 0 ? draftCount : undefined,
    },
    {
      label: t("Return cases", "طلبات الإرجاع"),
      href: "/app/cases",
      icon: Package,
      badge: openCaseCount > 0 ? openCaseCount : undefined,
    },
    {
      label: t("Feedback", "الملاحظات"),
      href: "/app/reports",
      icon: MessageSquareWarning,
    },
  ];
  const secondaryNav = [
    {
      label: t("Integrations", "التكاملات"),
      href: "/app/integrations",
      icon: Plug,
    },
    {
      label: t("Settings", "الإعدادات"),
      href: "/app/settings",
      icon: Settings,
    },
  ];

  const handleSignOut = async () => {
    await auth.signOut();
    router.replace("/auth");
  };

  const isActive = (href: string, end?: boolean) =>
    end ? pathname === href : pathname.startsWith(href);

  const navEnterStyle = (index: number): CSSProperties => ({
    animationDelay: `${60 + index * 45}ms`,
  });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" side={isArabic ? "right" : "left"}>
        <SidebarHeader className="gap-3 px-3 pt-3 pb-2 group-data-[collapsible=icon]:px-2">
          {/* Collapsed, the rail is 48px wide: centre the mark and size it to
              the nav icon column below, instead of keeping the expanded
              padding that pushed it off-centre and made it look oversized. */}
          <Link
            href="/app"
            className="sidebar-nav-enter flex items-center gap-2.5 rounded-lg px-1 py-1 transition-opacity duration-200 hover:opacity-80 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            style={navEnterStyle(0)}
            aria-label={t("Reload workspace home", "الصفحة الرئيسية لمساحة ريلود")}
          >
            <ReloadMark className="size-7 shrink-0 text-primary transition-[width,height] duration-200 group-data-[collapsible=icon]:size-[22px]" />
            <span className="font-display text-[15px] font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              {t("Reload", "ريلود")}
            </span>
          </Link>
          <div
            className="sidebar-nav-enter group-data-[collapsible=icon]:hidden"
            style={navEnterStyle(1)}
          >
            {auth.loading && auth.configured ? (
              <SidebarWorkspaceSkeleton />
            ) : (
              <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2.5 transition-[opacity,transform] duration-300 ease-out">
                <p className="text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/55">
                  {t("Workspace", "مساحة العمل")}
                </p>
                <div className="mt-1 text-sm font-medium text-sidebar-foreground">
                  <StoreIdentity name={storeName} markSize="sm" />
                </div>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarSeparator className="mx-0 w-full" />

        <SidebarContent className="px-2 py-2">
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="px-2">
              {t("Navigate", "التنقل")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryNav.map((item, index) => (
                  <SidebarMenuItem
                    key={item.href}
                    className="sidebar-nav-enter"
                    style={navEnterStyle(2 + index)}
                  >
                    <SidebarMenuButton
                      isActive={isActive(item.href, item.end)}
                      onClick={() => router.push(item.href)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge !== undefined && (
                      <SidebarMenuBadge className="rounded-md bg-sidebar-primary/12 text-[10px] font-semibold tabular-nums text-sidebar-primary peer-data-[active=true]/menu-button:text-sidebar-primary">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="px-2">
              {t("Configure", "الإعداد")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNav.map((item, index) => (
                  <SidebarMenuItem
                    key={item.href}
                    className="sidebar-nav-enter"
                    style={navEnterStyle(5 + index)}
                  >
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      onClick={() => router.push(item.href)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-1 px-2 pb-3">
          <SidebarSeparator className="mx-0 mb-1 w-full" />
          <SidebarMenu>
            <SidebarMenuItem
              className="sidebar-nav-enter"
              style={navEnterStyle(7)}
            >
              <SidebarMenuButton
                onClick={() => router.push("/return")}
                tooltip={t("Customer return", "إرجاع العميل")}
              >
                <Link2 />
                <span>{t("Customer return", "إرجاع العميل")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem
              className="sidebar-nav-enter"
              style={navEnterStyle(8)}
            >
              <SidebarMenuButton
                onClick={() => router.push("/")}
                tooltip={t("Public site", "الموقع العام")}
              >
                <Globe />
                <span>{t("Public site", "الموقع العام")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem
              className="sidebar-nav-enter"
              style={navEnterStyle(9)}
            >
              <SidebarMenuButton
                onClick={() => void handleSignOut()}
                tooltip={t("Sign out", "تسجيل الخروج")}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut />
                <span>{t("Sign out", "تسجيل الخروج")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="merchant-workspace">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <SidebarTrigger className="size-8 shrink-0 rounded-lg hover:bg-muted/60" />
            <WorkspaceBreadcrumb pathname={pathname} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CommandPalette />
            <LanguageToggle />
            <ModeToggle className="size-8" />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-9 lg:px-10">
          <PageTransition>{children}</PageTransition>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceBreadcrumb({ pathname }: { pathname: string }) {
  const { t, isArabic } = useLanguage();
  const segments = pathname.split("/").filter(Boolean);

  const labels: Record<string, string> = {
    app: t("Overview", "نظرة عامة"),
    policies: t("Policies", "السياسات"),
    new: t("New", "جديد"),
    review: t("Review", "مراجعة"),
    cases: t("Cases", "الحالات"),
    reports: t("Feedback", "الملاحظات"),
    integrations: t("Integrations", "التكاملات"),
    settings: t("Settings", "الإعدادات"),
  };

  const hrefForIndex = (index: number) => {
    const parts = segments.slice(0, index + 1);
    if (parts[0] === "app" && parts.length === 1) return "/app";
    return `/${parts.join("/")}`;
  };

  const crumbs = segments
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg, i }) => {
      if (i === 0 && seg === "app") return true;
      if (/^[0-9a-f-]{8,}$/i.test(seg) || /^SA-/i.test(seg)) return false;
      if (seg.length > 24 && !labels[seg]) return false;
      return Boolean(labels[seg]) || i === segments.length - 1;
    });

  if (crumbs.length === 0) {
    return (
      <span className="font-medium text-foreground">
        {t("Overview", "نظرة عامة")}
      </span>
    );
  }

  return (
    <nav
      aria-label={t("Breadcrumb", "مسار التنقل")}
      className="flex min-w-0 items-center gap-1 text-sm"
    >
      {crumbs.map(({ seg, i }, crumbIndex) => {
        const isLast = crumbIndex === crumbs.length - 1;
        const label =
          labels[seg] ?? (seg.length > 18 ? `${seg.slice(0, 8)}…` : seg);
        const href = hrefForIndex(i);

        return (
          <span key={`${seg}-${i}`} className="flex min-w-0 items-center gap-1">
            {crumbIndex > 0 && (
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 text-border",
                  isArabic && "rotate-180",
                )}
              />
            )}
            {isLast ? (
              <span className="truncate font-medium text-foreground">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="truncate text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
