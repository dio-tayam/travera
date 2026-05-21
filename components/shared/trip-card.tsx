"use client";

import Link from "next/link";
import { formatDateRange } from "@/lib/utils";
import { Users } from "lucide-react";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"] & {
  memberCount?: number;
};

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative block rounded-2xl overflow-hidden flex-shrink-0 w-72 h-44 shadow-sm hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ outlineColor: "var(--color-primary)" }}
    >
      {/* Background image */}
      {trip.cover_image_url ? (
        <img
          src={trip.cover_image_url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,56,168,0.85) 0%, transparent 60%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <h3
          className="text-white font-semibold text-base leading-tight line-clamp-2 mb-1"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {trip.title}
        </h3>

        <div className="flex items-center justify-between">
          {trip.start_date && trip.end_date && (
            <p
              className="text-white/75 text-xs"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {formatDateRange(trip.start_date, trip.end_date)}
            </p>
          )}
          {(trip.memberCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
              <Users size={11} className="text-white" />
              <span className="text-white text-xs">{trip.memberCount}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
