"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, ChevronDown, Clock, Info, LogOut, Mail, MoreHorizontal, UserMinus, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelative } from "@/lib/utils";
import { PERMISSIONS, ROLE_META } from "@/lib/roles";
import type { Member } from "@/lib/types";
import type { Role, TripInvitationRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Avatar, Badge, SectionTitle } from "@/components/ui/primitives";

const MENU = "z-50 min-w-[200px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise";
const ITEM = "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken";

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useTranslation("common");
  const { icon: Icon, tone } = ROLE_META[role];
  return <Badge tone={tone}><Icon size={11} aria-hidden="true" /> {t(`roles.${role}`)}</Badge>;
}

export function TravelersPanel({ tripId, tripTitle, members: initialMembers, invitations: initialInvites, userId, role }: {
  tripId: string; tripTitle: string; members: Member[]; invitations: TripInvitationRow[]; userId: string; role: Role;
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const supabase = createClient();
  const isOwner = role === "owner";
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Pick up server data after router.refresh() (e.g. a newly added traveler).
  useEffect(() => setMembers(initialMembers), [initialMembers]);
  useEffect(() => setInvites(initialInvites), [initialInvites]);

  const nameOf = (m: Member) => m.user_id === userId ? t("common.you") : m.profiles?.display_name ?? t("common.traveler");

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    const res = await fetch(`/api/trips/${tripId}/invitations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role: inviteRole }),
    });
    const body = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) { toast.error(t(`invite.errors.${body.code ?? "failed"}`, { defaultValue: t("invite.errors.failed") })); return; }
    if (body.status === "added") toast.success(t("invite.added"));
    else toast.success(body.emailed ? t("invite.emailed") : t("invite.pending"));
    setEmail("");
    router.refresh();
    // Optimistically show a pending invite until the refresh lands.
    if (body.status === "pending") {
      setInvites(p => [{ id: `tmp-${Date.now()}`, trip_id: tripId, email: email.trim().toLowerCase(), role: inviteRole,
                         invited_by: userId, created_at: new Date().toISOString() }, ...p.filter(i => i.email !== email.trim().toLowerCase())]);
    }
  }

  async function changeRole(m: Member, next: "editor" | "viewer") {
    if (m.role === next) return;
    const prev = members;
    setMembers(p => p.map(x => x.user_id === m.user_id ? { ...x, role: next } : x));
    const { error } = await supabase.from("trip_members").update({ role: next }).eq("trip_id", tripId).eq("user_id", m.user_id);
    if (error) { setMembers(prev); toast.error(t("travelers.roleFailed")); return; }
    toast.success(t("travelers.roleChanged", { name: nameOf(m), role: t(`roles.${next}`) }));
  }

  async function remove(m: Member) {
    const { error } = await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", m.user_id);
    if (error) { toast.error(t("travelers.removeFailed")); return; }
    setMembers(p => p.filter(x => x.user_id !== m.user_id));
    setRemoving(null);
    toast.success(t("travelers.removed", { name: nameOf(m) }));
  }

  async function cancelInvite(inv: TripInvitationRow) {
    const prev = invites;
    setInvites(p => p.filter(i => i.id !== inv.id));
    const { error } = await supabase.from("trip_invitations").delete().eq("trip_id", tripId).eq("email", inv.email);
    if (error) { setInvites(prev); toast.error(t("common.error")); }
  }

  async function leave() {
    const { error } = await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", userId);
    if (error) { toast.error(t("travelers.leaveFailed")); return; }
    toast.success(t("travelers.left", { title: tripTitle }));
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section aria-labelledby="travelers-heading">
      <SectionTitle meta={members.length} action={
        <button onClick={() => setShowPerms(s => !s)} aria-expanded={showPerms}
                className="flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink">
          <Info size={13} aria-hidden="true" /> {t("travelers.whoCanDoWhat")}
        </button>
      }>
        <span id="travelers-heading">{t("trip.travelers")}</span>
      </SectionTitle>

      {showPerms && (
        <div className="panel mb-3 overflow-x-auto animate-rise">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-ink-3">
                <th className="px-3 py-2 text-start font-normal" />
                {(["owner", "editor", "viewer"] as Role[]).map(r => (
                  <th key={r} className="px-2 py-2 text-center font-medium text-ink-2">{t(`roles.${r}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(p => (
                <tr key={p.key} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink-2">{t(`permissions.${p.key}`)}</td>
                  {(["owner", "editor", "viewer"] as const).map(r => (
                    <td key={r} className="px-2 py-2 text-center">
                      {p[r] ? <Check size={13} className="mx-auto text-positive" aria-label={t("common.yes")} />
                            : <X size={13} className="mx-auto text-ink-3/60" aria-label={t("common.no")} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-3">{t("permissions.privateNote")}</p>
        </div>
      )}

      <ul className="panel divide-y divide-line">
        {members.map(m => {
          const canManage = isOwner && m.role !== "owner";
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={34} />
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{nameOf(m)}</p>
              {canManage ? (
                <Menu.Root>
                  <Menu.Trigger aria-label={t("travelers.manage", { name: nameOf(m) })}
                                className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80">
                    <RoleBadge role={m.role} />
                    <ChevronDown size={13} className="text-ink-3" aria-hidden="true" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="end" sideOffset={4} className={MENU}>
                      <Menu.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">{t("travelers.role")}</Menu.Label>
                      {(["editor", "viewer"] as const).map(r => {
                        const Icon = ROLE_META[r].icon;
                        return (
                          <Menu.Item key={r} onSelect={() => changeRole(m, r)} className={ITEM}>
                            <Icon size={14} aria-hidden="true" />
                            <span className="flex-1">
                              <span className="block">{t(`roles.${r}`)}</span>
                              <span className="block text-[11.5px] text-ink-3">{t(`roles.${r}Hint`)}</span>
                            </span>
                            {m.role === r && <Check size={13} className="text-accent" />}
                          </Menu.Item>
                        );
                      })}
                      <Menu.Separator className="my-1 h-px bg-line" />
                      <Menu.Item onSelect={() => setRemoving(m)} className={cn(ITEM, "text-negative data-[highlighted]:bg-negative-soft")}>
                        <UserMinus size={14} /> {t("travelers.remove")}
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              ) : (
                <RoleBadge role={m.role} />
              )}
              {!isOwner && m.user_id === userId && (
                <Menu.Root>
                  <Menu.Trigger aria-label={t("common.more")} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
                    <MoreHorizontal size={15} />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="end" sideOffset={4} className={MENU}>
                      <Menu.Item onSelect={() => setLeaving(true)} className={cn(ITEM, "text-negative data-[highlighted]:bg-negative-soft")}>
                        <LogOut size={14} /> {t("travelers.leave")}
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              )}
            </li>
          );
        })}
        {invites.map(inv => (
          <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-3">
              <Clock size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink">{inv.email}</p>
              <p suppressHydrationWarning className="text-[11.5px] text-ink-3">
                {t("travelers.invitedAs", { role: t(`roles.${inv.role}`) })} · {formatRelative(inv.created_at)}
              </p>
            </div>
            {isOwner && (
              <button onClick={() => cancelInvite(inv)} aria-label={t("travelers.cancelInvite", { email: inv.email })}
                      className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-negative-soft hover:text-negative">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={invite} className="panel mt-3 space-y-2.5 px-4 py-4">
          <label htmlFor="invite-email" className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <UserPlus size={14} aria-hidden="true" /> {t("invite.title")}
          </label>
          <Input id="invite-email" type="email" inputMode="email" autoComplete="off" required value={email}
                 onChange={e => setEmail(e.target.value)} placeholder="traveler@gmail.com" />
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={inviteRole} onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
                      aria-label={t("travelers.role")}>
                <option value="editor">{t("roles.editor")} — {t("roles.editorHint")}</option>
                <option value="viewer">{t("roles.viewer")} — {t("roles.viewerHint")}</option>
              </Select>
            </div>
            <Button type="submit" loading={inviting} disabled={!email.trim()}><Mail size={15} /> {t("invite.send")}</Button>
          </div>
          <p className="text-[11.5px] text-ink-3">{t("invite.hint")}</p>
        </form>
      )}

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={async () => { if (removing) await remove(removing); }}
                     title={t("travelers.removeTitle", { name: removing ? nameOf(removing) : "" })}
                     description={t("travelers.removeDesc")} confirmLabel={t("travelers.remove")} />
      <ConfirmDialog open={leaving} onClose={() => setLeaving(false)} onConfirm={leave}
                     title={t("travelers.leaveTitle", { title: tripTitle })}
                     description={t("travelers.leaveDesc")} confirmLabel={t("travelers.leave")} />
    </section>
  );
}
