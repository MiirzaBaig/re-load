import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin-login";

export const metadata: Metadata = { title: "Reload · Team sign in", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <AdminLogin />;
}
