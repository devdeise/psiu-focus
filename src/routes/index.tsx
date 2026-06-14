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
  addMinutesToTime,
  countAbsences,
  getActivePatients,
  getAgendaAppointmentsForDate,
  getAppointmentsToday,
  getClinics,
  getPatients,
  timeFromIso,
  toDateKey,
} from "@/lib/store";
import type { Appointment, Clinic, Patient } from "@/lib/store/types";

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

type AppointmentSummary = {
  appointment: Appointment;
  patientName: string;
  origin: string;
  type: string;
  start: string;
  end: string;
  date: string;
};

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

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function appointmentSummary(
  appointment: Appointment,
  patients: Patient[],
  clinics: Clinic[],
): AppointmentSummary {
  const patient = patients.find((item) => item.id === appointment.patientId);
  const clinic = patient?.clinicId
    ? clinics.find((item) => item.id === patient.clinicId)
    : undefined;
  const start = timeFromIso(appointment.startsAt);

  return {
    appointment,
    patientName: patient?.name ?? "Paciente",
    origin: patient?.paymentType === "clinica" ? clinic?.name ?? "Clínica" : "Particular",
    type:
      patient?.attendanceTypeName ??
      (patient?.paymentType === "clinica" ? "Clínica" : "Terapia"),
    start,
    end: addMinutesToTime(start, appointment.durationMin),
    date: new Date(appointment.startsAt).toLocaleDateString("pt-BR"),
  };
}

function getCurrentAppointment(now: Date) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return (
    getAgendaAppointmentsForDate(toDateKey(now)).find((appointment) => {
      if (appointment.status !== "agendado") return false;
      const start = toMinutes(timeFromIso(appointment.startsAt));
      const end = start + appointment.durationMin;
      return currentMinutes >= start && currentMinutes < end;
    }) ?? null
  );
}

function getUpcomingAppointment(now: Date) {
  const today = toDateKey(now);

  for (let offset = 0; offset < 120; offset += 1) {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() + offset);
    const items = getAgendaAppointmentsForDate(toDateKey(date))
      .filter(
        (appointment) =>
          appointment.status === "agendado" &&
          new Date(appointment.startsAt).getTime() > now.getTime(),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    if (items[0]) return items[0];
  }

  return null;
}

function AppointmentBlock({
  title,
  appointment,
  empty,
}: {
  title: string;
  appointment: AppointmentSummary | null;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          {appointment ? (
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(220px,auto)] sm:gap-8">
              <div className="grid gap-2">
                <div className="truncate text-xl font-bold text-foreground sm:text-2xl">
                  {appointment.patientName}
                </div>
                <div className="text-muted-foreground">{appointment.date}</div>
                <div className="font-semibold text-foreground">
                  Horário: {appointment.start} - {appointment.end}
                </div>
              </div>
              <div className="grid gap-2 rounded-lg border border-border bg-background/30 px-3 py-2.5 text-muted-foreground">
                <div>Duração: {appointment.appointment.durationMin} min</div>
                <div>Origem: {appointment.origin}</div>
                <div>Tipo de atendimento: {appointment.type}</div>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-base font-semibold text-muted-foreground">
              {empty}
            </div>
          )}
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card/60 text-foreground">
          <Clock className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const [greeting, setGreeting] = useState("Bom dia");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [activePatients, setActivePatients] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [absences, setAbsences] = useState(0);
  const [current, setCurrent] = useState<AppointmentSummary | null>(null);
  const [next, setNext] = useState<AppointmentSummary | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
    setNotes(loadNotes());

    setActivePatients(getActivePatients().length);
    setTodayCount(getAppointmentsToday().length);
    setAbsences(countAbsences());

    const now = new Date();
    const patients = getPatients();
    const clinics = getClinics();
    const currentAppointment = getCurrentAppointment(now);
    const upcoming = getUpcomingAppointment(now);
    setCurrent(
      currentAppointment ? appointmentSummary(currentAppointment, patients, clinics) : null,
    );
    setNext(upcoming ? appointmentSummary(upcoming, patients, clinics) : null);
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
          <div className="relative grid gap-4 lg:grid-cols-2">
            <AppointmentBlock
              title="Atendimento Atual"
              appointment={current}
              empty="Nenhum atendimento em andamento."
            />
            <AppointmentBlock
              title="Próximo Atendimento"
              appointment={next}
              empty="Nenhum próximo atendimento agendado."
            />
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label="Atendimentos hoje" value={String(todayCount)} icon={Calendar} />
          <Stat
            label="Pacientes Ativos"
            value={String(activePatients)}
            icon={Users}
          />
          <Stat
            label="Alertas de faltas"
            value={String(absences)}
            icon={AlertTriangle}
            tone={absences > 0 ? "warning" : "default"}
            hint={absences > 0 ? "Revise pacientes com faltas" : "Sem pacientes em atenção"}
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
