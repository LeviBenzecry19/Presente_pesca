import type { Metadata } from "next";
import { Suspense } from "react";
import { StatsScreen } from "@/components/screens/StatsScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Suas conquistas" };

export default function EstatisticasPage() {
  return <Suspense fallback={<ScreenLoading />}><StatsScreen /></Suspense>;
}
