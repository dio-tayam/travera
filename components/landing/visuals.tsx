import {
  Backpack, BedDouble, Check, FileText, LayoutGrid, Plane, Route, Ticket,
  UtensilsCrossed, Wallet,
} from "lucide-react";
import { CAT } from "@/lib/categories";
import { Contours } from "@/components/ui/contours";
import { Layer, Parallax } from "./motion";

/* Static, decorative product illustrations — HTML/SVG only, so they stay crisp and add no image weight. */

const STOPS = [
  { n: 1, time: "07:30", title: "Arrive at Haneda", type: "Flight", icon: Plane, color: CAT.teal, x: 82, y: 74 },
  { n: 2, time: "10:00", title: "Sensō-ji Temple", type: "Activity", icon: Ticket, color: CAT.accent, x: 64, y: 34 },
  { n: 3, time: "12:30", title: "Tsukiji Market", type: "Food", icon: UtensilsCrossed, color: CAT.berry, x: 44, y: 58 },
  { n: 4, time: "16:00", title: "Hotel Gracery", type: "Hotel", icon: BedDouble, color: CAT.blue, x: 30, y: 24 },
];

function Pin({ n, color, size = 26 }: { n: number; color: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 30 38">
      <path d="M15 1C7.3 1 1 7.2 1 14.8 1 24 15 37 15 37s14-13 14-22.2C29 7.2 22.7 1 15 1z" fill={color} stroke="#fff" strokeWidth="2" />
      <text x="15" y="16" textAnchor="middle" dominantBaseline="middle" fontFamily="ui-monospace,monospace" fontSize="12" fontWeight="700" fill="#fff">{n}</text>
    </svg>
  );
}

/** Stylised map with roads, water, contour lines and the day's route. `animated` draws the route and drops the pins. */
export function MapArt({ className = "", points, animated = false, id = "map" }: {
  className?: string; points?: { x: number; y: number }[]; animated?: boolean; id?: string;
}) {
  const stops = STOPS.map((s, i) => ({ ...s, ...(points?.[i] ?? {}) }));
  const route = `M ${stops.map(s => `${s.x} ${s.y}`).join(" L ")}`;
  return (
    <div className={`relative overflow-hidden bg-[#ece8de] ${className}`}>
      <Contours className={`absolute inset-0 h-full w-full text-[#d6d0c0] ${animated ? "animate-drift" : ""}`} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {animated && (
          <mask id={`${id}-route`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <path d={route} fill="none" stroke="#fff" strokeWidth="8" pathLength={1} className="route-draw" />
          </mask>
        )}
        <path d="M-5 70 C 18 62, 30 80, 52 70 S 84 56, 105 64" fill="none" stroke="#c9d8de" strokeWidth="10" />
        <path d="M12 -5 L 34 105 M -5 44 L 105 30 M 74 -5 L 58 105" stroke="#fbfaf6" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <path d={route} fill="none" stroke="#16181d" mask={animated ? `url(#${id}-route)` : undefined}
              strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {stops.map((s, i) => (
        <span key={s.n} className="absolute -translate-x-1/2 -translate-y-full drop-shadow-sm" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <span className={animated ? "pin-drop block" : "block"} style={{ ["--d" as string]: `${700 + i * 380}ms` }}>
            <Pin n={s.n} color={s.color} />
          </span>
        </span>
      ))}
    </div>
  );
}

/** Mobile app screen inside a phone frame. */
function Phone() {
  return (
    <div className="w-[272px] rounded-[46px] bg-ink p-[9px] shadow-[0_50px_90px_-40px_rgb(22_24_29/0.6)]">
      <div className="relative h-[560px] overflow-hidden rounded-[38px] bg-paper">
        {/* status bar + island */}
        <div className="flex h-9 items-center justify-between px-6 pt-1 font-mono text-[10px] font-medium text-ink">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-ink" />
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] border border-ink" /></span>
        </div>
        {/* app bar */}
        <div className="flex h-10 items-center border-b border-line px-4 text-[12.5px] font-semibold text-ink">
          <span className="mr-2 text-ink-3">‹</span> Spring in Tokyo
        </div>
        <div className="px-4 pt-4">
          <p className="eyebrow text-[9px]">Itinerary · 8 days</p>
          <p className="display mt-1 text-[26px] text-ink">Day 1</p>
          <div className="mt-3 flex gap-1.5">
            {[["FRI", 20], ["SAT", 21], ["SUN", 22], ["MON", 23]].map(([d, n], i) => (
              <span key={d} className={`flex h-[46px] w-[42px] flex-col items-center justify-center rounded-[11px] border ${i === 0 ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink"}`}>
                <span className={`font-mono text-[8px] ${i === 0 ? "text-paper/60" : "text-ink-3"}`}>{d}</span>
                <span className="display text-[16px] leading-none">{n}</span>
              </span>
            ))}
          </div>
          <ol className="mt-4">
            {STOPS.map((s, i) => (
              <li key={s.n} className="animate-rise relative flex gap-2 pb-2 last:pb-0" style={{ animationDelay: `${500 + i * 140}ms` }}>
                {i < STOPS.length - 1 && <span className="absolute bottom-0 left-[10px] top-6 w-px bg-line" />}
                <span className="relative grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full border-[1.5px] bg-surface font-mono text-[9px] font-medium"
                      style={{ borderColor: s.color, color: s.color }}>{s.n}</span>
                <span className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-2.5 py-1.5">
                  <span className="flex items-center gap-1 text-[9.5px]">
                    <s.icon size={9} style={{ color: s.color }} />
                    <span style={{ color: s.color }}>{s.type}</span>
                    <span className="font-mono text-ink-3">{s.time}</span>
                  </span>
                  <span className="block truncate text-[11.5px] font-medium text-ink">{s.title}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        {/* tab bar */}
        <div className="absolute inset-x-0 bottom-0 flex h-14 items-start justify-around border-t border-line bg-paper pt-2.5">
          {[LayoutGrid, Route, Wallet, Backpack, FileText].map((Icon, i) => (
            <span key={i} className={`relative grid place-items-center ${i === 1 ? "text-ink" : "text-ink-3"}`}>
              {i === 1 && <span className="absolute -top-2.5 h-[3px] w-6 rounded-b-full bg-accent" />}
              <Icon size={16} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Boarding-pass ticket card. */
function TicketCard() {
  return (
    <div className="w-[248px] rounded-[16px] bg-surface shadow-[0_28px_56px_-28px_rgb(22_24_29/0.5)] ring-1 ring-line"
         style={{ ["--notch-bg" as string]: "#f5f3ee" }}>
      <div className="flex items-end justify-between px-4 pb-3 pt-3.5">
        <div><p className="eyebrow text-[9px]">From</p><p className="display mt-0.5 text-[26px] text-ink">MNL</p></div>
        <Plane size={15} className="mb-3 rotate-45 text-accent" />
        <div className="text-right"><p className="eyebrow text-[9px]">To</p><p className="display mt-0.5 text-[26px] text-ink">HND</p></div>
      </div>
      <div className="perforation" />
      <div className="grid grid-cols-3 gap-2 px-4 pb-3.5 pt-3">
        {[["Dates", "Nov 20–27"], ["Days", "08"], ["Crew", "3"]].map(([k, v]) => (
          <div key={k}><p className="eyebrow text-[8.5px]">{k}</p><p className="mt-0.5 text-[11.5px] font-medium text-ink">{v}</p></div>
        ))}
      </div>
    </div>
  );
}

export function HeroMockup() {
  return (
    <Parallax className="relative mx-auto h-[600px] w-full max-w-[600px]">
      <div aria-hidden="true">
        {/* map canvas — route kept in the right half so the phone never hides it */}
        <Layer depth={6} lift={0.04} className="absolute inset-x-0 top-10 hidden h-[470px] sm:block">
          <MapArt animated id="hero" className="h-full rounded-[28px] ring-1 ring-line"
                  points={[{ x: 88, y: 66 }, { x: 82, y: 26 }, { x: 68, y: 48 }, { x: 62, y: 18 }]} />
        </Layer>

        {/* phone */}
        <Layer depth={14} lift={0.1} className="absolute left-1/2 top-0 -translate-x-1/2 sm:left-[3%] sm:translate-x-0">
          <Phone />
        </Layer>

        {/* ticket */}
        <Layer depth={26} lift={0.18} className="absolute bottom-6 right-[-8px] hidden sm:block lg:right-[-24px]">
          <div className="animate-float"><div className="rotate-[-3deg]"><TicketCard /></div></div>
        </Layer>

        {/* settle-up chip */}
        <Layer depth={20} lift={0.14} className="absolute right-[6%] top-0 hidden md:block">
          <div className="animate-float-alt flex items-center gap-2.5 rounded-full bg-surface py-2 pl-2 pr-4 shadow-[0_20px_40px_-20px_rgb(22_24_29/0.45)] ring-1 ring-line">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-positive-soft text-positive"><Check size={14} strokeWidth={2.5} /></span>
            <span className="text-[12px] text-ink-2"><b className="font-semibold text-ink">Ana</b> paid you <b className="font-semibold tabular text-ink">₱5,300</b></span>
          </div>
        </Layer>
      </div>
    </Parallax>
  );
}
