"use client";

import { useEffect } from "react";
import { checkDueReminders, notificationPermission, registerPeriodicReminderCheck } from "@/lib/notifications/reminders";
import { getSyncEndpoint, runSync } from "@/lib/sync/client";

const REMINDER_POLL_MS = 60_000;

/**
 * Tarefas de fundo enquanto o app está aberto:
 * - sincroniza a fila quando volta a conexão / o app volta ao foco;
 * - dispara lembretes vencidos (a cada minuto e ao voltar ao foco).
 */
export function BackgroundTasks() {
  useEffect(() => {
    const syncConfigured = !!getSyncEndpoint();

    const tick = () => {
      void checkDueReminders();
    };
    const wake = () => {
      tick();
      if (syncConfigured) void runSync();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
    };

    wake();
    if (notificationPermission() === "granted") void registerPeriodicReminderCheck();

    const interval = setInterval(tick, REMINDER_POLL_MS);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
