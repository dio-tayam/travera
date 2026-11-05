"use client";

import { useEffect, useRef, useState } from "react";
import {
  BedDouble, Car, Check, Globe2, MapPin, Plane, Plus, RotateCcw, ShoppingBag, Ticket, UtensilsCrossed,
} from "lucide-react";
import { CAT } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Contours } from "@/components/ui/contours";
import { Reveal } from "./motion";

/* ── Shell: tilt + cursor spotlight ──────────────────────────────────────── */
function PlayCard({ eyebrow, title, body, hint, className, children }: {
  eyebrow: string; title: string; body: string; hint: string; className?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--px", `${x * 100}%`);
    el.style.setProperty("--py", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 4}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 5}deg`);
  }
  function onLeave() {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave}
         className={cn("group/card relative flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-paper",
                       "transition-[transform,box-shadow,border-color] duration-300 ease-out [transform:perspective(1100px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]",
                       "hover:border-line-strong hover:shadow-[0_30px_60px_-36px_rgb(22_24_29/0.45)]", className)}>
      {/* spotlight */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
           style={{ background: "radial-gradient(420px circle at var(--px,50%) var(--py,50%), rgb(212 85 43 / 0.08), transparent 60%)" }}
           aria-hidden="true" />
      <div className="relative px-6 pt-6 sm:px-7 sm:pt-7">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">{eyebrow}</p>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            {hint}
          </span>
        </div>
        <h3 className="display mt-3 text-[28px] text-ink">{title}</h3>
        <p className="mt-2 max-w-md text-[14.5px] text-ink-2">{body}</p>
      </div>
      <div className="relative mt-auto p-3 pt-6 sm:p-4 sm:pt-7">
        <div className="rounded-[16px] bg-sunken p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Animated number ─────────────────────────────────────────────────────── */
function useCountUp(value: number, ms = 600) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;

/* ── 1 · Itinerary: list ↔ map selection ─────────────────────────────────── */
const DEMO_STOPS = [
  { time: "07:30", title: "Arrive at Haneda", type: "Flight", icon: Plane, color: CAT.teal, x: 80, y: 78 },
  { time: "10:00", title: "Sensō-ji Temple", type: "Activity", icon: Ticket, color: CAT.accent, x: 70, y: 30 },
  { time: "12:30", title: "Tsukiji Market", type: "Food", icon: UtensilsCrossed, color: CAT.berry, x: 42, y: 56 },
  { time: "16:00", title: "Hotel Gracery", type: "Hotel", icon: BedDouble, color: CAT.blue, x: 24, y: 24 },
];

function ItineraryDemo() {
  const [active, setActive] = useState(1);
  const route = `M ${DEMO_STOPS.map(s => `${s.x} ${s.y}`).join(" L ")}`;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.05fr]">
      <ol className="space-y-1.5" role="listbox" aria-label="Stops">
        {DEMO_STOPS.map((s, i) => (
          <li key={s.title}>
            <button role="option" aria-selected={active === i} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-all duration-200",
                                  active === i ? "bg-surface shadow-[0_8px_20px_-14px_rgb(22_24_29/0.5)] ring-1 ring-line" : "hover:bg-surface/60")}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[10px] transition-colors"
                    style={active === i ? { background: s.color, borderColor: s.color, color: "#fff" } : { borderColor: s.color, color: s.color }}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] text-ink-3">{s.time} · {s.type}</span>
                <span className="block truncate text-[12.5px] font-medium text-ink">{s.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="relative min-h-[190px] overflow-hidden rounded-[14px] bg-[#ece8de] ring-1 ring-line">
        <Contours className="absolute inset-0 h-full w-full text-[#d6d0c0]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-5 66 C 20 58, 34 78, 56 68 S 86 56, 105 62" fill="none" stroke="#c9d8de" strokeWidth="9" />
          <path d={route} fill="none" stroke="#16181d" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {DEMO_STOPS.map((s, i) => (
          <button key={s.title} onClick={() => setActive(i)} aria-label={`Select ${s.title}`}
                  className="absolute -translate-x-1/2 -translate-y-full transition-transform duration-300"
                  style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: active === i ? 2 : 1 }}>
            <span className={cn("block origin-bottom transition-transform duration-300", active === i ? "scale-[1.35]" : "scale-100")}>
              <svg width="24" height="30" viewBox="0 0 30 38">
                <path d="M15 1C7.3 1 1 7.2 1 14.8 1 24 15 37 15 37s14-13 14-22.2C29 7.2 22.7 1 15 1z" fill={s.color} stroke="#fff" strokeWidth="2" />
                <text x="15" y="16" textAnchor="middle" dominantBaseline="middle" fontFamily="ui-monospace,monospace" fontSize="12" fontWeight="700" fill="#fff">{i + 1}</text>
              </svg>
            </span>
            {active === i && <span className="absolute left-1/2 top-full h-2 w-5 -translate-x-1/2 rounded-full bg-ink/20 blur-[2px]" />}
          </button>
        ))}
        <div key={active} className="animate-rise absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded-[10px] bg-surface/95 px-2.5 py-2 text-[11.5px] ring-1 ring-line backdrop-blur">
          <MapPin size={12} style={{ color: DEMO_STOPS[active].color }} />
          <span className="truncate font-medium text-ink">{DEMO_STOPS[active].title}</span>
          <span className="ml-auto font-mono text-[10px] text-ink-3">{DEMO_STOPS[active].time}</span>
        </div>
      </div>
    </div>
  );
}

/* ── 2 · Budget: add expenses, watch the split ───────────────────────────── */
const PEOPLE = ["You", "Ana", "Ben"];
const PRESETS = [
  { label: "Ramen", amount: 1200, icon: UtensilsCrossed, color: CAT.berry },
  { label: "Taxi", amount: 650, icon: Car, color: CAT.teal },
  { label: "Museum", amount: 900, icon: Ticket, color: CAT.accent },
  { label: "Souvenirs", amount: 2100, icon: ShoppingBag, color: CAT.ochre },
];
type DemoExpense = { id: number; label: string; amount: number; color: string; icon: typeof Car; payer: number };

function BudgetDemo() {
  const seed: DemoExpense[] = [{ id: 0, label: "Hotel Gracery", amount: 9000, color: CAT.blue, icon: BedDouble, payer: 0 }];
  const [items, setItems] = useState<DemoExpense[]>(seed);
  const nextId = useRef(1);
  const total = items.reduce((s, e) => s + e.amount, 0);
  const shown = useCountUp(total);

  // balances: each person owes total/3; payer is credited
  const paid = PEOPLE.map((_, p) => items.filter(e => e.payer === p).reduce((s, e) => s + e.amount, 0));
  const share = total / PEOPLE.length;
  const owesYou = PEOPLE.map((_, p) => p === 0 ? 0 : Math.max(0, share - paid[p]));

  function add(p: typeof PRESETS[number]) {
    const id = nextId.current++;
    setItems(list => [{ id, ...p, payer: id % PEOPLE.length }, ...list].slice(0, 5));
  }

  const byColor = items.reduce<Record<string, number>>((acc, e) => { acc[e.color] = (acc[e.color] ?? 0) + e.amount; return acc; }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => add(p)}
                  className="flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1.5 text-[11.5px] text-ink transition-all hover:-translate-y-0.5 hover:border-ink active:translate-y-0">
            <Plus size={11} /> {p.label} <span className="font-mono text-ink-3">{peso(p.amount)}</span>
          </button>
        ))}
        {items.length > 1 && (
          <button onClick={() => setItems(seed)} aria-label="Reset expenses"
                  className="grid h-[30px] w-[30px] place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink">
            <RotateCcw size={13} />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] bg-ink p-4 text-paper">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-paper/50">Total spent</p>
          <p className="display mt-1.5 text-[30px] tabular">{peso(shown)}</p>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-paper/10">
            {Object.entries(byColor).map(([c, v]) => (
              <span key={c} className="h-full border-r-2 border-ink transition-[width] duration-500 last:border-r-0" style={{ width: `${(v / total) * 100}%`, background: c }} />
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {PEOPLE.slice(1).map((n, i) => (
              <p key={n} className="flex justify-between text-[11px] text-paper/60">
                <span>{n} owes you</span><span className="font-mono text-paper">{peso(owesYou[i + 1])}</span>
              </p>
            ))}
          </div>
        </div>
        <ul className="space-y-1.5 overflow-hidden">
          {items.map(e => (
            <li key={e.id} className="animate-rise flex items-center gap-2 rounded-[10px] bg-surface px-2.5 py-2 ring-1 ring-line">
              <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `${e.color}18`, color: e.color }}><e.icon size={12} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{e.label}</span>
                <span className="block text-[10px] text-ink-3">Paid by {PEOPLE[e.payer]}</span>
              </span>
              <span className="text-[12px] font-medium tabular text-ink">{peso(e.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── 3 · Packing: tick it off ────────────────────────────────────────────── */
const PACK = ["Passport", "Power bank", "Rain jacket", "Universal adapter", "Walking shoes"];

function PackingDemo() {
  const [done, setDone] = useState<boolean[]>([true, false, false, false, false]);
  const count = done.filter(Boolean).length;
  const all = count === PACK.length;
  return (
    <div className="relative rounded-[14px] bg-surface p-3 ring-1 ring-line">
      <div className="flex items-baseline justify-between px-1">
        <p className="display text-[24px] text-ink tabular">{count}<span className="text-ink-3">/{PACK.length}</span></p>
        <p className={cn("font-mono text-[10px] transition-colors", all ? "text-positive" : "text-ink-3")}>{all ? "READY FOR TAKEOFF" : "PACKED"}</p>
      </div>
      <div className="relative mx-1 mt-2 h-1.5 overflow-visible rounded-full bg-sunken">
        <span className={cn("block h-full rounded-full transition-[width,background-color] duration-500", all ? "bg-positive" : "bg-ink")}
              style={{ width: `${(count / PACK.length) * 100}%` }} />
        <Plane size={14} className={cn("absolute -top-[5px] rotate-45 text-accent transition-[left] duration-500")}
               style={{ left: `calc(${(count / PACK.length) * 100}% - 7px)` }} aria-hidden="true" />
      </div>
      <ul className="mt-3">
        {PACK.map((label, i) => (
          <li key={label}>
            <button role="checkbox" aria-checked={done[i]} onClick={() => setDone(d => d.map((v, j) => j === i ? !v : v))}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left transition-colors hover:bg-sunken">
              <span className={cn("grid h-[17px] w-[17px] place-items-center rounded-[5px] border-[1.5px] transition-all duration-200",
                                  done[i] ? "scale-100 border-ink bg-ink text-paper" : "border-line-strong")}>
                {done[i] && <Check size={11} strokeWidth={3} className="animate-rise" />}
              </span>
              <span className={cn("text-[13px] transition-colors", done[i] ? "text-ink-3 line-through" : "text-ink")}>{label}</span>
            </button>
          </li>
        ))}
      </ul>
      {all && (
        <button onClick={() => setDone(PACK.map(() => false))}
                className="animate-rise absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-medium text-positive">
          <RotateCcw size={11} /> Unpack
        </button>
      )}
    </div>
  );
}

/* ── 4 · Documents: pull one from the stack ──────────────────────────────── */
const DOCS = [
  { ext: "PDF", label: "Boarding pass", icon: Plane, color: CAT.teal, detail: [["Flight", "PR 432"], ["Seat", "14A"], ["Gate", "7"]] },
  { ext: "PDF", label: "Hotel booking", icon: BedDouble, color: CAT.blue, detail: [["Check-in", "Nov 20"], ["Nights", "7"], ["Room", "Twin"]] },
  { ext: "JPG", label: "Japan e-visa", icon: Globe2, color: CAT.berry, detail: [["Type", "Tourist"], ["Valid", "90 days"], ["Entries", "Single"]] },
];

function DocsDemo() {
  const [open, setOpen] = useState(0);
  const doc = DOCS[open];
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
      <div className="relative mx-auto h-[170px] w-[180px]">
        {DOCS.map((d, i) => {
          const pos = (i - open + DOCS.length) % DOCS.length; // 0 = front
          return (
            <button key={d.label} onClick={() => setOpen(i)} aria-label={`Open ${d.label}`} aria-pressed={open === i}
                    className="absolute left-1/2 top-1/2 w-[120px] rounded-[12px] bg-surface p-2.5 text-left shadow-[0_14px_28px_-18px_rgb(22_24_29/0.5)] ring-1 ring-line transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      transform: `translate(-50%, -50%) translate(${pos * 22 - 22}px, ${pos * -8}px) rotate(${pos * 7 - 7}deg) scale(${1 - pos * 0.06})`,
                      zIndex: DOCS.length - pos,
                    }}>
              <span className="relative grid h-[70px] place-items-center rounded-[8px] bg-paper">
                <span className="h-[3px] w-3/5 rounded-full bg-line-strong" />
                <span className="absolute left-1.5 top-1.5 rounded-[4px] px-1.5 py-0.5 font-mono text-[8.5px] font-medium text-white" style={{ background: d.color }}>{d.ext}</span>
              </span>
              <span className="mt-2 flex items-center gap-1 truncate text-[10.5px] font-medium text-ink"><d.icon size={10} style={{ color: d.color }} />{d.label}</span>
            </button>
          );
        })}
      </div>
      <div key={open} className="animate-rise rounded-[14px] bg-surface p-4 ring-1 ring-line">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `${doc.color}18`, color: doc.color }}><doc.icon size={12} /></span>
          {doc.label}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {doc.detail.map(([k, v]) => (
            <div key={k}><dt className="eyebrow text-[9px]">{k}</dt><dd className="mt-0.5 text-[12.5px] font-medium text-ink">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-ink-3">Tap the stack to switch files.</p>
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */
export function FeaturePlayground() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal delay={0} className="h-full">
        <PlayCard eyebrow="01 · Itinerary" hint="Click a stop" title="Every day, mapped."
                  body="Search any place, drag to reorder, and see each day's route and pins on a live map.">
          <ItineraryDemo />
        </PlayCard>
      </Reveal>
      <Reveal delay={90} className="h-full">
        <PlayCard eyebrow="02 · Budget" hint="Add an expense" title="Split costs without the spreadsheet."
                  body="Log what you spend as you go. Travera tracks the budget and works out who owes whom.">
          <BudgetDemo />
        </PlayCard>
      </Reveal>
      <Reveal delay={0} className="h-full">
        <PlayCard eyebrow="03 · Packing" hint="Tick items off" title="One list, ticked off together."
                  body="Start from travel essentials, add your own, and see what's still left before you leave.">
          <PackingDemo />
        </PlayCard>
      </Reveal>
      <Reveal delay={90} className="h-full">
        <PlayCard eyebrow="04 · Documents" hint="Tap a file" title="Bookings within reach."
                  body="Boarding passes, hotel confirmations and visas, shared with everyone on the trip.">
          <DocsDemo />
        </PlayCard>
      </Reveal>
    </div>
  );
}
