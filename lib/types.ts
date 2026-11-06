import type { ProfileRow, Role } from "@/types/database";

/** A trip member joined with their profile (from `trip_members.select("…, profiles(*)")`). */
export type Member = { id?: string; user_id: string; role: Role; profiles: ProfileRow | null };
