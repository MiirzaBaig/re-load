"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReloadLogo } from "@/components/reload-logo";
import { IntroSplash } from "@/components/intro-splash";

import { CurtainReveal } from "@/components/curtain-reveal";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppChannel, WhatsAppLogo } from "@/components/phone-frame";
import { AuthDialog } from "@/components/auth-dialog";
import { useAuth } from "@/components/auth-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/components/language-provider";
import { ScrollToTop } from "@/components/scroll-to-top";
import { useSectionSpy } from "@/hooks/use-section-spy";
import { getWhatsAppStartUrl } from "@/lib/whatsapp";

/** Navbar WhatsApp link (desktop). Off: the floating bubble and hero CTA cover it. */
const SHOW_NAV_WHATSAPP = false;
/** "Get started" (desktop navbar + mobile menu). Off: Sign in is the only navbar action. */
const SHOW_GET_STARTED = false;

export function PublicLayout({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // The query string is read in an effect, not with useSearchParams(). That
  // hook forced a <Suspense> boundary around this whole layout, and on slow
  // networks the boundary received a provider update (auth, theme) before it
  // finished hydrating, so React threw the server HTML away and rebuilt the
  // page — a blank flash and a restarted intro. Nothing here needs the query
  // during render: it only opens the sign-in dialog and handles a redirect.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const read = () => setQuery(window.location.search);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [pathname]);
  const searchParams = useMemo(() => new URLSearchParams(query), [query]);
  const auth = useAuth();
  const { t } = useLanguage();
  const isHome = pathname === "/";
  const whatsappStartUrl = getWhatsAppStartUrl();
  const requestedReturnUrl = searchParams.get("returnUrl");
  const authReturnUrl = requestedReturnUrl?.startsWith("/") && !requestedReturnUrl.startsWith("//")
    ? requestedReturnUrl
    : "/app";
  const activeSection = useSectionSpy(
    isHome ? ["product", "how-it-works", "returns-financing", "contact"] : [],
  );
  const navLinks = [
    { id: "product", label: t("Product", "المنتج"), href: "/#product" },
    {
      id: "how-it-works",
      label: t("How it works", "كيف يعمل"),
      href: "/#how-it-works",
    },
    {
      id: "returns-financing",
      label: t("Returns financing", "تمويل المرتجعات"),
      href: "/#returns-financing",
    },
    // The contact form lives on the home page; from any other page this link
    // navigates home and the hash handler scrolls straight to it.
    { id: "contact", label: t("Contact", "تواصل معنا"), href: "/#contact" },
  ];
  const isNavActive = (sectionId: string) =>
    isHome && activeSection === sectionId;

  useEffect(() => {
    if (searchParams.get("auth") === "1") setAuthOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const returnUrl = searchParams.get("returnUrl");
    if (!auth.user || !returnUrl) return;
    if (!returnUrl.startsWith("/") || returnUrl.startsWith("//")) return;
    router.replace(returnUrl);
  }, [auth.user, router, searchParams]);

  const handleAuthOpenChange = (open: boolean) => {
    setAuthOpen(open);
    if (!open && searchParams.has("auth")) {
      router.replace(pathname);
      setQuery("");
    }
  };

  // Lock body scroll and allow Escape to close while the overlay is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    // Continuous progress rather than a boolean. A class toggle fires the whole
    // 520ms transition in one step the instant a threshold is crossed, which is
    // what read as static. Driving a 0→1 variable from scroll position means
    // the pill tracks the scroll itself — the YC/Linear approach.
    const RANGE = 120;
    let last = -1;

    const apply = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / RANGE));
      // Quantise so React re-renders at most ~50 times over the range instead
      // of on every pixel; the CSS variable still interpolates smoothly.
      const stepped = Math.round(progress * 50) / 50;
      if (stepped === last) return;
      last = stepped;
      // Set on the header, not <html>: a custom property changed on the root
      // re-resolves styles for every element on the page, dozens of times per
      // scroll. Only the header reads this value.
      headerRef.current?.style.setProperty(
        "--header-progress",
        String(stepped),
      );
      setScrolled(stepped > 0.5);
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) {
          el.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "instant"
              : "smooth",
            block: "start",
          });
          return;
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col">
      <IntroSplash />
      <header
        ref={headerRef}
        className={cn("public-header", scrolled && "public-header-scrolled")}
      >
        <div className="public-header-surface">
          <div className="public-header-inner">
            <Link href="/" className="rounded-lg p-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <ReloadLogo
                className={cn(
                  "transition-transform duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  scrolled ? "scale-90" : "scale-100",
                )}
              />
            </Link>

            <nav aria-label="Primary navigation" className="public-nav hidden items-center gap-1 p-1 md:flex">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  aria-current={
                    isNavActive(link.id) ? "page" : undefined
                  }
                  data-active={isNavActive(link.id) || undefined}
                  className="public-nav-link rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground aria-[current=page]:text-foreground"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              <div className="hidden items-center gap-1 md:flex">
                {/* Hidden: it repeated the floating WhatsApp bubble and the
                    hero's "Start on WhatsApp". Flip SHOW_NAV_WHATSAPP to restore. */}
                {SHOW_NAV_WHATSAPP && (
                  <a
                    href={whatsappStartUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="nav-ghost hidden rounded-full px-3 py-2 lg:inline-flex"
                    aria-label={t("Start a WhatsApp conversation", "ابدأ محادثة عبر واتساب")}
                  >
                    <WhatsAppChannel showStatus={false} />
                  </a>
                )}
                {auth.user ? (
                  <Button
                    size="sm"
                    onClick={() => router.push("/app")}
                    className="nav-cta rounded-full px-4"
                  >
                    {t("Workspace", "مساحة العمل")}
                  </Button>
                ) : (
                  <>
                    <button
                      onClick={() => setAuthOpen(true)}
                      className="nav-ghost rounded-full px-3 py-2 text-sm font-medium"
                    >
                      {t("Sign in", "تسجيل الدخول")}
                    </button>
                    {SHOW_GET_STARTED && (
                      <>
                    {/* New merchants start on WhatsApp (onboarding lives there);
                        returning ones use Sign in. The two used to open the
                        same sign-in dialog. */}
                    <Button asChild size="sm" className="nav-cta rounded-full px-4">
                      <a href={whatsappStartUrl} target="_blank" rel="noreferrer">
                        {t("Get started", "ابدأ الآن")}
                      </a>
                    </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              <LanguageToggle compact className="size-8" />
              <ModeToggle className="size-8" />
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="nav-ghost menu-toggle grid size-8 place-items-center rounded-full md:hidden"
                data-open={menuOpen}
              >
                {/* Both icons stay mounted and cross-fade, so the swap eases
                    instead of popping. */}
                <Menu className="menu-toggle-icon menu-toggle-open size-5" />
                <X className="menu-toggle-icon menu-toggle-close size-5" />
                <span className="sr-only">
                  {menuOpen
                    ? t("Close menu", "إغلاق القائمة")
                    : t("Open menu", "فتح القائمة")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen overlay menu: the modern mobile pattern — the page fades
          out, large tap targets fill the screen, no cramped side drawer. */}
      <div
        id="mobile-menu"
        className="mobile-menu md:hidden"
        data-open={menuOpen}
        aria-hidden={!menuOpen}
      >
        <nav className="flex flex-col px-6">
          {navLinks.map((link, i) => (
            <button
              key={link.href}
              onClick={() => {
                setMenuOpen(false);
                router.push(link.href);
              }}
              aria-current={isNavActive(link.id) ? "page" : undefined}
              style={{ ["--i" as string]: String(i) }}
              className={cn(
                "mobile-menu-item border-b border-border/70 py-4 text-start text-[17px] font-medium text-foreground",
                isNavActive(link.id) && "text-primary",
              )}
            >
              {link.label}
            </button>
          ))}
          <a
            href={whatsappStartUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
            style={{ ["--i" as string]: String(navLinks.length) }}
            className="mobile-menu-item flex items-center border-b border-border/70 py-4 text-[17px] font-medium text-foreground"
          >
            <WhatsAppChannel className="text-[17px] font-medium text-foreground" />
          </a>
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-6 pb-10 pt-8">
          {auth.user ? (
            <Button
              style={{ ["--i" as string]: String(navLinks.length + 1) }}
              className="mobile-menu-item nav-cta h-11 w-full rounded-full"
              onClick={() => {
                setMenuOpen(false);
                router.push("/app");
              }}
            >
              {t("Workspace", "مساحة العمل")}
            </Button>
          ) : (
            <>
              {SHOW_GET_STARTED && (
              <Button
                asChild
                style={{ ["--i" as string]: String(navLinks.length + 1) }}
                className="mobile-menu-item nav-cta h-11 w-full rounded-full"
              >
                <a
                  href={whatsappStartUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("Get started", "ابدأ الآن")}
                </a>
              </Button>
              )}
              <button
                style={{ ["--i" as string]: String(navLinks.length + 2) }}
                className={cn(
                  "mobile-menu-item h-11 w-full rounded-full text-sm font-medium transition-colors",
                  SHOW_GET_STARTED
                    ? "text-muted-foreground hover:text-foreground"
                    : "nav-cta bg-primary text-primary-foreground",
                )}
                onClick={() => {
                  setMenuOpen(false);
                  setAuthOpen(true);
                }}
              >
                {t("Sign in", "تسجيل الدخول")}
              </button>
            </>
          )}
        </div>
      </div>

      <CurtainReveal>
        <main className="relative isolate min-h-svh bg-background pt-16">
          {children}
        </main>
      </CurtainReveal>
      {isHome && (
        <a
          href={whatsappStartUrl}
          target="_blank"
          rel="noreferrer"
          className="whatsapp-float group"
          aria-label={t("Start a WhatsApp conversation", "ابدأ محادثة عبر واتساب")}
        >
          {/* Icon first so it anchors in the corner; the label slides out
              beside it on hover, on focus, and in the one-time peek. */}
          <span className="whatsapp-float-icon" aria-hidden="true">
            <WhatsAppLogo className="size-[19px] !text-current" />
            <span className="whatsapp-float-online" />
          </span>
          <span className="whatsapp-float-label" aria-hidden="true">
            <span className="whatsapp-float-title">
              {t("Start on WhatsApp", "ابدأ عبر واتساب")}
            </span>
          </span>
        </a>
      )}
      <ScrollToTop />
      <AuthDialog open={authOpen} onOpenChange={handleAuthOpenChange} redirectTo={authReturnUrl} />
    </div>
  );
}
