"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Notice } from "@/components/ui/Card";
import { Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { WeatherPanel } from "@/components/weather/WeatherPanel";
import { AMBIENTE_LABEL } from "@/data/especies";
import { getDb } from "@/lib/db";
import { createSpot, createTrip, setSetting } from "@/lib/db/repo";
import type { Ambiente, FishingSpot, WeatherSnapshot } from "@/lib/db/schema";
import { useNotificationPermission } from "@/lib/hooks/useNotificationPermission";
import { useOnline } from "@/lib/hooks/useOnline";
import { REMINDER_OPTIONS, requestNotificationPermission } from "@/lib/notifications/reminders";
import { fromDateTimeLocalValue, toDateTimeLocalValue, toLocalDateKey } from "@/lib/utils/dates";
import { fetchWeatherSnapshot } from "@/lib/weather/openMeteo";

function defaultPlannedAt(now: boolean): string {
  const d = new Date();
  if (!now) {
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
  }
  return toDateTimeLocalValue(d);
}

/** Espera os spots carregarem para resolver a pré-seleção (/planejar?spot=…). */
export function PlanScreen() {
  const params = useSearchParams();
  const profile = useCurrentProfile();
  const spots = useLiveQuery(
    async () => (await getDb().spots.where("profileId").equals(profile.id).toArray()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [profile.id],
  );
  if (spots === undefined) return <ScreenLoading />;
  const spotId = params.get("spot");
  const initialSpot = spotId ? spots.find((s) => s.id === spotId) : undefined;
  return <PlanForm profileId={profile.id} spots={spots} initialSpot={initialSpot} startNow={params.get("agora") === "1"} />;
}

function PlanForm({
  profileId,
  spots,
  initialSpot,
  startNow,
}: {
  profileId: string;
  spots: FishingSpot[];
  initialSpot?: FishingSpot;
  startNow: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const permission = useNotificationPermission();

  const [plannedAt, setPlannedAt] = useState(() => defaultPlannedAt(startNow));
  const [location, setLocation] = useState<LocationValue | null>(
    initialSpot ? { lat: initialSpot.lat, lng: initialSpot.lng, name: initialSpot.name, spotId: initialSpot.id } : null,
  );
  const [ambiente, setAmbiente] = useState<Ambiente>(initialSpot?.ambiente ?? "agua_doce");
  const [title, setTitle] = useState("");
  const [reminder, setReminder] = useState<string>("180");
  const [notes, setNotes] = useState("");
  const [saveAsSpot, setSaveAsSpot] = useState(false);
  const [spotName, setSpotName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const weatherAbort = useRef<AbortController | null>(null);

  function handleLocationChange(v: LocationValue) {
    setLocation(v);
    // Escolher um spot salvo define o ambiente automaticamente.
    if (v.spotId) {
      const spot = spots.find((s) => s.id === v.spotId);
      if (spot) setAmbiente(spot.ambiente);
    }
  }

  // Clima: busca automática (com debounce) ao mudar local ou data, quando online.
  const dateKey = plannedAt ? toLocalDateKey(fromDateTimeLocalValue(plannedAt)) : "";
  const lat = location?.lat;
  const lng = location?.lng;
  useEffect(() => {
    if (lat == null || lng == null || !dateKey || !online) return;
    const t = setTimeout(() => void loadWeather(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, dateKey, online]);

  async function loadWeather() {
    if (!location) return;
    weatherAbort.current?.abort();
    const ctrl = new AbortController();
    weatherAbort.current = ctrl;
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const snap = await fetchWeatherSnapshot(location.lat, location.lng, fromDateTimeLocalValue(plannedAt), ctrl.signal);
      if (!ctrl.signal.aborted) setWeather(snap);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setWeather(null);
      setWeatherError(err instanceof Error ? err.message : "Não foi possível obter o clima.");
    } finally {
      if (!ctrl.signal.aborted) setWeatherLoading(false);
    }
  }

  async function save() {
    if (!location) return setError("Escolha o local da pescaria.");
    if (!plannedAt) return setError("Informe data e hora.");
    setSaving(true);
    setError(null);
    try {
      let spotId = location.spotId;
      if (!spotId && saveAsSpot) {
        const spot = await createSpot({
          profileId,
          name: spotName.trim() || location.name || "Novo spot",
          lat: location.lat,
          lng: location.lng,
          ambiente,
        });
        spotId = spot.id;
      }
      const reminderMinutes = reminder === "" ? null : Number(reminder);
      if (reminderMinutes != null && permission === "default") await requestNotificationPermission();
      await setSetting("lastAmbiente", ambiente);
      const trip = await createTrip({
        profileId,
        plannedAt: fromDateTimeLocalValue(plannedAt).toISOString(),
        lat: location.lat,
        lng: location.lng,
        ambiente,
        locationName: location.name,
        spotId,
        title: title.trim() || undefined,
        weather: weather ?? undefined,
        reminderMinutesBefore: reminderMinutes,
        notes: notes.trim() || undefined,
      });
      router.replace(`/pescaria?id=${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
      setSaving(false);
    }
  }

  const offlineWeatherMsg = location && !online && !weather ? "Sem conexão: o clima será consultado quando a internet voltar." : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Planejar pescaria" subtitle="Data, local, clima e previsão de pesca" />

      <Card className="flex flex-col gap-4">
        <Field label="Quando" htmlFor="plannedAt">
          <Input id="plannedAt" type="datetime-local" value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} required />
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

        <Field label="Onde">
          <LocationPicker value={location} onChange={handleLocationChange} spots={spots} />
        </Field>

        {location && !location.spotId && (
          <label className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium">
            <input type="checkbox" className="size-5 accent-brand" checked={saveAsSpot} onChange={(e) => setSaveAsSpot(e.target.checked)} />
            Salvar este local como spot
          </label>
        )}
        {saveAsSpot && location && !location.spotId && (
          <Field label="Nome do spot" htmlFor="spotName">
            <Input id="spotName" value={spotName} onChange={(e) => setSpotName(e.target.value)} placeholder={location.name ?? "Ex.: Ponte do rio"} />
          </Field>
        )}
      </Card>

      {location && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Clima e previsão</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadWeather} loading={weatherLoading} disabled={!online}>
              Atualizar
            </Button>
          </div>
          {offlineWeatherMsg && <Notice tone="muted">{offlineWeatherMsg}</Notice>}
          {weatherError && <Notice tone="warning">{weatherError}</Notice>}
          {weatherLoading && !weather && <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />}
          {weather && <WeatherPanel snapshot={weather} plannedAt={fromDateTimeLocalValue(plannedAt).toISOString()} />}
        </section>
      )}

      <Card className="flex flex-col gap-4">
        <Field label="Nome da pescaria (opcional)" htmlFor="title">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Tucunaré na represa" />
        </Field>
        <Field label="Lembrete" htmlFor="reminder" hint={permission === "denied" ? "Notificações bloqueadas no navegador." : undefined}>
          <Select id="reminder" value={reminder} onChange={(e) => setReminder(e.target.value)}>
            <option value="">Sem lembrete</option>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Iscas, companhia, ponto de encontro…" />
        </Field>
      </Card>

      {error && <Notice tone="danger">{error}</Notice>}

      <Button variant="primary" size="xl" fullWidth onClick={save} loading={saving} disabled={!location}>
        Salvar pescaria
      </Button>
    </div>
  );
}
