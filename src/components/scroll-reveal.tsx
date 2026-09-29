"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => setVisible(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    const rect = el.getBoundingClientRect();
    const inView =
      rect.top < window.innerHeight * 0.92 &&
      rect.bottom > window.innerHeight * 0.08;
    if (inView) {
      // Already on screen: wait two frames so the hidden state is painted
      // first. Revealing synchronously here skipped the animation entirely,
      // which is why content above the fold appeared instantly.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(reveal);
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={cn(
        "transition-[opacity,transform] duration-[560ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0 motion-reduce:opacity-100",
        className,
      )}
      style={{
        transform: visible ? undefined : `translateY(${y}px)`,
        transitionDelay: visible ? `${delay}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );
}
