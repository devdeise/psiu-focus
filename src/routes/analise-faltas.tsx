import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/analise-faltas")({
  head: () => ({ meta: [{ title: "Análise de Faltas — PSIU!" }] }),
  component: () => (
    <ComingSoon
      title="Análise de Faltas"
      description="Acompanhe faltas justificadas e não justificadas por paciente."
      phase="Fase 7"
    />
  ),
});
