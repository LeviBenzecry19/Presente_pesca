"use client";

import { useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { DEFAULT_AVATAR } from "@/data/avatares";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password";
import { createProfile, deleteProfile, profileHasPassword, updateProfile } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/schema";

/**
 * Criar ou editar um perfil. Na criação, senha e foto são pedidas de uma vez;
 * na edição a senha só muda se a pessoa digitar uma nova.
 */
export function ProfileForm({
  profile,
  canDelete,
  onDone,
  onCancel,
}: {
  profile: Profile | null;
  canDelete: boolean;
  onDone: (profileId: string) => void;
  onCancel: () => void;
}) {
  const isNew = profile === null;
  const [name, setName] = useState(profile?.name ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? DEFAULT_AVATAR);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hadPassword = profile ? profileHasPassword(profile) : false;
  const passwordRequired = isNew || !hadPassword;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Escolha um nome para o perfil.");

    const wantsPassword = passwordRequired || password.length > 0;
    if (wantsPassword) {
      const problem = validatePassword(password);
      if (problem) return setError(problem);
      if (password !== confirmPassword) return setError("As senhas não conferem.");
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await createProfile({ name, avatar, password });
        onDone(created.id);
      } else {
        await updateProfile(profile.id, {
          name,
          avatar,
          password: wantsPassword ? password : undefined,
        });
        onDone(profile.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o perfil.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!profile) return;
    const confirmed = window.confirm(
      `Excluir o perfil "${profile.name}"? Todas as pescarias, capturas e spots dele serão apagados deste aparelho.`,
    );
    if (!confirmed) return;
    setSaving(true);
    await deleteProfile(profile.id);
    onCancel();
  }

  return (
    <form onSubmit={save} className="flex w-full max-w-md flex-col gap-5">
      <h2 className="text-2xl font-extrabold">{isNew ? "Novo perfil" : `Editar ${profile.name}`}</h2>

      <Field label="Nome" htmlFor="profile-name">
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Levi"
          maxLength={40}
          autoFocus={isNew}
        />
      </Field>

      <Field label="Foto do perfil" hint="Escolha um desenho ou uma foto da galeria.">
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </Field>

      <Field
        label={passwordRequired ? "Senha" : "Nova senha"}
        htmlFor="profile-password"
        hint={
          passwordRequired
            ? `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Ela só é pedida para editar ou excluir o perfil — não para pescar.`
            : "Deixe em branco para manter a senha atual."
        }
      >
        <Input
          id="profile-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {(passwordRequired || password.length > 0) && (
        <Field label="Repita a senha" htmlFor="profile-confirm">
          <Input
            id="profile-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} size="lg">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" className="flex-1" loading={saving} size="lg">
          {isNew ? "Criar perfil" : "Salvar"}
        </Button>
      </div>

      {!isNew && canDelete && (
        <Button type="button" variant="ghost" size="sm" onClick={remove} className="self-center text-danger">
          Excluir perfil
        </Button>
      )}
      {!isNew && !canDelete && (
        <p className="text-center text-xs text-muted">
          Este é o único perfil; crie outro antes de excluí-lo.
        </p>
      )}
    </form>
  );
}
