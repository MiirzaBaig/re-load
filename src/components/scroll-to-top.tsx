"use client";

import { useSsrReducedMotion as useReducedMotion } from "@/hooks/use-ssr-reduced-motion";

import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useCallback } from "react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

const SIZE = 48;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SHOW_AFTER = 0.08;

export function ScrollToTop() {
  const reduceMotion = useReducedMotion();
  const { t, isArabic } = useLanguage();
  const { scrollYProgress } = useScroll();

  const dashOffset = useTransform(scrollYProgress, (value) =>
    CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, value))),
  );
  const opacity = useTransform(scrollYProgress, (value) =>
    value > SHOW_AFTER ? 1 : 0,
  );
  const scale = useTransform(scrollYProgress, (value) =>
    value > SHOW_AFTER ? 1 : 0.82,
  );
  const pointerEvents = useTransform(scrollYProgress, (value) =>
    value > SHOW_AFTER ? "auto" : "none",
  );

  const scrollTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "instant" : "smooth",
    });
  }, [reduceMotion]);

  if (reduceMotion) {
    return null;
  }

  return (
    <motion.button
      type="button"
      onClick={scrollTop}
      aria-label={t("Scroll to top", "العودة للأعلى")}
      className={cn(
        "scroll-to-top",
        isArabic ? "scroll-to-top--start" : "scroll-to-top--end",
      )}
      style={{
        opacity,
        scale,
        pointerEvents,
      }}
      whileHover="hover"
      whileTap="tap"
      variants={{
        hover: {
          scale: 1.04,
          transition: { type: "spring", stiffness: 420, damping: 24 },
        },
        tap: {
          scale: 0.94,
          transition: { type: "spring", stiffness: 500, damping: 28 },
        },
      }}
    >
      <svg
        className="scroll-to-top-ring"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <circle
          className="scroll-to-top-track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />
        <motion.circle
          className="scroll-to-top-progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>

      <motion.span
        className="scroll-to-top-icon"
        aria-hidden="true"
        variants={{
          hover: {
            y: [0, -3, -1.5],
            scale: 1.08,
            transition: {
              y: {
                duration: 0.55,
                times: [0, 0.45, 1],
                ease: [0.22, 1, 0.36, 1],
                repeat: Infinity,
                repeatType: "mirror",
                repeatDelay: 0.15,
              },
              scale: { type: "spring", stiffness: 420, damping: 22 },
            },
          },
          tap: {
            y: 2,
            scale: 0.9,
            transition: { type: "spring", stiffness: 500, damping: 28 },
          },
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient
              id="scroll-top-arrow"
              x1="12"
              y1="4"
              x2="12"
              y2="20"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="var(--scroll-arrow-from)" />
              <stop offset="100%" stopColor="var(--scroll-arrow-to)" />
            </linearGradient>
          </defs>
          <path
            className="scroll-to-top-arrow"
            d="M12 5v14M5.5 11.5 12 5l6.5 6.5"
            stroke="url(#scroll-top-arrow)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.span>
    </motion.button>
  );
}
