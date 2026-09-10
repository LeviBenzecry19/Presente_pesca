import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilesScreen } from "@/components/screens/ProfilesScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Perfis" };

export default function PerfisPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <ProfilesScreen />
    </Suspense>
  );
}
