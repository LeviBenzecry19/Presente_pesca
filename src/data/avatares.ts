/**
 * Avatar padrão. O arquivo é gerado por `npm run avatars`; para trocar a arte,
 * basta sobrescrever o PNG em public/avatars mantendo o nome.
 *
 * Perfis salvos antes desta lista encolher podem apontar para um preset que não
 * existe mais — `avatarSrc` cai no primeiro da lista nesse caso.
 *
 * O campo `avatar` de um perfil guarda "preset:<id>" ou uma data URL da foto
 * escolhida na galeria — string em ambos os casos, o que deixa o avatar
 * simples de renderizar, de guardar no IndexedDB e de sincronizar.
 */
export interface AvatarPreset {
  id: string;
  label: string;
  src: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "pescador", label: "Pescador", src: "/avatars/pescador.png" },
];

export const PRESET_PREFIX = "preset:";
export const DEFAULT_AVATAR = `${PRESET_PREFIX}pescador`;

export function isPreset(avatar: string): boolean {
  return avatar.startsWith(PRESET_PREFIX);
}

/** Converte o valor guardado no perfil em algo que sirva de `src` de <img>. */
export function avatarSrc(avatar: string | undefined): string {
  if (!avatar) return AVATAR_PRESETS[0].src;
  if (isPreset(avatar)) {
    const id = avatar.slice(PRESET_PREFIX.length);
    return AVATAR_PRESETS.find((a) => a.id === id)?.src ?? AVATAR_PRESETS[0].src;
  }
  return avatar;
}

export function presetValue(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}
