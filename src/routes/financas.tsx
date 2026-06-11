import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/financas")({
  head: () => ({ meta: [{ title: "Finanças — PSIU!" }] }),
  component: () => (
    <ComingSoon
      title="Finanças"
      description="Atingido, recebido no caixa, produção, repasses e ranking de clínicas."
      phase="Fase 6"
    />
  ),
});
