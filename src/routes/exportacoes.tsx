import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, FileDown } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAgendaAppointmentsForDate,
  getClinics,
  getPatients,
  parseDateKey,
  normalizePatientSchedules,
  timeFromIso,
} from "@/lib/store";
import type { Appointment, Clinic, Patient } from "@/lib/store/types";

export const Route = createFileRoute("/exportacoes")({
  head: () => ({ meta: [{ title: "Exportações — PSIU!" }] }),
  component: ExportacoesPage,
});

type DateFilterMode = "month" | "custom";
type ExportFormat = "csv" | "excel";

const reportTypes = [
  { value: "agenda", label: "Agenda" },
  { value: "pacientes", label: "Pacientes" },
  { value: "clinicas", label: "Clínicas" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "historico-pagamentos", label: "Histórico de pagamentos" },
  { value: "financas", label: "Finanças" },
  { value: "faltas", label: "Faltas" },
  { value: "anotacoes", label: "Anotações" },
];

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthPeriod(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const current = parseDateKey(start);
  const last = parseDateKey(end);

  while (current <= last) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function moneyCell(value: number) {
  return (Number(value) || 0).toFixed(2).replace(".", ",");
}

function statusLabel(status: Appointment["status"]) {
  if (status === "realizado") return "Realizado";
  if (status === "falta") return "Falta";
  if (status === "falta-justificada") return "Falta justificada";
  if (status === "cancelado") return "Cancelado";
  return "Pendente";
}

function patientOrigin(patient: Patient) {
  return patient.paymentType === "clinica" ? "Clínica" : "Particular";
}

function paymentFrequencyLabel(patient: Patient) {
  return patient.paymentFrequency === "mensal" ? "Mensal" : "Por sessão";
}

function weekdayLabel(weekday: string) {
  const labels: Record<string, string> = {
    "0": "Domingo",
    "1": "Segunda-feira",
    "2": "Terça-feira",
    "3": "Quarta-feira",
    "4": "Quinta-feira",
    "5": "Sexta-feira",
    "6": "Sábado",
  };
  return labels[weekday] ?? weekday;
}

function schedulesLabel(patient: Patient) {
  return normalizePatientSchedules(patient)
    .map(
      (schedule) =>
        `${weekdayLabel(schedule.weekday)} ${schedule.time} (${schedule.durationMinutes} min)`,
    )
    .join(" | ");
}

function clinicPaymentTermLabel(clinic: Clinic) {
  const days = Number(clinic.paymentTermDays) || 30;
  if (clinic.paymentTermType === "custom") return `${days} dias`;
  if (clinic.paymentTermType === "60_days") return "60 dias";
  return "30 dias";
}

function clinicStatusLabel(clinic: Clinic, patients: Patient[]) {
  return patients.some((patient) => patient.status === "ativo" && patient.clinicId === clinic.id)
    ? "Ativa"
    : "Sem pacientes ativos";
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function periodSlug(period: { start: string; end: string }) {
  return period.start === period.end ? period.start : `${period.start}_a_${period.end}`;
}

function buildMonthOptions() {
  const now = new Date();
  return Array.from({ length: 25 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 12 + index, 1);
    const value = monthKey(date);
    return {
      value,
      label: `${monthNames[date.getMonth()]}/${date.getFullYear()}`,
    };
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ExportacoesPage() {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [reportType, setReportType] = useState("");
  const [dateMode, setDateMode] = useState<DateFilterMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const selectedPeriod =
    dateMode === "month"
      ? monthPeriod(selectedMonth)
      : { start: customStart || "—", end: customEnd || "—" };

  const exportData = () => {
    if (!reportType) {
      setMessage({ type: "error", text: "Selecione um tipo de relatório." });
      return;
    }
    if (dateMode === "custom" && (!customStart || !customEnd || customEnd < customStart)) {
      setMessage({ type: "error", text: "Informe um período válido." });
      return;
    }

    const period =
      dateMode === "month" ? monthPeriod(selectedMonth) : { start: customStart, end: customEnd };

    if (reportType === "agenda" && format === "csv") {
      const patients = getPatients();
      const clinics = getClinics();
      const rows = dateRange(period.start, period.end).flatMap((dateKey) =>
        getAgendaAppointmentsForDate(dateKey).map((appointment) => {
          const patient = patients.find((item) => item.id === appointment.patientId);
          const clinic = clinics.find((item) => item.id === (appointment.clinicId ?? patient?.clinicId));
          const isClinic = patient?.paymentType === "clinica";

          return [
            patient?.name ?? "Paciente não encontrado",
            dateKey,
            timeFromIso(appointment.startsAt),
            statusLabel(appointment.status),
            isClinic ? "Clínica" : "Particular",
            isClinic ? clinic?.name ?? "" : "",
            patient?.attendanceTypeName ?? "",
            moneyCell(Number(patient?.sessionValue) || 0),
            appointment.notes ?? "",
          ];
        }),
      );

      if (!rows.length) {
        setMessage({ type: "error", text: "Nenhum dado encontrado para o período selecionado." });
        return;
      }

      downloadCsv(`psiu-exportacao-agenda-${periodSlug(period)}.csv`, [
        [
          "paciente",
          "data",
          "horário",
          "status",
          "origem",
          "clínica",
          "tipo de atendimento",
          "valor",
          "observação",
        ],
        ...rows,
      ]);
      setMessage({ type: "success", text: "Arquivo exportado com sucesso." });
      return;
    }

    if (reportType === "pacientes" && format === "csv") {
      const patients = getPatients();
      const clinics = getClinics();
      const rows = patients.map((patient) => {
        const clinic = clinics.find((item) => item.id === patient.clinicId);

        return [
          patient.name,
          patientOrigin(patient),
          clinic?.name ?? "",
          patient.attendanceTypeName ?? "",
          moneyCell(Number(patient.sessionValue) || 0),
          paymentFrequencyLabel(patient),
          patient.agendaStartDate ?? patient.createdAt.slice(0, 10),
          schedulesLabel(patient),
          patient.status === "ativo" ? "Ativo" : "Encerrado",
        ];
      });

      if (!rows.length) {
        setMessage({ type: "error", text: "Nenhum dado encontrado para o período selecionado." });
        return;
      }

      downloadCsv(`psiu-exportacao-pacientes-${periodSlug(period)}.csv`, [
        [
          "nome",
          "origem",
          "clínica",
          "tipo de atendimento",
          "valor",
          "modelo de cobrança",
          "data de início da agenda",
          "dias e horários",
          "status",
        ],
        ...rows,
      ]);
      setMessage({ type: "success", text: "Arquivo exportado com sucesso." });
      return;
    }

    if (reportType === "clinicas" && format === "csv") {
      const clinics = getClinics();
      const patients = getPatients();
      const rows = clinics.map((clinic) => {
        const attendanceTypes = clinic.attendanceTypes ?? [];
        const linkedPatients = patients.filter((patient) => patient.clinicId === clinic.id);

        return [
          clinic.name,
          attendanceTypes.map((type) => type.name).join(" | "),
          attendanceTypes.map((type) => moneyCell(Number(type.value) || 0)).join(" | "),
          clinicPaymentTermLabel(clinic),
          linkedPatients.length,
          clinicStatusLabel(clinic, patients),
        ];
      });

      if (!rows.length) {
        setMessage({ type: "error", text: "Nenhum dado encontrado para o período selecionado." });
        return;
      }

      downloadCsv(`psiu-exportacao-clinicas-${periodSlug(period)}.csv`, [
        [
          "nome da clínica",
          "tipos de atendimento",
          "valores",
          "prazo de pagamento",
          "quantidade de pacientes",
          "status",
        ],
        ...rows,
      ]);
      setMessage({ type: "success", text: "Arquivo exportado com sucesso." });
      return;
    }

    setMessage({
      type: "success",
      text: "Estrutura de exportação criada. Os relatórios serão conectados na próxima etapa.",
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Exportações</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gere arquivos com os dados do PSIU! por mês ou período personalizado.
          </p>
        </header>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="glass-card p-5">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card/60 text-primary shadow-[0_0_18px_rgba(34,211,238,0.18)]">
                <FileDown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Configurar exportação</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha o relatório, o período e o formato do arquivo.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Tipo de relatório">
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um relatório" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((report) => (
                      <SelectItem key={report.value} value={report.value}>
                        {report.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Formato">
                <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel" disabled>
                      Excel (em breve)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 rounded-lg border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Filtro de data
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDateMode("month")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                    dateMode === "month"
                      ? "border-primary bg-primary/15 text-foreground shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-border bg-card/30 text-muted-foreground hover:bg-card/50"
                  }`}
                >
                  <span className="block font-semibold">Lista de meses com ano</span>
                  <span className="mt-1 block text-xs">Use um mês fechado, do primeiro ao último dia.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDateMode("custom")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                    dateMode === "custom"
                      ? "border-primary bg-primary/15 text-foreground shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-border bg-card/30 text-muted-foreground hover:bg-card/50"
                  }`}
                >
                  <span className="block font-semibold">Período personalizado</span>
                  <span className="mt-1 block text-xs">Defina data inicial e final manualmente.</span>
                </button>
              </div>

              {dateMode === "month" ? (
                <Field label="Mês/Ano">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Data inicial">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                    />
                  </Field>
                  <Field label="Data final">
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Período selecionado:{" "}
                <span className="font-semibold text-foreground">
                  {selectedPeriod.start} até {selectedPeriod.end}
                </span>
              </div>
              <Button type="button" onClick={exportData} className="w-full sm:w-auto">
                <FileDown className="h-4 w-4" /> Exportar
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
