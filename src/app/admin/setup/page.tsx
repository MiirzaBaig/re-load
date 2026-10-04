import type { Metadata } from "next";
import { AdminPasswordSetup } from "@/components/admin-password-setup";

export const metadata: Metadata = { title: "Reload · Set team password", robots: { index: false, follow: false } };

export default function AdminSetupPage() {
  return <AdminPasswordSetup />;
}
