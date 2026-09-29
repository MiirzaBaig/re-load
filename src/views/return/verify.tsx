"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ScrollReveal } from "@/components/scroll-reveal";
import { services } from "@/lib/services";
import { DEMO_CREDENTIALS } from "@/lib/fixtures";
import { Search, AlertCircle, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ReturnProgress } from "@/components/return-progress";
import { supabase } from "@/lib/supabase";

export function ReturnVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const returnCode = searchParams.get("store");
  const live = Boolean(returnCode);

  useEffect(() => {
    if (returnCode) sessionStorage.setItem("relod-return-code", returnCode);
    else {
      sessionStorage.removeItem("relod-return-code");
      sessionStorage.removeItem("relod-verification-token");
      sessionStorage.removeItem("relod-decision-id");
    }
  }, [returnCode]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (live && supabase && returnCode) {
      const { data, error: lookupError } = await supabase.functions.invoke("salla-order-lookup", {
        body: { returnCode, orderNumber, verifier: email },
      });
      setLoading(false);
      if (lookupError || !data?.order || !data?.verificationToken) {
        setError(t("We couldn't verify this order. Please check your details and try again.", "تعذر التحقق من الطلب. راجع بياناتك ثم حاول مرة أخرى."));
        return;
      }
      sessionStorage.setItem("relod-verified-order", JSON.stringify(data.order));
      sessionStorage.setItem("relod-verification-token", data.verificationToken);
      router.push("/return/details");
      return;
    }
    setTimeout(() => {
      const order = services.verifyOrder(orderNumber, email);
      setLoading(false);
      if (order) {
        sessionStorage.setItem("relod-verified-order", JSON.stringify(order));
        router.push("/return/details");
      } else {
        setError(t("We couldn't verify this order. Please check your order number and email and try again.", "تعذر التحقق من الطلب. راجع رقم الطلب والبريد الإلكتروني ثم حاول مرة أخرى."));
      }
    }, 600);
  };

  const fillDemo = () => {
    setOrderNumber(DEMO_CREDENTIALS.orderNumber);
    setEmail(DEMO_CREDENTIALS.email);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />{t("Back to Reload", "العودة إلى ريلود")}
      </Link>
      <ReturnProgress currentStep={1} />

      <ScrollReveal>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t("Start a return", "بدء طلب إرجاع")}</h1>
          <p className="text-sm text-muted-foreground">{t("Verify your order to check return eligibility.", "تحقق من طلبك لمعرفة أهلية المنتج للإرجاع.")}</p>
          {!live && <p className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">{t("Demo only · This page uses sample orders. For a real return, use the link provided by your store.", "تجربة توضيحية فقط · تستخدم هذه الصفحة طلبات نموذجية. لطلب إرجاع فعلي، استخدم الرابط الذي يقدمه متجرك.")}</p>}
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <Card className="animate-scale-in">
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="orderNumber">{t("Order number", "رقم الطلب")}</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="SA-10492"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t("Email or mobile", "البريد الإلكتروني أو رقم الجوال")}</Label>
                <Input
                  id="email"
                type="text"
                inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={loading || !orderNumber || !email} className="mt-2 group">
                {loading ? <Spinner className="mr-1" /> : <Search className="size-4" />}
                {t("Verify order", "التحقق من الطلب")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </ScrollReveal>

      {!live && <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={fillDemo}>{t("Try with a sample order", "التجربة بطلب نموذجي")}</Button>}
    </div>
  );
}
