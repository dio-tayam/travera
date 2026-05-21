"use client";

import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useState, useMemo } from "react";
import type { Database } from "@/types/database";
import { getStopTypeColor } from "@/lib/utils";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

const MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#E8EAF0" }] },
  { featureType: "water", stylers: [{ color: "#C8D8F5" }] },
  { featureType: "landscape", stylers: [{ color: "#F5F5F0" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#BDBDBD" }] },
];

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

interface TripMapProps {
  stops: Stop[];
  center?: { lat: number; lng: number };
}

function createPinSvg(number: number, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 9 9 17 16 24 7-7 16-15 16-24C32 7.163 24.837 0 16 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="20" text-anchor="middle" font-size="12" font-family="sans-serif"
        font-weight="bold" fill="white" dominant-baseline="middle">${number}</text>
    </svg>
  `)}`;
}

export function TripMap({ stops, center }: TripMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const defaultCenter = useMemo(() => {
    if (center) return center;
    const withCoords = stops.filter((s) => s.lat && s.lng);
    if (withCoords.length > 0) {
      return {
        lat: withCoords.reduce((a, s) => a + s.lat!, 0) / withCoords.length,
        lng: withCoords.reduce((a, s) => a + s.lng!, 0) / withCoords.length,
      };
    }
    return { lat: 14.5995, lng: 120.9842 }; // Manila default
  }, [stops, center]);

  const polylinePath = useMemo(
    () =>
      stops
        .filter((s) => s.lat && s.lng)
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({ lat: s.lat!, lng: s.lng! })),
    [stops]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
        <div className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
          Loading map…
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={defaultCenter}
      zoom={13}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      }}
    >
      {stops
        .filter((s) => s.lat && s.lng)
        .map((stop, idx) => (
          <Marker
            key={stop.id}
            position={{ lat: stop.lat!, lng: stop.lng! }}
            icon={{
              url: createPinSvg(idx + 1, getStopTypeColor(stop.type)),
              scaledSize: new google.maps.Size(32, 40),
              anchor: new google.maps.Point(16, 40),
            }}
            title={stop.title}
          />
        ))}

      {polylinePath.length > 1 && (
        <Polyline
          path={polylinePath}
          options={{
            strokeColor: "#0038A8",
            strokeWeight: 3,
            strokeOpacity: 0.7,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                offset: "0",
                repeat: "20px",
              },
            ],
          }}
        />
      )}
    </GoogleMap>
  );
}
