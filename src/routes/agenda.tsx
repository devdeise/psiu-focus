import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Plane,
  RotateCcw,
  Search,
  Umbrella,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addCashEntry,
  addMinutesToTime,
  combineDateTime,
  getAgendaAppointmentsForDate,
  dateKeyFromIso,
  getCashEntries,
  getClinics,
  getDayStatus,
  getMonthlyPaymentSummary,
  getPatients,
  getVacations,
  isMonthlyPaid,
  isVacationDate,
  monthKey,
  normalizePatientSchedules,
  parseDateKey,
  recordMonthlyPayment,
  saveDayStatus,
  savePatients,
  saveVacations,
  timeFromIso,
  toDateKey,
  upsertAppointment,
} from "@/lib/store";
import type { Appointment, Clinic, Patient, VacationPeriod } from "@/lib/store/types";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — PSIU!" }] }),
  component: AgendaPage,
});

type AgendaItem = Appointment & {
  patient: Patient;
  clinic?: Clinic;
};

type RescheduleDraft = {
  appointment: AgendaItem;
  date: string;
  time: string;
  duration: string;
  scope: "single" | "recurring" | "";
};

type ConflictInfo = {
  draft: RescheduleDraft;
  existingAppointment: Appointment;
  existingPatient: Patient;
  existingClinic?: Clinic;
  attempted: {
    patientName: string;
    date: string;
    weekday: string;
    start: string;
    duration: number;
    end: string;
  };
  existing: {
    patientName: string;
    date: string;
    weekday: string;
    start: string;
    duration: number;
    end: string;
  };
  message: string;
};

type StatusChangeValue = "realizado" | "falta" | "falta-justificada" | "agendado";

type StatusChangeDraft = {
  appointment: AgendaItem;
  status: StatusChangeValue;
  reason: string;
  note: string;
};

type JustifiedAbsenceDraft = {
  appointment: AgendaItem;
  reason: string;
  otherReason: string;
  note: string;
};

type MonthlyPaymentChoice = "integral" | "parcial" | "nao-recebido";

type MonthlyPaymentDraft = {
  appointment: AgendaItem;
  month: string;
  choice: MonthlyPaymentChoice;
  amountReceived: string;
};

type SessionPresenceChoice = "received" | "not-received" | "";

type SessionPresenceDraft = {
  appointment: AgendaItem;
  paymentReceived: SessionPresenceChoice;
};

const durationOptions = [30, 45, 50, 60, 90, 120] as const;
const justifiedAbsenceReasons = [
  "Problema de saúde",
  "Viagem",
  "Trabalho",
  "Emergência familiar",
  "Transporte",
  "Outro",
] as const;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function appointmentTime(item: Appointment) {
  return timeFromIso(item.startsAt);
}

function appointmentEnd(item: Appointment) {
  return addMinutesToTime(appointmentTime(item), item.durationMin);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function weekdayLabel(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("pt-BR", { weekday: "long" });
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: Appointment["status"]) {
  if (status === "realizado") return "Realizado";
  if (status === "falta") return "Falta";
  if (status === "falta-justificada") return "Falta justificada";
  if (status === "cancelado") return "Cancelado";
  return "Pendente";
}

function isDone(item: Appointment) {
  return ["realizado", "falta", "falta-justificada"].includes(item.status);
}

function uid() {
  return crypto.randomUUID();
}

function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [reschedule, setReschedule] = useState<RescheduleDraft | null>(null);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [vacationStart, setVacationStart] = useState(selectedDate);
  const [vacationEnd, setVacationEnd] = useState(selectedDate);
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [manageVacationsOpen, setManageVacationsOpen] = useState(false);
  const [absenceToConfirm, setAbsenceToConfirm] = useState<AgendaItem | null>(null);
  const [rescheduleConflict, setRescheduleConflict] = useState<ConflictInfo | null>(null);
  const [rescheduleContext, setRescheduleContext] = useState("");
  const [statusChange, setStatusChange] = useState<StatusChangeDraft | null>(null);
  const [statusAbsenceConfirmOpen, setStatusAbsenceConfirmOpen] = useState(false);
  const [justifiedAbsence, setJustifiedAbsence] = useState<JustifiedAbsenceDraft | null>(null);
  const [monthlyPayment, setMonthlyPayment] = useState<MonthlyPaymentDraft | null>(null);
  const [sessionPresence, setSessionPresence] = useState<SessionPresenceDraft | null>(null);

  const reload = () => {
    setPatients(getPatients());
    setClinics(getClinics());
    setAppointments(getAgendaAppointmentsForDate(selectedDate));
    setVacations(getVacations());
  };

  useEffect(() => {
    reload();
  }, [selectedDate]);

  const vacationForDay = useMemo(
    () =>
      vacations.find(
        (period) => period.startsOn <= selectedDate && period.endsOn >= selectedDate,
      ),
    [selectedDate, vacations],
  );

  useEffect(() => {
    if (vacationForDay) {
      setVacationStart(vacationForDay.startsOn);
      setVacationEnd(vacationForDay.endsOn);
    } else {
      setVacationStart(selectedDate);
      setVacationEnd(selectedDate);
    }
  }, [selectedDate, vacationForDay]);

  const dayStatus = isVacationDate(selectedDate) ? "ferias" : getDayStatus(selectedDate);

  const items = useMemo<AgendaItem[]>(() => {
    const q = query.trim().toLowerCase();
    const result: AgendaItem[] = [];
    for (const appointment of appointments) {
      const patient = patients.find((item) => item.id === appointment.patientId);
      if (!patient || patient.status !== "ativo") continue;
      const clinic =
        patient.paymentType === "clinica"
          ? clinics.find((item) => item.id === patient.clinicId)
          : undefined;
      const item: AgendaItem = { ...appointment, patient, clinic };
      if (q && !item.patient.name.toLowerCase().includes(q)) continue;
      result.push(item);
    }
    return result;
  }, [appointments, clinics, patients, query]);

  const pending = items.filter((item) => !isDone(item));
  const done = items.filter((item) => isDone(item));

  const updateAppointment = (appointment: Appointment, patch: Partial<Appointment>) => {
    upsertAppointment({
      ...appointment,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    reload();
  };

  const completePresence = (item: AgendaItem, paid: boolean) => {
    if (
      item.patient.paymentType === "particular" &&
      item.patient.paymentFrequency === "sessao" &&
      paid
    ) {
      const hasCashEntry = getCashEntries().some(
        (entry) =>
          entry.source === "particular-sessao" &&
          entry.appointmentId === item.id,
      );

      if (!hasCashEntry) {
        addCashEntry({
          source: "particular-sessao",
          patientId: item.patient.id,
          appointmentId: item.id,
          receivedMonth: monthKey(dateKeyFromIso(item.startsAt)),
          amount: Number(item.patient.sessionValue) || 0,
          notes: "Pagamento por sessão recebido na agenda",
        });
      }
    }

    updateAppointment(item, {
      status: "realizado",
      paid,
      repasseConfirmed: item.patient.paymentType !== "clinica",
    });
    setMessage("Atendimento marcado como realizado.");
  };

  const markPresence = (item: AgendaItem) => {
    if (item.patient.paymentType === "clinica") {
      completePresence(item, true);
      return;
    }

    if (item.patient.paymentFrequency === "sessao") {
      setSessionPresence({ appointment: item, paymentReceived: "" });
      return;
    }

    const month = monthKey(selectedDate);
    if (isMonthlyPaid(item.patient.id, month)) {
      completePresence(item, true);
      return;
    }

    setMonthlyPayment({
      appointment: item,
      month,
      choice: "integral",
      amountReceived: "",
    });
  };

  const confirmSessionPresence = () => {
    if (!sessionPresence) return;
    if (!sessionPresence.paymentReceived) {
      setMessage("Selecione se o pagamento foi recebido.");
      return;
    }

    completePresence(sessionPresence.appointment, sessionPresence.paymentReceived === "received");
    setSessionPresence(null);
  };

  const confirmMonthlyPayment = () => {
    if (!monthlyPayment) return;
    const item = monthlyPayment.appointment;
    const monthlyValue = Number(item.patient.sessionValue) || 0;
    const summary = getMonthlyPaymentSummary(item.patient.id, monthlyPayment.month, monthlyValue);
    let received = 0;

    if (monthlyPayment.choice === "integral") {
      received = summary.balance;
    } else if (monthlyPayment.choice === "parcial") {
      received = Number(monthlyPayment.amountReceived);
      if (!Number.isFinite(received) || received <= 0) {
        setMessage("Informe um valor recebido válido.");
        return;
      }
      if (received > summary.balance) {
        setMessage("O valor recebido não pode ser maior que o total em aberto.");
        return;
      }
    }

    if (received > 0) {
      recordMonthlyPayment(item.patient.id, monthlyPayment.month, monthlyValue, received);
    }

    completePresence(item, monthlyPayment.choice === "integral");
    setMonthlyPayment(null);
  };

  const markAbsence = (item: AgendaItem) => {
    setAbsenceToConfirm(item);
  };

  const confirmAbsence = () => {
    if (!absenceToConfirm) return;
    const item = absenceToConfirm;
    updateAppointment(item, { status: "falta", paid: false });
    setMessage("Falta registrada.");
    setAbsenceToConfirm(null);
  };

  const markJustifiedAbsence = (item: AgendaItem) => {
    setJustifiedAbsence({ appointment: item, reason: "", otherReason: "", note: "" });
  };

  const confirmJustifiedAbsence = () => {
    if (!justifiedAbsence) return;
    const reason = justifiedAbsence.reason.trim();
    const otherReason = justifiedAbsence.otherReason.trim();
    const note = justifiedAbsence.note.trim();
    if (!reason) {
      setMessage("Selecione o motivo da falta justificada.");
      return;
    }
    if (reason === "Outro" && !otherReason) {
      setMessage("Descreva o motivo quando selecionar Outro.");
      return;
    }
    const savedReason = reason === "Outro" ? `Outro: ${otherReason}` : reason;
    updateAppointment(justifiedAbsence.appointment, {
      status: "falta-justificada",
      paid: false,
      repasseConfirmed: false,
      absenceReason: note ? `${savedReason}. Observação: ${note}` : savedReason,
    });
    setMessage("Falta justificada registrada.");
    setJustifiedAbsence(null);
  };

  const openStatusChange = (item: AgendaItem) => {
    setStatusAbsenceConfirmOpen(false);
    setStatusChange({
      appointment: item,
      status: item.status as StatusChangeValue,
      reason: item.absenceReason ?? "",
      note: "",
    });
  };

  const closeStatusChange = () => {
    setStatusAbsenceConfirmOpen(false);
    setStatusChange(null);
  };

  const applyStatusAbsence = () => {
    if (!statusChange) return;
    updateAppointment(statusChange.appointment, {
      status: "falta",
      paid: false,
      repasseConfirmed: false,
      absenceReason: undefined,
    });
    setMessage("Status alterado para falta.");
    closeStatusChange();
  };

  const confirmStatusChange = () => {
    if (!statusChange) return;
    const item = statusChange.appointment;

    if (statusChange.status === "realizado") {
      markPresence(item);
      closeStatusChange();
      return;
    }

    if (statusChange.status === "falta") {
      setStatusAbsenceConfirmOpen(true);
      return;
    }

    if (statusChange.status === "falta-justificada") {
      const reason = statusChange.reason.trim();
      if (!reason) {
        setMessage("Informe o motivo da falta justificada.");
        return;
      }
      const note = statusChange.note.trim();
      updateAppointment(item, {
        status: "falta-justificada",
        paid: false,
        repasseConfirmed: false,
        absenceReason: note ? `${reason} Observação: ${note}` : reason,
      });
      setMessage("Status alterado para falta justificada.");
      closeStatusChange();
      return;
    }

    updateAppointment(item, {
      status: "agendado",
      paid: false,
      repasseConfirmed: false,
      absenceReason: undefined,
    });
    setMessage("Atendimento voltou para pendente.");
    closeStatusChange();
  };

  const openReschedule = (item: AgendaItem) => {
    setRescheduleContext("");
    setReschedule({
      appointment: item,
      date: selectedDate,
      time: appointmentTime(item),
      duration: String(item.durationMin),
      scope: "",
    });
  };

  const buildConflict = (draft: RescheduleDraft): ConflictInfo | null => {
    const start = toMinutes(draft.time);
    const duration = Number(draft.duration);
    const end = start + duration;
    const attemptedEnd = addMinutesToTime(draft.time, duration);

    const conflict = getAgendaAppointmentsForDate(draft.date).find((item) => {
      if (item.status === "cancelado") return false;
      if (item.id === draft.appointment.id) return false;
      if (item.patientId === draft.appointment.patientId) return false;
      const itemStart = toMinutes(appointmentTime(item));
      const itemEnd = itemStart + item.durationMin;
      return overlaps(start, end, itemStart, itemEnd);
    });

    if (!conflict) return null;

    const existingPatient = patients.find((patient) => patient.id === conflict.patientId);
    if (!existingPatient || existingPatient.status !== "ativo") return null;
    const existingClinic =
      existingPatient.paymentType === "clinica"
        ? clinics.find((clinic) => clinic.id === existingPatient.clinicId)
        : undefined;
    const existingName = existingPatient.name;
    const existingStart = appointmentTime(conflict);
    const existingEnd = appointmentEnd(conflict);
    const attemptedWeekday = weekdayLabel(draft.date);

    return {
      draft,
      existingAppointment: conflict,
      existingPatient,
      existingClinic,
      attempted: {
        patientName: draft.appointment.patient.name,
        date: draft.date,
        weekday: attemptedWeekday,
        start: draft.time,
        duration,
        end: attemptedEnd,
      },
      existing: {
        patientName: existingName,
        date: draft.date,
        weekday: attemptedWeekday,
        start: existingStart,
        duration: conflict.durationMin,
        end: existingEnd,
      },
      message: `Você está tentando remarcar ${draft.appointment.patient.name} para ${attemptedWeekday}, das ${draft.time} às ${attemptedEnd}, mas ${existingName} já está agendado neste horário, das ${existingStart} às ${existingEnd}.`,
    };
  };

  const applyRecurringReschedule = (
    draft: RescheduleDraft,
    basePatients = patients,
  ) => {
    const original = draft.appointment;
    const duration = Number(draft.duration);
    const targetWeekday = String(parseDateKey(draft.date).getDay());

    return basePatients.map((patient) => {
      if (patient.id !== original.patient.id) return patient;

      const currentSchedules = normalizePatientSchedules(patient);
      const hasSchedule = currentSchedules.some((schedule) => schedule.id === original.scheduleId);
      const nextSchedules = hasSchedule
        ? currentSchedules.map((schedule) =>
            schedule.id === original.scheduleId
              ? {
                  ...schedule,
                  weekday: targetWeekday,
                  time: draft.time,
                  durationMinutes: duration,
                }
              : schedule,
          )
        : [
            {
              id: original.scheduleId ?? `schedule:${uid()}`,
              weekday: targetWeekday,
              time: draft.time,
              durationMinutes: duration,
            },
          ];

      return {
        ...patient,
        schedules: nextSchedules,
        weekDay: nextSchedules[0]?.weekday,
        time: nextSchedules[0]?.time,
      };
    });
  };

  const applySingleReschedule = (draft: RescheduleDraft) => {
    const original = draft.appointment;
    const duration = Number(draft.duration);
    const startsAt = combineDateTime(draft.date, draft.time);

    upsertAppointment({
      ...original,
      status: "cancelado",
      updatedAt: new Date().toISOString(),
    });
    upsertAppointment({
      ...original,
      id: `rescheduled:${uid()}`,
      startsAt,
      durationMin: duration,
      status: "agendado",
      paid: false,
      originalDate: original.originalDate ?? selectedDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const applyReschedule = (draft: RescheduleDraft, basePatients = patients) => {
    if (draft.scope === "recurring") {
      const nextPatients = applyRecurringReschedule(draft, basePatients);
      savePatients(nextPatients);
      setPatients(nextPatients);
      return nextPatients;
    }

    applySingleReschedule(draft);
    return basePatients;
  };

  const validateReschedule = (draft: RescheduleDraft) => {
    const duration = Number(draft.duration);
    if (!draft.scope) {
      setMessage("Escolha onde aplicar a remarcação.");
      return false;
    }
    if (!draft.date || !draft.time || !duration || duration <= 0) {
      setMessage("Informe data, horário e duração para remarcar.");
      return false;
    }
    if (getDayStatus(draft.date) === "folga" || isVacationDate(draft.date)) {
      setMessage("Não é possível remarcar para folga ou férias.");
      return false;
    }
    return true;
  };

  const confirmReschedule = () => {
    if (!reschedule) return;
    if (!validateReschedule(reschedule)) return;

    const conflict = buildConflict(reschedule);
    if (conflict) {
      setRescheduleConflict(conflict);
      return;
    }

    applyReschedule(reschedule);
    setReschedule(null);
    setRescheduleContext("");
    setMessage("Atendimento remarcado.");
    reload();
  };

  const removeRecurringSchedule = (
    appointment: Appointment,
    basePatients = patients,
  ) => {
    if (!appointment.scheduleId) return basePatients;

    return basePatients.map((patient) => {
      if (patient.id !== appointment.patientId) return patient;
      const nextSchedules = normalizePatientSchedules(patient).filter(
        (schedule) => schedule.id !== appointment.scheduleId,
      );

      return {
        ...patient,
        schedules: nextSchedules,
        weekDay: nextSchedules[0]?.weekday,
        time: nextSchedules[0]?.time,
      };
    });
  };

  const cancelDisplacedOccurrence = (appointment: Appointment) => {
    upsertAppointment({
      ...appointment,
      status: "cancelado",
      updatedAt: new Date().toISOString(),
    });
  };

  const keepAttemptedPatient = () => {
    if (!rescheduleConflict) return;
    const { draft, existingAppointment, existingPatient, existingClinic } = rescheduleConflict;
    let nextPatients = patients;

    if (draft.scope === "recurring") {
      nextPatients = removeRecurringSchedule(existingAppointment, nextPatients);
    }

    cancelDisplacedOccurrence(existingAppointment);
    nextPatients = applyReschedule(draft, nextPatients);

    const displacedItem: AgendaItem = {
      ...existingAppointment,
      patient: existingPatient,
      clinic: existingClinic,
    };

    setRescheduleConflict(null);
    setReschedule({
      appointment: displacedItem,
      date: rescheduleConflict.existing.date,
      time: rescheduleConflict.existing.start,
      duration: String(rescheduleConflict.existing.duration),
      scope: draft.scope === "recurring" ? "recurring" : "single",
    });
    setRescheduleContext(
      `O paciente ${existingPatient.name} ficou sem horário após a resolução do conflito. Escolha um novo dia/horário.`,
    );
    setMessage(`${draft.appointment.patient.name} foi mantido no horário escolhido.`);
    setPatients(nextPatients);
    reload();
  };

  const keepExistingPatient = () => {
    if (!rescheduleConflict) return;
    const attemptedName = rescheduleConflict.attempted.patientName;
    const existingName = rescheduleConflict.existing.patientName;
    setRescheduleConflict(null);
    setRescheduleContext(
      `O horário foi mantido para ${existingName}. Escolha outro horário para ${attemptedName}.`,
    );
    setMessage(`Horário mantido para ${existingName}.`);
  };

  const setNormalDay = () => {
    saveDayStatus(selectedDate, "normal");
    setMessage("Dia marcado como atendimento normal.");
    reload();
  };

  const setDayOff = () => {
    saveDayStatus(selectedDate, "folga");
    setMessage("Dia marcado como folga. Atendimentos ocultados sem apagar histórico.");
    reload();
  };

  const saveVacation = () => {
    if (!vacationStart || !vacationEnd || vacationEnd < vacationStart) {
      setMessage("Informe um período de férias válido.");
      return;
    }
    const next = [...vacations, { id: uid(), startsOn: vacationStart, endsOn: vacationEnd }];
    saveVacations(next);
    saveDayStatus(selectedDate, "normal");
    setMessage("Período de férias salvo.");
    setVacationModalOpen(false);
    reload();
  };

  const cancelVacationPeriod = (periodId: string) => {
    const period = vacations.find((item) => item.id === periodId);
    if (period) {
      const current = parseDateKey(period.startsOn);
      const end = parseDateKey(period.endsOn);
      while (current <= end) {
        saveDayStatus(toDateKey(current), "normal");
        current.setDate(current.getDate() + 1);
      }
    }
    saveVacations(vacations.filter((period) => period.id !== periodId));
    setMessage("Férias canceladas.");
    reload();
  };

  const monthlyPaymentValue = monthlyPayment
    ? Number(monthlyPayment.appointment.patient.sessionValue) || 0
    : 0;
  const monthlyPaymentSummary = monthlyPayment
    ? getMonthlyPaymentSummary(
        monthlyPayment.appointment.patient.id,
        monthlyPayment.month,
        monthlyPaymentValue,
      )
    : null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Agenda</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Atendimentos gerados pelos pacientes ativos e seus dias cadastrados.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px,220px]">
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {parseDateKey(selectedDate).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
          </div>
        </header>

        {message && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="glass-card p-5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <Button
                variant={dayStatus === "normal" ? "default" : "outline"}
                className="min-w-[168px] justify-center"
                onClick={setNormalDay}
              >
                <CheckCircle2 className="h-4 w-4" /> Atendimento Normal
              </Button>
              <Button
                variant={dayStatus === "folga" ? "default" : "outline"}
                className="min-w-[120px] justify-center"
                onClick={setDayOff}
              >
                <Umbrella className="h-4 w-4" /> Folga
              </Button>
              <Button
                variant={dayStatus === "ferias" ? "default" : "outline"}
                className="min-w-[120px] justify-center"
                onClick={() => {
                  setVacationStart(selectedDate);
                  setVacationEnd(selectedDate);
                  setVacationModalOpen(true);
                }}
              >
                <Plane className="h-4 w-4" /> Férias
              </Button>
              {vacationForDay && (
                <Button
                  variant="outline"
                  className="min-w-[168px] justify-center"
                  onClick={() => setManageVacationsOpen(true)}
                >
                  <Plane className="h-4 w-4" /> Gerenciar férias
                </Button>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar paciente"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Pendentes
                </div>
                <div className="mt-1 text-2xl font-black">{pending.length}</div>
              </div>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Realizados
                </div>
                <div className="mt-1 text-2xl font-black">{done.length}</div>
              </div>
            </div>
          </div>
        </section>

        {dayStatus !== "normal" ? (
          <div className="glass-card flex min-h-52 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground glow">
              {dayStatus === "ferias" ? <Plane className="h-6 w-6" /> : <Umbrella className="h-6 w-6" />}
            </div>
            <h2 className="text-lg font-bold">
              {dayStatus === "ferias" ? "Período de férias" : "Dia de folga"}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {dayStatus === "ferias"
                ? "Este dia está marcado como férias. Não há atendimentos previstos."
                : "Os atendimentos deste dia ficam ocultos sem apagar histórico ou cadastros."}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="pendentes" className="w-full">
            <TabsList>
              <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
              <TabsTrigger value="realizados">Realizados</TabsTrigger>
            </TabsList>
            <TabsContent value="pendentes" className="mt-5">
              <AppointmentList
                items={pending}
                emptyLabel="Nenhum atendimento pendente para esta data."
                onPresence={markPresence}
                onAbsence={markAbsence}
                onJustifiedAbsence={markJustifiedAbsence}
                onReschedule={openReschedule}
              />
            </TabsContent>
            <TabsContent value="realizados" className="mt-5">
              <AppointmentList
                items={done}
                emptyLabel="Nenhum atendimento realizado nesta data."
                onChangeStatus={openStatusChange}
              />
            </TabsContent>
          </Tabs>
        )}

        {reschedule && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Remarcar atendimento</h2>
                  <p className="text-sm text-muted-foreground">
                    {reschedule.appointment.patient.name}
                  </p>
                  {rescheduleContext && (
                    <p className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                      {rescheduleContext}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setReschedule(null);
                    setRescheduleContext("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Aplicar remarcação em:
                  </span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="reschedule-scope"
                      checked={reschedule.scope === "single"}
                      onChange={() => setReschedule({ ...reschedule, scope: "single" })}
                    />
                    Somente este atendimento
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="reschedule-scope"
                      checked={reschedule.scope === "recurring"}
                      onChange={() => setReschedule({ ...reschedule, scope: "recurring" })}
                    />
                    Agenda inteira do paciente
                  </label>
                </div>
                <Input
                  type="date"
                  value={reschedule.date}
                  onChange={(event) =>
                    setReschedule({ ...reschedule, date: event.target.value })
                  }
                />
                <Input
                  type="time"
                  value={reschedule.time}
                  onChange={(event) =>
                    setReschedule({ ...reschedule, time: event.target.value })
                  }
                />
                <select
                  value={reschedule.duration}
                  onChange={(event) =>
                    setReschedule({ ...reschedule, duration: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
                >
                  {durationOptions.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} minutos
                    </option>
                  ))}
                </select>
                <Button onClick={confirmReschedule}>
                  <RotateCcw className="h-4 w-4" /> Salvar remarcação
                </Button>
              </div>
            </div>
          </div>
        )}

        {vacationModalOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Definir férias</h2>
                  <p className="text-sm text-muted-foreground">
                    O período só será marcado após a confirmação.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setVacationModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data inicial
                  </span>
                  <Input
                    type="date"
                    value={vacationStart}
                    onChange={(event) => setVacationStart(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data final
                  </span>
                  <Input
                    type="date"
                    value={vacationEnd}
                    onChange={(event) => setVacationEnd(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setVacationModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveVacation}>
                    <Plane className="h-4 w-4" /> Confirmar férias
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rescheduleConflict && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl p-5">
              <h2 className="text-lg font-bold">Conflito de horário encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Já existe outro paciente agendado neste horário. Escolha quem permanecerá com este horário.
              </p>
              <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                {rescheduleConflict.message}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paciente em remarcação
                  </div>
                  <div className="mt-2 font-bold">{rescheduleConflict.attempted.patientName}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {rescheduleConflict.attempted.weekday} ·{" "}
                    {parseDateKey(rescheduleConflict.attempted.date).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="mt-1 text-sm">
                    {rescheduleConflict.attempted.start} às {rescheduleConflict.attempted.end} ·{" "}
                    {rescheduleConflict.attempted.duration} min
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paciente já agendado
                  </div>
                  <div className="mt-2 font-bold">{rescheduleConflict.existing.patientName}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {rescheduleConflict.existing.weekday} ·{" "}
                    {parseDateKey(rescheduleConflict.existing.date).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="mt-1 text-sm">
                    {rescheduleConflict.existing.start} às {rescheduleConflict.existing.end} ·{" "}
                    {rescheduleConflict.existing.duration} min
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={keepAttemptedPatient}>
                  Manter {rescheduleConflict.attempted.patientName} neste horário
                </Button>
                <Button variant="outline" onClick={keepExistingPatient}>
                  Manter {rescheduleConflict.existing.patientName} neste horário
                </Button>
              </div>
            </div>
          </div>
        )}

        {manageVacationsOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Gerenciar férias</h2>
                  <p className="text-sm text-muted-foreground">
                    Cancelar férias não apaga histórico, pagamentos, faltas ou atendimentos realizados.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setManageVacationsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-3">
                {vacations.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
                    Nenhum período de férias cadastrado.
                  </div>
                ) : (
                  vacations.map((period) => (
                    <div
                      key={period.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {parseDateKey(period.startsOn).toLocaleDateString("pt-BR")} até{" "}
                          {parseDateKey(period.endsOn).toLocaleDateString("pt-BR")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Os dias voltam para Atendimento Normal ao cancelar este período.
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => cancelVacationPeriod(period.id)}
                      >
                        Cancelar férias
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {absenceToConfirm && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <h2 className="text-lg font-bold">Confirmar falta?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Essa ação pode impactar o financeiro e os alertas de falta do paciente.
              </p>
              <div className="mt-4 grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{absenceToConfirm.patient.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Data</span>
                  <span>{parseDateKey(selectedDate).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Horário</span>
                  <span>
                    {appointmentTime(absenceToConfirm)} até {appointmentEnd(absenceToConfirm)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Valor</span>
                  <span>{money(absenceToConfirm.patient.sessionValue)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Origem</span>
                  <span>
                    {absenceToConfirm.patient.paymentType === "clinica"
                      ? "Clínica"
                      : "Particular"}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setAbsenceToConfirm(null)}>
                  Cancelar
                </Button>
                <Button onClick={confirmAbsence}>Confirmar falta</Button>
              </div>
            </div>
          </div>
        )}

        {justifiedAbsence && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Falta justificada</h2>
                  <p className="text-sm text-muted-foreground">
                    Selecione o motivo da falta e adicione uma observação, se necessário.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setJustifiedAbsence(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Motivo da falta
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {justifiedAbsenceReasons.map((reason) => {
                      const selected = justifiedAbsence.reason === reason;
                      return (
                        <Button
                          key={reason}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className={
                            selected
                              ? "border-primary shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                              : "bg-card/60"
                          }
                          onClick={() =>
                            setJustifiedAbsence({
                              ...justifiedAbsence,
                              reason,
                              otherReason:
                                reason === "Outro" ? justifiedAbsence.otherReason : "",
                            })
                          }
                        >
                          {reason}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {justifiedAbsence.reason === "Outro" && (
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Outro motivo
                    </span>
                    <Input
                      value={justifiedAbsence.otherReason}
                      onChange={(event) =>
                        setJustifiedAbsence({
                          ...justifiedAbsence,
                          otherReason: event.target.value,
                        })
                      }
                      placeholder="Descreva o motivo"
                    />
                  </label>
                )}

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Observação opcional
                  </span>
                  <Textarea
                    value={justifiedAbsence.note}
                    onChange={(event) =>
                      setJustifiedAbsence({ ...justifiedAbsence, note: event.target.value })
                    }
                    placeholder="Descreva detalhes, se necessário..."
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setJustifiedAbsence(null)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={
                      !justifiedAbsence.reason ||
                      (justifiedAbsence.reason === "Outro" &&
                        !justifiedAbsence.otherReason.trim())
                    }
                    onClick={confirmJustifiedAbsence}
                  >
                    Confirmar falta justificada
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {sessionPresence && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Confirmar presença</h2>
                  <p className="text-sm text-muted-foreground">
                    Confirme a presença e informe se o pagamento da sessão foi recebido.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSessionPresence(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{sessionPresence.appointment.patient.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Data</span>
                  <span>
                    {parseDateKey(dateKeyFromIso(sessionPresence.appointment.startsAt)).toLocaleDateString(
                      "pt-BR",
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Horário</span>
                  <span>
                    {appointmentTime(sessionPresence.appointment)} -{" "}
                    {appointmentEnd(sessionPresence.appointment)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Valor</span>
                  <span>{money(sessionPresence.appointment.patient.sessionValue)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Origem</span>
                  <span>Particular</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tipo de atendimento</span>
                  <span>
                    {sessionPresence.appointment.patient.attendanceTypeName ?? "Terapia"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <span className="text-sm font-semibold">O pagamento foi recebido?</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={
                      sessionPresence.paymentReceived === "received" ? "default" : "outline"
                    }
                    className={
                      sessionPresence.paymentReceived === "received"
                        ? "border-primary shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                        : "bg-card/60"
                    }
                    onClick={() =>
                      setSessionPresence({
                        ...sessionPresence,
                        paymentReceived: "received",
                      })
                    }
                  >
                    Sim, recebido
                  </Button>
                  <Button
                    type="button"
                    variant={
                      sessionPresence.paymentReceived === "not-received" ? "default" : "outline"
                    }
                    className={
                      sessionPresence.paymentReceived === "not-received"
                        ? "border-primary shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                        : "bg-card/60"
                    }
                    onClick={() =>
                      setSessionPresence({
                        ...sessionPresence,
                        paymentReceived: "not-received",
                      })
                    }
                  >
                    Não recebido
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setSessionPresence(null)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!sessionPresence.paymentReceived}
                  onClick={confirmSessionPresence}
                >
                  Confirmar presença
                </Button>
              </div>
            </div>
          </div>
        )}

        {monthlyPayment && monthlyPaymentSummary && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Pagamento mensal</h2>
                  <p className="text-sm text-muted-foreground">
                    Confirme se o pagamento mensal deste paciente foi recebido.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMonthlyPayment(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{monthlyPayment.appointment.patient.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Competência</span>
                  <span className="capitalize">{formatMonth(monthlyPayment.month)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Valor mensal</span>
                  <span>{money(monthlyPaymentSummary.amountDue)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Valor já recebido</span>
                  <span>{money(monthlyPaymentSummary.amountReceived)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Saldo pendente</span>
                  <span>{money(monthlyPaymentSummary.balance)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total em aberto</span>
                  <span className="font-semibold text-foreground">
                    {money(monthlyPaymentSummary.balance)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Opções de pagamento
                  </span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="monthly-payment-choice"
                      checked={monthlyPayment.choice === "integral"}
                      onChange={() =>
                        setMonthlyPayment({
                          ...monthlyPayment,
                          choice: "integral",
                          amountReceived: "",
                        })
                      }
                    />
                    Pagamento integral
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="monthly-payment-choice"
                      checked={monthlyPayment.choice === "parcial"}
                      onChange={() =>
                        setMonthlyPayment({ ...monthlyPayment, choice: "parcial" })
                      }
                    />
                    Pagamento parcial
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="monthly-payment-choice"
                      checked={monthlyPayment.choice === "nao-recebido"}
                      onChange={() =>
                        setMonthlyPayment({
                          ...monthlyPayment,
                          choice: "nao-recebido",
                          amountReceived: "",
                        })
                      }
                    />
                    Não recebido
                  </label>
                </div>

                {monthlyPayment.choice === "parcial" && (
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Valor recebido
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={monthlyPaymentSummary.balance}
                      step="0.01"
                      value={monthlyPayment.amountReceived}
                      onChange={(event) =>
                        setMonthlyPayment({
                          ...monthlyPayment,
                          amountReceived: event.target.value,
                        })
                      }
                      placeholder="0,00"
                    />
                  </label>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setMonthlyPayment(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmMonthlyPayment}>Confirmar</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {statusChange && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Alterar status do atendimento</h2>
                  <p className="text-sm text-muted-foreground">
                    A correção afeta somente este atendimento.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={closeStatusChange}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{statusChange.appointment.patient.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Data</span>
                  <span>{parseDateKey(selectedDate).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Horário</span>
                  <span>
                    {appointmentTime(statusChange.appointment)} -{" "}
                    {appointmentEnd(statusChange.appointment)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status atual</span>
                  <span>{statusLabel(statusChange.appointment.status)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Origem</span>
                  <span>
                    {statusChange.appointment.patient.paymentType === "clinica"
                      ? statusChange.appointment.clinic?.name ?? "Clínica"
                      : "Particular"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Valor</span>
                  <span>{money(statusChange.appointment.patient.sessionValue)}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Novo status
                  </span>
                  <select
                    value={statusChange.status}
                    onChange={(event) =>
                      setStatusChange({
                        ...statusChange,
                        status: event.target.value as StatusChangeValue,
                      })
                    }
                    className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
                  >
                    <option value="realizado">Presença</option>
                    <option value="falta">Falta</option>
                    <option value="falta-justificada">Falta Justificada</option>
                    <option value="agendado">Pendente</option>
                  </select>
                </label>

                {statusChange.status === "falta-justificada" && (
                  <div className="grid gap-3">
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Motivo
                      </span>
                      <Input
                        value={statusChange.reason}
                        onChange={(event) =>
                          setStatusChange({ ...statusChange, reason: event.target.value })
                        }
                        placeholder="Informe o motivo"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Observação opcional
                      </span>
                      <Textarea
                        value={statusChange.note}
                        onChange={(event) =>
                          setStatusChange({ ...statusChange, note: event.target.value })
                        }
                        placeholder="Adicionar observação"
                      />
                    </label>
                  </div>
                )}

                {statusChange.status === "falta" && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                    Essa ação pode impactar o financeiro e os alertas de falta do paciente.
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={closeStatusChange}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmStatusChange}>Salvar alteração</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {statusAbsenceConfirmOpen && statusChange && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-5">
              <h2 className="text-lg font-bold">Confirmar falta?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Essa ação pode impactar o financeiro e os alertas de falta do paciente.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setStatusAbsenceConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={applyStatusAbsence}>Confirmar falta</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function AppointmentList({
  items,
  emptyLabel,
  onPresence,
  onAbsence,
  onJustifiedAbsence,
  onReschedule,
  onChangeStatus,
}: {
  items: AgendaItem[];
  emptyLabel: string;
  onPresence?: (item: AgendaItem) => void;
  onAbsence?: (item: AgendaItem) => void;
  onJustifiedAbsence?: (item: AgendaItem) => void;
  onReschedule?: (item: AgendaItem) => void;
  onChangeStatus?: (item: AgendaItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="glass-card flex min-h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => {
        const isClinic = item.patient.paymentType === "clinica";
        const attendanceType = isClinic
          ? item.patient.attendanceTypeName ?? "Clínica"
          : item.patient.attendanceTypeName ?? "Terapia";
        const origin = isClinic ? item.clinic?.name ?? "Clínica removida" : "Particular";
        const billingLabel =
          item.patient.paymentFrequency === "mensal" ? "Mensal" : "Por sessão";
        const itemMonth = monthKey(toDateKey(new Date(item.startsAt)));
        const monthlySummary =
          !isClinic && item.patient.paymentFrequency === "mensal"
            ? getMonthlyPaymentSummary(item.patient.id, itemMonth, item.patient.sessionValue)
            : null;
        const paymentStatus = isClinic
          ? "Não se aplica"
          : monthlySummary?.status === "parcial"
            ? "Parcial"
            : monthlySummary?.status === "pago" || item.paid
              ? "Pago"
              : "Pendente";
        const paymentBadgeVariant =
          isClinic || paymentStatus === "Parcial"
            ? "outline"
            : paymentStatus === "Pago"
              ? "default"
              : "secondary";

        return (
          <article key={item.id} className="glass-card p-4">
            <div className="grid gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-2xl font-black leading-none text-primary tabular-nums">
                  <Clock className="h-5 w-5" />
                  {appointmentTime(item)} - {appointmentEnd(item)}
                </div>

                <h3 className="mt-2 truncate text-xl font-black leading-tight">
                  {item.patient.name}
                </h3>

                <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">{origin}</div>
                  <div>
                    <span className="text-foreground/80">Tipo de atendimento:</span>{" "}
                    <span>{attendanceType}</span>
                  </div>
                  <div>
                    {isClinic ? (
                      <>
                        <span className="text-foreground/80">Valor:</span>{" "}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">{billingLabel}</span>
                        <span> - Valor: </span>
                      </>
                    )}
                    <span className="font-semibold text-foreground">
                      {money(item.patient.sessionValue)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground/80">Status pagamento:</span>
                    <Badge variant={paymentBadgeVariant}>{paymentStatus}</Badge>
                    {item.status !== "agendado" && (
                      <Badge variant="outline">{statusLabel(item.status)}</Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-foreground/80">Duração:</span>{" "}
                    <span className="font-semibold text-foreground">{item.durationMin} min</span>
                  </div>
                  {item.absenceReason && (
                    <div>
                      <span className="text-foreground/80">Motivo:</span>{" "}
                      <span>{item.absenceReason}</span>
                    </div>
                  )}
                </div>
              </div>
              {(onPresence || onChangeStatus) && (
                <div className="flex flex-wrap items-center gap-2">
                  {onPresence && (
                    <>
                      <Button size="sm" onClick={() => onPresence(item)}>
                        Presença
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAbsence?.(item)}
                      >
                        Falta
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onJustifiedAbsence?.(item)}
                      >
                        Falta Justificada
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReschedule?.(item)}
                      >
                        Remarcar
                      </Button>
                    </>
                  )}
                  {onChangeStatus && (
                    <Button size="sm" variant="outline" onClick={() => onChangeStatus(item)}>
                      Alterar status
                    </Button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
