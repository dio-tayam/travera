# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key

## Architecture

**Travera** is a collaborative travel planning app built with Next.js 16 (App Router), Supabase, and TypeScript.

### Route Structure

Uses the App Router with two route groups:

- `app/(auth)/login/` — Public login page (Google OAuth)
- `app/(app)/` — Protected routes with auth guard in layout
  - `dashboard/` — Trip list (server component fetches trips, passes to client)
  - `trips/[id]/` — Trip detail with sub-routes: `itinerary/`, `budget/`, `packing/`, `documents/`
- `app/auth/callback/route.ts` — OAuth code exchange handler
- `app/share/[shareToken]/` — Public trip share view (no auth required)

### Server vs. Client Components

Pages at `page.tsx` are Server Components that fetch data from Supabase and pass it to `*-client.tsx` Client Components. The split is intentional — server components handle data fetching, client components handle interactivity.

### Supabase Clients

Two separate clients exist — use the right one for the context:
- `lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions (cookie-based session)
- `lib/supabase/client.ts` — Client Components (browser session)

Auth middleware in `lib/supabase/middleware.ts` protects `/dashboard` and `/trips/*/` routes; it's invoked via `proxy.ts` (the Next.js middleware file).

### Database Schema

All types are in `types/database.ts`. Key tables:
- `profiles` — User display name, avatar, currency preference
- `trips` + `trip_members` — Trip data with owner/editor/viewer roles
- `itinerary_days` + `stops` — Day-by-day planning with place data (OpenStreetMap) on stops
- `expenses` + `expense_splits` — Budget tracking and cost splitting
- `packing_items` — Packing lists (rule-based suggestions in `lib/packing-suggestions.ts`)
- `documents` — File storage for travel docs

SQL schema files are in `supabase/`: `schema.sql`, `setup-storage.sql`, `fix-rls.sql`.

### Styling

Tailwind CSS v4 with design tokens in the `@theme` block of `app/globals.css` — every colour should come from there. The look is "modern travel / boarding pass": warm paper + ink neutrals, one signal-orange accent, no gradients.
- Neutrals: `paper` (bg), `surface` (panels), `sunken`, `line`, `line-strong`, `ink`, `ink-2`, `ink-3` → e.g. `bg-paper text-ink-2 border-line`
- Accent: `accent` / `accent-ink` / `accent-soft` — use sparingly (active nav, highlights, map destination)
- Status: `positive`, `negative`, `warning` (+ `-soft`). Category hues for stops/expenses/docs live in `lib/categories.ts` (icon + colour per type; no emoji)
- Fonts: Bricolage Grotesque (`.display` headings — emphasis via `<em>` is a colour shift, not italics), Onest (UI), JetBrains Mono (`.eyebrow` labels, figures). Logo: compass-rose mark (orange north point; `.logo-rose` group animates) in `components/ui/logo.tsx` (mirrored in `public/favicon.svg`). Background graphic: `<Contours />` topographic lines (`components/ui/contours.tsx`)
- Utilities: `.panel` (the one card style), `.panel-interactive`, `.eyebrow`, `.display`, `.perforation` (ticket divider), `.grid-texture`, `.skeleton`

UI primitives live in `components/ui/`: `Button` (cva variants, `asChild`), `Input`/`Select`/`Textarea`/`Field`, `Modal` (Radix dialog; bottom sheet on mobile), and `primitives.tsx` (`PageHeader`, `PageBody`, `SectionTitle`, `EmptyState`, `Progress`, `Avatar`, `Badge`, `Figure`). Build pages from these rather than ad-hoc classes.

Server pages load data with `requireTrip()` (`lib/trip-access.ts`) + `Promise.all`; `getUser()` in `lib/supabase/server.ts` is request-cached. The map bundle (MapLibre) is code-split via `LazyTripMap` and only mounted where visible.

Use `cn()` from `lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for conditional class merging.

### i18n

10 languages supported (EN, JA, KO, DE, NL, FR, ES, ZH, PT, AR) via i18next. Translation files live in `locales/[lang]/common.json`. Use the `useTranslation("common")` hook in client components. `lib/i18n.ts` configures language detection (browser → localStorage). The `I18nProvider` component wraps the `(app)` layout.

### Key Libraries

- **UI primitives**: Radix UI components in `components/ui/`
- **Maps** (all free, no API key or billing): MapLibre GL renders OpenFreeMap tiles; Photon (OSM) powers place search and reverse lookup; OSRM on routing.openstreetmap.de gives walk/bike/drive routes. All service calls live in `lib/maps.ts`. `components/shared/trip-map.tsx` handles pin↔list selection, per-leg routes (cached; straight-line estimate fallback), click-to-add places, and live location with geofences (`GEOFENCE_METERS`). "Directions" buttons are plain Google Maps URLs (no API). These are community services with fair-use limits — keep search debounced and routes cached.
- **Drag & drop**: `@dnd-kit` for reordering itinerary stops
- **Notifications**: `sonner` toast library
- **Dates**: `date-fns`

### Security headers

Set for every route in `next.config.ts` (`headers()`): Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and COOP. The CSP allow-lists the Supabase project host plus the free map services (`tiles.openfreemap.org`, `photon.komoot.io`, `routing.openstreetmap.de`). **If you add a new browser-side API, image host or iframe source, add it to the CSP** or the browser will block it (look for "Refused to connect" in the console). Geolocation is allowed for our own origin only (live location on the map).

### Deployment

Deployed to Netlify (`netlify.toml`): build command `npm run build`, publish directory `.next`, Node 20, `@netlify/plugin-nextjs`.
