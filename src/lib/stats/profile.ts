import type { Catch, FishingTrip } from "@/lib/db/schema";

export interface SpeciesStat {
  key: string;
  speciesId: string;
  speciesCustom?: string;
  count: number;
}

export interface ProfileStats {
  profileId: string;
  totalCatches: number;
  completedTrips: number;
  speciesCount: number;
  biggestCatch: Catch | null;
  longestCatch: Catch | null;
  bestDay: { date: string; count: number; tiedDates: string[] } | null;
  totalHours: number;
  timedTrips: number;
  averageCatchesPerTrip: number | null;
  weightsRecorded: number;
  lengthsRecorded: number;
  species: SpeciesStat[];
  byDay: { date: string; count: number }[];
  tripStats: { trip: FishingTrip; count: number; hours: number | null }[];
}

/** Local calendar days, including around UTC midnight. Invalid dates stay out of day records. */
export function localCatchDate(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function positiveMeasurement(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function completedHours(trip: FishingTrip): number | null {
  if (trip.status !== "concluida" || !trip.startedAt || !trip.endedAt) return null;
  const duration = new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime();
  return Number.isFinite(duration) && duration >= 0 ? duration / 3_600_000 : null;
}

/**
 * All-time totals count every capture belonging to the profile. Trip averages
 * use only completed trips and their captures, including trips with no catch.
 * Hours use completed trips with a valid start/end; missing weights are unknown.
 */
export function computeProfileStats(
  profileId: string,
  trips: readonly FishingTrip[],
  catches: readonly Catch[],
): ProfileStats {
  const ownCatches = catches.filter((item) => item.profileId === profileId);
  const ownTrips = trips.filter((trip) => trip.profileId === profileId);
  const byDayMap = new Map<string, number>();
  const speciesMap = new Map<string, SpeciesStat>();
  const tripCounts = new Map<string, number>();
  let biggestCatch: Catch | null = null;
  let longestCatch: Catch | null = null;
  let weightsRecorded = 0;
  let lengthsRecorded = 0;

  for (const item of ownCatches) {
    const day = localCatchDate(item.caughtAt);
    if (day) byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    tripCounts.set(item.tripId, (tripCounts.get(item.tripId) ?? 0) + 1);

    const custom = item.speciesCustom?.trim().replace(/\s+/g, " ");
    const key = item.speciesId === "outra"
      ? `outra:${(custom ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")}`
      : item.speciesId;
    const species = speciesMap.get(key);
    if (species) species.count += 1;
    else speciesMap.set(key, { key, speciesId: item.speciesId, speciesCustom: custom, count: 1 });

    if (positiveMeasurement(item.weightKg)) {
      weightsRecorded += 1;
      if (!biggestCatch || item.weightKg > biggestCatch.weightKg!) biggestCatch = item;
    }
    if (positiveMeasurement(item.lengthCm)) {
      lengthsRecorded += 1;
      if (!longestCatch || item.lengthCm > longestCatch.lengthCm!) longestCatch = item;
    }
  }

  const byDay = [...byDayMap].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  const bestCount = byDay.reduce((max, day) => Math.max(max, day.count), 0);
  const tiedDates = byDay.filter((day) => day.count === bestCount).map((day) => day.date).reverse();
  const tripStats = ownTrips
    .map((trip) => ({ trip, count: tripCounts.get(trip.id) ?? 0, hours: completedHours(trip) }))
    .sort((a, b) => b.trip.plannedAt.localeCompare(a.trip.plannedAt));
  const completed = tripStats.filter(({ trip }) => trip.status === "concluida");
  const timed = completed.filter((trip) => trip.hours !== null);
  const species = [...speciesMap.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    profileId,
    totalCatches: ownCatches.length,
    completedTrips: completed.length,
    speciesCount: species.filter((item) => item.key !== "outra:").length,
    biggestCatch,
    longestCatch,
    bestDay: tiedDates.length ? { date: tiedDates[0], count: bestCount, tiedDates } : null,
    totalHours: timed.reduce((sum, trip) => sum + trip.hours!, 0),
    timedTrips: timed.length,
    averageCatchesPerTrip: completed.length ? completed.reduce((sum, trip) => sum + trip.count, 0) / completed.length : null,
    weightsRecorded,
    lengthsRecorded,
    species,
    byDay,
    tripStats,
  };
}

export type RankingMetric = "catches" | "weight" | "bestDay";
export interface RankingEntry {
  profileId: string;
  name: string;
  stats: ProfileStats;
}

/** Competition ranking: equal values share a place; absent measurements have no place. */
export function rankProfiles<T extends RankingEntry>(entries: readonly T[], metric: RankingMetric) {
  const sorted = entries.map((entry) => ({
    ...entry,
    value: metric === "catches" ? entry.stats.totalCatches
      : metric === "weight" ? entry.stats.biggestCatch?.weightKg ?? null
      : entry.stats.bestDay?.count ?? null,
  })).sort((a, b) => {
    if (a.value === null && b.value !== null) return 1;
    if (b.value === null && a.value !== null) return -1;
    return (b.value ?? 0) - (a.value ?? 0) || a.name.localeCompare(b.name, "pt-BR") || a.profileId.localeCompare(b.profileId);
  });
  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((entry, index) => {
    if (entry.value === null) return { ...entry, rank: null, tied: false };
    if (entry.value !== lastValue) lastRank = index + 1;
    lastValue = entry.value;
    return {
      ...entry,
      rank: lastRank,
      tied: sorted[index - 1]?.value === entry.value || sorted[index + 1]?.value === entry.value,
    };
  });
}
