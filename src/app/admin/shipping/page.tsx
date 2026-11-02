import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { ShippingSandbox } from "@/components/admin/shipping/sandbox";

export const metadata: Metadata = {
  title: "Reload · Shipping sandbox",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const access = await getAdminAccess();
  if (!access || access.role !== "owner") redirect("/admin");
  return (
    <ShippingSandbox
      showWalletTest={process.env.SHIPPING_SANDBOX_TOPUPS_ENABLED === "true"}
    />
  );
}
