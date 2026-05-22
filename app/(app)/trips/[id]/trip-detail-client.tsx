"use client";

import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { formatDateRange, formatCurrency } from "@/lib/utils";
import { Calendar, MapPin, Users, Wallet, Share2, Lock, Unlock,
         Map, Package, FileText, ChevronRight, Plane } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

type Trip       = Database["public"]["Tables"]["trips"]["Row"];
type Membership = { role: "owner" | "editor" | "viewer" };
type Member     = {
  user_id: string; role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

interface Props { trip: Trip; membership: Membership; members: Member[] }

const NAV_DESCRIPTIONS: Record<string, string> = {
  itinerary: "Day-by-day stops",
  budget:    "Track shared costs",
  packing:   "Collaborative list",
  documents: "Tickets & visas",
};

const NAV_CARDS = [
  { href: "itinerary", label: "Itinerary",  icon: Map,     color: "#6366f1", bg: "#eef2ff", grad: "itinerary-gradient" },
  { href: "budget",    label: "Budget",     icon: Wallet,  color: "#f59e0b", bg: "#fffbeb", grad: "budget-gradient"    },
  { href: "packing",   label: "Packing",    icon: Package, color: "#10b981", bg: "#ecfdf5", grad: "packing-gradient"   },
  { href: "documents", label: "Documents",  icon: FileText,color: "#8b5cf6", bg: "#f5f3ff", grad: "docs-gradient"      },
] as const;

export function TripDetailClient({ trip, membership, members }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [isPublic, setIsPublic] = useState(trip.is_public);
  const [sharing, setSharing]   = useState(false);

  async function copyShareLink() {
    const url = `${window.location.origin}/share/${trip.share_token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied!");
  }

  async function togglePublic() {
    setSharing(true);
    const { error } = await supabase.from("trips")
      .update({ is_public: !isPublic }).eq("id", trip.id);
    if (!error) {
      setIsPublic(p => !p);
      toast.success(!isPublic ? "Trip is now public" : "Trip set to private");
    } else {
      toast.error("Failed to update");
    }
    setSharing(false);
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in" style={{ background: "var(--color-background)" }}>

      {/* Cover */}
      <div className="relative h-52 lg:h-60 overflow-hidden">
        {trip.cover_image_url
          ? <img src={trip.cover_image_url} alt={trip.title}
                 className="w-full h-full object-cover"/>
          : <div className="w-full h-full sky-gradient flex items-center justify-center">
              <Plane size={72} className="text-white/15 -rotate-45" aria-hidden="true"/>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"/>
        <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-7">
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1.5"
              style={{ fontFamily: "var(--font-heading)" }}>{trip.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
            {trip.destination && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13}/> {trip.destination}
              </span>
            )}
            {trip.start_date && trip.end_date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13}/> {formatDateRange(trip.start_date, trip.end_date)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users size={13}/> {members.length} {members.length === 1 ? "traveler" : "travelers"}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column body on desktop */}
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-5
                      px-4 lg:px-8 py-5 pb-8 items-start">

        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Budget stat */}
          {trip.total_budget && (
            <div className="card p-4 flex items-center gap-4 rounded-2xl">
              <div className="w-12 h-12 rounded-xl budget-gradient flex items-center justify-center shrink-0
                              shadow-sm shadow-amber-200">
                <Wallet size={20} className="text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total budget</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight"
                   style={{ fontFamily: "var(--font-heading)" }}>
                  {formatCurrency(trip.total_budget, trip.currency)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Per traveler</p>
                <p className="text-base font-semibold text-slate-500 leading-tight"
                   style={{ fontFamily: "var(--font-heading)" }}>
                  {formatCurrency(trip.total_budget / Math.max(members.length, 1), trip.currency)}
                </p>
              </div>
            </div>
          )}

          {/* Nav cards 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {NAV_CARDS.map(({ href, label, icon: Icon, color, bg }) => (
              <Link key={href} href={`/trips/${trip.id}/${href}`}
                    className="card card-hover flex items-center gap-3 p-4 group rounded-2xl">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                                transition-transform duration-200 group-hover:scale-110"
                     style={{ backgroundColor: bg }}>
                  <Icon size={20} style={{ color }} aria-hidden="true"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm"
                     style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{NAV_DESCRIPTIONS[href]}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400
                                                   transition-colors shrink-0"/>
              </Link>
            ))}
          </div>

          {/* Share (owner only) */}
          {membership.role === "owner" && (
            <div className="card p-4 space-y-3 rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900"
                      style={{ fontFamily: "var(--font-heading)" }}>
                    Share this trip
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {isPublic ? t("trip.shareDesc_public") : t("trip.shareDesc_private")}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-full font-semibold
                                 flex items-center gap-1.5"
                      style={isPublic
                        ? { background: "#eff6ff", color: "#2563eb" }
                        : { background: "#f8fafc", color: "#64748b" }}>
                  {isPublic ? <Unlock size={10}/> : <Lock size={10}/>}
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center px-3 py-2.5 rounded-xl border border-slate-200
                                bg-slate-50 text-xs font-mono text-slate-500 overflow-hidden min-w-0">
                  <span className="truncate">travera.app/share/{trip.share_token?.slice(0,12)}…</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={copyShareLink}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3
                                     py-2.5 rounded-xl border border-slate-200 text-sm font-medium
                                     text-slate-700 hover:bg-slate-50 hover:border-blue-200
                                     transition-all active:scale-95">
                    <Share2 size={14}/> {t("trip.copyLink")}
                  </button>
                  <button onClick={togglePublic} disabled={sharing}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3
                                     py-2.5 rounded-xl border text-sm font-medium transition-all
                                     active:scale-95"
                          style={isPublic
                            ? { borderColor:"#2563eb", color:"#2563eb", background:"#eff6ff" }
                            : { borderColor:"#e2e8f0", color:"#64748b" }}>
                    {isPublic ? t("trip.makePrivate") : t("trip.makePublic")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Travelers (sticky on desktop) ─────────── */}
        <div className="lg:sticky lg:top-6">
          <div className="card p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}>{t("trip.travelers")}</h3>
              <span className="text-[11px] text-slate-400 font-medium">{members.length}</span>
            </div>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full sky-gradient flex items-center justify-center
                                  text-white text-xs font-bold shrink-0">
                    {(m.profiles?.display_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate"
                       style={{ fontFamily: "var(--font-heading)" }}>
                      {m.profiles?.display_name ?? "Member"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {(m.profiles?.display_name ?? "member").split(" ")[0].toLowerCase()}@travera.app
                    </p>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize"
                        style={{
                          background: m.role==="owner" ? "#eff6ff" : "#f8fafc",
                          color:      m.role==="owner" ? "#2563eb" : "#64748b",
                        }}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
