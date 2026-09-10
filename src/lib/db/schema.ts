/**
 * Modelo de dados local (IndexedDB via Dexie).
 *
 * Espelha a seção 7 da especificação. `Catch` já guarda espécie + coordenadas +
 * horário, e `FishingTrip` guarda o snapshot de clima — exatamente os campos
 * que alimentarão o modelo preditivo (seção 5.1) no futuro.
 */

export type Ambiente = "agua_doce" | "mar";

export type TripStatus = "planejada" | "em_andamento" | "concluida";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Perfil de quem pesca. O app é presente de família: abre numa tela "quem vai
 * pescar?" e cada pessoa tem o próprio histórico. A senha não é login — ela só
 * protege editar/excluir o perfil (ver lib/auth/password.ts).
 */
export interface Profile {
  id: string;
  name: string;
  /** "preset:<id>" de data/avatares.ts, ou uma data URL da foto escolhida. */
  avatar: string;
  /** Vazio quando o perfil não tem senha (por exemplo, os migrados da v1). */
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface FishingSpot extends LatLng {
  id: string;
  profileId: string;
  name: string;
  ambiente: Ambiente;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface WeatherHour {
  /** ISO local (sem offset), como retornado pelo Open-Meteo com timezone=auto. */
  time: string;
  temperatureC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  windDirDeg: number | null;
  pressureHpa: number | null;
  precipitationMm: number | null;
  precipitationProbPct: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
}

export interface MoonInfo {
  /** 0 = nova, 0.5 = cheia, 1 = nova de novo. */
  phase: number;
  illuminationPct: number;
  label: string;
}

export interface WeatherSnapshot {
  source: "open-meteo";
  fetchedAt: string;
  lat: number;
  lng: number;
  /** yyyy-MM-dd da data consultada. */
  date: string;
  timezone: string;
  sunrise: string | null;
  sunset: string | null;
  moon: MoonInfo;
  hours: WeatherHour[];
}

export interface FishingTrip extends LatLng {
  id: string;
  profileId: string;
  title?: string;
  /** Data/hora planejada (ISO UTC). */
  plannedAt: string;
  locationName?: string;
  spotId?: string;
  ambiente: Ambiente;
  status: TripStatus;
  startedAt?: string;
  endedAt?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  weather?: WeatherSnapshot;
  /** Minutos antes de `plannedAt` para lembrar; null/undefined = sem lembrete. */
  reminderMinutesBefore?: number | null;
  reminderFiredAt?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Catch {
  id: string;
  profileId: string;
  tripId: string;
  /** ID da espécie em `data/especies.ts`, ou "outra". */
  speciesId: string;
  /** Nome livre quando speciesId === "outra". */
  speciesCustom?: string;
  weightKg?: number;
  lengthCm?: number;
  lat?: number;
  lng?: number;
  /** ISO UTC do momento da captura. */
  caughtAt: string;
  photo?: Blob;
  bait?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export type SyncEntity = "profile" | "spot" | "trip" | "catch";
export type SyncOp = "upsert" | "delete";

export interface SyncQueueItem {
  seq?: number;
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DB_NAME = "pesca-app";

/** Chave em `settings` com o id do perfil ativo. */
export const CURRENT_PROFILE_KEY = "currentProfileId";
