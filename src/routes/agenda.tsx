import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — PSIU!" }] }),
  component: () => (
    <ComingSoon
      title="Agenda"
      description="Calendário, status do dia, atendimentos pendentes e realizados."
      phase="Fase 4"
    />
  ),
});
