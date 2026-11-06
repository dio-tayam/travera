"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, languageMeta, setLanguage } from "@/lib/i18n";
import { Check, ChevronsUpDown, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "full" shows the language name; "compact" is an icon button with the language code. */
  variant?: "full" | "compact";
  side?: "top" | "bottom";
}

export function LanguageSwitcher({ className, variant = "full", side = "bottom" }: Props) {
  const { t, i18n } = useTranslation("common");
  const current = languageMeta(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${t("language.label")}: ${current.label}`}
        title={t("language.label")}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-control)] text-[13px] text-ink-2 transition-colors",
          "hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken data-[state=open]:text-ink",
          variant === "full" ? "h-9 w-full px-2.5" : "h-9 min-w-9 justify-center px-1.5",
          className
        )}
      >
        <Languages size={16} aria-hidden="true" className="shrink-0" />
        {variant === "full" ? (
          <>
            <span className="flex-1 truncate text-start">{current.label}</span>
            <ChevronsUpDown size={14} className="text-ink-3" aria-hidden="true" />
          </>
        ) : (
          <span className="font-mono text-[10.5px] uppercase tracking-wider">{current.code}</span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side={side}
          align={variant === "full" ? "start" : "end"}
          sideOffset={6}
          className="z-50 max-h-[min(var(--radix-dropdown-menu-content-available-height),380px)] min-w-[230px]
                     overflow-y-auto rounded-[12px] border border-line bg-surface p-1
                     shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise"
        >
          <Menu.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {t("language.label")}
          </Menu.Label>
          <Menu.RadioGroup value={current.code} onValueChange={code => setLanguage(code as typeof current.code)}>
            {SUPPORTED_LANGUAGES.map(lang => {
              const active = lang.code === current.code;
              return (
                <Menu.RadioItem
                  key={lang.code}
                  value={lang.code}
                  lang={lang.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[8px] px-2.5 py-2 text-[13px] outline-none",
                    "data-[highlighted]:bg-sunken",
                    active ? "font-medium text-ink" : "text-ink-2"
                  )}
                >
                  <span className="w-6 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{lang.code}</span>
                  <span className="flex-1">
                    {lang.label}
                    {lang.code !== current.code && (
                      <span className="ms-1.5 text-[11.5px] text-ink-3">{t(`language.${lang.code}`)}</span>
                    )}
                  </span>
                  {active && <Check size={14} className="text-accent" aria-hidden="true" />}
                </Menu.RadioItem>
              );
            })}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
