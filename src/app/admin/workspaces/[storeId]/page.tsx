import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { SUPPORT_UUID, type SupportWorkspace } from "@/lib/support-workspace";
import { SupportWorkspaceView } from "@/components/admin/support-workspace";
export const metadata: Metadata = {
  title: "Reload · Merchant support",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) redirect("/admin");
  const { storeId } = await params;
  if (!SUPPORT_UUID.test(storeId)) notFound();
  const { data, error } = await access.supabase.rpc("staff_support_workspace", {
    p_store: storeId,
  });
  if (error || !data) throw new Error("Could not open the support workspace.");
  return (
    <SupportWorkspaceView
      initial={data as SupportWorkspace}
      canPrepare={access.role === "owner"}
    />
  );
}
