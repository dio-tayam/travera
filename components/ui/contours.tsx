import { cn } from "@/lib/utils";

/**
 * Topographic contour lines — Travera's background graphic.
 * Pure SVG, scales to any container. Colour comes from `currentColor`.
 */
const RINGS = [
  // hill A (upper right)
  "M770 120c60-40 160-30 200 30s10 150-60 170-160-10-180-70 0-90 40-130z",
  "M720 90c90-70 250-60 300 40s0 220-110 250-250-20-280-110 10-110 90-180z",
  "M660 60c120-100 340-90 410 50s-10 300-160 340-340-30-380-160 10-140 130-230z",
  "M600 30c150-130 430-120 520 60s-20 380-210 430-430-40-480-200 20-170 170-290z",
  // hill B (lower left)
  "M180 470c40-50 130-60 170-10s20 130-40 150-140 0-150-60 0-50 20-80z",
  "M130 440c70-80 210-90 270-10s20 200-70 230-220 0-240-90 0-80 40-130z",
  "M80 410c100-110 290-120 370-10s20 270-100 310-300 0-330-120 0-110 60-180z",
  "M30 380c130-140 370-150 470-10s20 340-130 390-380 0-420-150 0-140 80-230z",
  // long ridges across
  "M-40 250c180-60 330 40 520-10s330-150 560-70",
  "M-40 300c200-70 340 60 540 0s340-160 580-70",
  "M-40 640c220-40 400-120 600-60s360 80 560 0",
];

export function Contours({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none", className)} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"
         fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      {RINGS.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
