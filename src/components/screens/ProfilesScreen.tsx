"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ProfilePicker } from "@/components/profiles/ProfilePicker";
import { useCurrentProfile } from "@/components/profiles/ProfileGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScreenLoading } from "@/components/ui/ScreenLoading";
import { getDb } from "@/lib/db";

/** Troca e gerenciamento de perfis a partir de dentro do app. */
export function ProfilesScreen() {
  const current = useCurrentProfile();
  const profiles = useLiveQuery(() => getDb().profiles.orderBy("createdAt").toArray());

  if (profiles === undefined) return <ScreenLoading />;

  return (
    <div className="flex flex-col">
      <PageHeader title="Perfis" back="/" subtitle="Troque de pescador ou ajuste os perfis" />
      <ProfilePicker profiles={profiles} currentProfileId={current.id} />
    </div>
  );
}
