"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Reveal on scroll ────────────────────────────────────────────────────── */
export function Reveal({ children, as = "div", delay = 0, variant, className }: {
  children: React.ReactNode; as?: "div" | "li" | "section" | "article" | "p" | "h2";
  delay?: number; variant?: "up" | "left" | "right" | "scale"; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(as, {
    ref, className,
    "data-reveal": variant === "up" ? "" : variant ?? "",
    "data-shown": shown ? "" : undefined,
    style: { ["--reveal-delay" as string]: `${delay}ms` },
  }, children);
}

/* ── Split-flap departure board word ─────────────────────────────────────── */
export function SplitFlap({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setInterval(() => setI(n => (n + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  const width = Math.max(...words.map(w => w.length));
  const word = words[i].padEnd(width, " ");
  return (
    <span className={cn("flap inline-flex items-center gap-[3px]", className)} aria-live="polite" aria-label={words[i]}>
      {word.split("").map((ch, idx) => (
        <span key={`${i}-${idx}`} aria-hidden="true" style={{ ["--i" as string]: idx }}
              className={cn(
                "flap-char relative inline-grid h-[22px] w-[17px] place-items-center rounded-[4px] leading-none",
                ch === " " ? "bg-ink/10" : "bg-ink text-paper",
                // the split line across the middle of each flap
                "after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-paper/15"
              )}>
          {ch === " " ? "" : ch}
        </span>
      ))}
    </span>
  );
}

/* ── Pointer + scroll parallax for the hero mockup ───────────────────────── */
/** Sets --mx/--my (pointer, -1…1) and --sy (scroll px) on the wrapper; children use them in transforms. */
export function Parallax({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const fine = window.matchMedia("(pointer: fine)").matches;

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => el.style.setProperty("--sy", String(Math.min(window.scrollY, 900))));
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <div ref={ref} className={className} style={{ ["--mx" as string]: 0, ["--my" as string]: 0, ["--sy" as string]: 0 }}>{children}</div>;
}

/** A layer inside <Parallax>: moves `depth` px with the pointer and `lift`×scroll vertically. */
export function Layer({ depth = 10, lift = 0, className, children }: {
  depth?: number; lift?: number; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}
         style={{
           transform: `translate3d(calc(var(--mx) * ${depth}px), calc(var(--my) * ${depth}px + var(--sy) * ${-lift}px), 0)`,
           transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
           willChange: "transform",
         }}>
      {children}
    </div>
  );
}

/* ── Steps with a scroll-linked progress rail ────────────────────────────── */
export function ScrollSteps({ steps }: { steps: { title: string; body: string; icon: React.ReactNode }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = (window.innerHeight * 0.65 - r.top) / r.height;
      setProgress(Math.max(0, Math.min(1, p)));
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <ol ref={ref} className="relative">
      <span className="absolute bottom-6 left-[23px] top-6 w-px bg-line" aria-hidden="true" />
      <span className="absolute left-[23px] top-6 w-px origin-top bg-accent transition-[height] duration-150"
            style={{ height: `calc((100% - 3rem) * ${progress})` }} aria-hidden="true" />
      {steps.map((s, i) => {
        const reached = progress >= (i + 0.35) / steps.length || progress === 1;
        return (
          <li key={s.title} className="relative flex gap-6 py-7">
            <span className={cn("relative z-[1] grid h-12 w-12 shrink-0 place-items-center rounded-full border font-mono text-[13px] transition-colors duration-500",
                                reached ? "border-ink bg-ink text-paper" : "border-line-strong bg-paper text-ink-3")}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className={cn("pt-1.5 transition-opacity duration-500", reached ? "opacity-100" : "opacity-45")}>
              <p className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight text-ink">
                {s.title} <span className="text-ink-3">{s.icon}</span>
              </p>
              <p className="mt-1 max-w-md text-[15px] text-ink-2">{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
