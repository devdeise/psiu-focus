import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import {
  Calendar,
  Clock,
  AlertTriangle,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  Users,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { addQuickNote } from "@/lib/notes-store";
import {
  countAbsences,
  getActivePatients,
  getAppointmentsToday,
  getNextAppointment,
  getPatients,
} from "@/lib/store";
import type { Appointment } from "@/lib/store/types";

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

const NOTES_KEY = "psiu:quick-notes";

function loadNotes(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    return raw ?? "";
  } catch {
    return "";
  }
}

function saveNotes(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_KEY, value);
  } catch {}
}

function HomePage() {
  const [greeting, setGreeting] = useState("Bom dia");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [activePatients, setActivePatients] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [absences, setAbsences] = useState(0);
  const [next, setNext] = useState<Appointment | null>(null);
  const [nextPatientName, setNextPatientName] = useState<string>("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
    setNotes(loadNotes());

    setActivePatients(getActivePatients().length);
    setTodayCount(getAppointmentsToday().length);
    setAbsences(countAbsences());

    const upcoming = getNextAppointment();
    setNext(upcoming);
    if (upcoming) {
      const patient = getPatients().find((p) => p.id === upcoming.patientId);
      setNextPatientName(patient?.name ?? "Paciente");
    }
  }, []);

  const handleSaveNotes = () => {
    const text = notes.trim();
    if (!text) return;
    saveNotes("");
    addQuickNote(text);
    setNotes("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearNotes = () => {
    setNotes("");
    saveNotes("");
  };

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
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ backgroundImage: "var(--gradient-glow)" }}
          />
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
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Atendimentos hoje" value="0" icon={Calendar} />
          <Stat
            label="Pacientes Ativos"
            value={String(activePatients)}
            icon={Users}
          />
          <Stat
            label="Alertas de faltas"
            value="0"
            icon={AlertTriangle}
            hint="Sem pacientes em atenção"
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

        {/* Anotações rápidas */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Anotações rápidas</h2>
              <p className="text-sm text-muted-foreground">
                Registre lembretes ou observações do dia.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: paciente reagendou, lembrar de confirmar pagamento, observação importante..."
              className="min-h-[120px] resize-y bg-card/60"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveNotes}
              className="rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow transition hover:opacity-90"
            >
              Salvar anotação
            </button>
            <button
              onClick={handleClearNotes}
              className="rounded-lg border border-input bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Limpar
            </button>
            {saved && <span className="text-sm text-success">Salvo!</span>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
