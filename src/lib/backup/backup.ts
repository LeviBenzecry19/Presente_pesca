import { getDb } from "@/lib/db";
import type { Catch, FishingSpot, FishingTrip, Profile } from "@/lib/db/schema";

/**
 * Exportação/importação local em JSON (fotos embutidas como data URL).
 * Serve como backup manual e para levar os dados de um aparelho a outro.
 */

export interface BackupFile {
  app: "pesca-app";
  /** 1 = antes dos perfis; 2 = com perfis. */
  version: 1 | 2;
  exportedAt: string;
  profiles?: Profile[];
  spots: FishingSpot[];
  trips: FishingTrip[];
  catches: (Omit<Catch, "photo"> & { photoDataUrl?: string })[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportBackup(): Promise<Blob> {
  const db = getDb();
  const [profiles, spots, trips, catchesRaw] = await Promise.all([
    db.profiles.toArray(),
    db.spots.toArray(),
    db.trips.toArray(),
    db.catches.toArray(),
  ]);
  const catches = await Promise.all(
    catchesRaw.map(async ({ photo, ...rest }) => ({
      ...rest,
      photoDataUrl: photo ? await blobToDataUrl(photo) : undefined,
    })),
  );
  const file: BackupFile = {
    app: "pesca-app",
    version: 2,
    exportedAt: new Date().toISOString(),
    profiles,
    spots,
    trips,
    catches,
  };
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

/**
 * @param fallbackProfileId perfil que recebe os dados de um backup antigo
 *   (versão 1), gerado antes de existirem perfis.
 */
export async function importBackup(
  file: File,
  fallbackProfileId: string,
): Promise<{ profiles: number; spots: number; trips: number; catches: number }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON.");
  }
  const data = parsed as Partial<BackupFile>;
  if (data.app !== "pesca-app" || !Array.isArray(data.trips) || !Array.isArray(data.catches)) {
    throw new Error("Arquivo inválido: não é um backup do Pesca App.");
  }

  const withProfile = <T extends { profileId?: string }>(row: T): T => ({
    ...row,
    profileId: row.profileId ?? fallbackProfileId,
  });

  const db = getDb();
  const profiles = data.profiles ?? [];
  const spots = (data.spots ?? []).map(withProfile);
  const trips = data.trips.map(withProfile);
  const catches: Catch[] = await Promise.all(
    data.catches.map(async ({ photoDataUrl, ...rest }) => ({
      ...withProfile(rest),
      photo: photoDataUrl ? await dataUrlToBlob(photoDataUrl) : undefined,
    })),
  );

  await db.transaction("rw", db.profiles, db.spots, db.trips, db.catches, async () => {
    if (profiles.length) await db.profiles.bulkPut(profiles);
    await db.spots.bulkPut(spots);
    await db.trips.bulkPut(trips);
    await db.catches.bulkPut(catches);
  });

  return { profiles: profiles.length, spots: spots.length, trips: trips.length, catches: catches.length };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
