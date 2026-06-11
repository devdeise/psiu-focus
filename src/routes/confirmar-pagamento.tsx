import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/confirmar-pagamento")({
  head: () => ({ meta: [{ title: "Confirmar Pagamento — PSIU!" }] }),
  component: () => (
    <ComingSoon
      title="Confirmar Pagamento"
      description="Acompanhe pagamentos pendentes de clínicas e particulares que precisam de confirmação."
      phase="Fase 5"
    />
  ),
});
