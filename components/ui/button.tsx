import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "font-medium rounded-[var(--radius-control)] transition-[background-color,border-color,color,transform] duration-150",
    "active:translate-y-px disabled:opacity-50 disabled:pointer-events-none",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:   "bg-ink text-paper hover:bg-[#2a2d35]",
        accent:    "bg-accent text-white hover:bg-accent-ink",
        secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
        ghost:     "text-ink-2 hover:bg-sunken hover:text-ink",
        danger:    "text-negative hover:bg-negative-soft",
      },
      size: {
        sm:   "h-8 px-3 text-[13px]",
        md:   "h-10 px-4 text-sm",
        lg:   "h-12 px-5 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";
