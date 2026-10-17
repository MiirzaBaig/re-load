import type { Metadata } from "next";
import { PrivacyPage } from "@/views/legal";

export default function Page() {
  return <PrivacyPage />;
}

export const metadata: Metadata = {
  title: "Reload privacy policy",
  description: "How Reload handles store information and customer data.",
  alternates: { canonical: "https://www.reload.sa/privacy" },
  robots: { index: true, follow: true },
};
