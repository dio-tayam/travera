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
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key

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
- `itinerary_days` + `stops` — Day-by-day planning with Google Places data on stops
- `expenses` + `expense_splits` — Budget tracking and cost splitting
- `packing_items` — Packing lists (with AI suggestions via Supabase Edge Function at `supabase/functions/suggest-packing-items/`)
- `documents` — File storage for travel docs

SQL schema files are in `supabase/`: `schema.sql`, `setup-storage.sql`, `fix-rls.sql`.

### Styling

Tailwind CSS v4 with custom design tokens defined as CSS variables in `app/globals.css`. Key tokens:
- `--color-primary: #2563eb` (blue), `--color-accent: #f59e0b` (amber)
- Section colors: itinerary (indigo), budget (amber), packing (emerald), documents (purple)
- Fonts: Plus Jakarta Sans (headings), DM Sans (body)
- Custom utilities: `.sky-gradient`, `.glass`, `.card`, `.card-hover`, `.nav-active-*`

Use `cn()` from `lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for conditional class merging.

### i18n

10 languages supported (EN, JA, KO, DE, NL, FR, ES, ZH, PT, AR) via i18next. Translation files live in `locales/[lang]/common.json`. Use the `useTranslation("common")` hook in client components. `lib/i18n.ts` configures language detection (browser → localStorage). The `I18nProvider` component wraps the `(app)` layout.

### Key Libraries

- **UI primitives**: Radix UI components in `components/ui/`
- **Maps**: `@react-google-maps/api` + `use-places-autocomplete` for stop search
- **Drag & drop**: `@dnd-kit` for reordering itinerary stops
- **Notifications**: `sonner` toast library
- **Dates**: `date-fns`

### Deployment

Deployed to Netlify (`netlify.toml`): build command `npm run build`, publish directory `.next`, Node 20, `@netlify/plugin-nextjs`.
