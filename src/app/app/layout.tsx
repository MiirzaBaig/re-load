import { MerchantLayout } from "@/layouts/merchant-layout";

export default function AppWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MerchantLayout
      shippingSettingsEnabled={
        process.env.SHIPPING_SANDBOX_SETTINGS_ENABLED === "true"
      }
    >
      {children}
    </MerchantLayout>
  );
}
