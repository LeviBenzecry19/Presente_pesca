"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { PasswordPrompt } from "./PasswordPrompt";
import { ProfileForm } from "./ProfileForm";
import { Button } from "@/components/ui/Button";
import { profileHasPassword, setCurrentProfile } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/schema";

type Screen =
  | { kind: "list" }
  | { kind: "unlock"; profile: Profile }
  | { kind: "form"; profile: Profile | null };

/**
 * Tela "quem vai pescar?", no espírito do seletor de perfis do Netflix.
 *
 * `fullscreen` = está fazendo o papel de tela de entrada (nenhum perfil ativo).
 * Sem ele, roda dentro do app, na rota /perfis, para trocar de perfil.
 */
export function ProfilePicker({
  profiles,
  fullscreen = false,
  currentProfileId,
}: {
  profiles: Profile[];
  fullscreen?: boolean;
  currentProfileId?: string;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(() =>
    profiles.length === 0 ? { kind: "form", profile: null } : { kind: "list" },
  );
  const [managing, setManaging] = useState(false);

  async function choose(profile: Profile) {
    await setCurrentProfile(profile.id);
    router.push("/");
  }

  function openProfile(profile: Profile) {
    if (!managing) {
      void choose(profile);
      return;
    }
    setScreen(profileHasPassword(profile) ? { kind: "unlock", profile } : { kind: "form", profile });
  }

  const wrapper = fullscreen
    ? "flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-10"
    : "flex flex-col items-center gap-8 py-4";

  if (screen.kind === "unlock") {
    return (
      <div className={wrapper}>
        <PasswordPrompt
          profile={screen.profile}
          onUnlocked={() => setScreen({ kind: "form", profile: screen.profile })}
          onCancel={() => setScreen({ kind: "list" })}
        />
      </div>
    );
  }

  if (screen.kind === "form") {
    const firstEver = profiles.length === 0;
    return (
      <div className={wrapper}>
        {firstEver && (
          <header className="text-center">
            <Brand />
            <h1 className="mt-4 text-3xl font-extrabold">Bem-vindo!</h1>
            <p className="mt-1 text-muted">Crie o primeiro perfil para começar a registrar pescarias.</p>
          </header>
        )}
        <ProfileForm
          profile={screen.profile}
          canDelete={profiles.length > 1}
          onDone={async (profileId) => {
            // Perfil recém-criado já entra no app; edição volta para a lista.
            if (screen.profile === null) {
              await setCurrentProfile(profileId);
              router.push("/");
              return;
            }
            setScreen({ kind: "list" });
          }}
          onCancel={() => setScreen({ kind: "list" })}
        />
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <header className="text-center">
        {fullscreen && <Brand />}
        <h1 className={`font-extrabold ${fullscreen ? "mt-6 text-4xl" : "text-2xl"}`}>
          {managing ? "Gerenciar perfis" : "Quem vai pescar?"}
        </h1>
        {managing && <p className="mt-1 text-sm text-muted">Toque num perfil para editar ou excluir.</p>}
      </header>

      <ul className="flex flex-wrap items-start justify-center gap-5 sm:gap-7">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => openProfile(profile)}
              className="group flex w-24 flex-col items-center gap-2 sm:w-28"
            >
              <span className="relative">
                <Avatar
                  avatar={profile.avatar}
                  name={profile.name}
                  size={96}
                  className={`transition group-hover:ring-4 group-hover:ring-brand group-focus-visible:ring-4 group-focus-visible:ring-brand ${
                    profile.id === currentProfileId ? "ring-4 ring-brand" : ""
                  }`}
                />
                {managing && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 text-3xl" aria-hidden>
                    ✏️
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-sm font-semibold text-muted group-hover:text-foreground">
                {profile.name}
              </span>
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setScreen({ kind: "form", profile: null })}
            className="group flex w-24 flex-col items-center gap-2 sm:w-28"
          >
            <span className="flex size-24 items-center justify-center rounded-2xl border-2 border-dashed border-border text-5xl text-muted transition group-hover:border-brand group-hover:text-brand">
              +
            </span>
            <span className="text-sm font-semibold text-muted group-hover:text-foreground">Novo perfil</span>
          </button>
        </li>
      </ul>

      <Button
        variant={managing ? "primary" : "outline"}
        size="lg"
        onClick={() => setManaging((m) => !m)}
        className="min-w-64 uppercase tracking-wide"
      >
        {managing ? "Concluído" : "Gerenciar perfis"}
      </Button>
    </div>
  );
}

function Brand() {
  return (
    <p className="flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight text-brand">
      <span aria-hidden>🎣</span> Pesca
    </p>
  );
}
