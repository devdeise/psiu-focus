import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  EyeOff,
  RotateCcw,
  Settings2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAgendaAppointmentsForDate,
  getAppointments,
  getCashEntries,
  clinicPaymentDueDate,
  getClinicPaymentRecords,
  getClinics,
  getMonthlyPaymentSummary,
  getPatients,
  monthKey,
  toDateKey,
} from "@/lib/store";
import type { Appointment, CashEntry, Clinic, Patient } from "@/lib/store/types";

export const Route = createFileRoute("/financas")({
  head: () => ({ meta: [{ title: "Finanças — PSIU!" }] }),
  component: FinancasPage,
});

type PeriodMode = "current" | "previous" | "custom";
type CardId =
  | "atingido"
  | "previsao"
  | "caixa"
  | "clinicas"
  | "perdas"
  | "particulares"
  | "weekday"
  | "ranking";

type CardConfig = {
  id: CardId;
  title: string;
};

type Period = {
  start: string;
  end: string;
};

const preferenceKey = "psiu:financas:cards";
const cardConfigs: CardConfig[] = [
  { id: "atingido", title: "Atingido" },
  { id: "previsao", title: "Previsão de Pagamento" },
  { id: "caixa", title: "Recebido no Caixa" },
  { id: "clinicas", title: "Aguardando Pagamento de Clínicas" },
  { id: "perdas", title: "Perdas Operacionais" },
  { id: "particulares", title: "Pagamentos Particulares Pendentes" },
  { id: "weekday", title: "Receita por Dia da Semana" },
  { id: "ranking", title: "Ranking de Clínicas" },
];

const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function defaultCardOrder() {
  return cardConfigs.map((card) => card.id);
}

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

function monthStart(month: string) {
  return `${month}-01`;
}

function monthEnd(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return toDateKey(new Date(year, monthIndex, 0));
}

function currentMonthPeriod(): Period {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function previousMonthPeriod(): Period {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function inPeriod(dateKey: string, period: Period) {
  return dateKey >= period.start && dateKey <= period.end;
}

function datesInPeriod(period: Period) {
  const dates: string[] = [];
  const current = parseDate(period.start);
  const end = parseDate(period.end);

  while (current <= end) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function monthOverlapsPeriod(month: string, period: Period) {
  return monthEnd(month) >= period.start && monthStart(month) <= period.end;
}

function loadVisibleCards(): CardId[] {
  const defaults = defaultCardOrder();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(preferenceKey);
    const parsed = raw ? (JSON.parse(raw) as CardId[]) : null;
    if (!parsed?.length) return defaults;
    const visible = defaults.filter((id) => parsed.includes(id));
    const forecastSeenKey = `${preferenceKey}:previsao-seen`;
    if (!window.localStorage.getItem(forecastSeenKey)) {
      window.localStorage.setItem(forecastSeenKey, "true");
      return visible.includes("previsao") ? visible : ([...visible, "previsao"] as CardId[]);
    }
    return visible;
  } catch {
    return defaults;
  }
}

function saveVisibleCards(cards: CardId[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(preferenceKey, JSON.stringify(cards));
}

function patientValue(patient?: Patient) {
  return Number(patient?.sessionValue) || 0;
}

function appointmentPatient(appointment: Appointment, patients: Map<string, Patient>) {
  return patients.get(appointment.patientId);
}

function FinancasPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("current");
  const [customStart, setCustomStart] = useState(currentMonthPeriod().start);
  const [customEnd, setCustomEnd] = useState(currentMonthPeriod().end);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [visibleCards, setVisibleCards] = useState<CardId[]>(loadVisibleCards);

  const appointments = useMemo(() => getAppointments(), []);
  const patients = useMemo(() => getPatients(), []);
  const clinics = useMemo(() => getClinics(), []);
  const cashEntries = useMemo(() => getCashEntries(), []);
  const clinicPaymentRecords = useMemo(() => getClinicPaymentRecords(), []);

  const period = useMemo<Period>(() => {
    if (periodMode === "previous") return previousMonthPeriod();
    if (periodMode === "custom") {
      return customStart <= customEnd
        ? { start: customStart, end: customEnd }
        : { start: customEnd, end: customStart };
    }
    return currentMonthPeriod();
  }, [customEnd, customStart, periodMode]);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );
  const clinicMap = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic])), [clinics]);

  const periodAppointments = useMemo(
    () => appointments.filter((item) => inPeriod(dateKeyFromIso(item.startsAt), period)),
    [appointments, period],
  );

  const realized = periodAppointments.filter((item) => item.status === "realizado");
  const lossStats = periodAppointments.reduce(
    (stats, appointment) => {
      if (
        appointment.status !== "falta" &&
        appointment.status !== "falta-justificada" &&
        appointment.status !== "cancelado"
      ) {
        return stats;
      }

      const value = patientValue(appointmentPatient(appointment, patientMap));
      if (appointment.status === "falta") stats.unjustifiedCount += 1;
      if (appointment.status === "falta-justificada") stats.justifiedCount += 1;
      if (appointment.status === "cancelado") stats.cancellationCount += 1;
      stats.total += value;
      return stats;
    },
    {
      total: 0,
      unjustifiedCount: 0,
      justifiedCount: 0,
      cancellationCount: 0,
    },
  );

  const achieved = realized.reduce((sum, appointment) => {
    return sum + patientValue(appointmentPatient(appointment, patientMap));
  }, 0);

  const cashReceived = cashEntries
    .filter((entry) => cashEntryInPeriod(entry, period))
    .reduce(
      (stats, entry) => {
        const amount = Number(entry.amount) || 0;
        const discount = entry.source === "clinica" ? Number(entry.discountAmount) || 0 : 0;
        const delayed = entry.delayed ?? Boolean(entry.month && entry.receivedMonth !== entry.month);
        if (delayed) stats.delayed += amount;
        else stats.onTime += amount;
        stats.discount += discount;
        stats.total += amount;
        return stats;
      },
      { total: 0, onTime: 0, delayed: 0, discount: 0 },
    );

  const productionCount = realized.length;
  const plannedCount = useMemo(
    () =>
      datesInPeriod(period).reduce(
        (sum, date) => sum + getAgendaAppointmentsForDate(date).length,
        0,
      ),
    [period],
  );
  const attainmentTotal = Math.max(plannedCount, productionCount);
  const attainmentPercent =
    attainmentTotal > 0 ? Math.round((productionCount / attainmentTotal) * 100) : 0;

  const paymentForecast = useMemo(
    () => getPaymentForecast(period, appointments, patientMap, clinicMap),
    [appointments, clinicMap, patientMap, period],
  );
  const clinicPending = getClinicPending(appointments, period, patientMap, clinicMap, clinicPaymentRecords);
  const particularPending = getParticularPending(realized, patientMap);
  const clinicRanking = getClinicRanking(realized, patientMap, clinicMap);
  const weekdayRevenue = getWeekdayRevenue(realized, patientMap);

  const toggleCard = (id: CardId) => {
    const next = visibleCards.includes(id)
      ? visibleCards.filter((item) => item !== id)
      : [...visibleCards, id];
    setVisibleCards(next);
    saveVisibleCards(next);
  };

  const isVisible = (id: CardId) => visibleCards.includes(id);

  const restoreDefaultOrder = () => {
    const next = defaultCardOrder();
    setVisibleCards(next);
    saveVisibleCards(next);
  };

  const renderFinanceCard = (id: CardId) => {
    switch (id) {
      case "atingido":
        return (
          <AtingidoCard
            percent={attainmentPercent}
            realized={productionCount}
            planned={attainmentTotal}
          />
        );
      case "previsao":
        return (
          <MetricCard
            title="Previsão de Pagamento"
            value={money(paymentForecast.net)}
            tone="info"
            icon={<CalendarDays className="h-5 w-5" />}
            action={
              <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm">
                <MoneyCounter label="Previsto bruto" value={paymentForecast.gross} />
                <MoneyCounter label="Descontos por falta" value={-paymentForecast.discounts} />
              </div>
            }
          />
        );
      case "caixa":
        return (
          <MetricCard
            title="Recebido no Caixa"
            value={money(cashReceived.total)}
            tone="success"
            icon={<Wallet className="h-5 w-5" />}
            action={
              <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm">
                <MoneyCounter label="No prazo" value={cashReceived.onTime} />
                <MoneyCounter label="Atrasados recebidos" value={cashReceived.delayed} />
                <MoneyCounter label="Desconto informado" value={cashReceived.discount} />
              </div>
            }
          />
        );
      case "clinicas":
        return (
          <MetricCard
            title="Aguardando Pagamento de Clínicas"
            value={money(clinicPending.total)}
            description={`Aguardando: ${money(clinicPending.awaiting)} · Atrasado: ${money(clinicPending.overdue)}`}
            tone={clinicPending.overdue > 0 ? "warning" : "default"}
            action={
              <Link to="/confirmar-pagamento">
                <Button size="sm" variant="outline">Ver detalhes</Button>
              </Link>
            }
          />
        );
      case "perdas":
        return (
          <MetricCard
            title="Perdas Operacionais"
            value={money(lossStats.total)}
            description="Impacto financeiro real do período selecionado."
            tone="danger"
            icon={<AlertTriangle className="h-5 w-5" />}
            action={
              <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm">
                <LossCounter label="Faltas" value={lossStats.unjustifiedCount} />
                <LossCounter label="Faltas justificadas" value={lossStats.justifiedCount} />
                <LossCounter label="Cancelamentos" value={lossStats.cancellationCount} />
              </div>
            }
          />
        );
      case "particulares":
        return (
          <MetricCard
            title="Pagamentos Particulares Pendentes"
            value={money(particularPending.total)}
            description={`${particularPending.patientCount} paciente(s) com pendência ou parcial.`}
            tone={particularPending.total > 0 ? "warning" : "default"}
            action={
              <Link to="/confirmar-pagamento">
                <Button size="sm" variant="outline">Ver detalhes</Button>
              </Link>
            }
          />
        );
      case "weekday":
        return (
          <DetailCard title="Receita por Dia da Semana">
            <div className="grid gap-3">
              {weekdayRevenue.map((item) => (
                <BarRow
                  key={item.weekday}
                  label={item.weekday}
                  value={money(item.amount)}
                  percent={achieved > 0 ? (item.amount / achieved) * 100 : 0}
                />
              ))}
            </div>
          </DetailCard>
        );
      case "ranking":
        return (
          <DetailCard title="Ranking de Clínicas">
            {clinicRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma produção de clínica no período.</p>
            ) : (
              <div className="grid gap-3">
                {clinicRanking.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        {index + 1}. {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.count} atendimento(s)
                      </div>
                    </div>
                    <Badge>{money(item.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </DetailCard>
        );
    }
  };

  const renderFinanceRow = (cards: CardId[], desktopColumns: string) => {
    const rowCards = cards.filter(isVisible);
    if (rowCards.length === 0) return null;

    return (
      <section className={`grid gap-4 md:grid-cols-2 ${desktopColumns}`}>
        {rowCards.map((id) => (
          <div key={id} className="min-h-full">
            {renderFinanceCard(id)}
          </div>
        ))}
      </section>
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Finanças</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Visão operacional e financeira baseada nos atendimentos e pagamentos salvos localmente.
            </p>
          </div>
          <Button variant="outline" onClick={() => setCustomizeOpen((value) => !value)}>
            <Settings2 className="h-4 w-4" /> Personalizar cards
          </Button>
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

        {customizeOpen && (
          <section className="glass-card p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Exibir cards</div>
                <p className="text-xs text-muted-foreground">
                  Escolha quais cards aparecem na tela.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={restoreDefaultOrder}>
                <RotateCcw className="h-4 w-4" /> Restaurar padrão
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cardConfigs.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleCard(card.id)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    isVisible(card.id)
                      ? "border-primary bg-primary/15 text-foreground shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                      : "border-border bg-card/40 text-muted-foreground"
                  }`}
                >
                  {isVisible(card.id) ? card.title : <span><EyeOff className="mr-1 inline h-3.5 w-3.5" />{card.title}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4">
          {renderFinanceRow(["atingido", "caixa", "previsao"], "lg:grid-cols-3")}
          {renderFinanceRow(
            ["perdas", "clinicas", "particulares"],
            "lg:grid-cols-3",
          )}
          {renderFinanceRow(["weekday", "ranking"], "lg:grid-cols-2")}
        </div>
      </div>
    </AppLayout>
  );
}

function cashEntryInPeriod(entry: CashEntry, period: Period) {
  if (entry.receivedMonth) return monthOverlapsPeriod(entry.receivedMonth, period);
  return inPeriod(dateKeyFromIso(entry.createdAt), period);
}

function forecastSourcePeriod(period: Period) {
  const start = parseDate(period.start);
  start.setMonth(start.getMonth() - 6);
  return { start: toDateKey(start), end: period.end };
}

function getForecastAppointments(period: Period, savedAppointments: Appointment[]) {
  const sourcePeriod = forecastSourcePeriod(period);
  const byId = new Map<string, Appointment>();

  for (const date of datesInPeriod(sourcePeriod)) {
    for (const appointment of getAgendaAppointmentsForDate(date)) {
      byId.set(appointment.id, appointment);
    }
  }

  for (const appointment of savedAppointments) {
    const appointmentDate = dateKeyFromIso(appointment.startsAt);
    if (appointment.status === "cancelado" && inPeriod(appointmentDate, sourcePeriod)) {
      byId.set(appointment.id, appointment);
    }
  }

  return [...byId.values()];
}

function forecastReceiptDate(
  appointment: Appointment,
  patient: Patient,
  clinicMap: Map<string, Clinic>,
) {
  const appointmentDate = dateKeyFromIso(appointment.startsAt);
  if (patient.paymentType === "clinica") {
    const clinic = clinicMap.get(patient.clinicId ?? appointment.clinicId ?? "");
    return toDateKey(clinicPaymentDueDate(appointmentDate, clinic));
  }
  return appointmentDate;
}

function getPaymentForecast(
  period: Period,
  savedAppointments: Appointment[],
  patientMap: Map<string, Patient>,
  clinicMap: Map<string, Clinic>,
) {
  const grossKeys = new Set<string>();
  const discountKeys = new Set<string>();

  return getForecastAppointments(period, savedAppointments).reduce(
    (stats, appointment) => {
      const patient = patientMap.get(appointment.patientId);
      if (!patient || patient.status !== "ativo") return stats;

      const receiptDate = forecastReceiptDate(appointment, patient, clinicMap);
      if (!inPeriod(receiptDate, period)) return stats;

      const value = patientValue(patient);
      const appointmentMonth = monthKey(dateKeyFromIso(appointment.startsAt));
      const isMonthly = patient.paymentType === "particular" && patient.paymentFrequency === "mensal";
      const grossKey = isMonthly
        ? `mensal:${patient.id}:${appointmentMonth}`
        : appointment.id;

      if (!grossKeys.has(grossKey)) {
        grossKeys.add(grossKey);
        stats.gross += value;
      }

      if (appointment.status === "falta" || appointment.status === "cancelado") {
        const discountKey = isMonthly
          ? `mensal:${patient.id}:${appointmentMonth}`
          : appointment.id;
        if (!discountKeys.has(discountKey)) {
          discountKeys.add(discountKey);
          stats.discounts += value;
        }
      }

      stats.net = Math.max(stats.gross - stats.discounts, 0);
      return stats;
    },
    { gross: 0, discounts: 0, net: 0 },
  );
}

function getClinicPending(
  appointments: Appointment[],
  period: Period,
  patientMap: Map<string, Patient>,
  clinicMap: Map<string, Clinic>,
  records: ReturnType<typeof getClinicPaymentRecords>,
) {
  const now = new Date();
  let awaiting = 0;
  let overdue = 0;

  for (const appointment of appointments) {
    if (appointment.status !== "realizado") continue;
    const patient = patientMap.get(appointment.patientId);
    if (!patient || patient.paymentType !== "clinica") continue;
    const clinicId = patient.clinicId ?? appointment.clinicId ?? "";
    const clinic = clinicMap.get(clinicId);
    if (!clinic) continue;
    const dueDate = clinicPaymentDueDate(dateKeyFromIso(appointment.startsAt), clinic);
    const dueDateKey = toDateKey(dueDate);
    if (!inPeriod(dueDateKey, period)) continue;
    const dueMonth = monthKey(dueDateKey);
    const record = records.find((item) => item.clinicId === clinicId && item.month === dueMonth);
    if (appointment.repasseConfirmed || record?.status === "confirmado") continue;
    const value = patientValue(patient);
    if (record?.status === "atrasado" || now > dueDate) overdue += value;
    else awaiting += value;
  }

  return { awaiting, overdue, total: awaiting + overdue };
}

function getParticularPending(realized: Appointment[], patientMap: Map<string, Patient>) {
  let total = 0;
  const patientIds = new Set<string>();
  const monthlyGroups = new Map<string, { patient: Patient; month: string }>();

  for (const appointment of realized) {
    const patient = patientMap.get(appointment.patientId);
    if (!patient || patient.paymentType !== "particular") continue;
    const month = monthKey(dateKeyFromIso(appointment.startsAt));
    if (patient.paymentFrequency === "sessao" && !appointment.paid) {
      total += patientValue(patient);
      patientIds.add(patient.id);
    }
    if (patient.paymentFrequency === "mensal") {
      monthlyGroups.set(`${patient.id}:${month}`, { patient, month });
    }
  }

  for (const { patient, month } of monthlyGroups.values()) {
    const summary = getMonthlyPaymentSummary(patient.id, month, patient.sessionValue);
    if (summary.status === "pendente" || summary.status === "parcial") {
      total += summary.balance;
      patientIds.add(patient.id);
    }
  }

  return { total, patientCount: patientIds.size };
}

function getClinicRanking(
  realized: Appointment[],
  patientMap: Map<string, Patient>,
  clinicMap: Map<string, Clinic>,
) {
  const totals = new Map<string, { id: string; name: string; amount: number; count: number }>();

  for (const appointment of realized) {
    const patient = patientMap.get(appointment.patientId);
    if (!patient || patient.paymentType !== "clinica") continue;
    const clinicId = patient.clinicId ?? appointment.clinicId ?? "";
    const clinic = clinicMap.get(clinicId);
    if (!clinic) continue;
    const current = totals.get(clinic.id) ?? {
      id: clinic.id,
      name: clinic.name,
      amount: 0,
      count: 0,
    };
    current.amount += patientValue(patient);
    current.count += 1;
    totals.set(clinic.id, current);
  }

  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}

function getWeekdayRevenue(realized: Appointment[], patientMap: Map<string, Patient>) {
  const totals = weekdays.map((weekday) => ({ weekday, amount: 0 }));
  for (const appointment of realized) {
    const patient = patientMap.get(appointment.patientId);
    const weekday = new Date(appointment.startsAt).getDay();
    totals[weekday].amount += patientValue(patient);
  }
  return totals;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  action,
  tone = "default",
}: {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "warning" | "success" | "info" | "danger";
}) {
  const toneStyles = {
    default: {
      card: "",
      value: "text-foreground",
      icon: "border-border bg-card/50 text-primary",
    },
    warning: {
      card: "border-warning/30 bg-warning/5",
      value: "text-foreground",
      icon: "border-warning/30 bg-warning/10 text-warning",
    },
    success: {
      card: "border-emerald-400/30 bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(15,23,42,0.76))] shadow-[0_0_26px_rgba(16,185,129,0.13)]",
      value: "text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.34)]",
      icon: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.18)]",
    },
    info: {
      card: "border-sky-400/30 bg-[linear-gradient(135deg,rgba(14,56,118,0.28),rgba(15,23,42,0.76))] shadow-[0_0_26px_rgba(56,189,248,0.13)]",
      value: "text-sky-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.34)]",
      icon: "border-sky-400/30 bg-sky-400/10 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.18)]",
    },
    danger: {
      card: "border-rose-400/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.25),rgba(15,23,42,0.78))] shadow-[0_0_26px_rgba(244,63,94,0.12)]",
      value: "text-rose-300 drop-shadow-[0_0_10px_rgba(253,164,175,0.32)]",
      icon: "border-rose-400/30 bg-rose-400/10 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.18)]",
    },
  }[tone];

  return (
    <article
      className={`glass-card h-full p-5 ${toneStyles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          <div className={`mt-2 truncate text-2xl font-black ${toneStyles.value}`}>{value}</div>
        </div>
        {icon && <div className={`rounded-lg border p-2 ${toneStyles.icon}`}>{icon}</div>}
      </div>
      {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </article>
  );
}

function AtingidoCard({
  percent,
  realized,
  planned,
}: {
  percent: number;
  realized: number;
  planned: number;
}) {
  return (
    <article className="glass-card h-full p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Atingido
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="text-4xl font-black leading-none tracking-tight">
          {percent}%
        </div>
        <p className="pb-0.5 text-sm text-muted-foreground">
          {realized} sessões realizadas de {planned} previstas
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_14px_rgba(34,211,238,0.45)]"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Produção operacional do período selecionado. Não inclui recebimentos atrasados ou caixa de outras competências.
      </p>
    </article>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="glass-card h-full p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function LossCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function MoneyCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold tabular-nums">{money(value)}</span>
    </div>
  );
}

function BarRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_14px_rgba(34,211,238,0.45)]"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
