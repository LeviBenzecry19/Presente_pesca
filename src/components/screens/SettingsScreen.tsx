"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/profiles/Avatar";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, Notice } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadBlob, exportBackup, importBackup } from "@/lib/backup/backup";
import { getDb } from "@/lib/db";
import { isIOSDevice, isStandaloneDisplay, useClientValue } from "@/lib/hooks/useClientValue";
import { useNotificationPermission } from "@/lib/hooks/useNotificationPermission";
import { useOnline } from "@/lib/hooks/useOnline";
import { registerPeriodicReminderCheck, requestNotificationPermission, sendTestNotification } from "@/lib/notifications/reminders";
import { getSyncEndpoint, runSync } from "@/lib/sync/client";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function SettingsScreen() {
  const online = useOnline();
  const profile = useCurrentProfile();
  const counts = useLiveQuery(async () => {
    const db = getDb();
    const [spots, trips, catches, pending, profiles] = await Promise.all([
      db.spots.where("profileId").equals(profile.id).count(),
      db.trips.where("profileId").equals(profile.id).count(),
      db.catches.where("profileId").equals(profile.id).count(),
      db.syncQueue.count(),
      db.profiles.count(),
    ]);
    return { spots, trips, catches, pending, profiles };
  }, [profile.id]);
  const lastSync = useLiveQuery(() => getDb().settings.get("lastSync"));

  const permission = useNotificationPermission();
  const standalone = useClientValue(isStandaloneDisplay, false);
  const isIOS = useClientValue(isIOSDevice, false);
  const [periodic, setPeriodic] = useState<boolean | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "muted"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function enableNotifications() {
    const p = await requestNotificationPermission();
    if (p === "granted") {
      setPeriodic(await registerPeriodicReminderCheck());
      await sendTestNotification();
    }
  }

  async function doExport() {
    setBusy("export");
    try {
      const blob = await exportBackup();
      downloadBlob(blob, `pesca-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setMsg({ tone: "success", text: "Backup gerado." });
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof Error ? err.message : "Falha ao exportar." });
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File | null) {
    if (!file) return;
    if (!confirm("Importar este backup? Registros com o mesmo ID serão sobrescritos.")) return;
    setBusy("import");
    try {
      const r = await importBackup(file, profile.id);
      setMsg({
        tone: "success",
        text: `Importado: ${r.profiles} perfis, ${r.spots} spots, ${r.trips} pescarias, ${r.catches} capturas.`,
      });
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof Error ? err.message : "Falha ao importar." });
    } finally {
      setBusy(null);
    }
  }

  async function wipe() {
    if (!confirm(`Apagar as pescarias, capturas e spots de ${profile.name}? O perfil continua existindo.`)) return;
    if (!confirm("Tem certeza? Não há como desfazer. Exporte um backup antes, se quiser.")) return;
    const db = getDb();
    await db.transaction("rw", db.spots, db.trips, db.catches, async () => {
      await db.catches.where("profileId").equals(profile.id).delete();
      await db.trips.where("profileId").equals(profile.id).delete();
      await db.spots.where("profileId").equals(profile.id).delete();
    });
    setMsg({ tone: "muted", text: `Dados de ${profile.name} apagados.` });
  }

  async function syncNow() {
    setBusy("sync");
    const r = await runSync();
    setBusy(null);
    if (!r.configured) setMsg({ tone: "muted", text: "Sincronização não configurada neste build." });
    else if (r.error) setMsg({ tone: "danger", text: `Sync: ${r.error}` });
    else setMsg({ tone: "success", text: `Sincronizado: ${r.sent} enviados, ${r.pending} pendentes.` });
  }

  const endpoint = getSyncEndpoint();
  const last = lastSync?.value as { at: string; sent: number; failed: number; error: string | null } | undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ajustes" />

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card className="flex flex-col gap-3">
        <CardTitle>Notificações</CardTitle>
        {permission === "unsupported" && <p className="text-sm text-muted">Este navegador não suporta notificações.</p>}
        {permission === "denied" && <Notice tone="warning">Notificações bloqueadas. Libere nas configurações do site no navegador.</Notice>}
        {permission === "default" && (
          <>
            <p className="text-sm text-muted">Receba lembretes das pescarias agendadas.</p>
            <Button variant="primary" onClick={enableNotifications}>Permitir notificações</Button>
          </>
        )}
        {permission === "granted" && (
          <>
            <p className="text-sm text-success font-semibold">✅ Notificações permitidas</p>
            <p className="text-xs text-muted">
              Lembretes disparam com o app aberto ou em segundo plano no Android (Chrome, app instalado)
              {periodic === false && " — verificação periódica indisponível neste navegador"}. No iPhone, abra o app de vez em quando para receber.
            </p>
            <Button variant="secondary" size="sm" onClick={() => sendTestNotification()} className="self-start">Enviar teste</Button>
          </>
        )}
      </Card>

      {!standalone && (
        <Card className="flex flex-col gap-2">
          <CardTitle>Instalar no celular</CardTitle>
          {installEvt ? (
            <Button variant="primary" onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>Instalar app</Button>
          ) : isIOS ? (
            <p className="text-sm text-muted">No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>
          ) : (
            <p className="text-sm text-muted">No menu do navegador, escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle>Perfil</CardTitle>
        <div className="flex items-center gap-3">
          <Avatar avatar={profile.avatar} name={profile.name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{profile.name}</p>
            <p className="text-xs text-muted">
              {counts ? `${counts.profiles} ${counts.profiles === 1 ? "perfil" : "perfis"} neste aparelho` : "…"}
            </p>
          </div>
          <Button href="/perfis" variant="outline" size="sm">Trocar</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Dados de {profile.name}</CardTitle>
        <p className="text-sm">
          {counts ? `${counts.spots} spots · ${counts.trips} pescarias · ${counts.catches} capturas` : "…"}
          {storage && storage.quota > 0 && (
            <span className="text-muted"> · {(storage.usage / 1048576).toFixed(1)} MB usados no aparelho</span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={doExport} loading={busy === "export"}>⬇️ Exportar backup</Button>
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 font-semibold text-brand">
            ⬆️ Importar backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => doImport(e.target.files?.[0] ?? null)} disabled={busy === "import"} />
          </label>
        </div>
        <p className="text-xs text-muted">O backup inclui todos os perfis do aparelho.</p>
        <Button variant="ghost" size="sm" onClick={wipe} className="self-center text-danger">
          Apagar os dados deste perfil
        </Button>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Sincronização</CardTitle>
        {endpoint ? (
          <>
            <p className="text-sm">
              Servidor: <span className="font-mono text-xs">{endpoint}</span>
              <br />
              Pendentes: <strong>{counts?.pending ?? 0}</strong>
              {last?.at && <> · última: {new Date(last.at).toLocaleString("pt-BR")}{last.error ? ` (erro: ${last.error})` : ""}</>}
            </p>
            <Button variant="primary" size="sm" onClick={syncNow} loading={busy === "sync"} disabled={!online} className="self-start">Sincronizar agora</Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Sem servidor configurado: os dados ficam apenas neste aparelho ({counts?.pending ?? 0} alterações aguardando um backend). Use o backup para transferir.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Sobre</CardTitle>
        <p className="mt-1 text-xs text-muted">
          Pesca App · MVP. Clima por <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>; mapas por{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. A previsão de pesca é uma estimativa por regras e não substitui a experiência local.
        </p>
      </Card>
    </div>
  );
}
