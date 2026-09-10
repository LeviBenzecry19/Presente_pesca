import { getDb } from "./index";
import { CURRENT_PROFILE_KEY, type Profile } from "./schema";
import { getSetting, setSetting } from "./repo";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { DEFAULT_AVATAR } from "@/data/avatares";
import { newId } from "@/lib/utils/ids";
import { nowIso } from "@/lib/utils/dates";
import { enqueue } from "./queue";

export async function listProfiles(): Promise<Profile[]> {
  return getDb().profiles.orderBy("createdAt").toArray();
}

export async function getCurrentProfileId(): Promise<string | null> {
  return getSetting<string | null>(CURRENT_PROFILE_KEY, null);
}

export async function setCurrentProfile(id: string | null): Promise<void> {
  await setSetting(CURRENT_PROFILE_KEY, id);
}

export async function createProfile(input: {
  name: string;
  avatar?: string;
  password: string;
}): Promise<Profile> {
  const ts = nowIso();
  const { hash, salt } = await hashPassword(input.password);
  const profile: Profile = {
    id: newId(),
    name: input.name.trim(),
    avatar: input.avatar || DEFAULT_AVATAR,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: ts,
    updatedAt: ts,
  };
  await getDb().profiles.add(profile);
  await enqueue("profile", profile.id, "upsert");
  return profile;
}

export async function updateProfile(
  id: string,
  patch: { name?: string; avatar?: string; password?: string },
): Promise<void> {
  const changes: Partial<Profile> = { updatedAt: nowIso() };
  if (patch.name !== undefined) changes.name = patch.name.trim();
  if (patch.avatar !== undefined) changes.avatar = patch.avatar;
  if (patch.password) {
    const { hash, salt } = await hashPassword(patch.password);
    changes.passwordHash = hash;
    changes.passwordSalt = salt;
  }
  await getDb().profiles.update(id, changes);
  await enqueue("profile", id, "upsert");
}

/** Apaga o perfil e tudo que pertence a ele. */
export async function deleteProfile(id: string): Promise<void> {
  const db = getDb();
  const [tripIds, catchIds, spotIds] = await Promise.all([
    db.trips.where("profileId").equals(id).primaryKeys(),
    db.catches.where("profileId").equals(id).primaryKeys(),
    db.spots.where("profileId").equals(id).primaryKeys(),
  ]);

  await db.transaction("rw", db.profiles, db.spots, db.trips, db.catches, async () => {
    await db.catches.where("profileId").equals(id).delete();
    await db.trips.where("profileId").equals(id).delete();
    await db.spots.where("profileId").equals(id).delete();
    await db.profiles.delete(id);
  });

  for (const cid of catchIds) await enqueue("catch", cid, "delete");
  for (const tid of tripIds) await enqueue("trip", tid, "delete");
  for (const sid of spotIds) await enqueue("spot", sid, "delete");
  await enqueue("profile", id, "delete");

  if ((await getCurrentProfileId()) === id) await setCurrentProfile(null);
}

export function profileHasPassword(profile: Profile): boolean {
  return profile.passwordHash !== "";
}

export async function checkProfilePassword(profile: Profile, password: string): Promise<boolean> {
  return verifyPassword(password, { hash: profile.passwordHash, salt: profile.passwordSalt });
}
