import { LandingPage } from "@/views/landing";
import { publicMetadata } from "@/lib/public-site";
import { PublicSchema } from "@/components/public-schema";
// Existing QR/hash/query links keep working; canonical points to the Arabic URL.
export const metadata = publicMetadata("ar");
export default function HomePage() {
  return (
    <>
      <PublicSchema locale="ar" />
      <LandingPage />
    </>
  );
}
