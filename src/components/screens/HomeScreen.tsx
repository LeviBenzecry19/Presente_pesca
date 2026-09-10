"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { TripCard, tripTitle } from "@/components/trips/TripCard";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, Notice } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/Field";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { AMBIENTE_LABEL } from "@/data/especies";
import { getDb } from "@/lib/db";
import { endTrip, getActiveTrip, getSetting, quickStartTrip, setSetting, startTrip } from "@/lib/db/repo";
import type { Ambiente, FishingSpot, FishingTrip } from "@/lib/db/schema";
import { haversineKm } from "@/lib/geo/distance";
import { getCurrentPosition, tryGetPosition } from "@/lib/geo/geolocation";
import { formatDuration } from "@/lib/utils/dates";

export function HomeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const profile = useCurrentProfile();

  // `getActiveTrip` devolve null quando não há pescaria ativa, para não
  // confundir "nada ativo" com "ainda carregando".
  const active = useLiveQuery(() => getActiveTrip(profile.id), [profile.id]);
  const upcoming = useLiveQuery(async () => {
    const list = await getDb().trips.where({ profileId: profile.id, status: "planejada" }).sortBy("plannedAt");
    const cutoff = Date.now() - 12 * 3600_000;
    return list.filter((t) => new Date(t.plannedAt).getTime() >= cutoff);
  }, [profile.id]);
  const spots = useLiveQuery(
    () => getDb().spots.where("profileId").equals(profile.id).toArray(),
    [profile.id],
  );
  const activeCatches = useLiveQuery(
    async () => (active ? getDb().catches.where("tripId").equals(active.id).count() : 0),
    [active?.id],
  );

  // Atalho do manifest: "/?acao=captura" leva direto ao formulário se há sessão ativa.
  useEffect(() => {
    if (params.get("acao") === "captura" && active) router.replace(`/captura?trip=${active.id}`);
  }, [params, active, router]);

  if (active === undefined || upcoming === undefined) return <ScreenLoading />;

  return (
    <div className="flex flex-col gap-5">
      {active ? (
        <ActiveTripCard trip={active} catchCount={activeCatches ?? 0} />
      ) : (
        <QuickStartCard profileId={profile.id} spots={spots ?? []} />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Próximas pescarias</CardTitle>
          <Button href="/planejar" variant="ghost" size="sm">+ Planejar</Button>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Nenhuma pescaria planejada"
            description="Escolha data e local para ver clima, previsão de pesca e receber um lembrete."
            action={<Button href="/planejar" variant="primary">Planejar pescaria</Button>}
          />
        ) : (
          upcoming.map((trip) => (
            <TripCard key={trip.id} trip={trip} actions={!active ? <StartButton trip={trip} /> : undefined} />
          ))
        )}
      </section>
    </div>
  );
}

function StartButton({ trip }: { trip: FishingTrip }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      variant="primary"
      fullWidth
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const pos = await tryGetPosition(8000);
        await startTrip(trip.id, pos);
        router.push(`/pescaria?id=${trip.id}`);
      }}
      icon={<span aria-hidden>▶️</span>}
    >
      Iniciar pescaria
    </Button>
  );
}

function ActiveTripCard({ trip, catchCount }: { trip: FishingTrip; catchCount: number }) {
  const router = useRouter();
  const [, force] = useState(0);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function finish() {
    if (!confirm("Encerrar a pescaria agora?")) return;
    setEnding(true);
    const pos = await tryGetPosition(8000);
    await endTrip(trip.id, pos);
    router.push(`/pescaria?id=${trip.id}`);
  }

  return (
    <Card className="border-accent/60 bg-gradient-to-br from-surface to-accent/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-accent-strong">
            <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden /> Pescaria em andamento
          </div>
          <h2 className="mt-1 truncate text-xl font-extrabold">{tripTitle(trip)}</h2>
          <p className="text-sm text-muted">
            {trip.startedAt ? `Há ${formatDuration(trip.startedAt)}` : ""} · {catchCount} {catchCount === 1 ? "captura" : "capturas"}
          </p>
        </div>
        <Button href={`/pescaria?id=${trip.id}`} variant="ghost" size="sm">Detalhes</Button>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button href={`/captura?trip=${trip.id}`} variant="accent" size="xl" fullWidth icon={<span aria-hidden>🐟</span>}>
          Registrar captura
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={finish} loading={ending}>
          Encerrar pescaria
        </Button>
      </div>
    </Card>
  );
}

function QuickStartCard({ profileId, spots }: { profileId: string; spots: FishingSpot[] }) {
  const router = useRouter();
  const [ambiente, setAmbiente] = useState<Ambiente>("agua_doce");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSetting<Ambiente>("lastAmbiente", "agua_doce").then(setAmbiente);
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const fix = await getCurrentPosition({ timeoutMs: 12_000 });
      // Se estiver a menos de 1 km de um spot salvo, associa automaticamente.
      const near = spots
        .map((s) => ({ s, d: haversineKm(fix, s) }))
        .filter((x) => x.d <= 1)
        .sort((a, b) => a.d - b.d)[0]?.s;
      await setSetting("lastAmbiente", near?.ambiente ?? ambiente);
      const trip = await quickStartTrip({
        profileId,
        lat: fix.lat,
        lng: fix.lng,
        ambiente: near?.ambiente ?? ambiente,
        locationName: near?.name,
        spotId: near?.id,
      });
      router.push(`/pescaria?id=${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível obter sua localização.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Pescar agora</CardTitle>
      <p className="mt-1 text-sm text-muted">Inicia uma sessão no seu local atual, sem planejar antes.</p>
      <div className="mt-3">
        <SegmentedControl
          ariaLabel="Ambiente"
          value={ambiente}
          onChange={setAmbiente}
          options={[
            { value: "agua_doce", label: AMBIENTE_LABEL.agua_doce, icon: <span aria-hidden>🏞️</span> },
            { value: "mar", label: AMBIENTE_LABEL.mar, icon: <span aria-hidden>🌊</span> },
          ]}
        />
      </div>
      {error && <Notice tone="danger" className="mt-3">{error} <a className="underline" href="/planejar?agora=1">Escolher local no mapa</a>.</Notice>}
      <Button className="mt-3" variant="primary" size="xl" fullWidth onClick={start} loading={busy} icon={<span aria-hidden>🎣</span>}>
        Iniciar pescaria aqui
      </Button>
    </Card>
  );
}
