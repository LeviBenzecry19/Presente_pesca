"use client";

import { useEffect, useState } from "react";
import { checkDueReminders } from "@/lib/notifications/reminders";
import { runSync } from "@/lib/sync/client";

/**
 * Registra o service worker (só em produção) e mostra o aviso de atualização.
 * Em desenvolvimento remove qualquer SW antigo para o HMR não brigar com cache.
 */
export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "SYNC_REQUEST") void runSync();
      if (type === "CHECK_REMINDERS") void checkDueReminders();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onMessage);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) setWaiting(installing);
          });
        });
      })
      .catch((err) => console.error("Falha ao registrar o service worker", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-xl">
        <span className="text-sm font-semibold">Nova versão disponível</span>
        <button
          type="button"
          onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-[#1a1200]"
        >
          Atualizar
        </button>
      </div>
    </div>
  );
}
