import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, Globe2, Languages, Link2, Plane, Plus, Radio, Smartphone } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { SiteNav } from "@/components/landing/site-nav";
import { SignInButton } from "@/components/landing/sign-in-button";
import { Reveal, ScrollSteps, SplitFlap } from "@/components/landing/motion";
import { FeaturePlayground } from "@/components/landing/playground";
import { HeroMockup } from "@/components/landing/visuals";
import { Logo } from "@/components/ui/logo";
import { Contours } from "@/components/ui/contours";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Travera — Plan trips together" },
  description: "One shared plan for your whole group: itinerary on a live map, split expenses, a packing checklist and travel documents. Free.",
};

const EXTRAS = [
  { icon: Radio, title: "Live collaboration", body: "Changes appear for everyone instantly — no refreshing." },
  { icon: Smartphone, title: "Made for the road", body: "Plan on a laptop, check today's stops on your phone." },
  { icon: Languages, title: "10 languages", body: "English, 日本語, 한국어, Deutsch, Français, Español and more." },
];

const STEPS = [
  { icon: <Plus size={17} aria-hidden="true" />, title: "Create a trip", body: "Name it, add dates, destination and an optional budget." },
  { icon: <Link2 size={17} aria-hidden="true" />, title: "Share the plan", body: "Turn on a read-only link so friends and family can follow along." },
  { icon: <Globe2 size={17} aria-hidden="true" />, title: "Plan it, then live it", body: "Build the days, track spending and pack — all in one place." },
];

const FAQ = [
  ["Is Travera free?", "Yes. Planning, sharing and collaborating are free, and no card is needed to sign up."],
  ["Who can see my trips?", "Only the travelers on the trip. Others can see it only if you turn on its public, read-only share link — and you can turn that off at any time."],
  ["Can people view a trip without signing in?", "Yes. Anyone with a trip's public share link can see the itinerary and map, read-only, without an account."],
  ["Which currencies are supported?", "Each trip has its own currency, including PHP, USD, EUR, JPY, KRW, GBP, AUD, SGD, THB and CNY."],
  ["Can I use it on my phone?", "Yes. Travera is built to work just as well on a phone as on a laptop — including the map and the packing checklist."],
];

const ROUTES = [
  ["MNL", "HND"], ["ICN", "CJU"], ["SIN", "DPS"], ["CEB", "TPE"], ["LHR", "CDG"], ["BKK", "CNX"],
  ["SYD", "AKL"], ["JFK", "LAX"], ["KIX", "OKA"], ["DXB", "IST"], ["HKG", "KUL"], ["FCO", "BCN"],
];

const HEADLINE = ["Every", "trip,", "one", "shared", "plan."];

export default async function LandingPage() {
  const signedIn = !!(await getUser());

  const arrow = <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />;
  const primaryCta = signedIn
    ? <Button asChild size="lg" className="group"><Link href="/dashboard">Open your trips {arrow}</Link></Button>
    : <SignInButton size="lg" google variant="primary">Continue with Google</SignInButton>;

  return (
    <div className="min-h-dvh bg-paper">
      <SiteNav signedIn={signedIn} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section id="top" className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[780px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" aria-hidden="true">
            <Contours className="animate-drift h-full w-full text-line-strong/70" />
          </div>
          <div className="relative mx-auto grid grid-cols-1 max-w-[1200px] items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-8 lg:pb-28 lg:pt-20">
            <div>
              <p className="animate-rise inline-flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-3.5 pr-1.5 text-[12.5px] text-ink-2 shadow-[0_6px_20px_-12px_rgb(22_24_29/0.3)]">
                Next stop
                <SplitFlap words={["TOKYO", "SEOUL", "CEBU", "BALI", "PARIS", "KYOTO", "LISBON"]}
                           className="font-mono text-[11px] font-medium" />
              </p>

              <h1 className="display word-rise mt-6 text-[46px] text-ink sm:text-[62px] xl:text-[74px]">
                {HEADLINE.map((w, i) => (
                  <span key={w} style={{ ["--i" as string]: i }} className={i >= 2 ? "text-accent" : undefined}>
                    {w}{i < HEADLINE.length - 1 ? " " : ""}
                  </span>
                ))}
              </h1>

              <p className="animate-rise mt-6 max-w-[34rem] text-[16px] leading-relaxed text-ink-2 [animation-delay:500ms] sm:text-[17px]">
                Travera puts your itinerary, budget, packing list and travel documents in one place —
                so the whole group plans together instead of across five group chats.
              </p>
              <div className="animate-rise mt-9 flex flex-col gap-3 [animation-delay:650ms] sm:flex-row sm:items-center">
                {primaryCta}
                <Button asChild size="lg" variant="secondary" className="group">
                  <a href="#how">See how it works <ArrowRight size={16} className="rotate-90 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden="true" /></a>
                </Button>
              </div>
              <ul className="animate-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2 [animation-delay:800ms]">
                {["No card required", "Private by default", "Works on any device"].map(t => (
                  <li key={t} className="flex items-center gap-1.5"><Check size={14} className="text-positive" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="animate-rise [animation-delay:250ms]">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* ── Departure board marquee ──────────────────────────── */}
        <section aria-label="Example routes" className="marquee overflow-hidden border-y border-line bg-ink py-4 text-paper">
          <div className="animate-marquee flex w-max gap-10">
            {[...ROUTES, ...ROUTES].map(([from, to], i) => (
              <span key={i} className="flex items-center gap-3 font-mono text-[13px] tracking-[0.12em]" aria-hidden={i >= ROUTES.length}>
                <span>{from}</span>
                <Plane size={13} className="rotate-45 text-accent" aria-hidden="true" />
                <span>{to}</span>
                <span className="ml-4 h-1 w-1 rounded-full bg-paper/25" aria-hidden="true" />
              </span>
            ))}
          </div>
        </section>

        {/* ── Features (scroll story) ──────────────────────────── */}
        <section id="features" className="scroll-mt-20 bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32">
            <div className="max-w-2xl">
              <Reveal as="p" className="eyebrow">Features</Reveal>
              <Reveal as="h2" delay={80} className="display mt-3 text-[40px] text-ink text-balance sm:text-[56px]">
                Everything the trip needs, nothing it doesn&apos;t.
              </Reveal>
              <Reveal as="p" delay={160} className="mt-4 text-[16px] text-ink-2">
                Four tools that share the same trip — go ahead, try them. Everything below works.
              </Reveal>
            </div>

            <div className="mt-12">
              <FeaturePlayground />
            </div>

            <ul className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
              {EXTRAS.map(({ icon: Icon, title, body }, i) => (
                <Reveal as="li" key={title} delay={i * 100}
                        className="group flex gap-4 rounded-[18px] border border-line bg-paper px-6 py-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[0_20px_40px_-24px_rgb(22_24_29/0.35)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-[13.5px] text-ink-2">{body}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <Reveal as="p" className="eyebrow">How it works</Reveal>
                <Reveal as="h2" delay={80} className="display mt-3 text-[40px] text-ink text-balance sm:text-[56px]">
                  From idea to itinerary in minutes.
                </Reveal>
                <Reveal as="p" delay={160} className="mt-4 max-w-sm text-[16px] text-ink-2">
                  No setup, no templates to wrestle with. Sign in with Google and start your first trip.
                </Reveal>
              </div>
              <ScrollSteps steps={STEPS} />
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8 lg:py-32">
            <div>
              <Reveal as="p" className="eyebrow">FAQ</Reveal>
              <Reveal as="h2" delay={80} className="display mt-3 text-[40px] text-ink sm:text-[56px]">Questions, answered.</Reveal>
            </div>
            <div className="border-t border-line">
              {FAQ.map(([q, a], i) => (
                <Reveal key={q} delay={i * 70}>
                  <details className="group border-b border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium text-ink transition-colors hover:text-accent-ink [&::-webkit-details-marker]:hidden">
                      {q}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-[transform,background-color,color] duration-300 group-open:rotate-45 group-open:bg-ink group-open:text-paper">
                        <Plus size={16} aria-hidden="true" />
                      </span>
                    </summary>
                    <p className="faq-body -mt-1 max-w-xl pb-6 text-[14.5px] leading-relaxed text-ink-2">{a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <Reveal variant="scale" className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center sm:px-12 sm:py-24">
            <Contours className="animate-drift absolute inset-0 h-full w-full text-paper/10" />
            <div className="relative">
              <h2 className="display mx-auto max-w-2xl text-[44px] text-paper text-balance sm:text-[64px]">
                Where are you <em className="text-accent">going next?</em>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[16px] text-paper/60">Start a trip in under a minute. Share it with your crew whenever you&apos;re ready.</p>
              <div className="mt-9 flex justify-center">
                {signedIn
                  ? <Button asChild size="lg" variant="accent" className="group"><Link href="/dashboard">Open your trips {arrow}</Link></Button>
                  : <SignInButton size="lg" variant="accent" className="group">Get started — it&apos;s free {arrow}</SignInButton>}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Logo size={24} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-ink-2">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
        </nav>
        <p className="font-mono text-[11px] text-ink-3">© {new Date().getFullYear()} Travera</p>
      </footer>
    </div>
  );
}
