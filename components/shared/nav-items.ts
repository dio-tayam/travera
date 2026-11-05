import { LayoutGrid, Route, Wallet, Backpack, FileText, type LucideIcon } from "lucide-react";

export type TripSummary = {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type NavItem = { href: string; icon: LucideIcon; labelKey: string; exact?: boolean };

export function tripNavItems(tripId: string): NavItem[] {
  return [
    { href: `/trips/${tripId}`,           icon: LayoutGrid, labelKey: "trip.overview", exact: true },
    { href: `/trips/${tripId}/itinerary`, icon: Route,      labelKey: "nav.itinerary" },
    { href: `/trips/${tripId}/budget`,    icon: Wallet,     labelKey: "nav.budget" },
    { href: `/trips/${tripId}/packing`,   icon: Backpack,   labelKey: "nav.packing" },
    { href: `/trips/${tripId}/documents`, icon: FileText,   labelKey: "nav.docs" },
  ];
}

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
