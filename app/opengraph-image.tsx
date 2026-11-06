import { ImageResponse } from "next/og";

export const alt = "Travera — Plan trips together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview card (Open Graph / Twitter) in the boarding-pass style. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
                    background: "#f5f3ee", padding: "72px 80px", fontFamily: "sans-serif", color: "#16181d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Rose size={64} />
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Travera</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>Every trip,</span>
          <span style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: "#d4552b" }}>one shared plan.</span>
          <span style={{ marginTop: 28, fontSize: 30, color: "#4b505c" }}>
            Itinerary on a live map · split expenses · packing · travel docs
          </span>
        </div>
        <div style={{ display: "flex", borderTop: "3px dashed #cfcabd", paddingTop: 24, fontSize: 24, color: "#868b96",
                      fontFamily: "monospace", letterSpacing: 2 }}>
          FREE · 10 LANGUAGES · MADE FOR GROUPS
        </div>
      </div>
    ),
    size
  );
}

/** Compass-rose mark (orange north point), mirrors components/ui/logo.tsx. */
function Rose({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d="M32 4 L38 32 L32 28 L26 32 Z" fill="#d4552b" />
      <path d="M32 60 L26 32 L32 36 L38 32 Z" fill="#16181d" />
      <path d="M4 32 L32 26 L28 32 L32 38 Z" fill="#16181d" />
      <path d="M60 32 L32 38 L36 32 L32 26 Z" fill="#16181d" />
    </svg>
  );
}
