import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Ajustes" };

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <SettingsScreen />
    </Suspense>
  );
}
