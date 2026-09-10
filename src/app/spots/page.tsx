import type { Metadata } from "next";
import { Suspense } from "react";
import { SpotsScreen } from "@/components/screens/SpotsScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Spots" };

export default function SpotsPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <SpotsScreen />
    </Suspense>
  );
}
