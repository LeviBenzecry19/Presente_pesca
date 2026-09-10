/**
 * Background Sync API: pede ao service worker para avisar o app quando houver
 * conexão. Sem suporte (iOS/Firefox), o SyncManager cai no evento `online`.
 */
export const SYNC_TAG = "sync-queue";

interface SyncManagerLike {
  register(tag: string): Promise<void>;
}

export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    // getRegistration em vez de `ready`: sem SW (dev) `ready` nunca resolveria.
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active) return false;
    const sync = (reg as ServiceWorkerRegistration & { sync?: SyncManagerLike }).sync;
    if (!sync) return false;
    await sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}
