import { getDb } from "@/lib/db";
import type { Catch, FishingSpot, FishingTrip, Profile, SyncQueueItem } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/db/repo";
import { newId } from "@/lib/utils/ids";
import { nowIso } from "@/lib/utils/dates";

/**
 * Cliente da fila de sincronização.
 *
 * Contrato do servidor em docs/backend/API.md. Quando `NEXT_PUBLIC_SYNC_ENDPOINT`
 * não está definido, o app é 100% local e a fila apenas acumula.
 */

export const SYNC_BATCH_SIZE = 25;
const MAX_ATTEMPTS_BEFORE_BACKOFF = 5;

export interface SyncResult {
  configured: boolean;
  sent: number;
  failed: number;
  pending: number;
  error?: string;
}

export function getSyncEndpoint(): string | null {
  const raw = process.env.NEXT_PUBLIC_SYNC_ENDPOINT?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export async function getDeviceId(): Promise<string> {
  const existing = await getSetting<string | null>("deviceId", null);
  if (existing) return existing;
  const id = newId();
  await setSetting("deviceId", id);
  return id;
}

type Payload =
  | { entity: "profile"; op: "upsert"; id: string; data: Profile }
  | { entity: "spot"; op: "upsert"; id: string; data: FishingSpot }
  | { entity: "trip"; op: "upsert"; id: string; data: FishingTrip }
  | { entity: "catch"; op: "upsert"; id: string; data: Omit<Catch, "photo"> & { hasPhoto: boolean } }
  | { entity: "profile" | "spot" | "trip" | "catch"; op: "delete"; id: string; data: null };

async function buildPayload(item: SyncQueueItem): Promise<{ payload: Payload; photo?: Blob } | null> {
  const db = getDb();
  if (item.op === "delete") {
    return { payload: { entity: item.entity, op: "delete", id: item.entityId, data: null } };
  }
  if (item.entity === "profile") {
    const row = await db.profiles.get(item.entityId);
    return row ? { payload: { entity: "profile", op: "upsert", id: row.id, data: row } } : null;
  }
  if (item.entity === "spot") {
    const row = await db.spots.get(item.entityId);
    return row ? { payload: { entity: "spot", op: "upsert", id: row.id, data: row } } : null;
  }
  if (item.entity === "trip") {
    const row = await db.trips.get(item.entityId);
    return row ? { payload: { entity: "trip", op: "upsert", id: row.id, data: row } } : null;
  }
  const row = await db.catches.get(item.entityId);
  if (!row) return null;
  const { photo, ...rest } = row;
  return { payload: { entity: "catch", op: "upsert", id: row.id, data: { ...rest, hasPhoto: !!photo } }, photo };
}

let running: Promise<SyncResult> | null = null;

/** Processa a fila. Reentrante: chamadas simultâneas compartilham a mesma execução. */
export function runSync(): Promise<SyncResult> {
  if (running) return running;
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<SyncResult> {
  const db = getDb();
  const endpoint = getSyncEndpoint();
  const pending = await db.syncQueue.count();
  if (!endpoint) return { configured: false, sent: 0, failed: 0, pending };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { configured: true, sent: 0, failed: 0, pending, error: "Sem conexão." };
  }

  const deviceId = await getDeviceId();
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  const items = await db.syncQueue.orderBy("seq").limit(SYNC_BATCH_SIZE).toArray();
  const prepared: { item: SyncQueueItem; payload: Payload; photo?: Blob }[] = [];
  for (const item of items) {
    // Itens já com muitas falhas esperam a próxima rodada (backoff simples).
    if (item.attempts >= MAX_ATTEMPTS_BEFORE_BACKOFF && Math.random() < 0.7) continue;
    const built = await buildPayload(item);
    if (!built) {
      await db.syncQueue.delete(item.seq!);
      continue;
    }
    prepared.push({ item, ...built });
  }

  if (prepared.length) {
    try {
      const res = await fetch(`${endpoint}/v1/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: JSON.stringify({ deviceId, items: prepared.map((p) => p.payload) }),
      });
      if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
      const json = (await res.json()) as { results?: { id: string; ok: boolean; error?: string }[] };
      const byId = new Map((json.results ?? []).map((r) => [r.id, r]));

      for (const p of prepared) {
        const r = byId.get(p.item.entityId);
        if (!r || !r.ok) {
          failed++;
          lastError = r?.error ?? "Item rejeitado pelo servidor";
          await db.syncQueue.update(p.item.seq!, { attempts: p.item.attempts + 1, lastError });
          continue;
        }
        if (p.photo) {
          // Bytes crus, não multipart: o PHP só monta $_FILES em POST, então um
          // PUT multipart chegaria ao backend com corpo vazio.
          const up = await fetch(`${endpoint}/v1/catches/${p.item.entityId}/photo`, {
            method: "PUT",
            headers: {
              "X-Device-Id": deviceId,
              "Content-Type": p.photo.type || "image/jpeg",
            },
            body: p.photo,
          });
          if (!up.ok) {
            failed++;
            lastError = `Falha ao enviar foto (${up.status})`;
            await db.syncQueue.update(p.item.seq!, { attempts: p.item.attempts + 1, lastError });
            continue;
          }
        }
        await db.syncQueue.delete(p.item.seq!);
        const ts = nowIso();
        if (p.item.op === "upsert") {
          if (p.item.entity === "profile") await db.profiles.update(p.item.entityId, { syncedAt: ts });
          if (p.item.entity === "spot") await db.spots.update(p.item.entityId, { syncedAt: ts });
          if (p.item.entity === "trip") await db.trips.update(p.item.entityId, { syncedAt: ts });
          if (p.item.entity === "catch") await db.catches.update(p.item.entityId, { syncedAt: ts });
        }
        sent++;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Falha de rede";
      failed += prepared.length;
      for (const p of prepared) {
        await db.syncQueue.update(p.item.seq!, { attempts: p.item.attempts + 1, lastError });
      }
    }
  }

  const remaining = await db.syncQueue.count();
  await setSetting("lastSync", { at: nowIso(), sent, failed, error: lastError ?? null });
  return { configured: true, sent, failed, pending: remaining, error: lastError };
}
