"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Check, ChevronsUpDown, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "full" shows the language name; "compact" is an icon button. */
  variant?: "full" | "compact";
  side?: "top" | "bottom";
}

export function LanguageSwitcher({ className, variant = "full", side = "bottom" }: Props) {
  const { i18n } = useTranslation("common");
  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Language: ${current.label}`}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-control)] text-[13px] text-ink-2 transition-colors",
          "hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken data-[state=open]:text-ink",
          variant === "full" ? "h-9 w-full px-2.5" : "h-9 w-9 justify-center",
          className
        )}
      >
        <Languages size={16} aria-hidden="true" className="shrink-0" />
        {variant === "full" && (
          <>
            <span className="flex-1 truncate text-left">{current.label}</span>
            <ChevronsUpDown size={14} className="text-ink-3" aria-hidden="true" />
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side={side}
          align={variant === "full" ? "start" : "end"}
          sideOffset={6}
          className="z-50 max-h-[min(var(--radix-dropdown-menu-content-available-height),320px)] min-w-[200px]
                     overflow-y-auto rounded-[12px] border border-line bg-surface p-1
                     shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise"
        >
          {SUPPORTED_LANGUAGES.map(lang => {
            const active = lang.code === current.code;
            return (
              <Menu.Item
                key={lang.code}
                onSelect={() => i18n.changeLanguage(lang.code)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[8px] px-2.5 py-2 text-[13px] outline-none",
                  "data-[highlighted]:bg-sunken",
                  active ? "text-ink font-medium" : "text-ink-2"
                )}
              >
                <span className="w-6 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{lang.code}</span>
                <span className="flex-1">{lang.label}</span>
                {active && <Check size={14} className="text-accent" aria-hidden="true" />}
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
