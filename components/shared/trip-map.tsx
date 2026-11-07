"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Bike, Car, Clock, ExternalLink, Footprints, Loader2, LocateFixed, MapPin, MapPinOff, MapPinned, Maximize2, Navigation, Plus, Search, X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Database } from "@/types/database";
import { STOP_META } from "@/lib/categories";
import { cn, getStopTypeColor } from "@/lib/utils";
import {
  GEOFENCE_METERS, MAP_STYLE_URL, circleRing, formatDistance, formatTravelTime, googleMapsDirectionsTo,
  googleMapsDirectionsUrl, haversine, openStreetMapUrl, reverseGeocode, routeBetween, searchPlaces,
  type LatLng, type Leg, type PlaceResult, type TravelMode,
} from "@/lib/maps";
import { MapPlaceholder } from "./map-placeholder";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

/** A place picked on the map, ready to become a stop. */
export type PlaceDraft = { title: string; address: string | null; lat: number; lng: number; placeId: string | null; placeholder?: boolean };

interface TripMapProps {
  /** The day's stops in order. Stops without coordinates keep their number but get no pin. */
  stops: Stop[];
  /** Controlled selection (pin ↔ list sync). Omit for internal selection. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Receives travel legs keyed by the leg's starting stop id. */
  onLegs?: (legs: Record<string, Leg>) => void;
  /** Enables click-to-add: clicking the map offers to add that place as a stop. */
  onAddPlace?: (place: PlaceDraft) => void;
}

const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995]; // Manila (lng, lat)
const MODES: { mode: TravelMode; icon: typeof Car; key: string }[] = [
  { mode: "WALKING", icon: Footprints, key: "walk" },
  { mode: "CYCLING", icon: Bike, key: "bike" },
  { mode: "DRIVING", icon: Car, key: "drive" },
];
const MODE_KEY = "travera:travel-mode";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function pinHtml(n: number, color: string) {
  return `<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true">
    <path d="M15 1C7.3 1 1 7.2 1 14.8 1 24 15 37 15 37s14-13 14-22.2C29 7.2 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle class="pin-ring" cx="15" cy="14.8" r="12.5" fill="none" stroke="#16181d" stroke-width="2"/>
    <text x="15" y="15.5" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace,monospace" font-size="11" font-weight="700" fill="#fff">${n}</text>
  </svg>`;
}

export function TripMap({ stops, selectedId, onSelect, onLegs, onAddPlace }: TripMapProps) {
  const { t } = useTranslation("common");
  const tRef = useRef(t);
  tRef.current = t;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [, setFrame] = useState(0); // re-render overlays when the camera moves

  // selection: controlled when the parent passes selectedId, internal otherwise
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : ownSelected;
  const selectRef = useRef<(id: string | null) => void>(() => {});
  const select = useCallback((id: string | null) => { onSelect ? onSelect(id) : setOwnSelected(id); }, [onSelect]);
  selectRef.current = select;

  const [mode, setMode] = useState<TravelMode>("WALKING");
  const [legs, setLegs] = useState<Record<string, Leg>>({});
  const [pending, setPending] = useState<PlaceDraft | null>(null);
  const [tracking, setTracking] = useState(false);
  const [me, setMe] = useState<{ pos: LatLng; accuracy: number } | null>(null);
  const [notice, setNotice] = useState<{ tone: "positive" | "negative"; text: string } | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
  const [activePlace, setActivePlace] = useState(-1);
  const arrivedAt = useRef(new Set<string>());
  const centeredOnMe = useRef(false);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const meMarker = useRef<Marker | null>(null);
  const pendingMarker = useRef<Marker | null>(null);
  const planeMarkers = useRef(new Map<string, Marker>());
  const onLegsRef = useRef(onLegs);
  onLegsRef.current = onLegs;
  const onAddRef = useRef(onAddPlace);
  onAddRef.current = onAddPlace;

  useEffect(() => {
    try { const m = localStorage.getItem(MODE_KEY) as TravelMode | null; if (m && MODES.some(x => x.mode === m)) setMode(m); } catch { /* ignore */ }
  }, []);
  function changeMode(m: TravelMode) {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(id);
  }, [notice]);

  // Keep each stop's number from the full day list, even when some stops have no location.
  const located = useMemo(
    () => stops.map((s, i) => ({ stop: s, n: i + 1 })).filter(({ stop }) => stop.lat != null && stop.lng != null),
    [stops]
  );
  const routeKey = located.map(({ stop }) => `${stop.id}@${stop.lat},${stop.lng}`).join("|");
  const searchNear = located.length
    ? { lat: located.reduce((sum, x) => sum + x.stop.lat!, 0) / located.length,
        lng: located.reduce((sum, x) => sum + x.stop.lng!, 0) / located.length }
    : null;

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 3) { setPlaceResults([]); setSearchingPlaces(false); setHasSearchedPlaces(false); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchingPlaces(true);
      searchPlaces(query, searchNear, controller.signal)
        .then(results => { setPlaceResults(results); setActivePlace(-1); setHasSearchedPlaces(true); })
        .catch(() => { if (!controller.signal.aborted) { setPlaceResults([]); setHasSearchedPlaces(true); } })
        .finally(() => { if (!controller.signal.aborted) setSearchingPlaces(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [placeQuery, searchNear?.lat, searchNear?.lng]);

  function selectPlace(place: PlaceResult) {
    setPlaceResults([]);
    setHasSearchedPlaces(false);
    setPending({ title: place.title, address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId });
    select(null);
    map?.flyTo({ center: [place.lng, place.lat], zoom: 15, duration: 700 });
  }

  function handlePlaceSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && placeResults.length) {
      e.preventDefault(); setActivePlace(index => (index + 1) % placeResults.length);
    } else if (e.key === "ArrowUp" && placeResults.length) {
      e.preventDefault(); setActivePlace(index => index <= 0 ? placeResults.length - 1 : index - 1);
    } else if (e.key === "Enter" && activePlace >= 0) {
      e.preventDefault(); selectPlace(placeResults[activePlace]);
    } else if (e.key === "Escape") {
      setPlaceResults([]);
    }
  }

  /* ── Create the map ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    let m: MLMap;
    try {
      m = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: 11,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      // No WebGL (very old device, or hardware acceleration disabled) — show a fallback instead of crashing.
      setFailed(true);
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    let raf = 0;
    const rerender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setFrame(f => f + 1)); };
    m.on("move", rerender);
    m.on("error", e => { if (!m.isStyleLoaded() && String(e.error?.message ?? "").match(/style|fetch/i)) setFailed(true); });

    m.on("load", () => {
      m.addSource("fences", { type: "geojson", data: EMPTY_FC });
      m.addSource("accuracy", { type: "geojson", data: EMPTY_FC });
      m.addSource("route", { type: "geojson", data: EMPTY_FC });
      m.addLayer({ id: "fences-fill", type: "fill", source: "fences", paint: { "fill-color": "#d4552b", "fill-opacity": 0.07 } });
      m.addLayer({ id: "fences-line", type: "line", source: "fences", paint: { "line-color": "#d4552b", "line-opacity": 0.4, "line-width": 1 } });
      m.addLayer({ id: "accuracy-fill", type: "fill", source: "accuracy", paint: { "fill-color": "#2f6fed", "fill-opacity": 0.12 } });
      m.addLayer({
        id: "route-casing", type: "line", source: "route", filter: ["==", ["get", "style"], "solid"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "route-solid", type: "line", source: "route", filter: ["==", ["get", "style"], "solid"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4 },
      });
      m.addLayer({
        id: "route-flight", type: "line", source: "route", filter: ["==", ["get", "style"], "flight"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#d4552b", "line-width": 2.5, "line-dasharray": [2, 2] },
      });
      m.addLayer({
        id: "route-dotted", type: "line", source: "route", filter: ["==", ["get", "style"], "dotted"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#16181d", "line-width": 4, "line-opacity": ["get", "opacity"], "line-dasharray": [0, 2] },
      });
      setMap(m);
    });

    m.on("click", e => {
      selectRef.current(null);
      if (!onAddRef.current) { setPending(null); return; }
      const at = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPending({ title: tRef.current("map.droppedPin"), address: null, ...at, placeId: null, placeholder: true });
      reverseGeocode(at).then(p => {
        if (!p) return;
        setPending(cur => cur && cur.lat === at.lat && cur.lng === at.lng
          ? { ...cur, title: p.title, address: p.address, placeId: p.placeId, placeholder: false } : cur);
      }).catch(() => { /* keep the dropped pin */ });
    });

    return () => { cancelAnimationFrame(raf); m.remove(); setMap(null); };
  }, []);

  useEffect(() => { map?.getCanvas().style.setProperty("cursor", onAddPlace ? "crosshair" : ""); }, [map, onAddPlace]);

  /* ── Stop pins (DOM markers) ────────────────────────────────────────── */
  useEffect(() => {
    if (!map) return;
    const live = new Set<string>();
    located.forEach(({ stop, n }) => {
      live.add(stop.id);
      const color = getStopTypeColor(stop.type);
      let entry = markers.current.get(stop.id);
      if (!entry) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "trip-pin";
        el.addEventListener("click", ev => { ev.stopPropagation(); setPending(null); selectRef.current(el.dataset.selected === "1" ? null : stop.id); });
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([stop.lng!, stop.lat!]).addTo(map);
        entry = { marker, el };
        markers.current.set(stop.id, entry);
      }
      entry.marker.setLngLat([stop.lng!, stop.lat!]);
      entry.el.innerHTML = `<span class="trip-pin-inner">${pinHtml(n, color)}</span>`;
      entry.el.setAttribute("aria-label", `${t("itinerary.stopN", { n })}: ${stop.title}`);
      entry.el.title = stop.title;
      entry.el.dataset.selected = stop.id === selected ? "1" : "0";
      entry.el.style.zIndex = stop.id === selected ? "10" : String(n);
    });
    markers.current.forEach((v, id) => { if (!live.has(id)) { v.marker.remove(); markers.current.delete(id); } });
  }, [map, located, selected, t]);

  useEffect(() => () => {
    markers.current.forEach(v => v.marker.remove()); markers.current.clear();
    planeMarkers.current.forEach(mk => mk.remove()); planeMarkers.current.clear();
  }, []);

  /* ── Fit everything in view ─────────────────────────────────────────── */
  const fitAll = useCallback(() => {
    if (!map) return;
    const pts: LatLng[] = located.map(({ stop }) => ({ lat: stop.lat!, lng: stop.lng! }));
    if (me) pts.push(me.pos);
    if (pts.length === 0) return;
    if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, duration: 600 }); return; }
    const b = new maplibregl.LngLatBounds();
    pts.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: { top: 80, right: 60, bottom: 84, left: 60 }, maxZoom: 16, duration: 700 });
  }, [map, located, me]);

  useEffect(() => { fitAll(); }, [map, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !selected) return;
    const hit = located.find(l => l.stop.id === selected);
    if (hit) map.easeTo({ center: [hit.stop.lng!, hit.stop.lat!], duration: 500 });
  }, [map, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Routes between consecutive stops (OSRM) ────────────────────────── */
  useEffect(() => {
    if (located.length < 2) { setLegs({}); onLegsRef.current?.({}); return; }
    const ctrl = new AbortController();
    Promise.all(located.slice(1).map((b, i) => {
      const a = located[i].stop;
      return routeBetween(a.id, b.stop.id, { lat: a.lat!, lng: a.lng! }, { lat: b.stop.lat!, lng: b.stop.lng! }, mode, ctrl.signal);
    })).then(list => {
      const rec = Object.fromEntries(list.map(l => [l.fromId, l]));
      setLegs(rec);
      onLegsRef.current?.(rec);
    }).catch(() => { /* aborted */ });
    return () => ctrl.abort();
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const src = map?.getSource("route") as GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = located.slice(1).map((b, i) => {
      const a = located[i].stop;
      const leg = legs[a.id];
      const coords = (leg?.path ?? [{ lat: a.lat!, lng: a.lng! }, { lat: b.stop.lat!, lng: b.stop.lng! }]).map(p => [p.lng, p.lat]);
      const style = leg?.kind === "flight" ? "flight" : !leg || leg.estimated || mode === "WALKING" ? "dotted" : "solid";
      return {
        type: "Feature", geometry: { type: "LineString", coordinates: coords },
        properties: { style, opacity: leg?.estimated || !leg ? 0.45 : 0.9, color: mode === "CYCLING" ? "#2b7a78" : "#16181d" },
      };
    });
    src.setData({ type: "FeatureCollection", features });

    // Plane icons at the middle of each flight arc, pointing toward the destination.
    const live = new Set<string>();
    Object.values(legs).forEach(leg => {
      if (leg.kind !== "flight" || !leg.path || leg.path.length < 3) return;
      live.add(leg.fromId);
      const mid = Math.floor(leg.path.length / 2);
      const p0 = map!.project([leg.path[mid - 1].lng, leg.path[mid - 1].lat]);
      const p1 = map!.project([leg.path[mid + 1].lng, leg.path[mid + 1].lat]);
      const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      let entry = planeMarkers.current.get(leg.fromId);
      if (!entry) {
        const el = document.createElement("div");
        el.className = "trip-plane";
        el.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="#d4552b" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" d="M21 12.5 13.5 9V4.2a1.5 1.5 0 0 0-3 0V9L3 12.5v2l7.5-1.6V18L8.5 19.5V21l3.5-1 3.5 1v-1.5L13.5 18v-5.1L21 14.5z"/></svg>`;
        entry = new maplibregl.Marker({ element: el, rotationAlignment: "viewport" }).setLngLat([leg.path[mid].lng, leg.path[mid].lat]).addTo(map!);
        planeMarkers.current.set(leg.fromId, entry);
      }
      entry.setLngLat([leg.path[mid].lng, leg.path[mid].lat]);
      // the icon points up (north); rotate it to follow the arc on screen
      entry.setRotation(angle + 90);
    });
    planeMarkers.current.forEach((mk, id) => { if (!live.has(id)) { mk.remove(); planeMarkers.current.delete(id); } });
  }, [map, legs, located, mode]);

  /* ── Live location + geofencing ─────────────────────────────────────── */
  useEffect(() => {
    if (!tracking) { setMe(null); centeredOnMe.current = false; return; }
    if (!("geolocation" in navigator)) {
      setNotice({ tone: "negative", text: t("map.noGeo") });
      setTracking(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      p => setMe({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy }),
      err => {
        setNotice({ tone: "negative", text: err.code === err.PERMISSION_DENIED
          ? t("map.geoBlocked")
          : t("map.geoFailed") });
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking]);

  useEffect(() => {
    if (!map) return;
    (map.getSource("fences") as GeoJSONSource | undefined)?.setData(tracking ? {
      type: "FeatureCollection",
      features: located.map(({ stop }) => ({
        type: "Feature", properties: {},
        geometry: { type: "Polygon", coordinates: [circleRing({ lat: stop.lat!, lng: stop.lng! }, GEOFENCE_METERS)] },
      })),
    } : EMPTY_FC);
  }, [map, tracking, located]);

  useEffect(() => {
    if (!map) return;
    (map.getSource("accuracy") as GeoJSONSource | undefined)?.setData(me ? {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(me.pos, me.accuracy)] } }],
    } : EMPTY_FC);
    if (me) {
      if (!meMarker.current) {
        const el = document.createElement("div");
        el.className = "trip-me";
        el.setAttribute("aria-label", t("map.youAreHere"));
        meMarker.current = new maplibregl.Marker({ element: el }).setLngLat([me.pos.lng, me.pos.lat]).addTo(map);
      } else meMarker.current.setLngLat([me.pos.lng, me.pos.lat]);
      if (!centeredOnMe.current) { centeredOnMe.current = true; map.easeTo({ center: [me.pos.lng, me.pos.lat], duration: 600 }); }
      for (const { stop } of located) {
        if (haversine(me.pos, { lat: stop.lat!, lng: stop.lng! }) <= GEOFENCE_METERS && !arrivedAt.current.has(stop.id)) {
          arrivedAt.current.add(stop.id);
          setNotice({ tone: "positive", text: t("map.arrived", { name: stop.title }) });
          select(stop.id);
          navigator.vibrate?.(80);
          break;
        }
      }
    } else {
      meMarker.current?.remove();
      meMarker.current = null;
    }
  }, [map, me]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pending (click-to-add) marker ──────────────────────────────────── */
  useEffect(() => {
    if (!map) return;
    if (!pending) { pendingMarker.current?.remove(); pendingMarker.current = null; return; }
    if (!pendingMarker.current) {
      const el = document.createElement("div");
      el.className = "trip-pending";
      pendingMarker.current = new maplibregl.Marker({ element: el }).setLngLat([pending.lng, pending.lat]).addTo(map);
    } else pendingMarker.current.setLngLat([pending.lng, pending.lat]);
  }, [map, pending]);

  /* ── Derived ────────────────────────────────────────────────────────── */
  const legList = Object.values(legs);
  const totals = legList.reduce((a, l) => ({ s: a.s + l.seconds, m: a.m + l.meters }), { s: 0, m: 0 });
  const anyEstimated = legList.some(l => l.estimated);
  const flights = legList.filter(l => l.kind === "flight").length;
  const selectedStop = located.find(l => l.stop.id === selected) ?? null;
  const dayUrl = googleMapsDirectionsUrl(located.map(({ stop }) => ({ lat: stop.lat!, lng: stop.lng! })), mode);
  const project = (p: LatLng) => map?.project([p.lng, p.lat]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-sunken grid-texture p-6 text-center">
        <div>
          <MapPinOff size={20} className="mx-auto text-ink-3" />
          <p className="mt-2 text-[13px] text-ink-2">{t("map.failed")}</p>
          <p className="mt-1 text-[12px] text-ink-3">{t("map.failedHint")}</p>
        </div>
      </div>
    );
  }

  const selPos = selectedStop ? project({ lat: selectedStop.stop.lat!, lng: selectedStop.stop.lng! }) : null;
  const pendPos = pending ? project(pending) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* MapLibre forces `position: relative` on its container, so size it explicitly. */}
      <div ref={containerRef} className="h-full w-full" />
      {!map && <div className="absolute inset-0"><MapPlaceholder /></div>}

      {/* ── Anchored cards ──────────────────────────────────────────── */}
      {map && selectedStop && selPos && (
        <div className="absolute z-[5]" style={{ left: selPos.x, top: selPos.y, transform: "translate(-50%, calc(-100% - 60px))" }}>
          <StopPopover stop={selectedStop.stop} n={selectedStop.n} mode={mode}
                       distance={me ? haversine(me.pos, { lat: selectedStop.stop.lat!, lng: selectedStop.stop.lng! }) : null}
                       onClose={() => select(null)} typeLabel={t(`itinerary.stopTypes.${selectedStop.stop.type}`)} />
        </div>
      )}
      {map && pending && pendPos && (
        <div className="absolute z-[5]" style={{ left: pendPos.x, top: pendPos.y, transform: "translate(-50%, calc(-100% - 18px))" }}>
          <div className="w-[240px] rounded-[14px] border border-line bg-surface p-3.5 shadow-[0_18px_40px_-18px_rgb(22_24_29/0.45)]">
            <div className="flex items-start gap-2">
              <MapPinned size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{pending.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{pending.address ?? t("map.lookingUp")}</p>
              </div>
              <button onClick={() => setPending(null)} aria-label={t("common.dismiss")} className="-mr-1 -mt-1 rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink">
                <X size={14} />
              </button>
            </div>
            {onAddPlace && <button onClick={() => { onAddPlace(pending); setPending(null); }}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-ink text-[13px] font-medium text-paper hover:bg-[#2a2d35]">
              <Plus size={14} /> {t("map.addToDay")}
            </button>}
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="absolute inset-x-3 top-3 z-[8] flex items-start gap-2">
      <div className="relative min-w-0 max-w-[320px] flex-1">
        <div className="flex h-10 items-center gap-2 rounded-[12px] border border-line bg-surface/95 px-3 shadow-[0_8px_24px_-14px_rgb(22_24_29/0.4)] backdrop-blur">
          {searchingPlaces ? <Loader2 size={15} className="shrink-0 animate-spin text-ink-3" aria-hidden="true" />
            : <Search size={15} className="shrink-0 text-ink-3" aria-hidden="true" />}
          <input value={placeQuery} onChange={e => { setPlaceQuery(e.target.value); setPlaceResults([]); setHasSearchedPlaces(false); }}
                 onKeyDown={handlePlaceSearchKey} placeholder={t("map.searchPlaceholder")} aria-label={t("map.searchPlace")}
                 role="combobox" aria-expanded={placeResults.length > 0} aria-controls="map-place-results"
                 aria-activedescendant={activePlace >= 0 ? `map-place-${activePlace}` : undefined}
                 autoComplete="off" className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3" />
          {placeQuery && <button type="button" onClick={() => { setPlaceQuery(""); setPlaceResults([]); setHasSearchedPlaces(false); }}
                                 aria-label={t("common.clear")} className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink">
            <X size={14} />
          </button>}
        </div>
        {(placeResults.length > 0 || (hasSearchedPlaces && !searchingPlaces)) && (
          <ul id="map-place-results" role="listbox" className="mt-1 max-h-64 overflow-y-auto rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)]">
            {placeResults.length > 0 ? placeResults.map((place, index) => (
              <li key={`${place.placeId ?? place.address}-${index}`} id={`map-place-${index}`} role="option" aria-selected={activePlace === index}>
                <button type="button" onClick={() => selectPlace(place)} onMouseEnter={() => setActivePlace(index)}
                        className={cn("flex w-full items-start gap-2.5 rounded-[8px] px-3 py-2 text-start", activePlace === index && "bg-sunken")}>
                  <MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink">{place.title}</span>
                    {place.subtitle && <span className="block truncate text-[12px] text-ink-3">{place.subtitle}</span>}
                  </span>
                </button>
              </li>
            )) : <li className="px-3 py-2 text-[12px] text-ink-3">{t("common.noResults")}</li>}
            {placeResults.length > 0 && <li className="px-3 pb-1 pt-1.5 text-[10.5px] text-ink-3">{t("itinerary.attribution")}</li>}
          </ul>
        )}
      </div>
      <div className="pointer-events-none flex shrink-0 items-center justify-end gap-2">
        {located.length >= 2 && (
          <div role="radiogroup" aria-label={t("map.travelMode")}
               className="pointer-events-auto flex rounded-[12px] border border-line bg-surface/95 p-1 shadow-[0_8px_24px_-14px_rgb(22_24_29/0.4)] backdrop-blur">
            {MODES.map(({ mode: m, icon: Icon, key }) => { const label = t(`map.modes.${key}`); return (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => changeMode(m)} title={label} aria-label={label}
                      className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] text-[12px] font-medium transition-colors",
                                    mode === m ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                <Icon size={15} aria-hidden="true" />
              </button>
            ); })}
          </div>
        )}
        <div className="pointer-events-auto flex rounded-[12px] border border-line bg-surface/95 p-1 shadow-[0_8px_24px_-14px_rgb(22_24_29/0.4)] backdrop-blur">
          <ToolButton label={tracking ? t("map.stopLive") : t("map.showLocation")} active={tracking} onClick={() => setTracking(v => !v)}>
            <LocateFixed size={15} />
          </ToolButton>
          <ToolButton label={t("map.fitAll")} onClick={fitAll} disabled={located.length === 0 && !me}>
            <Maximize2 size={15} />
          </ToolButton>
          {located.length > 0 && (
            <a href={dayUrl} target="_blank" rel="noopener noreferrer" title={t("map.openGoogle")} aria-label={t("map.openGoogle")}
               className="grid h-8 w-8 place-items-center rounded-[8px] text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
      </div>

      {/* ── Notices (arrival / errors) ──────────────────────────────── */}
      {notice && (
        <div role="status"
             className={cn("animate-rise absolute left-1/2 top-16 z-[7] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border py-2 pl-3.5 pr-2 text-[12.5px] shadow-[0_12px_30px_-14px_rgb(22_24_29/0.45)]",
                           notice.tone === "positive" ? "border-positive/30 bg-positive-soft text-positive" : "border-negative/30 bg-negative-soft text-negative")}>
          <span className="truncate font-medium">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label={t("common.dismiss")} className="rounded-full p-1 hover:bg-black/5"><X size={13} /></button>
        </div>
      )}

      {/* ── Day summary ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[6] max-w-[calc(100%-7rem)]">
        <div className="rounded-[12px] border border-line bg-surface/95 px-3 py-2 shadow-[0_8px_24px_-14px_rgb(22_24_29/0.4)] backdrop-blur">
          {located.length === 0 ? (
            <p className="text-[12px] text-ink-2">
              {stops.length === 0 ? t("map.noStops") : t("map.noLocations")}
              {onAddPlace && <span className="text-ink-3"> {t("map.clickToAdd")}</span>}
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                <Clock size={12} className="text-ink-3" aria-hidden="true" />
                {legList.length > 0
                  ? <>{anyEstimated && "≈ "}{formatTravelTime(totals.s)} · {formatDistance(totals.m)}</>
                  : t("itinerary.stopsCount", { count: located.length })}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-3">
                {flights > 0 ? `${t("map.inclFlights", { count: flights })} · ` : ""}
                {stops.length > located.length ? `${t("map.withoutLocation", { count: stops.length - located.length })} · ` : ""}
                {tracking && me ? `GPS ±${Math.round(me.accuracy)} m` : onAddPlace ? t("map.clickToAdd") : t("map.onMap", { count: located.length })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ label, active, disabled, onClick, children }: {
  label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active}
            className={cn("grid h-8 w-8 place-items-center rounded-[8px] transition-colors disabled:opacity-40",
                          active ? "bg-[#2f6fed] text-white" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
      {children}
    </button>
  );
}

function StopPopover({ stop, n, mode, distance, onClose, typeLabel }: {
  stop: Stop; n: number; mode: TravelMode; distance: number | null; onClose: () => void; typeLabel: string;
}) {
  const { t } = useTranslation("common");
  const meta = STOP_META[stop.type] ?? STOP_META.activity;
  const Icon = meta.icon;
  const at = { lat: stop.lat!, lng: stop.lng! };
  return (
    <div className="w-[260px] rounded-[14px] border border-line bg-surface p-3.5 shadow-[0_18px_40px_-18px_rgb(22_24_29/0.45)]">
      <div className="flex items-start gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold text-white" style={{ background: meta.color }}>{n}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-medium" style={{ color: meta.color }}>
            <Icon size={11} aria-hidden="true" /> {typeLabel}
            {stop.start_time && <span className="font-mono text-ink-3">· {stop.start_time.slice(0, 5)}</span>}
          </p>
          <p className="mt-0.5 text-[14px] font-semibold leading-snug text-ink">{stop.title}</p>
          {stop.address && <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{stop.address}</p>}
          {distance != null && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#2f6fed]/10 px-2 py-0.5 text-[11px] font-medium text-[#2f6fed]">
              <Navigation size={10} aria-hidden="true" />
              {distance <= GEOFENCE_METERS ? t("map.youreHere") : t("map.fromYou", { distance: formatDistance(distance) })}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label={t("common.close")} className="-mr-1 -mt-1 rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink"><X size={14} /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={googleMapsDirectionsTo(at, mode)} target="_blank" rel="noopener noreferrer"
           className="flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-ink text-[12px] font-medium text-paper hover:bg-[#2a2d35]">
          <Navigation size={12} /> {t("map.directions")}
        </a>
        <a href={openStreetMapUrl(at)} target="_blank" rel="noopener noreferrer"
           className="flex h-8 items-center justify-center gap-1.5 rounded-[9px] border border-line-strong text-[12px] font-medium text-ink hover:bg-sunken">
          <ExternalLink size={12} /> {t("map.viewOnMap")}
        </a>
      </div>
    </div>
  );
}
