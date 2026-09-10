import type { Metadata } from "next";
import { Suspense } from "react";
import { CatchFormScreen } from "@/components/screens/CatchFormScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Registrar captura" };

export default function CapturaPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <CatchFormScreen />
    </Suspense>
  );
}
