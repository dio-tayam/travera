import { parseDate, tripLength } from "./utils";

export type Suggestion = { label: string; category: string; why?: string };

const BEACH = /beach|island|bora|boracay|palawan|siargao|cebu|bohol|bali|phuket|krabi|maldives|hawaii|cancun|coast|resort|elnido|el nido|coron|samui|langkawi|okinawa|guam|fiji/i;
const COLD = /japan|tokyo|osaka|kyoto|hokkaido|sapporo|korea|seoul|busan|europe|paris|london|switzerland|alps|iceland|norway|finland|canada|alaska|mongolia|baguio|sagada|new york|chicago|beijing|harbin|ski|snow/i;
const NORTHERN_COLD_MONTHS = [10, 11, 0, 1, 2]; // Nov–Mar
const ABROAD_HINT = /japan|korea|china|taiwan|hong kong|singapore|thailand|vietnam|bali|indonesia|malaysia|usa|europe|australia|dubai|india|paris|london|tokyo|seoul|bangkok|maldives|abroad|international/i;

/** Rule-based packing suggestions from destination keywords, season and trip length — runs offline, free. */
export function suggestPacking(opts: { destination?: string | null; start?: string | null; end?: string | null }): Suggestion[] {
  const dest = opts.destination ?? "";
  const days = tripLength(opts.start, opts.end) ?? 4;
  const month = opts.start ? parseDate(opts.start).getMonth() : new Date().getMonth();
  const tops = Math.min(days, 7);
  const out: Suggestion[] = [
    { label: "ID / driver's license", category: "Documents" },
    { label: "Booking confirmations", category: "Documents" },
    { label: "Cash & cards", category: "Documents" },
    { label: "Phone charger", category: "Electronics" },
    { label: "Power bank", category: "Electronics" },
    { label: "Earphones", category: "Electronics" },
    { label: "Toothbrush & toothpaste", category: "Toiletries" },
    { label: "Deodorant", category: "Toiletries" },
    { label: "Medicines & first aid", category: "Health" },
    { label: "Hand sanitizer", category: "Health" },
    { label: `Shirts ×${tops}`, category: "Clothing", why: `${days}-day trip` },
    { label: `Underwear ×${Math.min(days + 1, 8)}`, category: "Clothing", why: `${days}-day trip` },
    { label: "Comfortable walking shoes", category: "Clothing" },
    { label: "Reusable water bottle", category: "Essentials" },
  ];

  if (ABROAD_HINT.test(dest)) {
    out.push(
      { label: "Passport", category: "Documents", why: "International trip" },
      { label: "Visa / e-visa", category: "Documents", why: "International trip" },
      { label: "Travel insurance", category: "Documents", why: "International trip" },
      { label: "Universal adapter", category: "Electronics", why: "International trip" },
    );
  }
  if (BEACH.test(dest)) {
    out.push(
      { label: "Swimwear", category: "Clothing", why: "Beach destination" },
      { label: "Sunscreen SPF 50+", category: "Toiletries", why: "Beach destination" },
      { label: "Sunglasses", category: "Essentials", why: "Beach destination" },
      { label: "Flip-flops", category: "Clothing", why: "Beach destination" },
      { label: "Dry bag", category: "Essentials", why: "Beach destination" },
      { label: "Insect repellent", category: "Health", why: "Beach destination" },
    );
  }
  if (COLD.test(dest) && NORTHERN_COLD_MONTHS.includes(month)) {
    out.push(
      { label: "Warm jacket", category: "Clothing", why: "Cold season" },
      { label: "Thermal innerwear", category: "Clothing", why: "Cold season" },
      { label: "Gloves & beanie", category: "Clothing", why: "Cold season" },
      { label: "Lip balm & moisturizer", category: "Toiletries", why: "Cold season" },
    );
  } else if (COLD.test(dest)) {
    out.push({ label: "Light jacket", category: "Clothing", why: "Cool evenings" });
  }
  if ([5, 6, 7, 8, 9].includes(month) && !COLD.test(dest)) {
    out.push({ label: "Umbrella / rain jacket", category: "Essentials", why: "Rainy season" });
  }
  if (days >= 5) out.push({ label: "Laundry bag", category: "Essentials", why: `${days}-day trip` });
  if (days >= 7) out.push({ label: "Travel-size detergent", category: "Toiletries", why: "Week-long trip" });
  out.push({ label: "Travel pillow", category: "Essentials" }, { label: "Snacks for the road", category: "Essentials" });

  const seen = new Set<string>();
  return out.filter(s => { const k = s.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
