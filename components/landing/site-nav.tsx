"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignInButton } from "./sign-in-button";

const LINKS = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "faq", label: "FAQ" },
];

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  // Scroll state: background + reading progress (header always stays pinned)
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  // Scroll-spy: highlight the section in view
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    LINKS.forEach(l => { const el = document.getElementById(l.id); if (el) io.observe(el); });
    const hero = document.getElementById("top");
    const heroIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(null); }, { rootMargin: "-40% 0px -55% 0px" });
    if (hero) heroIo.observe(hero);
    return () => { io.disconnect(); heroIo.disconnect(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={cn(
      "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300 ease-out",
      scrolled || open ? "border-b border-line bg-paper/85 shadow-[0_8px_24px_-20px_rgb(22_24_29/0.35)] backdrop-blur-md" : "border-b border-transparent"
    )}>
      <nav className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 sm:px-6 lg:px-8" aria-label="Primary">
        <Link href="/" aria-label="Travera home" onClick={() => setOpen(false)} className="logo-spin">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 rounded-full p-1 md:flex">
          {LINKS.map(l => (
            <li key={l.id}>
              <a href={`#${l.id}`} aria-current={active === l.id ? "true" : undefined}
                 className={cn("relative rounded-full px-3.5 py-1.5 text-[14px] transition-colors duration-200",
                               active === l.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild className="group"><Link href="/dashboard">Open dashboard <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
              <SignInButton className="group">
                Get started <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </SignInButton>
            </>
          )}
        </div>

        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="ml-auto grid h-10 w-10 place-items-center rounded-[var(--radius-control)] text-ink hover:bg-sunken md:hidden">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* reading progress */}
      <span ref={progressRef} aria-hidden="true"
            className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left scale-x-0 bg-accent" />

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-paper px-4 pb-6 pt-2 animate-rise md:hidden">
          <ul>
            {LINKS.map((l, i) => (
              <li key={l.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <a href={`#${l.id}`} onClick={() => setOpen(false)}
                   className="flex h-14 items-center justify-between border-b border-line text-[17px] font-medium text-ink">
                  {l.label} <ArrowRight size={16} className="text-ink-3" />
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2">
            {signedIn ? (
              <Button asChild size="lg"><Link href="/dashboard">Open dashboard</Link></Button>
            ) : (
              <>
                <SignInButton size="lg" google variant="secondary">Continue with Google</SignInButton>
                <Button asChild size="lg" variant="ghost"><Link href="/login">Sign in</Link></Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
