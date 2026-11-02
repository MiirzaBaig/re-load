import type { Metadata } from "next";
import { InterestSignup } from "@/components/interest-signup";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Meet Reload | Merchant interest",
  // Was: "Register your interest in Reload's returns workspace."
  description: "Register your interest in Reload: customer support and returns on WhatsApp for Saudi online stores.",
};

export default function InterestPage() {
  return <InterestSignup />;
}
