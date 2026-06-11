import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import {
  Calendar,
  Clock,
  Wallet,
  AlertTriangle,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PSIU! — Gestão para psicólogos" },
      {
        name: "description",
        content:
          "Organize atendimentos, pacientes, clínicas, agenda, faltas e finanças em um só lugar.",
      },
    ],
  }),
  component: HomePage,
});

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className={`mt-3 text-3xl font-black tracking-tight ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function QuickAction({
  to,
  title,
  subtitle,
  icon: Icon,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="glass-card group flex items-center gap-4 p-5 transition-all hover:border-primary/40 hover:shadow-glow"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-foreground">{title}</div>
        <div className="truncate text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function HomePage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">
              Bem-vindo ao <span className="text-gradient">PSIU!</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Sua rotina clínica organizada em um só lugar.
            </p>
          </div>
        </header>

        {/* Próximo atendimento */}
        <section className="glass-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0 opacity-60"
            style={{ backgroundImage: "var(--gradient-glow)" }} />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Próximo atendimento
              </div>
              <div className="mt-2 text-xl font-bold sm:text-2xl">
                Nenhum atendimento agendado
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Cadastre pacientes para começar a montar sua agenda.
              </div>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-card/60 text-foreground">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Atendimentos hoje" value="0" icon={Calendar} />
          <Stat
            label="Pagamentos pendentes"
            value="R$ 0"
            icon={Wallet}
            tone="warning"
            hint="Nenhuma pendência"
          />
          <Stat
            label="Alertas de faltas"
            value="0"
            icon={AlertTriangle}
            hint="Sem pacientes em atenção"
          />
          <Stat
            label="Recebido no mês"
            value="R$ 0"
            icon={TrendingUp}
            tone="success"
          />
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ações rápidas
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickAction
              to="/agenda"
              title="Agenda"
              subtitle="Veja e gerencie atendimentos do dia."
              icon={Calendar}
            />
            <QuickAction
              to="/cadastro"
              title="Cadastro"
              subtitle="Cadastre pacientes, clínicas e horários."
              icon={UserPlus}
            />
            <QuickAction
              to="/confirmar-pagamento"
              title="Confirmar Pagamento"
              subtitle="Repasses de clínicas e pendências particulares."
              icon={CheckCircle2}
            />
          </div>
        </section>

        {/* Resumo financeiro */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Resumo financeiro</h2>
              <p className="text-sm text-muted-foreground">Visão rápida do período.</p>
            </div>
            <Link
              to="/financas"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver tudo
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Atingido</div>
              <div className="mt-1 text-xl font-bold">R$ 0</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recebido</div>
              <div className="mt-1 text-xl font-bold text-success">R$ 0</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Aguardando</div>
              <div className="mt-1 text-xl font-bold text-warning">R$ 0</div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
