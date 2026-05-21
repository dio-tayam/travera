import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  // We pass Database as the generic so IDE autocomplete works for table names,
  // but cast the return type so row-level types use our explicit Row aliases.
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any as ReturnType<typeof createBrowserClient>;
}
