import { Crown, Eye, PenLine, type LucideIcon } from "lucide-react";
import type { Role } from "@/types/database";

export const ROLE_META: Record<Role, { icon: LucideIcon; tone: "accent" | "neutral" | "outline" }> = {
  owner:  { icon: Crown,   tone: "accent" },
  editor: { icon: PenLine, tone: "neutral" },
  viewer: { icon: Eye,     tone: "outline" },
};

/** Permission matrix shown in the travelers panel; mirrors the RLS policies in supabase/v2-roles-privacy-admin.sql. */
export const PERMISSIONS: { key: string; owner: boolean; editor: boolean; viewer: boolean }[] = [
  { key: "viewGroup",     owner: true,  editor: true,  viewer: true  },
  { key: "personal",      owner: true,  editor: true,  viewer: true  },
  { key: "tickAssigned",  owner: true,  editor: true,  viewer: true  },
  { key: "editGroup",     owner: true,  editor: true,  viewer: false },
  { key: "assignPacking", owner: true,  editor: true,  viewer: false },
  { key: "manageTrip",    owner: true,  editor: false, viewer: false },
  { key: "manageMembers", owner: true,  editor: false, viewer: false },
];
