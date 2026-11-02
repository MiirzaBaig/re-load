import { notFound } from "next/navigation";
import { ShippingSettings } from "@/views/shipping-settings";
export default function Page() {
  if (process.env.SHIPPING_SANDBOX_SETTINGS_ENABLED !== "true") notFound();
  return <ShippingSettings />;
}
