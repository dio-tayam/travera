"use client";

import dynamic from "next/dynamic";
import { MapPlaceholder } from "./map-placeholder";

/** Code-split map: the Google Maps bundle only loads when a map is actually rendered. */
export const LazyTripMap = dynamic(() => import("./trip-map").then(m => m.TripMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});
