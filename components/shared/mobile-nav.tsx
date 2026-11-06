"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { tripNavItems, isActive } from "./nav-items";

/** Bottom tab bar — only shown inside a trip, on screens below `lg`. */
export function MobileNav({ tripId }: { tripId: string }) {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  return (
    <nav aria-label={t("sidebar.sections")}
         className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md safe-bottom lg:hidden">
      <ul className="mx-auto flex max-w-lg">
        {tripNavItems(tripId).map(item => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const label = item.labelKey === "nav.itinerary" ? t("nav.map") : t(item.labelKey);
          return (
            <li key={item.href} className="flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined}
                    className={cn("relative flex h-16 flex-col items-center justify-center gap-1 transition-colors",
                                  active ? "text-ink" : "text-ink-3")}>
                <span className={cn("absolute top-0 h-[3px] w-8 rounded-b-full bg-accent transition-opacity",
                                    active ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                <Icon size={20} aria-hidden="true" strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10.5px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
