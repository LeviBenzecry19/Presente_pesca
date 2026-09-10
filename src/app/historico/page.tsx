import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryScreen } from "@/components/screens/HistoryScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Histórico" };

export default function HistoricoPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <HistoryScreen />
    </Suspense>
  );
}
