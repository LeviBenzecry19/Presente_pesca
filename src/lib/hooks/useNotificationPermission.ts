import { useSyncExternalStore } from "react";
import { notificationPermission, subscribePermission, type PermissionState } from "@/lib/notifications/reminders";

const getServerSnapshot = (): PermissionState => "default";

/** Estado atual da permissão de notificações, atualizado após cada pedido. */
export function useNotificationPermission(): PermissionState {
  return useSyncExternalStore(subscribePermission, notificationPermission, getServerSnapshot);
}
