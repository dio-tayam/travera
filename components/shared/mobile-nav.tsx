"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { LayoutDashboard, Map, Wallet, Package, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps { tripId?: string }

const TAB_COLORS: Record<string, string> = {
  dashboard: "text-blue-600",
  itinerary: "text-indigo-600",
  budget:    "text-amber-500",
  packing:   "text-emerald-600",
  documents: "text-purple-600",
};

export function MobileNav({ tripId }: MobileNavProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  const tabs = tripId ? [
    { href: `/trips/${tripId}`,           icon: LayoutDashboard, label: t("nav.dashboard"), key: "dashboard" },
    { href: `/trips/${tripId}/itinerary`, icon: Map,             label: t("nav.map"),       key: "itinerary" },
    { href: `/trips/${tripId}/budget`,    icon: Wallet,          label: t("nav.budget"),    key: "budget"    },
    { href: `/trips/${tripId}/packing`,   icon: Package,         label: t("nav.packing"),   key: "packing"   },
    { href: `/trips/${tripId}/documents`, icon: FileText,        label: t("nav.docs"),      key: "documents" },
  ] : [
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), key: "dashboard" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/96 backdrop-blur-md
                    border-t border-slate-100 flex safe-area-inset-bottom"
         aria-label="Mobile navigation">
      {tabs.map(({ href, icon: Icon, label, key }) => {
        const isExact = href === `/trips/${tripId}` || href === "/dashboard";
        const active  = isExact ? pathname === href : pathname.startsWith(href);
        const color   = TAB_COLORS[key] ?? TAB_COLORS.dashboard;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 min-h-14
                       transition-all duration-150 relative"
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full
                               bg-current opacity-80"
                    style={{ color: "inherit" }}/>
            )}
            <Icon
              size={20}
              aria-hidden="true"
              className={cn("transition-all duration-150",
                active ? `${color} scale-110` : "text-slate-400")}
            />
            <span className={cn("text-[10px] font-semibold transition-colors tracking-wide",
              active ? color : "text-slate-400")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
