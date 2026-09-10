import { getDb } from "@/lib/db";
import { CURRENT_PROFILE_KEY } from "@/lib/db/schema";
import { nowIso } from "@/lib/utils/dates";

/**
 * Lembretes de pescaria.
 *
 * MVP sem servidor de push: a verificação roda quando o app está aberto
 * (montagem, foco, a cada minuto) e, onde suportado (Chrome/Android com PWA
 * instalado), via Periodic Background Sync tratado no service worker. Web Push
 * de verdade depende do backend (docs/backend/API.md).
 */

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: "1 hora antes" },
  { value: 180, label: "3 horas antes" },
  { value: 720, label: "12 horas antes" },
  { value: 1440, label: "1 dia antes" },
];

export const PERIODIC_REMINDER_TAG = "check-reminders";
const LATE_GRACE_MS = 2 * 60 * 60 * 1000;

export type PermissionState = NotificationPermission | "unsupported";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): PermissionState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/* Store mínimo para componentes reagirem à mudança de permissão (useSyncExternalStore). */
const permissionListeners = new Set<() => void>();

export function subscribePermission(callback: () => void): () => void {
  permissionListeners.add(callback);
  return () => {
    permissionListeners.delete(callback);
  };
}

function notifyPermissionChange() {
  for (const cb of permissionListeners) cb();
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  } finally {
    notifyPermissionChange();
  }
}

export async function showLocalNotification(
  title: string,
  options: { body?: string; tag?: string; url?: string; silent?: boolean } = {},
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const payload: NotificationOptions & { data: { url: string } } = {
    body: options.body,
    tag: options.tag,
    silent: options.silent,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: options.url ?? "/" },
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, payload);
        return true;
      }
    }
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}

/** Dispara lembretes vencidos ainda não notificados. Retorna quantos disparou. */
export async function checkDueReminders(): Promise<number> {
  if (notificationPermission() !== "granted") return 0;
  const db = getDb();
  const now = Date.now();
  // Só o perfil ativo: ninguém quer ser lembrado da pescaria do irmão.
  const profileId = (await db.settings.get(CURRENT_PROFILE_KEY))?.value as string | undefined;
  if (!profileId) return 0;
  const trips = await db.trips.where({ profileId, status: "planejada" }).toArray();
  let fired = 0;
  for (const trip of trips) {
    if (trip.reminderMinutesBefore == null || trip.reminderFiredAt) continue;
    const plannedMs = new Date(trip.plannedAt).getTime();
    const dueMs = plannedMs - trip.reminderMinutesBefore * 60_000;
    if (now < dueMs || now > plannedMs + LATE_GRACE_MS) continue;
    const when = new Date(trip.plannedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const pending = (trip.checklist ?? []).filter((i) => !i.done).length;
    const checklistNote = pending ? ` · ${pending} ${pending === 1 ? "item pendente" : "itens pendentes"} no checklist` : "";
    const ok = await showLocalNotification("Pescaria chegando! 🎣", {
      body: `${trip.title || trip.locationName || "Sua pescaria"} — ${when}${checklistNote}`,
      tag: `trip-${trip.id}`,
      url: `/pescaria?id=${trip.id}`,
    });
    if (ok) {
      await db.trips.update(trip.id, { reminderFiredAt: nowIso() });
      fired++;
    }
  }
  return fired;
}

/* Sessão ativa visível na bandeja (seção 4.5): silenciosa, mesma tag → uma só. */
export const ACTIVE_TRIP_TAG = "active-trip";

export async function notifyActiveTrip(trip: { id: string; title?: string; locationName?: string }): Promise<boolean> {
  return showLocalNotification("Pescaria em andamento 🎣", {
    body: `${trip.title || trip.locationName || "Boa pescaria!"} · Toque para registrar uma captura`,
    tag: ACTIVE_TRIP_TAG,
    url: `/captura?trip=${trip.id}`,
    silent: true,
  });
}

export async function closeNotificationsByTag(tag: string): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    for (const n of await reg.getNotifications({ tag })) n.close();
  } catch {
    /* sem SW (dev) ou sem suporte: nada a fechar */
  }
}

export async function sendTestNotification(): Promise<boolean> {
  return showLocalNotification("Notificações ativas ✅", {
    body: "Você receberá lembretes das pescarias agendadas.",
    tag: "test",
    url: "/configuracoes",
  });
}

interface PeriodicSyncLike {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  getTags(): Promise<string[]>;
}

/** Periodic Background Sync (Chrome/Android instalado). Falso se indisponível. */
export async function registerPeriodicReminderCheck(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const periodic = (reg as ServiceWorkerRegistration & { periodicSync?: PeriodicSyncLike }).periodicSync;
    if (!periodic) return false;
    const status = await navigator.permissions
      .query({ name: "periodic-background-sync" as PermissionName })
      .catch(() => null);
    if (status && status.state !== "granted") return false;
    await periodic.register(PERIODIC_REMINDER_TAG, { minInterval: 15 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
