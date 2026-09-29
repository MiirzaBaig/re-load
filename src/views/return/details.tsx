"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { services } from "@/lib/services";
import {
  type DeliveryFacts,
  type ReturnReason,
  type ItemCondition,
  REASON_LABELS,
  CONDITION_LABELS,
  formatSAR,
} from "@/lib/domain";
import { ArrowRight, ArrowLeft, Package, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { ReturnProgress } from "@/components/return-progress";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { getReturnStartPath } from "@/lib/return-url";

export function ReturnDetailsPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const reasonLabels: Record<ReturnReason, string> = {
    defective: t(REASON_LABELS.defective, "المنتج معيب"), wrong_item: t(REASON_LABELS.wrong_item, "تم استلام منتج غير صحيح"),
    not_as_described: t(REASON_LABELS.not_as_described, "المنتج غير مطابق للوصف"), changed_mind: t(REASON_LABELS.changed_mind, "تغيير الرأي"), damaged_in_transit: t(REASON_LABELS.damaged_in_transit, "تضرر أثناء الشحن"),
  };
  const conditionLabels: Record<ItemCondition, string> = { new_unopened: t(CONDITION_LABELS.new_unopened, "جديد وغير مفتوح"), opened_unused: t(CONDITION_LABELS.opened_unused, "مفتوح وغير مستخدم"), used: t(CONDITION_LABELS.used, "مستخدم") };
  const [order, setOrder] = useState<DeliveryFacts | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ReturnReason>("defective");
  const [condition, setCondition] = useState<ItemCondition>("new_unopened");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("relod-verified-order");
    if (!raw) {
      router.push(getReturnStartPath());
      return;
    }
    try {
      const parsed = JSON.parse(raw) as DeliveryFacts;
      setOrder(parsed);
      if (parsed.items.length > 0) {
        setSelectedItemId(parsed.items[0].id);
        setQuantity(1);
      }
    } catch {
      router.push(getReturnStartPath());
    }
  }, [router]);

  if (!order) return null;

  const selectedItem = order.items.find((i) => i.id === selectedItemId);
  const maxQty = selectedItem?.quantity ?? 1;

  const handleCheck = async () => {
    if (!selectedItemId) return;
    const verificationToken = sessionStorage.getItem("relod-verification-token");
    let decision = null;
    if (verificationToken && supabase) {
      setChecking(true);
      const { data, error } = await supabase.functions.invoke("return-decide", {
        body: { verificationToken, itemId: selectedItemId, quantity, reason, condition, action: "evaluate" },
      });
      setChecking(false);
      if (error || !data?.decision || !data?.decisionId) {
        toast.error(t("We could not check this return. Please try again.", "تعذر التحقق من طلب الإرجاع. حاول مرة أخرى."));
        return;
      }
      decision = data.decision;
      sessionStorage.setItem("relod-decision-id", data.decisionId);
    } else {
      decision = services.evaluate(order, selectedItemId, quantity, reason, condition);
    }
    if (!decision) {
      router.push(getReturnStartPath());
      return;
    }
    sessionStorage.setItem("relod-decision", JSON.stringify(decision));
    sessionStorage.setItem("relod-return-context", JSON.stringify({
      orderId: order.orderId,
      itemId: selectedItemId,
      quantity,
      reason,
      condition,
    }));
    router.push("/return/result");
  };

  return (
    <div className="flex flex-col gap-5">
      <ReturnProgress currentStep={2} />

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t("Return details", "تفاصيل الإرجاع")}</h1>
        <p className="text-sm text-muted-foreground">{t("Order", "الطلب")} {order.orderId} · {order.customerName}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Label className="mb-2">{t("Select item to return", "اختر المنتج المراد إرجاعه")}</Label>
          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedItemId(item.id); setQuantity(1); }}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-4 text-left transition-all",
                  selectedItemId === item.id
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-muted/20",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{t("SKU", "رمز المنتج")}: {item.sku} · {formatSAR(item.price)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{t("Qty", "الكمية")}: {item.quantity}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedItem && (
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6">
              <div>
                <Label className="mb-2">{t("Quantity", "الكمية")}</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-12 text-center text-sm font-medium tabular-nums">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    disabled={quantity >= maxQty}
                  >
                    <Plus className="size-4" />
                  </Button>
                  <span className="ms-2 text-xs text-muted-foreground">{t("Max", "الحد الأقصى")}: {maxQty}</span>
                </div>
              </div>

              <div>
                <Label className="mb-2">{t("Reason for return", "سبب الإرجاع")}</Label>
                <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReturnReason)}>
                  <div className="flex flex-col gap-2">
                    {(Object.keys(REASON_LABELS) as ReturnReason[]).map((r) => (
                      <label key={r} className="flex items-center gap-2 cursor-pointer rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/20 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value={r} id={`reason-${r}`} />
                        <span className="text-sm text-foreground">{reasonLabels[r]}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-2">{t("Item condition", "حالة المنتج")}</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as ItemCondition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONDITION_LABELS) as ItemCondition[]).map((c) => (
                      <SelectItem key={c} value={c}>{conditionLabels[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push(getReturnStartPath())}>
          <ArrowLeft className={cn("size-4", isArabic && "rotate-180")} />
          {t("Back", "رجوع")}
        </Button>
        <Button onClick={() => void handleCheck()} disabled={!selectedItemId || checking} className="flex-1 group">
          {checking && <Spinner />}{checking ? t("Checking…", "جارٍ التحقق…") : t("Check eligibility", "التحقق من الأهلية")}
          <ArrowRight className={cn("size-4 transition-transform group-hover:translate-x-1", isArabic && "rotate-180")} />
        </Button>
      </div>
    </div>
  );
}
