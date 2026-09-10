import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/components/screens/CompareScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Comparar pescadores" };

export default function CompararPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <CompareScreen />
    </Suspense>
  );
}
