"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import MapPicker from "@/components/map/MapPickerLazy";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, EmptyState, Notice } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { OUTRA_ESPECIE_ID, getSpecies, speciesForAmbiente, speciesName } from "@/data/especies";
import { getDb } from "@/lib/db";
import { createCatch, deleteCatch, updateCatch } from "@/lib/db/repo";
import type { Catch, FishingTrip, LatLng } from "@/lib/db/schema";
import { tryGetPosition } from "@/lib/geo/geolocation";
import { useObjectUrl } from "@/lib/hooks/useObjectUrl";
import { formatCoords, parseDecimal } from "@/lib/utils/format";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/utils/dates";
import { compressImage } from "@/lib/utils/photo";

/** Quantas capturas anteriores olhamos para montar os atalhos de espécie. */
const RECENT_LOOKBACK = 20;
const RECENT_CHIPS = 6;

type Loaded =
  | { state: "sem-pescaria" }
  | { state: "pescaria-sumiu" }
  | { state: "captura-sumiu"; trip: FishingTrip }
  | { state: "pronto"; trip: FishingTrip; item: Catch | null; recent: Catch[] };

/**
 * Registro de captura. Entidade por query string (/captura?trip=…&id=…) para
 * que o service worker sirva a mesma tela para qualquer pescaria offline —
 * sem `id`, é uma captura nova.
 */
export function CatchFormScreen() {
  const params = useSearchParams();
  const tripId = params.get("trip") ?? "";
  const catchId = params.get("id") ?? "";
  const profile = useCurrentProfile();
  // Cada "salvar e registrar outra" troca a chave do formulário, que reinicia
  // limpo (inclusive com um novo GPS) sem sair da tela.
  const [round, setRound] = useState(0);
  const [savedName, setSavedName] = useState<string | null>(null);

  const data = useLiveQuery<Loaded>(async () => {
    if (!tripId) return { state: "sem-pescaria" };
    const db = getDb();
    const trip = await db.trips.get(tripId);
    if (!trip || trip.profileId !== profile.id) return { state: "pescaria-sumiu" };

    let item: Catch | null = null;
    if (catchId) {
      const found = await db.catches.get(catchId);
      if (!found || found.tripId !== tripId || found.profileId !== profile.id) {
        return { state: "captura-sumiu", trip };
      }
      item = found;
    }

    // Índice composto: pega só as últimas capturas, sem varrer o histórico todo.
    const recent = await db.catches
      .where("[profileId+caughtAt]")
      .between([profile.id, Dexie.minKey], [profile.id, Dexie.maxKey])
      .reverse()
      .limit(RECENT_LOOKBACK)
      .toArray();
    return { state: "pronto", trip, item, recent };
  }, [tripId, catchId, profile.id]);

  if (data === undefined) return <ScreenLoading />;

  if (data.state === "sem-pescaria") {
    return (
      <EmptyState
        icon={<Icon name="fish" size={42} />}
        title="Pescaria não informada"
        description="Toda captura pertence a uma pescaria. Abra a pescaria e toque em Registrar captura."
        action={<Button href="/">Ir para o início</Button>}
      />
    );
  }
  if (data.state === "pescaria-sumiu") {
    return (
      <EmptyState
        icon="🤷"
        title="Pescaria não encontrada"
        description="Ela pode ter sido excluída, ou pertence a outro perfil."
        action={<Button href="/">Voltar ao início</Button>}
      />
    );
  }
  if (data.state === "captura-sumiu") {
    return (
      <EmptyState
        icon="🤷"
        title="Captura não encontrada"
        description="Ela pode ter sido excluída deste aparelho."
        action={<Button href={`/pescaria?id=${encodeURIComponent(data.trip.id)}`}>Voltar para a pescaria</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {savedName && (
        <Notice tone="success">
          {savedName} registrado. Bora pra próxima! 🎣
        </Notice>
      )}
      <CatchForm
        key={data.item ? data.item.id : `nova-${round}`}
        profileId={profile.id}
        trip={data.trip}
        item={data.item}
        recent={data.recent}
        onSavedAnother={(name) => {
          setSavedName(name);
          setRound((n) => n + 1);
        }}
      />
    </div>
  );
}

/** Horário sugerido: agora na pescaria em andamento, o fim numa já concluída. */
function defaultCaughtAt(trip: FishingTrip): Date {
  if (trip.status === "concluida" && trip.endedAt) return new Date(trip.endedAt);
  if (trip.status === "planejada") return new Date(trip.plannedAt);
  return new Date();
}

function decimalValue(n?: number | null): string {
  return n == null || Number.isNaN(n) ? "" : String(n).replace(".", ",");
}

/** Origem das coordenadas — muda só o texto de apoio, não o que é salvo. */
type PosSource = "nenhuma" | "salva" | "pescaria" | "gps" | "mapa";

const POS_LABEL: Record<PosSource, string> = {
  nenhuma: "Sem local marcado",
  salva: "Local salvo com esta captura",
  pescaria: "Local da pescaria",
  gps: "Local do GPS",
  mapa: "Ajustado no mapa",
};

interface FormErrors {
  species?: string;
  custom?: string;
  weight?: string;
  length?: string;
  caughtAt?: string;
}

function CatchForm({
  profileId,
  trip,
  item,
  recent,
  onSavedAnother,
}: {
  profileId: string;
  trip: FishingTrip;
  item: Catch | null;
  recent: Catch[];
  onSavedAnother: (speciesLabel: string) => void;
}) {
  const router = useRouter();
  const tripHref = `/pescaria?id=${encodeURIComponent(trip.id)}`;

  const [speciesId, setSpeciesId] = useState(() => item?.speciesId ?? "");
  const [speciesCustom, setSpeciesCustom] = useState(() => item?.speciesCustom ?? "");
  const [weight, setWeight] = useState(() => decimalValue(item?.weightKg));
  const [length, setLength] = useState(() => decimalValue(item?.lengthCm));
  const [caughtAt, setCaughtAt] = useState(() =>
    toDateTimeLocalValue(item ? new Date(item.caughtAt) : defaultCaughtAt(trip)),
  );
  const [bait, setBait] = useState(() => item?.bait ?? "");
  const [notes, setNotes] = useState(() => item?.notes ?? "");
  const [photo, setPhoto] = useState<Blob | null>(() =>
    item?.photo instanceof Blob && item.photo.size > 0 ? item.photo : null,
  );
  const [photoBusy, setPhotoBusy] = useState(false);

  const [position, setPosition] = useState<LatLng | null>(() => {
    if (item) return item.lat != null && item.lng != null ? { lat: item.lat, lng: item.lng } : null;
    return { lat: trip.lat, lng: trip.lng };
  });
  const [posSource, setPosSource] = useState<PosSource>(() => {
    if (!item) return "pescaria";
    return item.lat != null && item.lng != null ? "salva" : "nenhuma";
  });
  // Numa captura nova o GPS já sai buscando: menos um toque com a mão molhada.
  const [locating, setLocating] = useState(() => !item);
  const [showMap, setShowMap] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "again" | "delete" | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const photoUrl = useObjectUrl(photo);
  const isNew = item === null;

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    void tryGetPosition(10_000).then((fix) => {
      if (cancelled) return;
      if (fix) {
        setPosition({ lat: fix.lat, lng: fix.lng });
        setPosSource("gps");
      }
      setLocating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isNew]);

  const { here, elsewhere } = useMemo(() => {
    const local = speciesForAmbiente(trip.ambiente);
    const ids = new Set(local.map((s) => s.id));
    return { here: local, elsewhere: speciesForAmbiente("todos").filter((s) => !ids.has(s.id)) };
  }, [trip.ambiente]);

  // Atalhos: primeiro o que já saiu nesta pescaria, depois o histórico do perfil.
  const chips = useMemo(() => {
    const seen = new Map<string, { speciesId: string; speciesCustom?: string; label: string }>();
    const ordered = [...recent].sort((a, b) => Number(b.tripId === trip.id) - Number(a.tripId === trip.id));
    for (const c of ordered) {
      const label = speciesName(c.speciesId, c.speciesCustom);
      const key = c.speciesId === OUTRA_ESPECIE_ID ? `outra:${label.toLocaleLowerCase("pt-BR")}` : c.speciesId;
      if (!seen.has(key)) seen.set(key, { speciesId: c.speciesId, speciesCustom: c.speciesCustom, label });
      if (seen.size >= RECENT_CHIPS) break;
    }
    return [...seen.values()];
  }, [recent, trip.id]);

  const chosen = getSpecies(speciesId);
  const baitHints = chosen?.iscas ?? [];
  const label = speciesId ? speciesName(speciesId, speciesCustom) : "";

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher a mesma foto de novo
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await compressImage(file));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function useGps() {
    setLocating(true);
    const fix = await tryGetPosition(12_000);
    if (fix) {
      setPosition({ lat: fix.lat, lng: fix.lng });
      setPosSource("gps");
    }
    setLocating(false);
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!speciesId) next.species = "Escolha a espécie.";
    if (speciesId === OUTRA_ESPECIE_ID && !speciesCustom.trim()) next.custom = "Diga qual peixe foi.";

    const kg = parseDecimal(weight.trim());
    if (weight.trim() && (kg === undefined || kg <= 0)) next.weight = "Informe um peso maior que zero.";
    const cm = parseDecimal(length.trim());
    if (length.trim() && (cm === undefined || cm <= 0)) next.length = "Informe um comprimento maior que zero.";

    const when = caughtAt ? fromDateTimeLocalValue(caughtAt) : null;
    if (!when || Number.isNaN(when.getTime())) next.caughtAt = "Informe quando o peixe foi fisgado.";
    return next;
  }

  async function save(another: boolean) {
    const found = validate();
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(another ? "again" : "save");
    try {
      const payload = {
        speciesId,
        speciesCustom: speciesId === OUTRA_ESPECIE_ID ? speciesCustom.trim() : undefined,
        weightKg: parseDecimal(weight.trim()),
        lengthCm: parseDecimal(length.trim()),
        lat: position?.lat,
        lng: position?.lng,
        caughtAt: fromDateTimeLocalValue(caughtAt).toISOString(),
        photo: photo ?? undefined,
        bait: bait.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (item) {
        await updateCatch(item.id, payload, { profileId, tripId: trip.id });
      } else {
        await createCatch({ profileId, tripId: trip.id, ...payload });
      }

      if (another) onSavedAnother(label);
      else router.replace(tripHref);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar a captura.");
      setBusy(null);
    }
  }

  async function remove() {
    if (!item) return;
    if (!confirm("Excluir esta captura? Essa ação não pode ser desfeita.")) return;
    setBusy("delete");
    try {
      await deleteCatch(item.id, { profileId, tripId: trip.id });
      router.replace(tripHref);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível excluir a captura.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={item ? "Editar captura" : "Registrar captura"}
        back={tripHref}
        subtitle={trip.title || trip.locationName || "Pescaria em andamento"}
      />

      {/* Foto — primeiro campo: é o que some se o peixe voltar pra água. */}
      <Card className="flex flex-col gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={pickPhoto}
          aria-label="Foto da captura"
        />
        {photoUrl ? (
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            {/* Foto local do IndexedDB: é um blob, não passa pelo otimizador do Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Foto da captura" className="max-h-72 w-full object-cover" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-2/60 px-4 py-8 text-brand"
          >
            <Icon name="camera" size={38} />
            <span className="text-base font-bold">{photoBusy ? "Preparando a foto…" : "Tirar foto do peixe"}</span>
            <span className="text-xs font-medium text-muted">Opcional — dá pra registrar sem foto</span>
          </button>
        )}
        {photoUrl && (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()} loading={photoBusy}>
              Trocar foto
            </Button>
            <Button variant="ghost" className="text-danger" onClick={() => setPhoto(null)}>
              Remover
            </Button>
          </div>
        )}
      </Card>

      {/* Espécie */}
      <Card className="flex flex-col gap-4">
        {chips.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Últimas espécies</span>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {chips.map((c) => {
                const active =
                  c.speciesId === speciesId &&
                  (c.speciesId !== OUTRA_ESPECIE_ID || (c.speciesCustom ?? "") === speciesCustom);
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      setSpeciesId(c.speciesId);
                      setSpeciesCustom(c.speciesCustom ?? "");
                    }}
                    className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-semibold ${
                      active ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface"
                    }`}
                  >
                    🐟 {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Espécie" htmlFor="especie" error={errors.species}>
          <Select
            id="especie"
            value={speciesId}
            onChange={(e) => {
              setSpeciesId(e.target.value);
              setErrors((prev) => ({ ...prev, species: undefined }));
            }}
          >
            <option value="">Escolha o peixe…</option>
            <optgroup label={trip.ambiente === "mar" ? "Comuns no mar" : "Comuns em água doce"}>
              {here.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </optgroup>
            {elsewhere.length > 0 && (
              <optgroup label="Outros ambientes">
                {elsewhere.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={OUTRA_ESPECIE_ID}>Outra espécie…</option>
          </Select>
        </Field>

        {speciesId === OUTRA_ESPECIE_ID && (
          <Field label="Qual peixe?" htmlFor="especie-outra" error={errors.custom}>
            <Input
              id="especie-outra"
              value={speciesCustom}
              onChange={(e) => setSpeciesCustom(e.target.value)}
              placeholder="Ex.: Piaba, Acará…"
              autoFocus
            />
          </Field>
        )}

        {chosen?.defeso && (
          <Notice tone="warning">
            <strong>Defeso:</strong> {chosen.defeso}. Devolva o peixe à água se a pesca estiver proibida na sua região.
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)" htmlFor="peso" error={errors.weight}>
            <Input
              id="peso"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ex.: 2,4"
            />
          </Field>
          <Field label="Comprimento (cm)" htmlFor="comprimento" error={errors.length}>
            <Input
              id="comprimento"
              inputMode="decimal"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="Ex.: 48"
            />
          </Field>
        </div>

        <Field label="Quando foi" htmlFor="quando" error={errors.caughtAt}>
          <Input id="quando" type="datetime-local" value={caughtAt} onChange={(e) => setCaughtAt(e.target.value)} />
        </Field>
      </Card>

      {/* Local exato da captura */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Local da captura</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Fechar mapa" : "Ajustar no mapa"}
          </Button>
        </div>
        <p className="text-xs text-muted">
          <span className="font-semibold text-foreground">{POS_LABEL[posSource]}</span>
          {position && <> · {formatCoords(position.lat, position.lng)}</>}
        </p>
        <Button variant="outline" onClick={useGps} loading={locating} icon={<Icon name="pin" size={18} />}>
          {locating ? "Procurando você…" : "Usar meu GPS"}
        </Button>
        {showMap && (
          <div className="h-56">
            <MapPicker
              value={position}
              onChange={(p) => {
                setPosition(p);
                setPosSource("mapa");
              }}
              spots={[{ id: trip.id, name: trip.locationName || "Pescaria", lat: trip.lat, lng: trip.lng }]}
              className="h-full"
              zoom={15}
            />
          </div>
        )}
      </Card>

      {/* Isca e observações */}
      <Card className="flex flex-col gap-4">
        <Field label="Isca usada" htmlFor="isca">
          <Input id="isca" value={bait} onChange={(e) => setBait(e.target.value)} placeholder="Ex.: Tuvira, massa, jig…" />
        </Field>
        {baitHints.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {baitHints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setBait(hint)}
                className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold text-muted hover:bg-surface-2"
              >
                + {hint}
              </button>
            ))}
          </div>
        )}
        <Field label="Observações" htmlFor="obs" hint="Técnica, profundidade, companhia — o que valer a pena lembrar.">
          <Textarea id="obs" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      {saveError && <Notice tone="danger">{saveError}</Notice>}

      <div className="flex flex-col gap-2">
        <Button variant="primary" size="xl" fullWidth onClick={() => save(false)} loading={busy === "save"}>
          {item ? "Salvar alterações" : "Salvar captura"}
        </Button>
        {!item && (
          <Button variant="secondary" size="lg" fullWidth onClick={() => save(true)} loading={busy === "again"}>
            Salvar e registrar outra
          </Button>
        )}
        {item && (
          <Button variant="ghost" size="sm" onClick={remove} loading={busy === "delete"} className="self-center text-danger">
            Excluir captura
          </Button>
        )}
      </div>
    </div>
  );
}
