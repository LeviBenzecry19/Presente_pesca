import { getDb } from "./index";
import type { SyncEntity, SyncOp } from "./schema";
import { nowIso } from "@/lib/utils/dates";
import { requestBackgroundSync } from "@/lib/sync/background";

/**
 * Fila de sincronização. Fica em módulo próprio para que `repo.ts` e
 * `profiles.ts` a compartilhem sem importarem um ao outro.
 */
export async function enqueue(entity: SyncEntity, entityId: string, op: SyncOp): Promise<void> {
  const db = getDb();
  // Uma única entrada pendente por entidade basta: o sync lê o estado atual.
  const existing = await db.syncQueue.where("entityId").equals(entityId).first();
  if (existing) {
    await db.syncQueue.update(existing.seq!, { op, createdAt: nowIso(), lastError: undefined });
  } else {
    await db.syncQueue.add({ entity, entityId, op, createdAt: nowIso(), attempts: 0 });
  }
  void requestBackgroundSync();
}
