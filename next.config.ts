import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Supabase project origin (REST, auth, storage) and its realtime websocket. */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const supabaseHost = (() => {
  try { return new URL(supabaseUrl).host; } catch { return "*.supabase.co"; }
})();

/** Free map services used from the browser (see lib/maps.ts). */
const MAP_ORIGINS = [
  "https://tiles.openfreemap.org",      // vector tiles, styles, fonts, sprites
  "https://photon.komoot.io",           // place search / reverse lookup
  "https://routing.openstreetmap.de",   // OSRM routing
];

const csp = [
  "default-src 'self'",
  // Next.js inlines small bootstrap scripts; dev mode additionally needs eval for fast refresh.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Avatars (Google), trip covers (any https), signed Supabase images, local upload previews.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} ${MAP_ORIGINS.join(" ")}${isDev ? " ws: http://localhost:*" : ""}`,
  // MapLibre renders tiles in blob: web workers.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // In-app PDF preview loads signed Supabase Storage URLs in an iframe.
  `frame-src 'self' https://${supabaseHost} blob:`,
  `media-src 'self' blob: https://${supabaseHost}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Live location on the itinerary map needs geolocation for our own origin only.
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
