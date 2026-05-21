"use client";

import { cn } from "@/lib/utils";

interface TraveraSpinnerProps {
  size?: number;
  className?: string;
}

export function TraveraSpinner({ size = 40, className }: TraveraSpinnerProps) {
  const rays = Array.from({ length: 8 }, (_, i) => i);
  const shortRays = Array.from({ length: 8 }, (_, i) => i);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("travera-spinner", className)}
      aria-label="Loading"
      role="img"
    >
      {/* Primary rays */}
      {rays.map((i) => (
        <line
          key={`ray-${i}`}
          x1="50"
          y1="50"
          x2={50 + 38 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
          y2={50 + 38 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
          stroke="#FCD116"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
      {/* Short rays between primary */}
      {shortRays.map((i) => (
        <line
          key={`short-${i}`}
          x1={50 + 20 * Math.cos(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
          y1={50 + 20 * Math.sin(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
          x2={50 + 32 * Math.cos(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
          y2={50 + 32 * Math.sin(((i * 45 + 22.5 - 90) * Math.PI) / 180)}
          stroke="#FCD116"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {/* Center circle */}
      <circle cx="50" cy="50" r="14" fill="#FCD116" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-4">
        <TraveraSpinner size={64} />
        <p
          className="text-sm font-medium"
          style={{ color: "var(--color-primary)", fontFamily: "var(--font-body)" }}
        >
          Loading…
        </p>
      </div>
    </div>
  );
}
