"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, type ReactNode } from "react";
import { ProfilePicker } from "./ProfilePicker";
import { AppShell } from "@/components/AppShell";
import { getDb } from "@/lib/db";
import { getCurrentProfileId } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/schema";

const ProfileContext = createContext<Profile | null>(null);

/** Perfil ativo. Só pode ser usado dentro do app, depois do portão. */
export function useCurrentProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) {
    throw new Error("useCurrentProfile precisa estar dentro de <ProfileGate>.");
  }
  return profile;
}

/**
 * Portão de entrada: sem perfil escolhido, mostra o seletor no lugar do app.
 * É o mais perto de "login" que este app tem — sem e-mail e sem senha, porque
 * é presente de família e roda no aparelho da pessoa.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const profiles = useLiveQuery(() => getDb().profiles.orderBy("createdAt").toArray());
  // null = ninguém escolhido; undefined = ainda carregando.
  const currentId = useLiveQuery(async () => (await getCurrentProfileId()) ?? null);

  if (profiles === undefined || currentId === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <span className="sr-only">Carregando perfis…</span>
        <span className="size-10 animate-spin rounded-full border-4 border-border border-t-brand" aria-hidden />
      </div>
    );
  }

  const current = currentId ? (profiles.find((p) => p.id === currentId) ?? null) : null;

  if (!current) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4">
        <ProfilePicker profiles={profiles} fullscreen />
      </main>
    );
  }

  return (
    <ProfileContext.Provider value={current}>
      <AppShell profile={current}>{children}</AppShell>
    </ProfileContext.Provider>
  );
}
