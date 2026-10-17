"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Circle, ShieldCheck } from "lucide-react";
import { TWEEN } from "@/components/desk/primitives";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

/** Progress reflects saved provider confirmation, never the redirect query alone. */
export function PaymentTracker({
  stage,
  review = false,
}: {
  stage: 0 | 1 | 2;
  review?: boolean;
}) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const steps = [
    t("Checkout opened", "تم تجهيز الدفع"),
    t("Payment confirmed", "تم تأكيد الدفع"),
    t("Plan active", "الاشتراك مفعّل"),
  ];
  return (
    <ol
      aria-label={t("Payment progress", "مراحل الدفع")}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3"
    >
      {steps.map((label, index) => (
        <motion.li
          key={index}
          initial={false}
          animate={{ opacity: index <= stage ? 1 : 0.5 }}
          transition={{ ...TWEEN, duration: reduced ? 0 : TWEEN.duration }}
          className="flex min-w-0 items-center gap-3"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
              index <= stage
                ? "border-eligible/25 bg-eligible/10 text-eligible"
                : "bg-muted text-muted-foreground",
              review && index === stage + 1 && "border-review/30 text-review",
            )}
          >
            <motion.span
              key={index <= stage ? "done" : "todo"}
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...TWEEN, duration: reduced ? 0 : 0.28 }}
              className="grid place-items-center"
            >
              {index <= stage ? (
                <Check className="size-4" />
              ) : index === 1 ? (
                <ShieldCheck className="size-4" />
              ) : (
                <Circle className="size-3" />
              )}
            </motion.span>
          </span>
          <span className="text-sm font-medium">{label}</span>
        </motion.li>
      ))}
    </ol>
  );
}
