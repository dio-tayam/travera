"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { toast } from "sonner";
import { ArrowRight, Check, Copy, Globe2, Lock, Mail, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatDateRange, tripLength } from "@/lib/utils";
import { tripStatus } from "@/components/shared/trip-pass";
import { tripNavItems } from "@/components/shared/nav-items";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Figure, PageBody, PageHeader, SectionTitle } from "@/components/ui/primitives";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Member = {
  user_id: string; role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};
interface Props { trip: Trip; membership: { role: "owner" | "editor" | "viewer" }; members: Member[] }

const SECTION_COPY: Record<string, string> = {
  itinerary: "Plan each day's stops and see them on the map.",
  budget:    "Log shared costs and settle up fairly.",
  packing:   "A checklist the whole group can work through.",
  documents: "Tickets, bookings and visas in one place.",
};

export function TripDetailClient({ trip, membership, members }: Props) {
  const { t } = useTranslation("common");
  const [isPublic, setIsPublic] = useState(trip.is_public);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/share/${trip.share_token}`);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => { setShareUrl(`${window.location.origin}/share/${trip.share_token}`); }, [trip.share_token]);

  const status = tripStatus(trip);
  const days = tripLength(trip.start_date, trip.end_date);
  const sections = tripNavItems(trip.id).slice(1);

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1800);
  }

  async function togglePublic() {
    setSaving(true);
    const { error } = await createClient().from("trips").update({ is_public: !isPublic }).eq("id", trip.id);
    if (error) toast.error("Couldn't update sharing");
    else {
      setIsPublic(p => !p);
      toast.success(!isPublic ? "Anyone with the link can now view this trip" : "Trip is private again");
    }
    setSaving(false);
  }

  async function inviteTraveler(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    const response = await fetch(`/api/trips/${trip.id}/invitations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(result.error ?? "Couldn't send invitation");
    else { toast.success(result.added ? "Traveler added to the trip" : "Invitation sent by email"); setInviteEmail(""); if (result.added) window.location.reload(); }
    setInviting(false);
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow={<span suppressHydrationWarning className={cn(status.live && "text-positive")}>{status.label}</span>}
        title={trip.title}
        description={trip.destination ?? undefined}
      />

      {trip.cover_image_url && (
        <div className="mt-6 h-48 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-sunken sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={trip.cover_image_url} alt="" className="h-full w-full object-cover" decoding="async" />
        </div>
      )}

      {/* Boarding-pass facts */}
      <div className="panel mt-6 grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-4">
        <Figure label={t("trip.destination")} value={trip.destination ?? "—"} />
        <Figure label="Dates" value={trip.start_date && trip.end_date ? formatDateRange(trip.start_date, trip.end_date) : "Not set"} />
        <Figure label="Length" value={days ? `${days} ${days === 1 ? "day" : "days"}` : "—"} />
        <Figure label={t("trip.travelers")} value={members.length} />
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          {/* Sections */}
          <section aria-labelledby="plan-heading">
            <SectionTitle><span id="plan-heading">Plan</span></SectionTitle>
            <ul className="panel divide-y divide-line overflow-hidden">
              {sections.map((s, i) => {
                const key = s.href.split("/").pop()!;
                const Icon = s.icon;
                return (
                  <li key={s.href}>
                    <Link href={s.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
                      <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-2 transition-colors group-hover:border-ink group-hover:text-ink">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink">{t(s.labelKey)}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{SECTION_COPY[key]}</span>
                      </span>
                      <ArrowRight size={16} aria-hidden="true"
                                  className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Budget */}
          {trip.total_budget != null && (
            <section aria-labelledby="budget-heading">
              <SectionTitle action={
                <Link href={`/trips/${trip.id}/budget`} className="text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                  View expenses
                </Link>
              }><span id="budget-heading">{t("nav.budget")}</span></SectionTitle>
              <div className="panel grid grid-cols-2 gap-6 px-5 py-5">
                <div>
                  <p className="eyebrow">{t("trip.totalBudget")}</p>
                  <p className="display mt-2 text-[32px] text-ink tabular">{formatCurrency(trip.total_budget, trip.currency, { compact: true })}</p>
                </div>
                <div>
                  <p className="eyebrow">{t("trip.perTraveler")}</p>
                  <p className="display mt-2 text-[32px] text-ink-2 tabular">
                    {formatCurrency(trip.total_budget / Math.max(members.length, 1), trip.currency, { compact: true })}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Sharing */}
          {membership.role === "owner" && (
            <section aria-labelledby="share-heading">
              <SectionTitle><span id="share-heading">{t("trip.shareTrip")}</span></SectionTitle>
              <div className="panel px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full",
                                        isPublic ? "bg-accent-soft text-accent-ink" : "bg-sunken text-ink-2")}>
                      {isPublic ? <Globe2 size={16} /> : <Lock size={16} />}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-ink">{isPublic ? "Public link is on" : "Private trip"}</p>
                      <p className="mt-0.5 text-[13px] text-ink-2">
                        {isPublic ? t("trip.shareDesc_public") : t("trip.shareDesc_private")}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPublic} onChange={togglePublic} disabled={saving} label="Public link" />
                </div>

                {isPublic && (
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-[var(--radius-control)] border border-line bg-paper px-3 font-mono text-[12px] text-ink-2">
                      {shareUrl}
                    </code>
                    <Button variant="secondary" onClick={copyShareLink}>
                      {copied ? <Check size={15} className="text-positive" /> : <Copy size={15} />}
                      {copied ? "Copied" : t("trip.copyLink")}
                    </Button>
                  </div>
                )}
              </div>
              {!isPublic && <form onSubmit={inviteTraveler} className="panel mt-4 flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-[13px] font-medium text-ink">Invite a traveler by Gmail or email
                  <span className="mt-2 block"><input type="text" inputMode="email" autoComplete="off" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="traveler@gmail.com" aria-label="Traveler email address" className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 text-[14px]" /></span>
                </label>
                <Button type="submit" loading={inviting}><Mail size={15} /> Send invite</Button>
              </form>}
            </section>
          )}
        </div>

        {/* Travelers */}
        <aside className="lg:sticky lg:top-6" aria-labelledby="travelers-heading">
          <SectionTitle meta={members.length}><span id="travelers-heading">{t("trip.travelers")}</span></SectionTitle>
          {members.length > 1 && <p className="mb-3 flex items-center gap-2 text-[12px] text-ink-2"><UserPlus size={14}/> Shared group: all travelers can see and edit this trip.</p>}
          <ul className="panel divide-y divide-line">
            {members.map(m => (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={34} />
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                  {m.profiles?.display_name ?? "Traveler"}
                </p>
                <Badge tone={m.role === "owner" ? "accent" : "neutral"} className="capitalize">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PageBody>
  );
}

function Switch({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: () => void; disabled?: boolean; label: string;
}) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled}
            className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
                          checked ? "bg-ink" : "bg-line-strong")}>
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          checked && "translate-x-4")} />
    </button>
  );
}
