"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CatchLightbox } from "@/components/album/CatchLightbox";
import { CatchPhoto } from "@/components/album/CatchPhoto";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { TripCard, tripWhen } from "@/components/trips/TripCard";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, Stat } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import type { Catch, FishingTrip } from "@/lib/db/schema";
import { formatMonthLong, hoursBetween } from "@/lib/utils/dates";
import { formatWeight, normalizeText } from "@/lib/utils/format";

type Tab = "trips" | "photos";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "trips", label: "Pescarias", icon: "list" },
  { id: "photos", label: "Fotos", icon: "camera" },
];

const TRIPS_PAGE = 12;
const PHOTOS_PAGE = 24;

export function HistoryScreen() {
  const profile = useCurrentProfile();

  // Concluídas + planejadas que já passaram (não iniciadas). O corte de tempo
  // fica dentro da consulta para manter a renderização pura.
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [all, catches] = await Promise.all([
      db.trips.where("profileId").equals(profile.id).sortBy("plannedAt"),
      db.catches.where("profileId").equals(profile.id).toArray(),
    ]);
    const cutoff = Date.now() - 12 * 3600_000;
    const past = all
      .reverse()
      .filter(
        (t) => t.status === "concluida" || (t.status === "planejada" && new Date(t.plannedAt).getTime() < cutoff),
      );
    return { profileId: profile.id, past, catches };
  }, [profile.id]);

  if (!data || data.profileId !== profile.id) return <ScreenLoading />;

  return (
    <HistoryContent
      key={profile.id}
      profileId={profile.id}
      profileName={profile.name}
      past={data.past}
      catches={data.catches}
    />
  );
}

function HistoryContent({
  profileId,
  profileName,
  past,
  catches,
}: {
  profileId: string;
  profileName: string;
  past: FishingTrip[];
  catches: Catch[];
}) {
  const [tab, setTab] = useState<Tab>("trips");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tripLimit, setTripLimit] = useState(TRIPS_PAGE);
  const [photoLimit, setPhotoLimit] = useState(PHOTOS_PAGE);

  const tripMap = useMemo(() => new Map(past.map((trip) => [trip.id, trip])), [past]);

  const stats = useMemo(() => {
    const done = past.filter((t) => t.status === "concluida");
    const hours = done.reduce((s, t) => (t.startedAt && t.endedAt ? s + hoursBetween(t.startedAt, t.endedAt) : s), 0);
    const biggest = catches.reduce<Catch | null>(
      (best, c) => (c.weightKg != null && (best?.weightKg ?? -1) < c.weightKg ? c : best),
      null,
    );
    const bySpecies = new Map<string, number>();
    for (const c of catches) {
      const key = speciesName(c.speciesId, c.speciesCustom);
      bySpecies.set(key, (bySpecies.get(key) ?? 0) + 1);
    }
    const top = [...bySpecies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { trips: done.length, catches: catches.length, hours, biggest, top };
  }, [past, catches]);

  /** Todas as capturas com foto, da mais recente para a mais antiga. */
  const photos = useMemo(
    () =>
      catches
        .filter(hasPhoto)
        .sort((a, b) => dateNumber(b.caughtAt) - dateNumber(a.caughtAt) || a.id.localeCompare(b.id)),
    [catches],
  );

  const years = useMemo(() => {
    const found = new Set<string>();
    past.forEach((trip) => {
      const y = yearOf(tripWhen(trip));
      if (y) found.add(y);
    });
    photos.forEach((item) => {
      const y = yearOf(item.caughtAt);
      if (y) found.add(y);
    });
    return [...found].sort((a, b) => b.localeCompare(a));
  }, [past, photos]);

  const filteredTrips = useMemo(() => {
    const query = normalizeText(search);
    return past.filter((trip) => {
      if (year && yearOf(tripWhen(trip)) !== year) return false;
      if (!query) return true;
      return normalizeText(`${trip.title ?? ""} ${trip.locationName ?? ""}`).includes(query);
    });
  }, [past, search, year]);

  const filteredPhotos = useMemo(() => {
    const query = normalizeText(search);
    return photos.filter((item) => {
      if (year && yearOf(item.caughtAt) !== year) return false;
      if (!query) return true;
      const trip = tripMap.get(item.tripId);
      const name = speciesName(item.speciesId, item.speciesCustom);
      return normalizeText(`${name} ${trip?.locationName ?? ""} ${trip?.title ?? ""}`).includes(query);
    });
  }, [photos, search, tripMap, year]);

  const selectedIndex = filteredPhotos.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? filteredPhotos[selectedIndex] : null;
  const hasFilters = search !== "" || year !== "";
  const empty = past.length === 0 && catches.length === 0;

  function clearFilters() {
    setSearch("");
    setYear("");
  }

  function changeTab(next: Tab, element?: HTMLElement | null) {
    setTab(next);
    element?.querySelector<HTMLButtonElement>(`#historico-tab-${next}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Histórico" subtitle={`Pescarias e estatísticas de ${profileName}`} />

      {empty ? (
        <EmptyState
          icon="📖"
          title="Ainda sem histórico"
          description="Concluir pescarias e registrar capturas vai montar suas estatísticas aqui."
          action={<Button href="/planejar">Planejar a primeira</Button>}
        />
      ) : (
        <>
          <Card>
            <CardTitle>Estatísticas</CardTitle>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Pescarias" value={stats.trips} />
              <Stat label="Capturas" value={stats.catches} />
              <Stat label="Fotos" value={photos.length} />
              <Stat
                label="Horas na água"
                value={stats.hours.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              />
              <Stat
                label="Maior peixe"
                value={stats.biggest ? formatWeight(stats.biggest.weightKg) : "—"}
                sub={stats.biggest ? speciesName(stats.biggest.speciesId, stats.biggest.speciesCustom) : undefined}
              />
            </div>
            {stats.top.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Espécies mais capturadas</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {stats.top.map(([name, n]) => (
                    <li key={name} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-strong">
                      {name} <span className="font-medium opacity-80">× {n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <div
            role="tablist"
            aria-label="Como ver o histórico"
            className="flex gap-1 rounded-2xl border border-border bg-surface p-1"
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const at = TABS.findIndex((item) => item.id === tab);
              changeTab(TABS[(at + step + TABS.length) % TABS.length].id, event.currentTarget);
            }}
          >
            {TABS.map((item) => {
              const active = item.id === tab;
              const count = item.id === "trips" ? past.length : photos.length;
              return (
                <button
                  key={item.id}
                  id={`historico-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={active ? `historico-painel-${item.id}` : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2"
                  }`}
                >
                  <Icon name={item.icon} className="size-4" />
                  {item.label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <section aria-label="Filtros do histórico" className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
            <Field label="Buscar" htmlFor="historico-busca">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute top-4 left-3.5 size-5 text-muted" />
                <Input
                  id="historico-busca"
                  type="search"
                  placeholder={tab === "photos" ? "Espécie ou local…" : "Título ou local…"}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-11"
                />
              </div>
            </Field>
            <Field label="Ano" htmlFor="historico-ano">
              <div className="relative">
                <Select id="historico-ano" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="">Todos os anos</option>
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Icon name="chevron-down" className="pointer-events-none absolute top-4 right-3 size-4 text-muted" />
              </div>
            </Field>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="justify-self-start sm:mb-0.5">
                Limpar filtros
              </Button>
            )}
          </section>

          {tab === "trips" && (
            <section
              id="historico-painel-trips"
              role="tabpanel"
              aria-labelledby="historico-tab-trips"
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Pescarias</CardTitle>
                <p role="status" className="shrink-0 text-sm text-muted">
                  {filteredTrips.length} {filteredTrips.length === 1 ? "pescaria" : "pescarias"}
                </p>
              </div>
              {filteredTrips.length === 0 ? (
                <EmptyState
                  icon={<Icon name={hasFilters ? "search" : "calendar"} className="size-12 text-brand" />}
                  title={hasFilters ? "Nada com esses filtros" : "Nenhuma pescaria encerrada"}
                  description={
                    hasFilters
                      ? "Tente outro termo ou outro ano para reencontrar o dia que você procura."
                      : "Quando você concluir uma pescaria, ela fica guardada aqui."
                  }
                  action={
                    hasFilters ? (
                      <Button variant="outline" onClick={clearFilters}>
                        Ver todas
                      </Button>
                    ) : (
                      <Button href="/planejar">Planejar uma pescaria</Button>
                    )
                  }
                />
              ) : (
                <>
                  {groupByMonth(filteredTrips.slice(0, tripLimit), tripWhen).map((group) => (
                    <div key={group.key} className="flex flex-col gap-3">
                      <MonthHeading label={group.label} count={group.items.length} />
                      {group.items.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  ))}
                  {tripLimit < filteredTrips.length && (
                    <Button variant="outline" onClick={() => setTripLimit((value) => value + TRIPS_PAGE)}>
                      Ver mais pescarias ({filteredTrips.length - tripLimit})
                    </Button>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "photos" && (
            <section
              id="historico-painel-photos"
              role="tabpanel"
              aria-labelledby="historico-tab-photos"
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Só as fotos</CardTitle>
                <p role="status" className="shrink-0 text-sm text-muted">
                  {filteredPhotos.length} {filteredPhotos.length === 1 ? "foto" : "fotos"}
                </p>
              </div>
              {filteredPhotos.length === 0 ? (
                <EmptyState
                  icon={<Icon name={hasFilters ? "search" : "camera"} className="size-12 text-brand" />}
                  title={hasFilters ? "Nenhuma foto por aqui" : "Nenhuma captura com foto ainda"}
                  description={
                    hasFilters
                      ? "Nenhuma foto bate com a busca. Limpe os filtros para ver o mural inteiro."
                      : "Registre uma captura com foto e o mural começa a encher."
                  }
                  action={
                    hasFilters ? (
                      <Button variant="outline" onClick={clearFilters}>
                        Ver todas as fotos
                      </Button>
                    ) : (
                      <Button href="/planejar">Planejar uma pescaria</Button>
                    )
                  }
                />
              ) : (
                <>
                  {groupByMonth(filteredPhotos.slice(0, photoLimit), (item) => item.caughtAt).map((group) => (
                    <div key={group.key}>
                      <MonthHeading label={group.label} count={group.items.length} />
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                        {group.items.map((item) => (
                          <PhotoTile
                            key={item.id}
                            item={item}
                            trip={tripMap.get(item.tripId)}
                            onSelect={() => setSelectedId(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {photoLimit < filteredPhotos.length && (
                    <Button variant="outline" onClick={() => setPhotoLimit((value) => value + PHOTOS_PAGE)}>
                      Ver mais fotos ({filteredPhotos.length - photoLimit})
                    </Button>
                  )}
                  <p className="text-center text-xs text-muted">
                    Quer os detalhes de cada captura?{" "}
                    <Link href="/album" className="font-semibold text-brand underline underline-offset-2">
                      Abrir o álbum completo
                    </Link>
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}

      {selected && (
        <CatchLightbox
          item={selected}
          trip={tripMap.get(selected.tripId)}
          profileId={profileId}
          index={selectedIndex}
          count={filteredPhotos.length}
          onPrevious={() => setSelectedId(filteredPhotos[selectedIndex - 1]?.id ?? selectedId)}
          onNext={() => setSelectedId(filteredPhotos[selectedIndex + 1]?.id ?? selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function MonthHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h3>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="text-xs tabular-nums text-muted">{count}</span>
    </div>
  );
}

function PhotoTile({ item, trip, onSelect }: { item: Catch; trip?: FishingTrip; onSelect: () => void }) {
  const title = speciesName(item.speciesId, item.speciesCustom);
  const weight = item.weightKg != null && Number.isFinite(item.weightKg) && item.weightKg > 0 ? item.weightKg : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Ver foto de ${title}, ${shortDate(item.caughtAt)}${weight ? `, ${formatWeight(weight)}` : ""}`}
      className="group relative aspect-square overflow-hidden rounded-xl border border-border shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transform-none"
    >
      <CatchPhoto
        item={item}
        className="size-full"
        imageClassName="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1f19]/85 to-transparent px-2 pt-6 pb-1.5 text-left text-[11px] font-semibold text-white">
        <span className="block truncate">{title}</span>
        <span className="block truncate font-medium opacity-80">
          {weight ? formatWeight(weight) : trip?.locationName || trip?.title || shortDate(item.caughtAt)}
        </span>
      </span>
    </button>
  );
}

/** Agrupa uma lista já ordenada em blocos por mês, preservando a ordem. */
function groupByMonth<T>(items: T[], dateOf: (item: T) => string) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const time = new Date(dateOf(item)).getTime();
    const label = Number.isFinite(time) ? formatMonthLong(new Date(time)) : "Sem data";
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    // A chave leva o índice porque duas ilhas "Sem data" podem aparecer separadas.
    else groups.push({ key: `${groups.length}-${label}`, label, items: [item] });
  }
  return groups;
}

function hasPhoto(item: Catch): boolean {
  return item.photo instanceof Blob && item.photo.size > 0;
}

function dateNumber(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function yearOf(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? String(date.getFullYear()) : "";
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Data não informada";
}
