/**
 * Free, key-less geo services — no billing account needed:
 *  - Map tiles:  OpenFreeMap (OpenStreetMap data)        https://openfreemap.org
 *  - Search:     Photon by Komoot (OSM geocoder)          https://photon.komoot.io
 *  - Routing:    OSRM on FOSSGIS servers (walk/bike/car)  https://routing.openstreetmap.de
 * These are community services with fair-use policies: we debounce search, cache routes,
 * and fall back to straight-line estimates when a request fails.
 */

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Radius (metres) around each stop that counts as "arrived" when live location is on. */
export const GEOFENCE_METERS = 150;

export type TravelMode = "WALKING" | "CYCLING" | "DRIVING";
export type LatLng = { lat: number; lng: number };

/**
 * Travel between two consecutive stops.
 *  - "route":    a real road/path route from OSRM
 *  - "flight":   too far apart or no road connects them (different islands/countries) — drawn as an arc
 *  - "estimate": routing unavailable; straight-line estimate
 */
export type LegKind = "route" | "flight" | "estimate";
export type Leg = {
  fromId: string;
  toId: string;
  seconds: number;
  meters: number;
  estimated: boolean;
  kind: LegKind;
  path?: LatLng[];
};

/** Beyond this straight-line distance, walking/cycling between stops is treated as a flight. */
const FLIGHT_OVER_M: Record<string, number> = { WALKING: 60_000, CYCLING: 150_000, DRIVING: 900_000 };
/** OSRM snaps points to the nearest road it can connect; more than this and the route is bogus. */
const MAX_SNAP_M = 3_000;

/** A place returned by search / reverse lookup. `placeId` is an OSM reference like "osm:W173154847". */
export type PlaceResult = { title: string; subtitle: string | null; address: string; lat: number; lng: number; placeId: string | null };

/* ── Distance helpers ─────────────────────────────────────────────────── */

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SPEED_MPS: Record<TravelMode, number> = { WALKING: 1.35, CYCLING: 4.2, DRIVING: 8.5 };

/** Curved great-circle-ish arc for flight legs (quadratic Bézier, bulging to one side). */
export function arcPath(a: LatLng, b: LatLng, steps = 64): LatLng[] {
  let bl = b.lng;
  if (bl - a.lng > 180) bl -= 360; else if (a.lng - bl > 180) bl += 360; // take the short way across the antimeridian
  const dx = bl - a.lng, dy = b.lat - a.lat;
  const cx = a.lng + dx / 2 - dy * 0.22, cy = a.lat + dy / 2 + dx * 0.22;
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({ lng: u * u * a.lng + 2 * u * t * cx + t * t * bl, lat: u * u * a.lat + 2 * u * t * cy + t * t * b.lat });
  }
  return out;
}

/** Flight leg: ~780 km/h cruise plus ~40 min for taxi, climb and descent. */
export function flightLeg(fromId: string, toId: string, a: LatLng, b: LatLng): Leg {
  const meters = haversine(a, b);
  return { fromId, toId, meters, seconds: (meters / 1000 / 780) * 3600 + 40 * 60, estimated: true, kind: "flight", path: arcPath(a, b) };
}

/** Offline guess for a leg: a flight when far apart, otherwise a straight-line ground estimate. */
export function estimateLeg(fromId: string, toId: string, a: LatLng, b: LatLng, mode: TravelMode): Leg {
  const direct = haversine(a, b);
  if (direct > FLIGHT_OVER_M[mode]) return flightLeg(fromId, toId, a, b);
  const meters = direct * (mode === "WALKING" ? 1.25 : 1.35); // detour factor
  return { fromId, toId, meters, seconds: meters / SPEED_MPS[mode], estimated: true, kind: "estimate" };
}

/** Polygon ring approximating a circle — used for geofence and GPS-accuracy overlays. */
export function circleRing(center: LatLng, radiusM: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

export function formatDistance(m: number): string {
  return m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

export function formatTravelTime(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ── Routing (OSRM) ───────────────────────────────────────────────────── */

const OSRM_PROFILE: Record<TravelMode, string> = { WALKING: "foot", CYCLING: "bike", DRIVING: "car" };
const legCache = new Map<string, Omit<Leg, "fromId" | "toId">>();
/** Ground distance above which we don't even ask the router (no one walks 60 km between stops). */
function obviouslyFlight(a: LatLng, b: LatLng, mode: TravelMode) { return haversine(a, b) > FLIGHT_OVER_M[mode]; }

export async function routeBetween(fromId: string, toId: string, a: LatLng, b: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<Leg> {
  const key = `${a.lat},${a.lng}>${b.lat},${b.lng}:${mode}`;
  const hit = legCache.get(key);
  if (hit) return { ...hit, fromId, toId };
  if (obviouslyFlight(a, b, mode)) return flightLeg(fromId, toId, a, b);
  try {
    const p = OSRM_PROFILE[mode];
    const url = `https://routing.openstreetmap.de/routed-${p}/route/v1/${p}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const data: {
      code: string;
      waypoints?: { distance: number }[];
      routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[];
    } = await res.json();
    const r = data.routes?.[0];
    if (data.code !== "Ok" || !r) throw new Error("no route");
    // A stop snapped far away means no road connects them (e.g. different islands or countries).
    if (data.waypoints?.some(w => w.distance > MAX_SNAP_M)) {
      const leg = haversine(a, b) > 20_000 ? flightLeg(fromId, toId, a, b) : estimateLeg(fromId, toId, a, b, mode);
      legCache.set(key, leg);
      return leg;
    }
    const leg: Omit<Leg, "fromId" | "toId"> = {
      seconds: r.duration, meters: r.distance, estimated: false, kind: "route",
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    };
    legCache.set(key, leg);
    return { ...leg, fromId, toId };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return estimateLeg(fromId, toId, a, b, mode);
  }
}

/* ── Geocoding (Photon) ───────────────────────────────────────────────── */

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; housenumber?: string; street?: string; district?: string; city?: string;
    state?: string; country?: string; osm_type?: string; osm_id?: number;
  };
};

function toPlace(f: PhotonFeature): PlaceResult {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const parts = [street, p.district, p.city, p.state, p.country].filter((x, i, arr) => x && arr.indexOf(x) === i) as string[];
  const title = p.name ?? (street || p.city || "Dropped pin");
  return {
    title,
    subtitle: parts.filter(x => x !== title).slice(0, 3).join(", ") || null,
    address: [title, ...parts.filter(x => x !== title)].join(", "),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    placeId: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : null,
  };
}

/** Place search with optional location bias (e.g. the day's other stops). */
export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  if (near) { q.set("lat", String(near.lat)); q.set("lon", String(near.lng)); }
  const res = await fetch(`https://photon.komoot.io/api/?${q}`, { signal });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data: { features: PhotonFeature[] } = await res.json();
  return data.features.map(toPlace);
}

/** Nearest named place / address for a point on the map. */
export async function reverseGeocode(at: LatLng, signal?: AbortSignal): Promise<PlaceResult | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=en`, { signal });
  if (!res.ok) return null;
  const data: { features: PhotonFeature[] } = await res.json();
  return data.features[0] ? toPlace(data.features[0]) : null;
}

/* ── Google Maps deep links (plain URLs — free, no API) ───────────────── */

/** Opens the whole day in Google Maps for turn-by-turn navigation. */
export function googleMapsDirectionsUrl(points: LatLng[], mode: TravelMode): string {
  if (points.length === 0) return "https://www.google.com/maps";
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  if (points.length === 1) return `https://www.google.com/maps/search/?api=1&query=${fmt(points[0])}`;
  const travelmode = mode === "CYCLING" ? "bicycling" : mode.toLowerCase();
  const params = new URLSearchParams({ api: "1", origin: fmt(points[0]), destination: fmt(points[points.length - 1]), travelmode });
  const mid = points.slice(1, -1).slice(0, 9); // URL API allows up to 9 waypoints
  if (mid.length) params.set("waypoints", mid.map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsDirectionsTo(p: LatLng, mode: TravelMode): string {
  const travelmode = mode === "CYCLING" ? "bicycling" : mode.toLowerCase();
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${travelmode}`;
}

export function openStreetMapUrl(p: LatLng): string {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}
