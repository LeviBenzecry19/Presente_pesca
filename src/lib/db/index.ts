import Dexie, { type EntityTable, type Transaction } from "dexie";
import {
  CURRENT_PROFILE_KEY,
  DB_NAME,
  type Catch,
  type FishingSpot,
  type FishingTrip,
  type Profile,
  type SettingRow,
  type SyncQueueItem,
} from "./schema";
import { newId } from "@/lib/utils/ids";
import { DEFAULT_AVATAR } from "@/data/avatares";

/**
 * Banco local. Só pode ser aberto no navegador — nunca importe este módulo
 * em Server Components.
 *
 * Índices: listamos apenas os campos usados em consultas. Blobs (fotos) ficam
 * fora de índices e são armazenados diretamente pelo IndexedDB.
 */
export class PescaDB extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  spots!: EntityTable<FishingSpot, "id">;
  trips!: EntityTable<FishingTrip, "id">;
  catches!: EntityTable<Catch, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "seq">;
  settings!: EntityTable<SettingRow, "key">;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      spots: "id, name, updatedAt",
      trips: "id, status, plannedAt, spotId, updatedAt",
      catches: "id, tripId, speciesId, caughtAt, updatedAt",
      syncQueue: "++seq, entity, entityId, createdAt",
      settings: "key",
    });

    // v2: perfis. Índices compostos porque toda consulta agora filtra pelo
    // perfil ativo antes de qualquer outra coisa.
    this.version(2)
      .stores({
        profiles: "id, name, updatedAt",
        spots: "id, profileId, name, updatedAt",
        trips: "id, profileId, [profileId+status], [profileId+plannedAt], status, plannedAt, spotId, updatedAt",
        catches: "id, tripId, profileId, [profileId+caughtAt], speciesId, caughtAt, updatedAt",
        syncQueue: "++seq, entity, entityId, createdAt",
        settings: "key",
      })
      .upgrade(migrateToProfiles);

    // v3: a tela de escolha de perfil apresenta os perfis por ordem de criação.
    // Declarar o índice em uma nova versão preserva os bancos que já foram
    // migrados para a v2 e permite que o IndexedDB o construa sem perder dados.
    this.version(3).stores({
      profiles: "id, name, createdAt, updatedAt",
      spots: "id, profileId, name, updatedAt",
      trips: "id, profileId, [profileId+status], [profileId+plannedAt], status, plannedAt, spotId, updatedAt",
      catches: "id, tripId, profileId, [profileId+caughtAt], speciesId, caughtAt, updatedAt",
      syncQueue: "++seq, entity, entityId, createdAt",
      settings: "key",
    });
  }
}

/**
 * Dados criados antes dos perfis passam a pertencer a um perfil inicial, que
 * nasce sem senha — a pessoa define uma depois, em Gerenciar perfis.
 */
async function migrateToProfiles(tx: Transaction): Promise<void> {
  const spots = tx.table<FishingSpot>("spots");
  const trips = tx.table<FishingTrip>("trips");
  const catches = tx.table<Catch>("catches");

  const existing = (await spots.count()) + (await trips.count()) + (await catches.count());
  if (0 === existing) return;

  const now = new Date().toISOString();
  const profile: Profile = {
    id: newId(),
    name: "Meu perfil",
    avatar: DEFAULT_AVATAR,
    passwordHash: "",
    passwordSalt: "",
    createdAt: now,
    updatedAt: now,
  };

  await tx.table<Profile>("profiles").add(profile);
  await spots.toCollection().modify({ profileId: profile.id });
  await trips.toCollection().modify({ profileId: profile.id });
  await catches.toCollection().modify({ profileId: profile.id });
  await tx.table<SettingRow>("settings").put({ key: CURRENT_PROFILE_KEY, value: profile.id });
}

let instance: PescaDB | null = null;

export function getDb(): PescaDB {
  if (!instance) instance = new PescaDB();
  return instance;
}
