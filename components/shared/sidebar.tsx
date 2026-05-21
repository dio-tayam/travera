"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  LayoutDashboard,
  Map,
  Wallet,
  Package,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "#map", icon: Map, key: "map" },
  { href: "#budget", icon: Wallet, key: "budget" },
  { href: "#packing", icon: Package, key: "packing" },
  { href: "#docs", icon: FileText, key: "docs" },
] as const;

interface SidebarProps {
  tripId?: string;
}

export function Sidebar({ tripId }: SidebarProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const items = tripId
    ? [
        { href: `/trips/${tripId}`, icon: LayoutDashboard, label: t("nav.dashboard") },
        { href: `/trips/${tripId}/itinerary`, icon: Map, label: t("nav.itinerary") },
        { href: `/trips/${tripId}/budget`, icon: Wallet, label: t("nav.budget") },
        { href: `/trips/${tripId}/packing`, icon: Package, label: t("nav.packing") },
        { href: `/trips/${tripId}/documents`, icon: FileText, label: t("nav.docs") },
      ]
    : [
        { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
      ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 bg-white border-r border-gray-100 transition-all duration-200 z-20",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center px-4 py-5 border-b border-gray-100",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 100 100" aria-label="Travera logo">
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1="50" y1="50"
                x2={50 + 38 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
                y2={50 + 38 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
                stroke="#FCD116" strokeWidth="6" strokeLinecap="round" />
            ))}
            <circle cx="50" cy="50" r="14" fill="#FCD116" />
          </svg>
          {!collapsed && (
            <span
              className="text-lg font-extrabold"
              style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}
            >
              Travera
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2" aria-label="Main navigation">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                collapsed && "justify-center"
              )}
              style={active ? { backgroundColor: "var(--color-primary)" } : {}}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 p-2 space-y-1">
        {!collapsed && <LanguageSwitcher className="w-full" />}
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors",
            collapsed && "justify-center"
          )}
          aria-label={t("nav.signOut")}
          title={collapsed ? t("nav.signOut") : undefined}
        >
          <LogOut size={18} aria-hidden="true" />
          {!collapsed && <span>{t("nav.signOut")}</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
