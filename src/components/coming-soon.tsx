import { AppLayout } from "@/components/app-layout";
import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </header>
        <div className="glass-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground glow">
            <Construction className="h-6 w-6" />
          </div>
          <div className="text-lg font-semibold">Em construção</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Esta tela será implementada na <span className="text-foreground font-medium">{phase}</span>.
            A Fase 1 entrega apenas a base visual, navegação, Home e Perfil.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
