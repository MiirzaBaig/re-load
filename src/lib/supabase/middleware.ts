import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Never trust a caller-supplied locale header. The public path is authoritative.
  requestHeaders.delete("x-reload-public-locale");
  const path = request.nextUrl.pathname;
  const locale =
    path === "/" || /^\/ar(?:\/|$)/.test(path)
      ? "ar"
      : /^\/en(?:\/|$)/.test(path) || ["/privacy", "/terms"].includes(path)
        ? "en"
        : null;
  if (locale) requestHeaders.set("x-reload-public-locale", locale);
  const next = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let supabaseResponse = next();

  if (locale || !isSupabaseConfigured) {
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        requestHeaders.set("cookie", request.headers.get("cookie") || "");
        supabaseResponse = next();
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/app") || pathname.startsWith("/onboarding");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
