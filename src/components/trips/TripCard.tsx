"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Card";
import { WeatherMini } from "@/components/weather/WeatherPanel";
import { getDb } from "@/lib/db";
import type { FishingTrip, TripStatus } from "@/lib/db/schema";
import { formatRelativeDay, formatTime, formatDuration } from "@/lib/utils/dates";
import { formatCoords } from "@/lib/utils/format";

export const STATUS_LABEL: Record<TripStatus, { label: string; tone: "brand" | "success" | "muted" | "accent" }> = {
  planejada: { label: "Planejada", tone: "brand" },
  em_andamento: { label: "Em andamento", tone: "accent" },
  concluida: { label: "Concluída", tone: "success" },
};

export function tripTitle(trip: FishingTrip): string {
  return trip.title?.trim() || trip.locationName || formatCoords(trip.lat, trip.lng);
}

/** Quando a pescaria de fato aconteceu — cai no planejado enquanto não começou. */
export function tripWhen(trip: FishingTrip): string {
  return trip.status === "concluida" && trip.startedAt ? trip.startedAt : trip.plannedAt;
}

export function TripCard({ trip, actions }: { trip: FishingTrip; actions?: ReactNode }) {
  const catchCount = useLiveQuery(() => getDb().catches.where("tripId").equals(trip.id).count(), [trip.id]);
  const status = STATUS_LABEL[trip.status];
  const when = tripWhen(trip);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <Link href={`/pescaria?id=${trip.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">
              {formatRelativeDay(when)} · {formatTime(when)}
            </div>
            <h3 className="truncate text-lg font-bold">{tripTitle(trip)}</h3>
            {trip.title && trip.locationName && <div className="truncate text-sm text-muted">{trip.locationName}</div>}
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>🐟 {catchCount ?? 0} {catchCount === 1 ? "captura" : "capturas"}</span>
          {trip.startedAt && trip.status !== "planejada" && (
            <span>⏱️ {formatDuration(trip.startedAt, trip.endedAt)}</span>
          )}
          <span>{trip.ambiente === "mar" ? "🌊 Mar" : "🏞️ Água doce"}</span>
        </div>

        {trip.weather && (
          <div className="mt-3">
            <WeatherMini snapshot={trip.weather} plannedAt={trip.plannedAt} />
          </div>
        )}
      </Link>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </article>
  );
}
