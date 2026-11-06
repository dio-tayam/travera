"use client";

import { usePathname, useRouter } from "next/navigation";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Plane, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { rememberMode, useIsAdmin } from "@/lib/use-is-admin";

const MODES = [
  { id: "traveler", icon: Plane, href: "/dashboard" },
  { id: "admin", icon: ShieldCheck, href: "/admin" },
] as const;

/**
 * Traveler ↔ Admin workspace switch, styled like LanguageSwitcher.
 * Renders nothing unless the account has more than one role.
 */
export function ModeSwitcher({ variant = "full", className, side = "top" }: {
  variant?: "full" | "compact"; className?: string; side?: "top" | "bottom";
}) {
  const { t } = useTranslation("common");
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const router = useRouter();
  if (!isAdmin) return null;

  const current = pathname.startsWith("/admin") ? MODES[1] : MODES[0];
  const CurIcon = current.icon;

  function go(m: (typeof MODES)[number]) {
    rememberMode(m.id);
    if (m.id !== current.id) router.push(m.href);
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${t("mode.label")}: ${t(`mode.${current.id}`)}`}
        title={t("mode.label")}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-control)] text-[13px] text-ink-2 transition-colors",
          "hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken data-[state=open]:text-ink",
          variant === "full" ? "h-9 w-full px-2.5" : "h-9 w-9 justify-center",
          className
        )}
      >
        <CurIcon size={16} aria-hidden="true" className="shrink-0" />
        {variant === "full" && (
          <>
            <span className="flex-1 truncate text-start">{t(`mode.${current.id}`)}</span>
            <ChevronsUpDown size={14} className="text-ink-3" aria-hidden="true" />
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side={side}
          align={variant === "full" ? "start" : "end"}
          sideOffset={6}
          className="z-50 min-w-[250px] rounded-[14px] border border-line bg-surface p-1.5
                     shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise"
        >
          <Menu.Label className="px-2.5 pb-1.5 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {t("mode.label")}
          </Menu.Label>
          {MODES.map(m => {
            const Icon = m.icon;
            const active = m.id === current.id;
            return (
              <Menu.Item
                key={m.id}
                onSelect={() => go(m)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 outline-none transition-colors",
                  "data-[highlighted]:bg-sunken",
                  active && "bg-sunken"
                )}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[9px]",
                                    m.id === "admin" ? "bg-ink text-paper" : "bg-accent-soft text-accent-ink")}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{t(`mode.${m.id}`)}</span>
                  <span className="block text-[12px] text-ink-3">{t(`mode.${m.id}Hint`)}</span>
                </span>
                {active && <Check size={15} className="shrink-0 text-accent" aria-hidden="true" />}
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
