import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/screens/PlanScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Planejar" };

export default function PlanejarPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <PlanScreen />
    </Suspense>
  );
}
