"use client";

import { useSsrReducedMotion as useReducedMotion } from "@/hooks/use-ssr-reduced-motion";

import { useEffect, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const lineContainer: Variants = {
  hidden: {},
  visible: (delay = 0) => ({
    transition: {
      delayChildren: delay,
      staggerChildren: 0.075,
    },
  }),
};

const wordReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
    filter: "blur(10px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.82,
      ease: EASE,
    },
  },
};

const lineReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    filter: "blur(12px)",
  },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay,
      duration: 0.9,
      ease: EASE,
    },
  }),
};

function splitWords(text: string) {
  return text.trim().split(/(\s+)/).filter(Boolean);
}

function RevealedLine({
  text,
  className,
  lineClassName,
  delay,
  wordByWord,
}: {
  text: string;
  className?: string;
  /** Class for the whole line (e.g. the drawn underline), not each word. */
  lineClassName?: string;
  delay: number;
  wordByWord: boolean;
}) {
  if (!wordByWord) {
    return (
      <motion.span
        className={cn("hero-tagline-line", lineClassName ?? "block", className)}
        variants={lineReveal}
        custom={delay}
        initial="hidden"
        animate="visible"
      >
        {text}
      </motion.span>
    );
  }

  const parts = splitWords(text);

  return (
    <motion.span
      className={cn("hero-tagline-line", lineClassName ?? "block")}
      variants={lineContainer}
      custom={delay}
      initial="hidden"
      animate="visible"
      aria-label={text}
    >
      {parts.map((part, index) =>
        /^\s+$/.test(part) ? (
          <span key={`s-${index}`}>{part}</span>
        ) : (
          <motion.span
            key={`${part}-${index}`}
            className={cn(
              "hero-tagline-word",
              className,
            )}
            variants={wordReveal}
          >
            {part}
          </motion.span>
        ),
      )}
    </motion.span>
  );
}

// The slogan is the big visual line; the page H1 (with search words) sits in
// the hero badge on the landing page.
export function HeroTagline({
  line1,
  line2,
  body,
  isArabic,
  onComplete,
  asHeading = false,
}: {
  line1: string;
  line2: string;
  body: string;
  isArabic: boolean;
  onComplete?: () => void;
  /**
   * The headline is the page H1: one flowing sentence whose closing words
   * (line2) are highlighted and underlined, instead of two stacked lines.
   */
  asHeading?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Word split is English-only — Arabic shaping must stay on whole lines.
  const wordByWord = !isArabic && !reduceMotion;
  const line2Delay = reduceMotion ? 0 : wordByWord ? 0.42 : 0.3;
  const bodyDelay = reduceMotion ? 0 : wordByWord ? 0.95 : 0.8;

  useEffect(() => {
    if (reduceMotion) {
      onCompleteRef.current?.();
      return;
    }
    const ms = Math.round((bodyDelay + 0.8) * 1000);
    const id = window.setTimeout(() => onCompleteRef.current?.(), ms);
    return () => window.clearTimeout(id);
  }, [line1, line2, body, isArabic, reduceMotion, bodyDelay]);

  const Title = asHeading ? "h1" : "p";
  const titleClass = asHeading
    ? "hero-headline mx-auto max-w-[20ch] font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground text-balance sm:text-[50px] lg:text-[60px]"
    : "mx-auto max-w-[18ch] font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground text-balance sm:text-[56px] lg:text-[64px]";
  const accentLine = asHeading ? "hero-accent-line" : undefined;

  if (reduceMotion) {
    return (
      <div className="flex flex-col items-start gap-7">
        <Title className={titleClass}>
          <span className={asHeading ? "hero-tagline-line inline" : "block"}>{line1}</span>
          {asHeading && " "}
          <span className={cn("hero-gradient-text", asHeading ? "hero-tagline-line hero-accent-line" : "block")}>{line2}</span>
        </Title>
        <p className="mx-auto max-w-[40ch] text-base leading-relaxed text-muted-foreground md:text-[17px] text-pretty">
          {body}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-7">
      <Title className={titleClass}>
        <RevealedLine text={line1} lineClassName={asHeading ? "inline" : undefined} delay={0.05} wordByWord={wordByWord} />
        {asHeading && " "}
        <RevealedLine
          text={line2}
          className="hero-gradient-text"
          lineClassName={accentLine}
          delay={line2Delay}
          // One piece in headline mode, so the highlight is one smooth
          // gradient instead of restarting on every word.
          wordByWord={wordByWord && !asHeading}
        />
      </Title>

      <motion.p
        className="mx-auto max-w-[40ch] text-base leading-relaxed text-muted-foreground md:text-[17px] text-pretty"
        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: bodyDelay, duration: 0.75, ease: EASE }}
      >
        {body}
      </motion.p>
    </div>
  );
}
