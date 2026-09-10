import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <EmptyState
      icon="📡"
      title="Você está sem conexão"
      description="Esta tela ainda não estava salva no aparelho. Suas pescarias e capturas continuam disponíveis no início."
      action={<Button href="/">Ir para o início</Button>}
    />
  );
}
