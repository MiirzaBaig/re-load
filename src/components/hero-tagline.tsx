"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
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
  delay,
  wordByWord,
}: {
  text: string;
  className?: string;
  delay: number;
  wordByWord: boolean;
}) {
  if (!wordByWord) {
    return (
      <motion.span
        className={cn("hero-tagline-line block", className)}
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
      className="hero-tagline-line block"
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

export function HeroTagline({
  line1,
  line2,
  body,
  isArabic,
  onComplete,
}: {
  line1: string;
  line2: string;
  body: string;
  isArabic: boolean;
  onComplete?: () => void;
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

  if (reduceMotion) {
    return (
      <div className="flex flex-col items-start gap-7">
        <h1 className="mx-auto max-w-[18ch] font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground text-balance sm:text-[56px] lg:text-[64px]">
          <span className="block">{line1}</span>
          <span className="hero-gradient-text block">{line2}</span>
        </h1>
        <p className="mx-auto max-w-[46ch] text-lg leading-relaxed text-muted-foreground text-pretty">
          {body}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-7">
      <h1 className="mx-auto max-w-[18ch] font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground text-balance sm:text-[56px] lg:text-[64px]">
        <RevealedLine text={line1} delay={0.05} wordByWord={wordByWord} />
        <RevealedLine
          text={line2}
          className="hero-gradient-text"
          delay={line2Delay}
          wordByWord={wordByWord}
        />
      </h1>

      <motion.p
        className="mx-auto max-w-[46ch] text-lg leading-relaxed text-muted-foreground text-pretty"
        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: bodyDelay, duration: 0.75, ease: EASE }}
      >
        {body}
      </motion.p>
    </div>
  );
}
