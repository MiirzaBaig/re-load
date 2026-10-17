import type { Metadata } from "next";
import { TermsPage } from "@/views/legal";

export default function Page() {
  return <TermsPage />;
}

export const metadata: Metadata = {
  title: "Reload terms of use",
  description:
    "Terms for using Reload and responsibilities for merchants and customers.",
  alternates: { canonical: "https://www.reload.sa/terms" },
  robots: { index: true, follow: true },
};
