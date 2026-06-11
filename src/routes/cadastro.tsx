import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Cadastro — PSIU!" }] }),
  component: () => (
    <ComingSoon
      title="Cadastro"
      description="Cadastre pacientes, clínicas e horários."
      phase="Fase 3"
    />
  ),
});
