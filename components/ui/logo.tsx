import { cn } from "@/lib/utils";

/**
 * Travera mark: a free-standing compass rose with the north point in signal orange.
 * No background tile. `inverted` = light rose for dark backgrounds.
 * The rose sits in a `.logo-rose` group so it can be animated (spin-in, hover turn).
 */
export function LogoMark({ size = 28, className, inverted = false }: {
  size?: number; className?: string; inverted?: boolean;
}) {
  const face = inverted ? "#f5f3ee" : "#16181d";
  const shade = inverted ? "#a19d90" : "#6b6f78";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)}>
      <g className="logo-rose">
        {/* north (accent) */}
        <path d="M32 2 L39.5 24.5 L32 32 Z" fill="#e8673a" />
        <path d="M32 2 L24.5 24.5 L32 32 Z" fill="#d4552b" />
        {/* east */}
        <path d="M62 32 L39.5 24.5 L32 32 Z" fill={face} />
        <path d="M62 32 L39.5 39.5 L32 32 Z" fill={shade} />
        {/* south */}
        <path d="M32 62 L39.5 39.5 L32 32 Z" fill={face} />
        <path d="M32 62 L24.5 39.5 L32 32 Z" fill={shade} />
        {/* west */}
        <path d="M2 32 L24.5 39.5 L32 32 Z" fill={face} />
        <path d="M2 32 L24.5 24.5 L32 32 Z" fill={shade} />
      </g>
    </svg>
  );
}

export function Logo({ className, inverted = false, size = 26 }: {
  className?: string; inverted?: boolean; size?: number;
}) {
  return (
    <span className={cn("group/logo inline-flex items-center gap-2", className)}>
      <LogoMark size={size} inverted={inverted} />
      <span className={cn("font-display text-[21px] font-bold leading-none tracking-[-0.045em]",
                          inverted ? "text-paper" : "text-ink")}>
        travera
      </span>
    </span>
  );
}
