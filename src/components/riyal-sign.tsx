import { cn } from "@/lib/utils";

/**
 * The official Saudi riyal sign (SAMA, 2025), drawn as a vector so it renders
 * the same everywhere (most fonts don't have U+20C1 yet). Inherits text colour.
 * Per the guidelines it sits to the left of the amount in both languages, so
 * callers wrap sign + number in a dir="ltr" span.
 */
export function RiyalSign({ className, label = "SAR" }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="97 -802 895 1000"
      fill="currentColor"
      role="img"
      aria-label={label}
      className={cn("inline-block h-[0.82em] w-auto shrink-0", className)}
    >
      <path transform="scale(1,-1)" d="M654 -84 992 -12Q986 -72 961 -126L623 -198Q629 -138 654 -84ZM961 89 623 17V232L518 210V91Q518 75 509 61L454 -20Q433 -51 395 -59L97 -123Q103 -63 128 -8L413 52V188L147 131Q153 191 177 245L413 295V714Q457 768 518 802V318L623 340V661Q668 715 729 749V362L992 418Q986 359 961 304L729 255V147L992 203Q986 143 961 89Z" />
    </svg>
  );
}
