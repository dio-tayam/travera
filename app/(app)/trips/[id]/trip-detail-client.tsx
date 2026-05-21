"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { formatDateRange, formatCurrency } from "@/lib/utils";
import { Calendar, MapPin, Users, Wallet, Share2, Globe } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Membership = { role: "owner" | "editor" | "viewer" };
type Member = {
  user_id: string;
  role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

interface Props {
  trip: Trip;
  membership: Membership;
  members: Member[];
}

export function TripDetailClient({ trip, membership, members }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [sharing, setSharing] = useState(false);

  const navCards = [
    { href: "itinerary", label: t("nav.itinerary"), icon: MapPin, color: "var(--color-primary)" },
    { href: "budget", label: t("nav.budget"), icon: Wallet, color: "var(--color-accent)" },
    { href: "packing", label: t("nav.packing"), icon: Users, color: "#16a34a" },
    { href: "documents", label: t("nav.docs"), icon: Globe, color: "#7c3aed" },
  ];

  async function handleShare() {
    const url = `${window.location.origin}/share/${trip.share_token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  }

  async function togglePublic() {
    setSharing(true);
    try {
      await supabase
        .from("trips")
        .update({ is_public: !trip.is_public })
        .eq("id", trip.id);
      toast.success(trip.is_public ? "Trip set to private" : "Trip is now public!");
    } catch {
      toast.error("Failed to update sharing settings");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Cover */}
      <div className="relative h-52 lg:h-64 overflow-hidden">
        {trip.cover_image_url ? (
          <img
            src={trip.cover_image_url}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: "var(--color-primary)" }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6">
          <h1
            className="text-2xl lg:text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {trip.title}
          </h1>
          {trip.destination && (
            <p className="text-white/80 text-sm flex items-center gap-1 mt-1" style={{ fontFamily: "var(--font-body)" }}>
              <MapPin size={13} aria-hidden="true" />
              {trip.destination}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-6 py-6 space-y-6 max-w-2xl">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {trip.start_date && trip.end_date && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} style={{ color: "var(--color-primary)" }} />
                <span className="text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>Dates</span>
              </div>
              <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
                {formatDateRange(trip.start_date, trip.end_date)}
              </p>
            </div>
          )}
          {trip.total_budget && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} style={{ color: "var(--color-accent)" }} />
                <span className="text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>Budget</span>
              </div>
              <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
                {formatCurrency(trip.total_budget, trip.currency)}
              </p>
            </div>
          )}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} style={{ color: "#16a34a" }} />
              <span className="text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>Members</span>
            </div>
            <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-2 gap-3">
          {navCards.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={`/trips/${trip.id}/${href}`}
              className="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={20} style={{ color }} aria-hidden="true" />
              </div>
              <span
                className="font-semibold text-sm"
                style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}
              >
                {label}
              </span>
            </Link>
          ))}
        </div>

        {/* Share section (owner only) */}
        {membership.role === "owner" && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              Share Trip
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <Share2 size={15} aria-hidden="true" />
                Copy Link
              </button>
              <button
                onClick={togglePublic}
                disabled={sharing}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border"
                style={
                  trip.is_public
                    ? { borderColor: "var(--color-primary)", color: "var(--color-primary)", fontFamily: "var(--font-body)" }
                    : { borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }
                }
              >
                {trip.is_public ? "Public" : "Private"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
