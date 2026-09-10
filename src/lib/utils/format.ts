export function formatWeight(kg?: number | null): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

export function formatLength(cm?: number | null): string {
  if (cm == null || Number.isNaN(cm)) return "—";
  return `${cm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm`;
}

export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "L" : "O";
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lng).toFixed(5)}° ${ew}`;
}

/** Aceita "1,5" ou "1.5". */
export function parseDecimal(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function formatTemp(c?: number | null): string {
  if (c == null || Number.isNaN(c)) return "—";
  return `${Math.round(c)}°`;
}

export function formatWind(kmh?: number | null): string {
  if (kmh == null || Number.isNaN(kmh)) return "—";
  return `${Math.round(kmh)} km/h`;
}

export function formatPressure(hpa?: number | null): string {
  if (hpa == null || Number.isNaN(hpa)) return "—";
  return `${Math.round(hpa)} hPa`;
}

export function windDirectionLabel(deg?: number | null): string {
  if (deg == null || Number.isNaN(deg)) return "";
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/** Minúsculas sem acento, para buscar "traira" e achar "traíra". */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
