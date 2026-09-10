import type { MoonInfo } from "@/lib/db/schema";

/** Mês sinódico médio, em dias. */
const SYNODIC_MONTH = 29.530588853;
/** Lua nova de referência: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Fase lunar em [0, 1): 0 = nova, 0.25 = quarto crescente, 0.5 = cheia, 0.75 = quarto minguante. */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - REFERENCE_NEW_MOON_MS) / 86_400_000;
  let phase = (days % SYNODIC_MONTH) / SYNODIC_MONTH;
  if (phase < 0) phase += 1;
  return phase;
}

export function moonLabel(phase: number): string {
  if (phase < 0.0625 || phase >= 0.9375) return "Lua nova";
  if (phase < 0.1875) return "Lua crescente";
  if (phase < 0.3125) return "Quarto crescente";
  if (phase < 0.4375) return "Crescente gibosa";
  if (phase < 0.5625) return "Lua cheia";
  if (phase < 0.6875) return "Minguante gibosa";
  if (phase < 0.8125) return "Quarto minguante";
  return "Lua minguante";
}

export function moonEmoji(phase: number): string {
  const icons = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  return icons[Math.round(phase * 8) % 8];
}

export function moonInfo(date: Date): MoonInfo {
  const phase = moonPhase(date);
  const illuminationPct = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
  return { phase, illuminationPct, label: moonLabel(phase) };
}

/** Distância (0–0.5) até a lua nova ou cheia mais próxima. Perto de 0 = fase "forte" para pesca. */
export function distanceToNewOrFull(phase: number): number {
  const toNew = Math.min(phase, 1 - phase);
  const toFull = Math.abs(phase - 0.5);
  return Math.min(toNew, toFull);
}
