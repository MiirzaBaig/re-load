import { PublicLayout } from "@/layouts/public-layout";

/*
 * No <Suspense> here on purpose. It existed only because PublicLayout used
 * useSearchParams(); on slow networks that boundary got a provider update
 * before hydrating and React rebuilt the whole page from scratch. PublicLayout
 * now reads the query string in an effect instead. Pages that still use
 * useSearchParams (e.g. /auth) keep their own boundary.
 */
export default function PublicRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
