"use client";

import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaneLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export function PlaneLoader({ size = "md", className, label = "Loading…" }: PlaneLoaderProps) {
  const sizes = { sm: 20, md: 32, lg: 48 };
  const px = sizes[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        <Plane
          size={px}
          className="animate-plane-fly text-blue-600 -rotate-45"
          aria-hidden="true"
        />
        {/* trail dots */}
        <div className="absolute -bottom-1 -right-1 flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="block rounded-full bg-blue-400"
              style={{
                width: 4 - i * 0.5,
                height: 4 - i * 0.5,
                opacity: 1 - i * 0.25,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
      {label && (
        <p className="text-sm text-blue-600 font-medium" style={{ fontFamily: "var(--font-body)" }}>
          {label}
        </p>
      )}
    </div>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <PlaneLoader size="lg" label={label ?? "Loading…"} />
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }) {
  return (
    <Plane
      size={18}
      className={cn("animate-plane-fly text-blue-600 -rotate-45 inline-block", className)}
      aria-hidden="true"
    />
  );
}
