"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Notice } from "@/components/ui/Card";
import { Field, Input, SegmentedControl, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { AMBIENTE_LABEL } from "@/data/especies";
import { getDb } from "@/lib/db";
import { createSpot, deleteSpot, getActiveTrip, quickStartTrip, updateSpot } from "@/lib/db/repo";
import type { Ambiente, FishingSpot, LatLng } from "@/lib/db/schema";
import { formatDistanceKm, haversineKm } from "@/lib/geo/distance";
import { tryGetPosition } from "@/lib/geo/geolocation";
import { formatCoords } from "@/lib/utils/format";

export function SpotsScreen() {
  const router = useRouter();
  const profile = useCurrentProfile();
  const spots = useLiveQuery(
    async () => (await getDb().spots.where("profileId").equals(profile.id).toArray()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [profile.id],
  );
  // null = não há pescaria ativa; undefined = ainda carregando (ver HomeScreen).
  const active = useLiveQuery(() => getActiveTrip(profile.id), [profile.id]);
  const [editing, setEditing] = useState<FishingSpot | "new" | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  if (spots === undefined) return <ScreenLoading />;

  const sorted = userPos
    ? [...spots].sort((a, b) => haversineKm(userPos, a) - haversineKm(userPos, b))
    : spots;

  async function sortByDistance() {
    setLocating(true);
    setUserPos(await tryGetPosition());
    setLocating(false);
  }

  async function startHere(spot: FishingSpot) {
    setStarting(spot.id);
    const trip = await quickStartTrip({
      profileId: profile.id,
      lat: spot.lat,
      lng: spot.lng,
      ambiente: spot.ambiente,
      locationName: spot.name,
      spotId: spot.id,
    });
    router.push(`/pescaria?id=${trip.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Meus spots"
        subtitle="Locais salvos para planejar mais rápido"
        actions={!editing && <Button variant="primary" size="sm" onClick={() => setEditing("new")}>+ Novo</Button>}
      />

      {editing && (
        <SpotForm
          profileId={profile.id}
          initial={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {spots.length === 0 && !editing ? (
        <EmptyState
          icon="📌"
          title="Nenhum spot salvo"
          description="Salve seus pontos recorrentes para planejar e iniciar pescarias com um toque."
          action={<Button variant="primary" onClick={() => setEditing("new")}>Adicionar spot</Button>}
        />
      ) : (
        <>
          {spots.length > 1 && (
            <Button variant="ghost" size="sm" onClick={sortByDistance} loading={locating} className="self-start">
              📍 Ordenar por distância
            </Button>
          )}
          <ul className="flex flex-col gap-3">
            {sorted.map((spot) => (
              <li key={spot.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">{spot.name}</h3>
                      <p className="text-xs text-muted">
                        {spot.ambiente === "mar" ? "🌊" : "🏞️"} {AMBIENTE_LABEL[spot.ambiente]} · {formatCoords(spot.lat, spot.lng)}
                        {userPos && <> · {formatDistanceKm(haversineKm(userPos, spot))}</>}
                      </p>
                      {spot.notes && <p className="mt-1 text-sm">{spot.notes}</p>}
                    </div>
                    <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand" onClick={() => setEditing(spot)}>
                      Editar
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button href={`/planejar?spot=${spot.id}`} variant="outline" size="md">📅 Planejar</Button>
                    <Button variant="primary" size="md" onClick={() => startHere(spot)} loading={starting === spot.id} disabled={!!active}>
                      🎣 Pescar agora
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {active && <Notice tone="muted">Há uma pescaria em andamento; encerre-a para iniciar outra.</Notice>}
        </>
      )}
    </div>
  );
}

function SpotForm({
  profileId,
  initial,
  onDone,
}: {
  profileId: string;
  initial: FishingSpot | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ambiente, setAmbiente] = useState<Ambiente>(initial?.ambiente ?? "agua_doce");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [location, setLocation] = useState<LocationValue | null>(initial ? { lat: initial.lat, lng: initial.lng, name: initial.name } : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Dê um nome ao spot.");
    if (!location) return setError("Marque o local no mapa ou use o GPS.");
    setSaving(true);
    try {
      const data = { name: name.trim(), lat: location.lat, lng: location.lng, ambiente, notes: notes.trim() || undefined };
      if (initial) await updateSpot(initial.id, data);
      else await createSpot({ profileId, ...data });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial || !confirm(`Excluir o spot "${initial.name}"?`)) return;
    await deleteSpot(initial.id);
    onDone();
  }

  return (
    <Card className="flex flex-col gap-4 border-brand">
      <h2 className="text-lg font-bold">{initial ? "Editar spot" : "Novo spot"}</h2>
      <Field label="Nome" htmlFor="spot-name">
        <Input id="spot-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Barranco da curva" autoFocus />
      </Field>
      <Field label="Ambiente">
        <SegmentedControl
          ariaLabel="Ambiente"
          value={ambiente}
          onChange={setAmbiente}
          options={[
            { value: "agua_doce", label: AMBIENTE_LABEL.agua_doce, icon: <span aria-hidden>🏞️</span> },
            { value: "mar", label: AMBIENTE_LABEL.mar, icon: <span aria-hidden>🌊</span> },
          ]}
        />
      </Field>
      <Field label="Local">
        <LocationPicker value={location} onChange={(v) => setLocation({ lat: v.lat, lng: v.lng, name: v.name })} mapHeight="h-56" />
      </Field>
      <Field label="Observações" htmlFor="spot-notes">
        <Textarea id="spot-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Acesso, profundidade, melhores iscas…" />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onDone} className="flex-1">Cancelar</Button>
        <Button variant="primary" onClick={save} loading={saving} className="flex-1">Salvar</Button>
      </div>
      {initial && (
        <Button variant="ghost" size="sm" onClick={remove} className="self-center text-danger">
          Excluir spot
        </Button>
      )}
    </Card>
  );
}
