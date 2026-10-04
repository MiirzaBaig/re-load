import type { Metadata } from "next";
import { InterestSignup } from "@/components/interest-signup";

export const metadata: Metadata = {
  title: "Meet Reload | Merchant interest",
  description: "Register your interest in Reload's returns workspace.",
};

export default function InterestPage() {
  return <InterestSignup />;
}
