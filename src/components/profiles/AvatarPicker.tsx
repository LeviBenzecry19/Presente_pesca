"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { Notice } from "@/components/ui/Card";
import { AVATAR_PRESETS, isPreset, presetValue } from "@/data/avatares";
import { fileToAvatar } from "@/lib/utils/avatar";

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (avatar: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const custom = !isPreset(value);

  async function pickFromGallery(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar essa imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {AVATAR_PRESETS.map((preset) => {
          const selected = value === presetValue(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              aria-label={preset.label}
              aria-pressed={selected}
              onClick={() => onChange(presetValue(preset.id))}
              className={`rounded-2xl p-1 transition ${
                selected ? "ring-4 ring-brand" : "ring-2 ring-transparent hover:ring-border"
              }`}
            >
              <Avatar avatar={presetValue(preset.id)} name={preset.label} size={72} />
            </button>
          );
        })}

        <label
          className={`flex size-[80px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center text-[11px] font-bold leading-tight ${
            custom ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted"
          }`}
        >
          {custom ? (
            <Avatar avatar={value} name="Foto escolhida" size={72} />
          ) : (
            <>
              <span aria-hidden className="text-xl">🖼️</span>
              Galeria
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => pickFromGallery(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {busy && <p className="text-sm text-muted">Preparando a imagem…</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      {custom && !busy && (
        <p className="text-xs text-muted">Foto da galeria escolhida. Toque no desenho para voltar ao padrão.</p>
      )}
    </div>
  );
}
