/**
 * Canonical public origin, used for sitemap, robots, canonical URLs and Open Graph.
 * Set NEXT_PUBLIC_SITE_URL in Netlify (e.g. https://travera.app). Falls back to Netlify's
 * own URL env, then localhost for development.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Travera";
export const SITE_TITLE = "Travera — Plan trips together";
export const SITE_DESCRIPTION =
  "Free collaborative trip planner: build a day-by-day itinerary on a live map, split group expenses, share packing lists and keep travel documents in one place.";
export const SITE_KEYWORDS = [
  "trip planner", "travel planner", "group trip planner", "itinerary planner", "collaborative travel planning",
  "split travel expenses", "travel budget tracker", "packing list app", "travel documents", "road trip planner",
  "free trip planner", "vacation planner",
];
