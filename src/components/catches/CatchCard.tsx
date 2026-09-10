"use client";

import Link from "next/link";
import { speciesName } from "@/data/especies";
import type { Catch } from "@/lib/db/schema";
import { useObjectUrl } from "@/lib/hooks/useObjectUrl";
import { formatTime } from "@/lib/utils/dates";
import { formatLength, formatWeight } from "@/lib/utils/format";

export function CatchCard({ item }: { item: Catch }) {
  const photoUrl = useObjectUrl(item.photo);
  return (
    <Link
      href={`/captura?trip=${item.tripId}&id=${item.id}`}
      className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm active:bg-surface-2"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={`Foto: ${speciesName(item.speciesId, item.speciesCustom)}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-3xl" aria-hidden>🐟</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-bold">{speciesName(item.speciesId, item.speciesCustom)}</h3>
          <span className="shrink-0 text-xs font-semibold text-muted">{formatTime(item.caughtAt)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
          <span><span className="text-muted">Peso</span> <strong>{formatWeight(item.weightKg)}</strong></span>
          <span><span className="text-muted">Tamanho</span> <strong>{formatLength(item.lengthCm)}</strong></span>
        </div>
        {(item.bait || item.notes) && (
          <p className="mt-1 truncate text-xs text-muted">
            {item.bait && <>Isca: {item.bait}</>}
            {item.bait && item.notes && " · "}
            {item.notes}
          </p>
        )}
      </div>
    </Link>
  );
}
