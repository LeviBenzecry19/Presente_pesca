import type { WeatherHour, WeatherSnapshot } from "@/lib/db/schema";
import { toLocalDateKey } from "@/lib/utils/dates";
import { moonInfo } from "./moon";

/**
 * Cliente Open-Meteo (sem chave de API).
 * - Previsão: até 16 dias à frente e ~2 meses para trás.
 * - Histórico: datas mais antigas caem na API de arquivo (ERA5), que não tem
 *   probabilidade de chuva.
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const HOURLY_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
] as const;

export const MAX_FORECAST_DAYS_AHEAD = 16;
const FORECAST_PAST_DAYS_LIMIT = 60;

export class WeatherRangeError extends Error {}
export class WeatherUnavailableError extends Error {}

interface OpenMeteoResponse {
  timezone?: string;
  hourly?: Record<string, (number | null)[] | string[]>;
  daily?: { time?: string[]; sunrise?: string[]; sunset?: string[] };
  error?: boolean;
  reason?: string;
}

function daysFromToday(date: Date): number {
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86_400_000);
}

function num(arr: unknown, i: number): number | null {
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function fetchWeatherSnapshot(
  lat: number,
  lng: number,
  date: Date,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const diff = daysFromToday(date);
  if (diff > MAX_FORECAST_DAYS_AHEAD) {
    throw new WeatherRangeError(
      `A previsão do tempo só está disponível para até ${MAX_FORECAST_DAYS_AHEAD} dias à frente.`,
    );
  }
  const useArchive = diff < -FORECAST_PAST_DAYS_LIMIT;
  const dateKey = toLocalDateKey(date);

  const hourly = useArchive
    ? HOURLY_VARS.filter((v) => v !== "precipitation_probability")
    : [...HOURLY_VARS];

  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lng.toFixed(5),
    hourly: hourly.join(","),
    daily: "sunrise,sunset",
    timezone: "auto",
    start_date: dateKey,
    end_date: dateKey,
    wind_speed_unit: "kmh",
  });

  const url = `${useArchive ? ARCHIVE_URL : FORECAST_URL}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new WeatherUnavailableError("Sem conexão para consultar o clima.");
  }
  const json = (await res.json().catch(() => null)) as OpenMeteoResponse | null;
  if (!res.ok || !json || json.error) {
    throw new WeatherUnavailableError(json?.reason ?? `Serviço de clima respondeu ${res.status}.`);
  }

  const times = (json.hourly?.time as string[] | undefined) ?? [];
  const h = json.hourly ?? {};
  const hours: WeatherHour[] = times.map((time, i) => ({
    time,
    temperatureC: num(h.temperature_2m, i),
    humidityPct: num(h.relative_humidity_2m, i),
    windKmh: num(h.wind_speed_10m, i),
    windDirDeg: num(h.wind_direction_10m, i),
    // Pressão ao nível do mar: comparável entre locais (a de superfície cai ~100 hPa a cada 1000 m).
    pressureHpa: num(h.pressure_msl, i),
    precipitationMm: num(h.precipitation, i),
    precipitationProbPct: num(h.precipitation_probability, i),
    cloudCoverPct: num(h.cloud_cover, i),
    weatherCode: num(h.weather_code, i),
  }));

  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);

  return {
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
    lat,
    lng,
    date: dateKey,
    timezone: json.timezone ?? "auto",
    sunrise: json.daily?.sunrise?.[0] ?? null,
    sunset: json.daily?.sunset?.[0] ?? null,
    moon: moonInfo(noon),
    hours,
  };
}

/** Hora (0–23) de um timestamp local "yyyy-MM-ddTHH:mm" do Open-Meteo. */
export function hourOf(localTime: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(localTime);
  return m ? Number(m[1]) : 0;
}

/** Minutos desde meia-noite de um timestamp local. */
export function minutesOf(localTime: string | null): number | null {
  if (!localTime) return null;
  const m = /T(\d{2}):(\d{2})/.exec(localTime);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Hora mais próxima do horário planejado, para o resumo rápido. */
export function pickHour(snapshot: WeatherSnapshot, plannedAtIso: string): WeatherHour | undefined {
  if (!snapshot.hours.length) return undefined;
  const planned = new Date(plannedAtIso);
  const target = planned.getHours();
  return snapshot.hours.reduce((best, cur) =>
    Math.abs(hourOf(cur.time) - target) < Math.abs(hourOf(best.time) - target) ? cur : best,
  );
}
