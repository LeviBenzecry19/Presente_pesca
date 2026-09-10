import { getDb } from "./index";
import type {
  Ambiente,
  Catch,
  FishingSpot,
  FishingTrip,
  LatLng,
  WeatherSnapshot,
} from "./schema";
import { newId } from "@/lib/utils/ids";
import { nowIso } from "@/lib/utils/dates";
import { enqueue } from "./queue";
import { ACTIVE_TRIP_TAG, closeNotificationsByTag, notifyActiveTrip } from "@/lib/notifications/reminders";

/**
 * Única porta de escrita do banco local: cada alteração grava o registro e
 * enfileira a sincronização. Tudo é escopado por `profileId`, o perfil ativo.
 */

/* ------------------------------------------------------------------ */
/* Spots                                                          */
/* ------------------------------------------------------------------ */

export async function createSpot(input: {
  profileId: string;
  name: string;
  lat: number;
  lng: number;
  ambiente: Ambiente;
  notes?: string;
}): Promise<FishingSpot> {
  const ts = nowIso();
  const spot: FishingSpot = { id: newId(), createdAt: ts, updatedAt: ts, ...input };
  await getDb().spots.add(spot);
  await enqueue("spot", spot.id, "upsert");
  return spot;
}

export async function updateSpot(
  id: string,
  patch: Partial<Omit<FishingSpot, "id" | "profileId" | "createdAt">>,
) {
  await getDb().spots.update(id, { ...patch, updatedAt: nowIso() });
  await enqueue("spot", id, "upsert");
}

export async function deleteSpot(id: string) {
  const db = getDb();
  await db.transaction("rw", db.spots, db.trips, async () => {
    await db.spots.delete(id);
    // Pescarias mantêm suas coordenadas; só perdem a referência.
    await db.trips.where("spotId").equals(id).modify({ spotId: undefined });
  });
  await enqueue("spot", id, "delete");
}

/* ------------------------------------------------------------------ */
/* Pescarias                                                           */
/* ------------------------------------------------------------------ */

export async function createTrip(input: {
  profileId: string;
  plannedAt: string;
  lat: number;
  lng: number;
  ambiente: Ambiente;
  locationName?: string;
  spotId?: string;
  title?: string;
  weather?: WeatherSnapshot;
  reminderMinutesBefore?: number | null;
  notes?: string;
  status?: FishingTrip["status"];
  startedAt?: string;
}): Promise<FishingTrip> {
  const ts = nowIso();
  const trip: FishingTrip = {
    id: newId(),
    status: input.status ?? "planejada",
    createdAt: ts,
    updatedAt: ts,
    checklist: [],
    ...input,
  };
  const db = getDb();
  await db.transaction("rw", db.trips, db.syncQueue, async () => {
    if (trip.status === "em_andamento") await assertNoOtherActiveTrip(trip.profileId);
    await db.trips.add(trip);
    await enqueue("trip", trip.id, "upsert");
  });
  return trip;
}

export async function updateTrip(
  id: string,
  patch: Partial<Omit<FishingTrip, "id" | "profileId" | "createdAt">>,
) {
  const db = getDb();
  await db.transaction("rw", db.trips, db.syncQueue, async () => {
    const trip = await db.trips.get(id);
    if (!trip) throw new Error("Esta pescaria não está mais disponível.");
    if (patch.status === "em_andamento") await assertNoOtherActiveTrip(trip.profileId, id);
    await db.trips.update(id, { ...patch, updatedAt: nowIso() });
    await enqueue("trip", id, "upsert");
  });
}

/** Called within the same write transaction as the status change. */
async function assertNoOtherActiveTrip(profileId: string, exceptId?: string) {
  const active = await getDb().trips.where({ profileId, status: "em_andamento" }).toArray();
  if (active.some((trip) => trip.id !== exceptId)) {
    throw new Error("Você já tem uma pescaria em andamento. Encerre-a antes de iniciar outra.");
  }
}

export async function startTrip(id: string, position?: LatLng | null) {
  const ts = nowIso();
  await updateTrip(id, {
    status: "em_andamento",
    startedAt: ts,
    endedAt: undefined,
    startLat: position?.lat,
    startLng: position?.lng,
  });
  const trip = await getDb().trips.get(id);
  if (trip) void notifyActiveTrip(trip);
}

export async function endTrip(id: string, position?: LatLng | null) {
  const ts = nowIso();
  await updateTrip(id, {
    status: "concluida",
    endedAt: ts,
    endLat: position?.lat,
    endLng: position?.lng,
  });
  void closeNotificationsByTag(ACTIVE_TRIP_TAG);
}

/** Reabre uma pescaria concluída (ex.: encerrou sem querer). */
export async function reopenTrip(id: string) {
  await updateTrip(id, { status: "em_andamento", endedAt: undefined, endLat: undefined, endLng: undefined });
  const trip = await getDb().trips.get(id);
  if (trip) void notifyActiveTrip(trip);
}

export async function deleteTrip(id: string) {
  const db = getDb();
  const wasActive = (await db.trips.get(id))?.status === "em_andamento";
  await db.transaction("rw", db.trips, db.catches, db.syncQueue, async () => {
    const catchIds = await db.catches.where("tripId").equals(id).primaryKeys();
    await db.catches.where("tripId").equals(id).delete();
    await db.trips.delete(id);
    for (const cid of catchIds) await enqueue("catch", cid, "delete");
    await enqueue("trip", id, "delete");
  });
  if (wasActive) void closeNotificationsByTag(ACTIVE_TRIP_TAG);
}

/** "Pescar agora": cria e inicia uma pescaria no local atual. */
export async function quickStartTrip(input: {
  profileId: string;
  lat: number;
  lng: number;
  ambiente: Ambiente;
  locationName?: string;
  spotId?: string;
}): Promise<FishingTrip> {
  const ts = nowIso();
  const trip = await createTrip({
    plannedAt: ts,
    status: "em_andamento",
    startedAt: ts,
    ...input,
  });
  void notifyActiveTrip(trip);
  return trip;
}

/* ------------------------------------------------------------------ */
/* Capturas                                                            */
/* ------------------------------------------------------------------ */

export type CatchInput = Omit<Catch, "id" | "createdAt" | "updatedAt" | "syncedAt">;

export async function createCatch(input: CatchInput): Promise<Catch> {
  const ts = nowIso();
  const item: Catch = { id: newId(), createdAt: ts, updatedAt: ts, ...input };
  const db = getDb();
  await db.transaction("rw", db.trips, db.catches, db.syncQueue, async () => {
    const trip = await db.trips.get(input.tripId);
    if (!trip || trip.profileId !== input.profileId) throw new Error("Esta pescaria não pertence ao perfil selecionado.");
    await db.catches.add(item);
    await enqueue("catch", item.id, "upsert");
  });
  return item;
}

export async function updateCatch(
  id: string,
  patch: Partial<Omit<Catch, "id" | "profileId" | "createdAt" | "tripId">>,
  expected?: { profileId: string; tripId: string },
) {
  const db = getDb();
  await db.transaction("rw", db.trips, db.catches, db.syncQueue, async () => {
    const item = await db.catches.get(id);
    if (!item || (expected && (item.profileId !== expected.profileId || item.tripId !== expected.tripId))) {
      throw new Error("Esta captura não pertence à pescaria selecionada.");
    }
    const trip = await db.trips.get(item.tripId);
    if (!trip || trip.profileId !== item.profileId) throw new Error("Esta pescaria não está mais disponível.");
    await db.catches.update(id, { ...patch, profileId: item.profileId, tripId: item.tripId, updatedAt: nowIso() });
    await enqueue("catch", id, "upsert");
  });
}

export async function deleteCatch(id: string, expected?: { profileId: string; tripId: string }) {
  const db = getDb();
  await db.transaction("rw", db.catches, db.syncQueue, async () => {
    const item = await db.catches.get(id);
    if (!item) return;
    if (expected && (item.profileId !== expected.profileId || item.tripId !== expected.tripId)) {
      throw new Error("Esta captura não pertence à pescaria selecionada.");
    }
    await db.catches.delete(id);
    await enqueue("catch", id, "delete");
  });
}

/* ------------------------------------------------------------------ */
/* Consultas de apoio                                                  */
/* ------------------------------------------------------------------ */

/** `null` = não há pescaria ativa (diferente de `undefined`, que é "carregando"). */
export async function getActiveTrip(profileId: string): Promise<FishingTrip | null> {
  return (await getDb().trips.where({ profileId, status: "em_andamento" }).first()) ?? null;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await getDb().settings.put({ key, value });
}
