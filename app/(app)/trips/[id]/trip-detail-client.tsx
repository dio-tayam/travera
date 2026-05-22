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
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--color-background)" }}>

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

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* Budget stat */}
        {trip.total_budget && (
          <div className="card p-4 flex items-center gap-3 rounded-2xl">
            <div className="w-11 h-11 rounded-xl budget-gradient flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-white"/>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total budget</p>
              <p className="text-xl font-bold text-slate-900"
                 style={{ fontFamily: "var(--font-heading)" }}>
                {formatCurrency(trip.total_budget, trip.currency)}
              </p>
            </div>
          </div>
        )}

        {/* Nav cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {NAV_CARDS.map(({ href, label, icon: Icon, color, bg }) => (
            <Link key={href} href={`/trips/${trip.id}/${href}`}
                  className="card card-hover flex items-center gap-3 p-4 group rounded-2xl">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                              transition-transform duration-200 group-hover:scale-110"
                   style={{ backgroundColor: bg }}>
                <Icon size={19} style={{ color }} aria-hidden="true"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm"
                   style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400
                                                 transition-colors shrink-0"/>
            </Link>
          ))}
        </div>

        {/* Share (owner only) */}
        {membership.role === "owner" && (
          <div className="card p-4 space-y-3 rounded-2xl">
            <h3 className="font-bold text-sm text-slate-900"
                style={{ fontFamily: "var(--font-heading)" }}>
              Share this trip
            </h3>
            <div className="flex gap-2">
              <button onClick={copyShareLink}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                                 rounded-xl border border-slate-200 text-sm font-medium
                                 text-slate-700 hover:bg-slate-50 hover:border-blue-200
                                 transition-all active:scale-95">
                <Share2 size={14}/> Copy link
              </button>
              <button onClick={togglePublic} disabled={sharing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                                 rounded-xl border text-sm font-medium transition-all active:scale-95"
                      style={isPublic
                        ? { borderColor:"#2563eb", color:"#2563eb", background:"#eff6ff" }
                        : { borderColor:"#e2e8f0", color:"#64748b" }}>
                {isPublic ? <Unlock size={14}/> : <Lock size={14}/>}
                {isPublic ? "Public" : "Private"}
              </button>
            </div>
            {isPublic && (
              <p className="text-xs text-slate-400 leading-relaxed">
                Anyone with the link can view this trip&apos;s itinerary (read-only).
              </p>
            )}
          </div>
        )}

        {/* Members */}
        <div className="card p-4 rounded-2xl">
          <h3 className="font-bold text-sm text-slate-900 mb-3"
              style={{ fontFamily: "var(--font-heading)" }}>Travelers</h3>
          <div className="space-y-2.5">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full sky-gradient flex items-center justify-center
                                text-white text-xs font-bold shrink-0">
                  {(m.profiles?.display_name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {m.profiles?.display_name ?? "Member"}
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
  );
}
