"use client";

import { useEffect, useId, useRef } from "react";
import { CatchPhoto } from "./CatchPhoto";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { speciesName } from "@/data/especies";
import type { Catch, FishingTrip } from "@/lib/db/schema";
import { formatLength, formatWeight } from "@/lib/utils/format";

export function CatchLightbox({
  item,
  trip,
  profileId,
  index,
  count,
  onPrevious,
  onNext,
  onClose,
}: {
  item: Catch;
  trip?: FishingTrip;
  profileId: string;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const ownTrip = trip?.id === item.tripId && trip.profileId === profileId && item.profileId === profileId;
  const date = new Date(item.caughtAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Data não informada";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          onPrevious();
        } else if (event.key === "ArrowRight" && index < count - 1) {
          event.preventDefault();
          onNext();
        }
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-3xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-[#102c26]/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span id={descriptionId} className="text-sm font-semibold text-muted" aria-live="polite">
          Memória {index + 1} de {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label="Fechar foto"
          onClick={() => dialogRef.current?.close()}
          className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-foreground transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>
      <div className="grid md:grid-cols-[1.15fr_1fr]">
        <div className="relative bg-brand-soft">
          <CatchPhoto item={item} loading="eager" className="h-[38dvh] min-h-56 w-full md:h-full md:min-h-96" imageClassName="object-contain" />
          {count > 1 && (
            <div className="absolute inset-x-0 bottom-4 flex justify-between px-4">
              <button
                type="button"
                onClick={onPrevious}
                disabled={index === 0}
                aria-label="Captura anterior"
                className="flex size-12 items-center justify-center rounded-full border border-border bg-surface text-brand shadow-md disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon name="arrow-left" className="size-5" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={index === count - 1}
                aria-label="Próxima captura"
                className="flex size-12 items-center justify-center rounded-full border border-border bg-surface text-brand shadow-md disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon name="arrow-right" className="size-5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Uma boa história de pescaria</p>
            <h2 id={titleId} className="font-display text-3xl leading-tight">{speciesName(item.speciesId, item.speciesCustom)}</h2>
            <p className="mt-2 text-sm text-muted">{dateLabel}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background p-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon name="scale" className="size-4" /> Peso</dt>
              <dd className="mt-2 text-xl font-bold">{validMeasure(item.weightKg) ? formatWeight(item.weightKg) : "Não pesado"}</dd>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon name="ruler" className="size-4" /> Comprimento</dt>
              <dd className="mt-2 text-xl font-bold">{validMeasure(item.lengthCm) ? formatLength(item.lengthCm) : "Não medido"}</dd>
            </div>
            <div className="col-span-2 border-b border-border pb-4 pt-1">
              <dt className="text-xs font-semibold text-muted">Local da pescaria</dt>
              <dd className="mt-1 flex items-start gap-2 text-sm font-semibold"><Icon name="pin" className="mt-0.5 size-4 shrink-0 text-brand" />{trip?.locationName || trip?.title || "Local não informado"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-semibold text-muted">Isca / técnica</dt>
              <dd className="mt-1 text-sm">{item.bait || "Não informada"}</dd>
            </div>
            {item.notes && <div className="col-span-2"><dt className="text-xs font-semibold text-muted">Lembranças desse dia</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.notes}</dd></div>}
          </dl>
          {ownTrip && (
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <Button href={`/pescaria?id=${encodeURIComponent(item.tripId)}`} variant="primary" size="sm">Ver pescaria</Button>
              <Button href={`/captura?trip=${encodeURIComponent(item.tripId)}&id=${encodeURIComponent(item.id)}`} variant="outline" size="sm">{item.photo ? "Editar captura" : "Adicionar foto"}</Button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function validMeasure(value?: number): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}
