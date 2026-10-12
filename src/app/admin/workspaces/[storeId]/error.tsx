"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">
        {t("Could not open this workspace", "تعذّر فتح مساحة العمل")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Your staff access may have changed, or the service is temporarily unavailable.",
          "قد يكون وصولك تغيّر أو الخدمة غير متاحة مؤقتًا.",
        )}
      </p>
      <Button onClick={reset}>{t("Try again", "حاول مجددًا")}</Button>
      <Button asChild variant="outline">
        <Link href="/admin?view=merchants">
          {t("Back to merchants", "العودة للتجار")}
        </Link>
      </Button>
    </main>
  );
}
