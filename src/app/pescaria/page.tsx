import type { Metadata } from "next";
import { Suspense } from "react";
import { TripScreen } from "@/components/screens/TripScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export const metadata: Metadata = { title: "Pescaria" };

/**
 * A pescaria vem por query string (/pescaria?id=…) em vez de segmento dinâmico
 * de propósito: assim o HTML desta rota é um só e o service worker consegue
 * pré-cachear a tela para qualquer pescaria, mesmo offline.
 */
export default function PescariaPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <TripScreen />
    </Suspense>
  );
}
