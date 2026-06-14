import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAppointments, getPatients, savePatients, toDateKey } from "@/lib/store";
import type { Appointment, Patient } from "@/lib/store/types";

export const Route = createFileRoute("/analise-faltas")({
  head: () => ({ meta: [{ title: "Análise de Faltas — PSIU!" }] }),
  component: AnaliseFaltasPage,
});

type PeriodMode = "current" | "previous" | "custom";
type Period = {
  start: string;
  end: string;
};
type AbsenceStatus = "Em atenção" | "Em observação" | "Atenção mista" | "Sem alerta";
type PatientAbsenceSummary = {
  patient: Patient;
  unjustified: number;
  justified: number;
  total: number;
  status: AbsenceStatus;
  financialLoss: number;
  actionEnabled: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function dateKeyFromIso(iso: string) {
  return toDateKey(new Date(iso));
}

function currentMonthPeriod(): Period {
  const now = new Date();
  return {
    start: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function previousMonthPeriod(): Period {
  const now = new Date();
  return {
    start: toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    end: toDateKey(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

function inPeriod(dateKey: string, period: Period) {
  return dateKey >= period.start && dateKey <= period.end;
}

function patientValue(patient: Patient) {
  return Number(patient.sessionValue) || 0;
}

function absenceStatus(unjustified: number, justified: number): AbsenceStatus {
  const total = unjustified + justified;
  if (unjustified > 0 && justified > 0 && total >= 3) return "Atenção mista";
  if (unjustified >= 3) return "Em atenção";
  if (justified >= 3) return "Em observação";
  return "Sem alerta";
}

function statusVariant(status: AbsenceStatus) {
  if (status === "Em atenção") return "destructive";
  if (status === "Em observação") return "outline";
  if (status === "Atenção mista") return "secondary";
  return "default";
}

function buildSummaries(
  appointments: Appointment[],
  patients: Patient[],
  period: Period,
): PatientAbsenceSummary[] {
  const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
  const summaries = new Map<string, PatientAbsenceSummary>();

  for (const appointment of appointments) {
    if (appointment.status !== "falta" && appointment.status !== "falta-justificada") continue;
    if (!inPeriod(dateKeyFromIso(appointment.startsAt), period)) continue;

    const patient = patientMap.get(appointment.patientId);
    if (!patient) continue;

    const current =
      summaries.get(patient.id) ??
      {
        patient,
        unjustified: 0,
        justified: 0,
        total: 0,
        status: "Sem alerta" as const,
        financialLoss: 0,
        actionEnabled: false,
      };

    if (appointment.status === "falta") {
      current.unjustified += 1;
      current.financialLoss += patientValue(patient);
    } else {
      current.justified += 1;
    }

    current.total = current.unjustified + current.justified;
    current.status = absenceStatus(current.unjustified, current.justified);
    current.actionEnabled =
      current.unjustified >= 3 || current.justified >= 3 || current.total >= 3;
    summaries.set(patient.id, current);
  }

  return [...summaries.values()].sort((a, b) => {
    if (b.actionEnabled !== a.actionEnabled) return Number(b.actionEnabled) - Number(a.actionEnabled);
    if (b.total !== a.total) return b.total - a.total;
    return a.patient.name.localeCompare(b.patient.name);
  });
}

function AnaliseFaltasPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("current");
  const [customStart, setCustomStart] = useState(currentMonthPeriod().start);
  const [customEnd, setCustomEnd] = useState(currentMonthPeriod().end);
  const [patients, setPatients] = useState<Patient[]>(() => getPatients());
  const [appointments] = useState<Appointment[]>(() => getAppointments());
  const [selected, setSelected] = useState<PatientAbsenceSummary | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState("");

  const period = useMemo<Period>(() => {
    if (periodMode === "previous") return previousMonthPeriod();
    if (periodMode === "custom") {
      return customStart <= customEnd
        ? { start: customStart, end: customEnd }
        : { start: customEnd, end: customStart };
    }
    return currentMonthPeriod();
  }, [customEnd, customStart, periodMode]);

  const summaries = useMemo(
    () => buildSummaries(appointments, patients, period),
    [appointments, patients, period],
  );

  const alertCount = summaries.filter((summary) => summary.actionEnabled).length;
  const totalLoss = summaries.reduce((sum, summary) => sum + summary.financialLoss, 0);

  const keepPatient = () => {
    setMessage(`${selected?.patient.name ?? "Paciente"} mantido na agenda.`);
    setSelected(null);
  };

  const removeFromAgenda = () => {
    if (!selected) return;
    const now = new Date().toISOString();
    const nextPatients = patients.map((patient) =>
      patient.id === selected.patient.id
        ? { ...patient, status: "encerrado" as const, closedAt: now }
        : patient,
    );
    setPatients(nextPatients);
    savePatients(nextPatients);
    setMessage(`${selected.patient.name} foi movido para Encerrados. Histórico preservado.`);
    setSelected(null);
    setConfirmRemove(false);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Análise de Faltas
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Identifique excesso de faltas, acompanhe justificativas e veja o impacto operacional.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
            <SummaryPill
              label="Pacientes em alerta"
              value={String(alertCount)}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <SummaryPill
              label="Perda financeira"
              value={money(totalLoss)}
              icon={<ClipboardList className="h-4 w-4" />}
            />
          </div>
        </header>

        <section className="glass-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Período
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={periodMode === "current" ? "default" : "outline"}
                  onClick={() => setPeriodMode("current")}
                >
                  Mês atual
                </Button>
                <Button
                  size="sm"
                  variant={periodMode === "previous" ? "default" : "outline"}
                  onClick={() => setPeriodMode("previous")}
                >
                  Mês anterior
                </Button>
                <Button
                  size="sm"
                  variant={periodMode === "custom" ? "default" : "outline"}
                  onClick={() => setPeriodMode("custom")}
                >
                  Período personalizado
                </Button>
              </div>
            </div>

            {periodMode === "custom" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Início
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Fim
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>
                {parseDate(period.start).toLocaleDateString("pt-BR")} até{" "}
                {parseDate(period.end).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <section className="hidden overflow-hidden rounded-xl border border-border bg-card/40 lg:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Não justificadas</th>
                <th className="px-4 py-3">Justificadas</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Perda financeira</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    Nenhuma falta registrada no período.
                  </td>
                </tr>
              ) : (
                summaries.map((summary) => (
                  <tr key={summary.patient.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{summary.patient.name}</td>
                    <td className="px-4 py-3">{summary.unjustified}</td>
                    <td className="px-4 py-3">{summary.justified}</td>
                    <td className="px-4 py-3">{summary.total}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(summary.status)}>{summary.status}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{money(summary.financialLoss)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!summary.actionEnabled || summary.patient.status === "encerrado"}
                        onClick={() => setSelected(summary)}
                      >
                        Ações
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 lg:hidden">
          {summaries.length === 0 ? (
            <div className="glass-card p-5 text-sm text-muted-foreground">
              Nenhuma falta registrada no período.
            </div>
          ) : (
            summaries.map((summary) => (
              <article key={summary.patient.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">{summary.patient.name}</h2>
                    <div className="mt-2">
                      <Badge variant={statusVariant(summary.status)}>{summary.status}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Perda</div>
                    <div className="font-black">{money(summary.financialLoss)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <Counter label="Não just." value={summary.unjustified} />
                  <Counter label="Just." value={summary.justified} />
                  <Counter label="Total" value={summary.total} />
                </div>
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={!summary.actionEnabled || summary.patient.status === "encerrado"}
                  onClick={() => setSelected(summary)}
                >
                  Ações
                </Button>
              </article>
            ))
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-glow">
            {!confirmRemove ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black">Ações do paciente</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha como seguir com {selected.patient.name}.
                    </p>
                  </div>
                  <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                </div>

                <div className="mt-4 grid gap-2 rounded-lg border border-border bg-background/35 p-3 text-sm">
                  <InfoRow label="Faltas não justificadas" value={String(selected.unjustified)} />
                  <InfoRow label="Faltas justificadas" value={String(selected.justified)} />
                  <InfoRow label="Total de faltas" value={String(selected.total)} />
                  <InfoRow label="Perda financeira" value={money(selected.financialLoss)} />
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cancelar
                  </Button>
                  <Button variant="outline" onClick={keepPatient}>
                    <CheckCircle2 className="h-4 w-4" /> Manter na Agenda
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirmRemove(true)}>
                    <UserX className="h-4 w-4" /> Retirar da Agenda
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-black">Retirar da Agenda?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selected.patient.name} será movido para Encerrados e não aparecerá mais nos
                  próximos atendimentos. Histórico, pagamentos e registros anteriores serão preservados.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setConfirmRemove(false)}>
                    Voltar
                  </Button>
                  <Button variant="destructive" onClick={removeFromAgenda}>
                    Confirmar retirada
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SummaryPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="text-xl font-black">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
