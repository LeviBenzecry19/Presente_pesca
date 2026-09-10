"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatchCard } from "@/components/catches/CatchCard";
import MapPicker from "@/components/map/MapPickerLazy";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { STATUS_LABEL, tripTitle } from "@/components/trips/TripCard";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardTitle, EmptyState, Notice, Stat } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { WeatherPanel } from "@/components/weather/WeatherPanel";
import { speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import { deleteTrip, endTrip, getActiveTrip, reopenTrip, startTrip, updateTrip } from "@/lib/db/repo";
import type { Catch, ChecklistItem, FishingTrip } from "@/lib/db/schema";
import { tryGetPosition } from "@/lib/geo/geolocation";
import { useOnline } from "@/lib/hooks/useOnline";
import { REMINDER_OPTIONS, notificationPermission, requestNotificationPermission } from "@/lib/notifications/reminders";
import { formatDateTime, formatDuration, fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/utils/dates";
import { formatCoords, formatWeight } from "@/lib/utils/format";
import { newId } from "@/lib/utils/ids";
import { fetchWeatherSnapshot } from "@/lib/weather/openMeteo";

const CHECKLIST_SUGGESTIONS = ["Licença de pesca", "Iscas", "Protetor solar", "Água e comida", "Alicate e faca", "Lanterna", "Capa de chuva", "Boia/colete"];

export function TripScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const online = useOnline();
  const profile = useCurrentProfile();

  // `undefined` = carregando; `null` = não existe (ou é de outro perfil).
  const trip = useLiveQuery(async () => {
    if (!id) return null;
    const found = await getDb().trips.get(id);
    return found && found.profileId === profile.id ? found : null;
  }, [id, profile.id]);
  const catches = useLiveQuery(
    async () => (id ? getDb().catches.where("tripId").equals(id).reverse().sortBy("caughtAt") : ([] as Catch[])),
    [id],
  );
  // null = não há pescaria ativa; undefined = ainda carregando (ver HomeScreen).
  const otherActive = useLiveQuery(() => getActiveTrip(profile.id), [profile.id]);

  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [weatherMsg, setWeatherMsg] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (trip?.status !== "em_andamento") return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [trip?.status]);

  if (!id) return <Notice tone="danger">Pescaria não informada.</Notice>;
  if (trip === undefined || catches === undefined) return <ScreenLoading />;
  if (trip === null) {
    return (
      <EmptyState
        icon="🤷"
        title="Pescaria não encontrada"
        description="Ela pode ter sido excluída, ou pertence a outro perfil."
        action={<Button href="/">Voltar ao início</Button>}
      />
    );
  }

  const status = STATUS_LABEL[trip.status];
  const blockedByOther = !!otherActive && otherActive.id !== trip.id;

  async function start() {
    setBusy("start");
    const pos = await tryGetPosition(8000);
    await startTrip(trip!.id, pos);
    setBusy(null);
  }
  async function finish() {
    if (!confirm("Encerrar a pescaria agora?")) return;
    setBusy("end");
    const pos = await tryGetPosition(8000);
    await endTrip(trip!.id, pos);
    setBusy(null);
  }
  async function remove() {
    if (!confirm("Excluir esta pescaria e todas as capturas dela? Essa ação não pode ser desfeita.")) return;
    await deleteTrip(trip!.id);
    router.replace("/");
  }
  async function refreshWeather() {
    setBusy("weather");
    setWeatherMsg(null);
    try {
      const snap = await fetchWeatherSnapshot(trip!.lat, trip!.lng, new Date(trip!.plannedAt));
      await updateTrip(trip!.id, { weather: snap });
    } catch (err) {
      setWeatherMsg(err instanceof Error ? err.message : "Falha ao atualizar o clima.");
    } finally {
      setBusy(null);
    }
  }
  async function setReminder(value: string) {
    const minutes = value === "" ? null : Number(value);
    if (minutes != null && notificationPermission() === "default") await requestNotificationPermission();
    await updateTrip(trip!.id, { reminderMinutesBefore: minutes, reminderFiredAt: undefined });
  }

  const biggest = catches.reduce<Catch | null>((best, c) => (c.weightKg != null && (best?.weightKg ?? -1) < c.weightKg ? c : best), null);
  const catchPoints = catches.filter((c) => c.lat != null && c.lng != null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={tripTitle(trip)}
        back="/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{formatDateTime(trip.plannedAt)}</span>
          </span>
        }
        actions={<Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Fechar" : "Editar"}</Button>}
      />

      {editing && <TripEditor trip={trip} onDone={() => setEditing(false)} />}

      {/* Ações principais por status */}
      {trip.status === "planejada" && (
        <Card className="flex flex-col gap-3">
          <Button variant="primary" size="xl" fullWidth onClick={start} loading={busy === "start"} disabled={blockedByOther} icon={<span aria-hidden>▶️</span>}>
            Iniciar pescaria
          </Button>
          {blockedByOther && <Notice tone="muted">Você já tem uma pescaria em andamento. Encerre-a antes de iniciar esta.</Notice>}
          <Field label="Lembrete" htmlFor="reminder">
            <Select id="reminder" value={trip.reminderMinutesBefore == null ? "" : String(trip.reminderMinutesBefore)} onChange={(e) => setReminder(e.target.value)}>
              <option value="">Sem lembrete</option>
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
        </Card>
      )}

      {trip.status === "em_andamento" && (
        <Card className="flex flex-col gap-2 border-accent/60 bg-gradient-to-br from-surface to-accent/10">
          <p className="text-sm text-muted">
            Iniciada {trip.startedAt ? `há ${formatDuration(trip.startedAt)}` : ""} · {catches.length} {catches.length === 1 ? "captura" : "capturas"}
          </p>
          <Button href={`/captura?trip=${trip.id}`} variant="accent" size="xl" fullWidth icon={<span aria-hidden>🐟</span>}>
            Registrar captura
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={finish} loading={busy === "end"}>
            Encerrar pescaria
          </Button>
        </Card>
      )}

      {trip.status === "concluida" && (
        <Card>
          <CardTitle>Resumo</CardTitle>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Duração" value={trip.startedAt && trip.endedAt ? formatDuration(trip.startedAt, trip.endedAt) : "—"} />
            <Stat label="Capturas" value={catches.length} />
            <Stat label="Maior" value={biggest ? formatWeight(biggest.weightKg) : "—"} sub={biggest ? speciesName(biggest.speciesId, biggest.speciesCustom) : undefined} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button href={`/captura?trip=${trip.id}`} variant="outline" className="flex-1">+ Adicionar captura</Button>
            <Button variant="ghost" onClick={() => reopenTrip(trip.id)} disabled={blockedByOther}>Reabrir</Button>
          </div>
        </Card>
      )}

      {/* Capturas */}
      {(trip.status !== "planejada" || catches.length > 0) && (
        <section className="flex flex-col gap-3">
          <CardTitle>Capturas ({catches.length})</CardTitle>
          {catches.length === 0 ? (
            <EmptyState icon="🐟" title="Nenhuma captura ainda" description="Quando fisgar, toque em Registrar captura." />
          ) : (
            <ul className="flex flex-col gap-2">
              {catches.map((c) => (
                <li key={c.id}><CatchCard item={c} /></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Checklist */}
      {trip.status !== "concluida" && <Checklist trip={trip} />}

      {/* Clima */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Clima e previsão</CardTitle>
          {trip.status !== "concluida" && (
            <Button variant="ghost" size="sm" onClick={refreshWeather} loading={busy === "weather"} disabled={!online}>
              {trip.weather ? "Atualizar" : "Buscar clima"}
            </Button>
          )}
        </div>
        {weatherMsg && <Notice tone="warning">{weatherMsg}</Notice>}
        {trip.weather ? (
          <WeatherPanel snapshot={trip.weather} plannedAt={trip.plannedAt} />
        ) : (
          <Notice tone="muted">{online ? "Clima ainda não consultado para esta pescaria." : "Sem conexão para consultar o clima."}</Notice>
        )}
      </section>

      {/* Local */}
      <section className="flex flex-col gap-2">
        <CardTitle>Local</CardTitle>
        <div className="h-48">
          <MapPicker
            value={{ lat: trip.lat, lng: trip.lng }}
            interactive={false}
            zoom={13}
            className="h-full"
            spots={catchPoints.map((c) => ({
              id: c.id,
              name: speciesName(c.speciesId, c.speciesCustom),
              lat: c.lat!,
              lng: c.lng!,
            }))}
          />
        </div>
        <p className="text-xs text-muted">
          {trip.locationName && <span className="font-semibold text-foreground">{trip.locationName} · </span>}
          {formatCoords(trip.lat, trip.lng)}
          {catchPoints.length > 0 && <> · {catchPoints.length} {catchPoints.length === 1 ? "captura marcada" : "capturas marcadas"}</>}
        </p>
      </section>

      {trip.notes && (
        <Card>
          <CardTitle>Observações</CardTitle>
          <p className="mt-1 whitespace-pre-wrap text-sm">{trip.notes}</p>
        </Card>
      )}

      <Button variant="ghost" size="sm" onClick={remove} className="self-center text-danger">
        Excluir pescaria
      </Button>
    </div>
  );
}

function TripEditor({ trip, onDone }: { trip: FishingTrip; onDone: () => void }) {
  const [title, setTitle] = useState(trip.title ?? "");
  const [plannedAt, setPlannedAt] = useState(toDateTimeLocalValue(trip.plannedAt));
  const [notes, setNotes] = useState(trip.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const newPlanned = fromDateTimeLocalValue(plannedAt).toISOString();
    await updateTrip(trip.id, {
      title: title.trim() || undefined,
      plannedAt: newPlanned,
      notes: notes.trim() || undefined,
      // Mudou a data: lembrete volta a valer e o clima precisa ser reconsultado.
      ...(newPlanned !== trip.plannedAt ? { reminderFiredAt: undefined, weather: undefined } : {}),
    });
    onDone();
  }

  return (
    <Card className="flex flex-col gap-3 border-brand">
      <Field label="Nome" htmlFor="edit-title">
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Tucunaré na represa" />
      </Field>
      {trip.status === "planejada" && (
        <Field label="Quando" htmlFor="edit-when">
          <Input id="edit-when" type="datetime-local" value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} />
        </Field>
      )}
      <Field label="Observações" htmlFor="edit-notes">
        <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onDone} className="flex-1">Cancelar</Button>
        <Button variant="primary" onClick={save} loading={saving} className="flex-1">Salvar</Button>
      </div>
    </Card>
  );
}

function Checklist({ trip }: { trip: FishingTrip }) {
  const [text, setText] = useState("");
  const items = trip.checklist ?? [];
  const done = items.filter((i) => i.done).length;

  const persist = (next: ChecklistItem[]) => updateTrip(trip.id, { checklist: next });
  const add = (label: string) => {
    const l = label.trim();
    if (!l || items.some((i) => i.label.toLowerCase() === l.toLowerCase())) return;
    void persist([...items, { id: newId(), label: l, done: false }]);
    setText("");
  };
  const suggestions = CHECKLIST_SUGGESTIONS.filter((s) => !items.some((i) => i.label.toLowerCase() === s.toLowerCase()));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Checklist</CardTitle>
        {items.length > 0 && <span className="text-xs font-bold text-muted">{done}/{items.length}</span>}
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
              <input
                id={`chk-${item.id}`}
                type="checkbox"
                className="size-6 accent-brand"
                checked={item.done}
                onChange={(e) => persist(items.map((i) => (i.id === item.id ? { ...i, done: e.target.checked } : i)))}
              />
              <label htmlFor={`chk-${item.id}`} className={`flex-1 text-base ${item.done ? "line-through text-muted" : ""}`}>{item.label}</label>
              <button type="button" aria-label={`Remover ${item.label}`} className="px-2 text-muted" onClick={() => persist(items.filter((i) => i.id !== item.id))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted hover:bg-surface-2">
              + {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Novo item…" aria-label="Novo item do checklist" />
        <Button type="submit" variant="secondary">Adicionar</Button>
      </form>
    </Card>
  );
}
