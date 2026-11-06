"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, LayoutDashboard, Map, ScrollText, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { ModeSwitcher } from "@/components/shared/mode-switcher";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/trips", label: "Trips", icon: Map },
  { href: "/admin/logs", label: "Activity log", icon: ScrollText },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

/** Admin console chrome. Internal tool, so English only. */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) => exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row" dir="ltr" lang="en">
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:h-dvh lg:w-[240px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-5">
          <Link href="/admin" className="flex items-center gap-2" aria-label="Admin home">
            <Logo size={24} />
          </Link>
          <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-paper lg:hidden">
            <ShieldCheck size={11} /> Admin
          </span>
          <div className="lg:hidden"><ModeSwitcher variant="compact" /></div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map(item => {
            const Icon = item.icon;
            const on = active(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined}
                    className={cn("relative flex h-9 shrink-0 items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-[13.5px] transition-colors",
                                  on ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                {on && <span className="absolute -left-3 top-2 bottom-2 hidden w-[3px] rounded-r-full bg-accent lg:block" aria-hidden="true" />}
                <Icon size={16} aria-hidden="true" className={cn(on && "text-accent")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-line p-3 lg:absolute lg:bottom-0 lg:block lg:w-[240px]">
          <ModeSwitcher />
          <Link href="/dashboard" className="flex h-9 items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink">
            <ArrowLeft size={15} /> Back to Travera
          </Link>
          <p className="truncate px-2.5 pt-1 font-mono text-[10.5px] text-ink-3" title={email}>{email}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-rise">{children}</div>
      </main>
    </div>
  );
}
