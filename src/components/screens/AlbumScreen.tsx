"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { CatchLightbox } from "@/components/album/CatchLightbox";
import { CatchPhoto } from "@/components/album/CatchPhoto";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import type { Catch, FishingTrip } from "@/lib/db/schema";
import { formatWeight, normalizeText } from "@/lib/utils/format";

export function AlbumScreen() {
  const profile = useCurrentProfile();
  const [attempt, setAttempt] = useState(0);
  const result = useLiveQuery(async () => {
    try {
      const db = getDb();
      const [catches, trips] = await Promise.all([
        db.catches.where("profileId").equals(profile.id).toArray(),
        db.trips.where("profileId").equals(profile.id).toArray(),
      ]);
      return { status: "ready" as const, profileId: profile.id, catches, trips };
    } catch {
      return { status: "error" as const, profileId: profile.id };
    }
  }, [profile.id, attempt]);

  if (!result || result.profileId !== profile.id) return <ScreenLoading />;
  if (result.status === "error") {
    return <div className="space-y-4"><Notice tone="danger">Não foi possível abrir suas memórias. Tente carregar o álbum novamente.</Notice><Button onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button></div>;
  }

  return <AlbumContent key={profile.id} profileId={profile.id} catches={result.catches} trips={result.trips} />;
}

function AlbumContent({ profileId, catches, trips }: { profileId: string; catches: Catch[]; trips: FishingTrip[] }) {
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [onlyPhotos, setOnlyPhotos] = useState(false);
  const [sort, setSort] = useState<"recent" | "heaviest">("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tripMap = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips]);
  const active = trips.find((trip) => trip.status === "em_andamento");
  const captureHref = active ? `/captura?trip=${encodeURIComponent(active.id)}` : "/planejar";
  const speciesOptions = useMemo(() => {
    const options = new Map<string, string>();
    catches.forEach((item) => {
      const label = speciesName(item.speciesId, item.speciesCustom);
      options.set(normalizeText(label), label);
    });
    return [...options].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [catches]);
  const photoCount = catches.filter(hasPhoto).length;
  const record = catches.reduce((max, item) => Math.max(max, validWeight(item.weightKg) ? item.weightKg : 0), 0);
  const filtered = useMemo(() => {
    const query = normalizeText(search);
    return catches.filter((item) => {
      const name = normalizeText(speciesName(item.speciesId, item.speciesCustom));
      const trip = tripMap.get(item.tripId);
      const text = `${name} ${normalizeText(trip?.locationName ?? "")} ${normalizeText(trip?.title ?? "")}`;
      return (!query || text.includes(query)) && (!species || name === species) && (!onlyPhotos || hasPhoto(item));
    }).sort((a, b) => {
      if (sort === "heaviest") {
        const weightA = validWeight(a.weightKg) ? a.weightKg : -1;
        const weightB = validWeight(b.weightKg) ? b.weightKg : -1;
        if (weightA !== weightB) return weightB - weightA;
      }
      return dateNumber(b.caughtAt) - dateNumber(a.caughtAt) || a.id.localeCompare(b.id);
    });
  }, [catches, onlyPhotos, search, sort, species, tripMap]);
  const selectedIndex = filtered.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const hasFilters = search !== "" || species !== "" || onlyPhotos;

  function clearFilters() {
    setSearch("");
    setSpecies("");
    setOnlyPhotos(false);
  }

  return (
    <div className="flex flex-col gap-6 pb-5 sm:gap-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand"><Icon name="album" className="size-4" /> Memórias à beira d’água</p>
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">Meu álbum de pesca</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Cada peixe, um dia para lembrar. Suas conquistas guardadas em um só lugar.</p>
        </div>
        <Button href={captureHref} icon={<Icon name={active ? "camera" : "plus"} className="size-5" />} className="shrink-0 self-start sm:self-auto">{active ? "Registrar captura" : "Nova pescaria"}</Button>
      </header>

      <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-surface py-5 shadow-sm">
        <AlbumCount icon="fish" value={catches.length} label="capturas" />
        <AlbumCount icon="camera" value={photoCount} label="com foto" />
        <AlbumCount icon="leaf" value={speciesOptions.length} label="espécies" />
      </div>

      {catches.length === 0 ? (
        <div className="rounded-3xl bg-surface p-3 sm:p-8">
          <EmptyState
            icon={<Icon name="album" className="size-14 text-brand" />}
            title="As melhores histórias ainda estão por vir"
            description="Registre seu primeiro peixe, adicione uma foto e comece a guardar os dias bons de pescaria."
            action={<Button href={captureHref} icon={<Icon name="plus" className="size-4" />}>{active ? "Registrar meu primeiro peixe" : "Planejar minha primeira pescaria"}</Button>}
          />
        </div>
      ) : (
        <>
          <section aria-label="Filtros do álbum" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Encontrar uma memória" htmlFor="album-search">
                <div className="relative">
                  <Icon name="search" className="pointer-events-none absolute top-4 left-3.5 size-5 text-muted" />
                  <Input id="album-search" type="search" placeholder="Espécie ou local…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-11" />
                </div>
              </Field>
              <Field label="Espécie" htmlFor="album-species">
                <div className="relative">
                  <Select id="album-species" value={species} onChange={(event) => setSpecies(event.target.value)}><option value="">Todas as espécies</option>{speciesOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
                  <Icon name="chevron-down" className="pointer-events-none absolute top-4 right-3 size-4 text-muted" />
                </div>
              </Field>
              <Field label="Ordenar por" htmlFor="album-sort">
                <div className="relative">
                  <Select id="album-sort" value={sort} onChange={(event) => setSort(event.target.value as "recent" | "heaviest")}><option value="recent">Mais recentes</option><option value="heaviest">Mais pesados</option></Select>
                  <Icon name="chevron-down" className="pointer-events-none absolute top-4 right-3 size-4 text-muted" />
                </div>
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={onlyPhotos} onChange={(event) => setOnlyPhotos(event.target.checked)} className="size-5 rounded accent-brand" />Só capturas com foto</label>
              {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>}
            </div>
          </section>

          <section aria-label="Suas capturas">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">{hasFilters ? "Memórias encontradas" : "Pequenos e grandes troféus"}</h2>
              <p role="status" className="shrink-0 text-xs text-muted sm:text-sm">{filtered.length} {filtered.length === 1 ? "captura" : "capturas"}</p>
            </div>
            {filtered.length === 0 ? (
              <EmptyState icon={<Icon name="search" className="size-12 text-brand" />} title="Nenhuma captura por aqui" description="Experimente outra espécie ou local, ou limpe os filtros para ver todas as memórias." action={<Button variant="outline" onClick={clearFilters}>Ver todas as capturas</Button>} />
            ) : (
              <AlbumGrid key={`${search}|${species}|${onlyPhotos}|${sort}`} items={filtered} tripMap={tripMap} record={record} onSelect={setSelectedId} />
            )}
          </section>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted"><Icon name="heart" className="size-4 text-accent-strong" />As fotos são suas. As boas lembranças, para sempre.</p>
        </>
      )}

      {selected && <CatchLightbox item={selected} trip={tripMap.get(selected.tripId)} profileId={profileId} index={selectedIndex} count={filtered.length} onPrevious={() => setSelectedId(filtered[selectedIndex - 1]?.id ?? selectedId)} onNext={() => setSelectedId(filtered[selectedIndex + 1]?.id ?? selectedId)} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function AlbumCount({ icon, value, label }: { icon: "fish" | "camera" | "leaf"; value: number; label: string }) {
  return <div className="flex flex-col items-center px-2 text-center"><Icon name={icon} className="mb-2 size-5 text-brand" /><span className="text-2xl font-bold tabular-nums sm:text-3xl">{value.toLocaleString("pt-BR")}</span><span className="mt-1 text-xs text-muted sm:text-sm">{label}</span></div>;
}

function AlbumGrid({ items, tripMap, record, onSelect }: { items: Catch[]; tripMap: Map<string, FishingTrip>; record: number; onSelect: (id: string) => void }) {
  const [limit, setLimit] = useState(24);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.slice(0, limit).map((item) => {
          const title = speciesName(item.speciesId, item.speciesCustom);
          const trip = tripMap.get(item.tripId);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-label={`Ver ${title}, ${shortDate(item.caughtAt)}${validWeight(item.weightKg) ? `, ${formatWeight(item.weightKg)}` : ""}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-reduce:transform-none"
            >
              <div className="relative">
                <CatchPhoto item={item} className="aspect-[4/3] w-full" imageClassName="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none" />
                {validWeight(item.weightKg) && item.weightKg === record && <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-[#321608] shadow-sm sm:text-xs"><Icon name="trophy" className="size-3.5" />Recorde pessoal</span>}
                {validWeight(item.weightKg) && <span className="absolute right-2 bottom-2 rounded-lg bg-surface/95 px-2.5 py-1 text-xs font-bold text-brand-strong shadow-sm sm:text-sm">{formatWeight(item.weightKg)}</span>}
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="truncate font-display text-lg font-semibold sm:text-xl">{title}</h3>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted"><Icon name="pin" className="size-3.5 shrink-0" /><span className="truncate">{trip?.locationName || trip?.title || "Local não informado"}</span></p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-muted sm:text-xs"><time dateTime={Number.isFinite(new Date(item.caughtAt).getTime()) ? item.caughtAt : undefined}>{shortDate(item.caughtAt)}</time><Icon name="arrow-right" className="size-4 text-brand" /></div>
              </div>
            </button>
          );
        })}
      </div>
      {limit < items.length && <div className="mt-6 text-center"><Button variant="outline" onClick={() => setLimit((value) => value + 24)}>Ver mais memórias ({items.length - limit})</Button></div>}
    </>
  );
}

function validWeight(value?: number): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function hasPhoto(item: Catch): boolean {
  return item.photo instanceof Blob && item.photo.size > 0;
}

function dateNumber(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Data não informada";
}
