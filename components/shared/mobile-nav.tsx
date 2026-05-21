"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { LayoutDashboard, Map, Wallet, Package, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  tripId?: string;
}

export function MobileNav({ tripId }: MobileNavProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  const tabs = tripId
    ? [
        { href: `/trips/${tripId}`, icon: LayoutDashboard, label: t("nav.dashboard") },
        { href: `/trips/${tripId}/itinerary`, icon: Map, label: t("nav.map") },
        { href: `/trips/${tripId}/budget`, icon: Wallet, label: t("nav.budget") },
        { href: `/trips/${tripId}/packing`, icon: Package, label: t("nav.packing") },
        { href: `/trips/${tripId}/documents`, icon: FileText, label: t("nav.docs") },
      ]
    : [
        { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
      ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex z-30 safe-area-pb"
      aria-label="Mobile navigation"
    >
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]"
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={22}
              aria-hidden="true"
              style={{ color: active ? "var(--color-primary)" : "#9CA3AF" }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: active ? "var(--color-primary)" : "#9CA3AF" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
