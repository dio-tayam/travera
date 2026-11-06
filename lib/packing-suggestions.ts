import type { TFunction } from "i18next";
import { parseDate, tripLength } from "./utils";

/** `category` is a stable English key (stored in the DB); `label`/`why` are already translated. */
export type Suggestion = { key: string; label: string; category: string; why?: string };

/** Built-in categories. Stored in English; shown via `packing.cats.<name>`. */
export const PACKING_CATEGORIES = ["Essentials", "Clothing", "Toiletries", "Electronics", "Documents", "Health", "Other"] as const;

const BEACH = /beach|island|bora|boracay|palawan|siargao|cebu|bohol|bali|phuket|krabi|maldives|hawaii|cancun|coast|resort|elnido|el nido|coron|samui|langkawi|okinawa|guam|fiji/i;
const COLD = /japan|tokyo|osaka|kyoto|hokkaido|sapporo|korea|seoul|busan|europe|paris|london|switzerland|alps|iceland|norway|finland|canada|alaska|mongolia|baguio|sagada|new york|chicago|beijing|harbin|ski|snow/i;
const NORTHERN_COLD_MONTHS = [10, 11, 0, 1, 2]; // Nov–Mar
const ABROAD_HINT = /japan|korea|china|taiwan|hong kong|singapore|thailand|vietnam|bali|indonesia|malaysia|usa|europe|australia|dubai|india|paris|london|tokyo|seoul|bangkok|maldives|abroad|international/i;

type Raw = { key: string; category: string; why?: string; vars?: Record<string, number> };

/** Rule-based packing suggestions from destination keywords, season and trip length — runs offline, free. */
export function suggestPacking(opts: { destination?: string | null; start?: string | null; end?: string | null }, t: TFunction): Suggestion[] {
  const dest = opts.destination ?? "";
  const days = tripLength(opts.start, opts.end) ?? 4;
  const month = opts.start ? parseDate(opts.start).getMonth() : new Date().getMonth();
  const out: Raw[] = [
    { key: "id", category: "Documents" },
    { key: "bookings", category: "Documents" },
    { key: "cash", category: "Documents" },
    { key: "charger", category: "Electronics" },
    { key: "powerBank", category: "Electronics" },
    { key: "earphones", category: "Electronics" },
    { key: "toothbrush", category: "Toiletries" },
    { key: "deodorant", category: "Toiletries" },
    { key: "medicines", category: "Health" },
    { key: "sanitizer", category: "Health" },
    { key: "shirts", category: "Clothing", why: "tripDays", vars: { count: Math.min(days, 7) } },
    { key: "underwear", category: "Clothing", why: "tripDays", vars: { count: Math.min(days + 1, 8) } },
    { key: "shoes", category: "Clothing" },
    { key: "bottle", category: "Essentials" },
  ];

  if (ABROAD_HINT.test(dest)) {
    out.push(
      { key: "passport", category: "Documents", why: "international" },
      { key: "visa", category: "Documents", why: "international" },
      { key: "insurance", category: "Documents", why: "international" },
      { key: "adapter", category: "Electronics", why: "international" },
    );
  }
  if (BEACH.test(dest)) {
    out.push(
      { key: "swimwear", category: "Clothing", why: "beach" },
      { key: "sunscreen", category: "Toiletries", why: "beach" },
      { key: "sunglasses", category: "Essentials", why: "beach" },
      { key: "flipflops", category: "Clothing", why: "beach" },
      { key: "dryBag", category: "Essentials", why: "beach" },
      { key: "repellent", category: "Health", why: "beach" },
    );
  }
  if (COLD.test(dest) && NORTHERN_COLD_MONTHS.includes(month)) {
    out.push(
      { key: "warmJacket", category: "Clothing", why: "cold" },
      { key: "thermals", category: "Clothing", why: "cold" },
      { key: "gloves", category: "Clothing", why: "cold" },
      { key: "lipBalm", category: "Toiletries", why: "cold" },
    );
  } else if (COLD.test(dest)) {
    out.push({ key: "lightJacket", category: "Clothing", why: "coolEvenings" });
  }
  if ([5, 6, 7, 8, 9].includes(month) && !COLD.test(dest)) {
    out.push({ key: "umbrella", category: "Essentials", why: "rainy" });
  }
  if (days >= 5) out.push({ key: "laundryBag", category: "Essentials", why: "tripDays" });
  if (days >= 7) out.push({ key: "detergent", category: "Toiletries", why: "weekLong" });
  out.push({ key: "pillow", category: "Essentials" }, { key: "snacks", category: "Essentials" });

  const seen = new Set<string>();
  return out
    .filter(s => { if (seen.has(s.key)) return false; seen.add(s.key); return true; })
    .map(s => ({
      key: s.key,
      label: t(`suggest.items.${s.key}`, s.vars),
      category: s.category,
      why: s.why ? t(`suggest.why.${s.why}`, { days }) : undefined,
    }));
}
