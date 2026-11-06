import {
  BedDouble, Ticket, UtensilsCrossed, TramFront, Plane, Coffee,
  Car, ShoppingBag, Receipt, Globe2, FileText,
  type LucideIcon,
} from "lucide-react";

export type CategoryMeta = { icon: LucideIcon; color: string };

/** Muted category hues — mirrors the --color-cat-* tokens in globals.css. */
export const CAT = {
  blue:  "#3d5a99",
  teal:  "#2b7a78",
  berry: "#a8456b",
  sage:  "#5f8a4a",
  ochre: "#b9822a",
  slate: "#6b7280",
  accent: "#d4552b",
} as const;

export const STOP_TYPES = ["activity", "restaurant", "hotel", "transit", "flight", "free"] as const;

export const STOP_META: Record<string, CategoryMeta> = {
  hotel:      { icon: BedDouble,       color: CAT.blue   },
  activity:   { icon: Ticket,          color: CAT.accent },
  restaurant: { icon: UtensilsCrossed, color: CAT.berry  },
  transit:    { icon: TramFront,       color: CAT.slate  },
  flight:     { icon: Plane,           color: CAT.teal   },
  free:       { icon: Coffee,          color: CAT.sage   },
};

export const EXPENSE_CATEGORIES = ["food", "accommodation", "transport", "activity", "shopping", "other"] as const;

/**
 * Expense hues double as the spending chart's stacked-series palette, in this fixed order.
 * Validated with the dataviz palette checker on #ffffff (lightness, chroma, adjacent CVD ΔE ≥ 8 protan,
 * normal-vision ΔE ≥ 15, contrast ≥ 3:1). The tritan pair transport↔activity is in the warn band, so
 * charts always add secondary encoding (2px gaps, legend, tooltip, table view). Change only by re-validating.
 */
export const EXPENSE_META: Record<string, CategoryMeta> = {
  food:          { icon: UtensilsCrossed, color: "#d4552b" },
  accommodation: { icon: BedDouble,       color: "#2a6fc9" },
  transport:     { icon: Car,             color: "#139a6c" },
  activity:      { icon: Ticket,          color: "#c98500" },
  shopping:      { icon: ShoppingBag,     color: "#d66b94" },
  other:         { icon: Receipt,         color: "#5b4fc9" },
};

export const DOC_TYPES = ["flight", "hotel", "visa", "other"] as const;

export const DOC_META: Record<string, CategoryMeta> = {
  flight: { icon: Plane,     color: CAT.teal  },
  hotel:  { icon: BedDouble, color: CAT.blue  },
  visa:   { icon: Globe2,    color: CAT.berry },
  other:  { icon: FileText,  color: CAT.slate },
};

export const CURRENCIES = ["PHP", "USD", "EUR", "JPY", "KRW", "GBP", "AUD", "SGD", "THB", "CNY", "HKD", "TWD", "VND", "IDR", "MYR", "CAD", "CHF", "AED", "BRL", "MXN"] as const;
