"use client";

import { useState, useTransition } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { Ban, MoreHorizontal, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { AdminUserRow } from "@/types/database";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { setAdminAccess, setSuspended } from "../actions";

const ITEM = "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40";

export function UsersTable({ rows, me }: { rows: AdminUserRow[]; me: string }) {
  const [pending, start] = useTransition();
  const [suspending, setSuspending] = useState<AdminUserRow | null>(null);
  const [reason, setReason] = useState("");

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(ok); else toast.error(r.error ?? "Something went wrong");
    });
  }

  if (!rows.length) return <p className="panel mt-4 px-5 py-10 text-center text-[13px] text-ink-3">No users match.</p>;

  return (
    <>
      <div className={cn("panel mt-4 overflow-x-auto", pending && "opacity-70")}>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Joined</th>
              <th className="px-3 py-2.5 font-medium">Last seen</th>
              <th className="px-3 py-2.5 text-right font-medium">Trips</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(u => (
              <tr key={u.id} className={cn(u.is_suspended && "bg-negative-soft/40")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.display_name ?? u.email} src={u.avatar_url} size={30} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{u.display_name ?? "—"}{u.id === me && <span className="text-ink-3"> (you)</span>}</p>
                      <p className="truncate font-mono text-[11.5px] text-ink-3">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-2">{formatDate(u.created_at)}</td>
                <td className="px-3 py-3 text-ink-2">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : "Never"}</td>
                <td className="px-3 py-3 text-right font-mono text-ink tabular">{u.trip_count}<span className="text-ink-3"> / {u.owned_count} owned</span></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.is_admin && <Badge tone="accent"><ShieldCheck size={11} /> Admin</Badge>}
                    {u.is_suspended
                      ? <Badge tone="negative" className="max-w-[200px] truncate" ><Ban size={11} /> Suspended{u.suspension_reason ? ` · ${u.suspension_reason}` : ""}</Badge>
                      : !u.is_admin && <Badge tone="positive">Active</Badge>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Menu.Root>
                    <Menu.Trigger aria-label={`Actions for ${u.email}`} className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
                      <MoreHorizontal size={16} />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Content align="end" sideOffset={4} className="z-50 min-w-[200px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)]">
                        {u.is_admin ? (
                          <Menu.Item disabled={u.id === me} className={ITEM} onSelect={() => act(() => setAdminAccess(u.id, false), "Admin access removed")}>
                            <ShieldOff size={14} /> Remove admin
                          </Menu.Item>
                        ) : (
                          <Menu.Item disabled={u.is_suspended} className={ITEM} onSelect={() => act(() => setAdminAccess(u.id, true), "Admin access granted")}>
                            <ShieldCheck size={14} /> Make admin
                          </Menu.Item>
                        )}
                        {u.is_suspended ? (
                          <Menu.Item className={ITEM} onSelect={() => act(() => setSuspended(u.id, false), "Suspension lifted")}>
                            <Undo2 size={14} /> Lift suspension
                          </Menu.Item>
                        ) : (
                          <Menu.Item disabled={u.id === me || u.is_admin} className={cn(ITEM, "text-negative data-[highlighted]:bg-negative-soft")}
                                     onSelect={() => { setReason(""); setSuspending(u); }}>
                            <Ban size={14} /> Suspend…
                          </Menu.Item>
                        )}
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!suspending} onOpenChange={o => { if (!o) setSuspending(null); }} title="Suspend user"
             description={suspending ? `${suspending.email} will lose access to every trip until the suspension is lifted. Their data is kept.` : undefined}>
        <form onSubmit={e => {
          e.preventDefault();
          const u = suspending!;
          setSuspending(null);
          act(() => setSuspended(u.id, true, reason.trim()), "User suspended");
        }}>
          <label className="block text-[13px] font-medium text-ink">Reason <span className="font-normal text-ink-3">(shown to admins only)</span>
            <Textarea className="mt-2" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Spam share links" />
          </label>
          <ModalActions>
            <Button type="button" variant="ghost" onClick={() => setSuspending(null)}>Cancel</Button>
            <Button type="submit" className="bg-negative hover:bg-negative/90">Suspend</Button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}
