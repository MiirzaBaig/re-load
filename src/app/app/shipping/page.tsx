import Link from "next/link";
import { notFound } from "next/navigation";
import { ShippingWallet } from "@/views/shipping-wallet";
export default function Page() {
  if (process.env.SHIPPING_SANDBOX_TOPUPS_ENABLED !== "true") notFound();
  return (
    <div className="space-y-6">
      <ShippingWallet />
      {process.env.SHIPPING_SANDBOX_SETTINGS_ENABLED === "true" && (
        <Link
          href="/app/shipping/settings"
          className="inline-flex rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted"
        >
          Shipping settings · إعدادات الشحن
        </Link>
      )}
      {process.env.OTO_SANDBOX_RETURNS_ENABLED === "true" && (
        <Link
          href="/app/shipping/return-test"
          className="inline-flex rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted"
        >
          <span lang="en">Try a sandbox return</span>
          <span aria-hidden="true" className="px-2">
            ·
          </span>
          <span lang="ar" dir="rtl">
            جرّب إرجاعًا تجريبيًا
          </span>
        </Link>
      )}
    </div>
  );
}
