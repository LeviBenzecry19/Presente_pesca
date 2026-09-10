"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import type { Profile } from "@/lib/db/schema";
import { checkProfilePassword } from "@/lib/db/profiles";

/**
 * Pede a senha antes de deixar editar ou excluir um perfil. Escolher um perfil
 * para pescar nunca passa por aqui — o app abre num toque.
 */
export function PasswordPrompt({
  profile,
  onUnlocked,
  onCancel,
}: {
  profile: Profile;
  onUnlocked: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    const ok = await checkProfilePassword(profile, password);
    setChecking(false);
    if (ok) {
      onUnlocked();
    } else {
      setError("Senha incorreta.");
      setPassword("");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-4 text-center">
      <Avatar avatar={profile.avatar} name={profile.name} size={96} />
      <div>
        <h2 className="text-xl font-extrabold">Senha de {profile.name}</h2>
        <p className="mt-1 text-sm text-muted">Só para editar ou excluir este perfil.</p>
      </div>

      <Field label="Senha" htmlFor="unlock-password" className="w-full max-w-xs text-left">
        <Input
          id="unlock-password"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </Field>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex w-full max-w-xs gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" loading={checking} disabled={!password}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
