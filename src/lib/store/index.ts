import type {
  Appointment,
  CashEntry,
  Clinic,
  ClinicPaymentRecord,
  DayStatus,
  DayStatusRecord,
  MonthlyPayment,
  Patient,
  PatientSchedule,
  VacationPeriod,
} from "./types";

export const STORAGE_KEYS = {
  clinics: "psiu:clinics",
  patients: "psiu:patients",
  appointments: "psiu:appointments",
  dayStatuses: "psiu:day-statuses",
  vacations: "psiu:vacations",
  monthlyPayments: "psiu:monthly-payments",
  cashEntries: "psiu:cash-entries",
  clinicPayments: "psiu:clinic-payments",
  seeded: "psiu:store:seeded",
} as const;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return crypto.randomUUID();
}

export function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

export function dateKeyFromIso(iso: string): string {
  return toDateKey(new Date(iso));
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function combineDateTime(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time}:00`).toISOString();
}

export function timeFromIso(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function normalizePatientSchedules(patient: Patient): PatientSchedule[] {
  const schedules =
    patient.schedules
      ?.filter((schedule) => schedule.weekday && schedule.time)
      .map((schedule) => ({
        ...schedule,
        durationMinutes:
          Number.isFinite(Number(schedule.durationMinutes)) &&
          Number(schedule.durationMinutes) > 0
            ? Number(schedule.durationMinutes)
            : 50,
      })) ?? [];
  if (schedules.length) return schedules;
  if (patient.weekDay && patient.time) {
    return [
      {
        id: `legacy-${patient.id}`,
        weekday: patient.weekDay,
        time: patient.time,
        durationMinutes: 50,
      },
    ];
  }
  return [];
}

// ---------- Clinics ----------
export function getClinicPaymentTermDays(clinic?: Pick<Clinic, "paymentTermType" | "customPaymentDays" | "paymentTermDays">) {
  if (clinic?.paymentTermType === "60_days") return 60;
  if (clinic?.paymentTermType === "custom") {
    const customDays = Number(clinic.customPaymentDays ?? clinic.paymentTermDays);
    return Number.isFinite(customDays) && customDays > 0 ? customDays : 30;
  }
  if (clinic?.paymentTermType === "30_days") return 30;
  const savedDays = Number(clinic?.paymentTermDays);
  return Number.isFinite(savedDays) && savedDays > 0 ? savedDays : 30;
}

export function normalizeClinicPaymentTerm(clinic: Clinic): Clinic {
  const days = getClinicPaymentTermDays(clinic);
  const paymentTermType =
    clinic.paymentTermType ?? (days === 60 ? "60_days" : days === 30 ? "30_days" : "custom");

  return {
    ...clinic,
    paymentTermType,
    customPaymentDays: paymentTermType === "custom" ? days : undefined,
    paymentTermDays: days,
  };
}

export function clinicPaymentDueDate(dateKey: string, clinic?: Clinic) {
  const dueDate = parseDateKey(dateKey);
  dueDate.setDate(dueDate.getDate() + getClinicPaymentTermDays(clinic));
  return dueDate;
}

export function clinicPaymentDueMonth(dateKey: string, clinic?: Clinic) {
  return monthKey(toDateKey(clinicPaymentDueDate(dateKey, clinic)));
}

export function getClinics(): Clinic[] {
  return read<Clinic>(STORAGE_KEYS.clinics).map(normalizeClinicPaymentTerm);
}
export function saveClinics(clinics: Clinic[]) {
  write(STORAGE_KEYS.clinics, clinics.map(normalizeClinicPaymentTerm));
  void import("./cloud").then((m) => m.scheduleSync("clinics"));
}

// ---------- Patients ----------
export function getPatients(): Patient[] {
  return read<Patient>(STORAGE_KEYS.patients);
}
export function savePatients(patients: Patient[]) {
  write(STORAGE_KEYS.patients, patients);
  void import("./cloud").then((m) => m.scheduleSync("patients"));
}
export function getActivePatients(): Patient[] {
  return getPatients().filter((p) => p.status === "ativo");
}

export function patientHasHistory(patientId: string): boolean {
  if (!patientId) return false;

  const patientAppointments = getAppointments().filter(
    (appointment) => appointment.patientId === patientId,
  );

  const hasAppointmentHistory = patientAppointments.some((appointment) => {
    if (["realizado", "falta", "falta-justificada"].includes(appointment.status)) {
      return true;
    }
    if (appointment.paid || appointment.repasseConfirmed) return true;
    if (appointment.status === "cancelado") return true;
    if (appointment.id.startsWith("rescheduled:")) return true;
    if (appointment.originalDate && appointmentDateKey(appointment) !== appointment.originalDate) {
      return true;
    }
    return false;
  });
  if (hasAppointmentHistory) return true;

  const hasMonthlyPaymentHistory = getMonthlyPayments().some(
    (payment) => payment.patientId === patientId,
  );
  if (hasMonthlyPaymentHistory) return true;

  const appointmentIds = new Set(patientAppointments.map((appointment) => appointment.id));
  const hasCashEntryHistory = getCashEntries().some(
    (entry) =>
      entry.patientId === patientId ||
      Boolean(entry.appointmentId && appointmentIds.has(entry.appointmentId)),
  );
  if (hasCashEntryHistory) return true;

  return getClinicPaymentRecords().some((record) =>
    record.appointmentIds.some((appointmentId) => appointmentIds.has(appointmentId)),
  );
}

// ---------- Calendar state ----------
export function getDayStatuses(): DayStatusRecord[] {
  return read<DayStatusRecord>(STORAGE_KEYS.dayStatuses);
}

export function getDayStatus(dateKey: string): DayStatus {
  return getDayStatuses().find((item) => item.date === dateKey)?.status ?? "normal";
}

export function saveDayStatus(dateKey: string, status: DayStatus) {
  const filtered = getDayStatuses().filter((item) => item.date !== dateKey);
  write(
    STORAGE_KEYS.dayStatuses,
    status === "normal" ? filtered : [...filtered, { date: dateKey, status }],
  );
  void import("./cloud").then((m) => m.scheduleSync("dayStatuses"));
}

export function getVacations(): VacationPeriod[] {
  return read<VacationPeriod>(STORAGE_KEYS.vacations);
}

export function saveVacations(periods: VacationPeriod[]) {
  write(STORAGE_KEYS.vacations, periods);
  void import("./cloud").then((m) => m.scheduleSync("vacations"));
}

export function isVacationDate(dateKey: string): boolean {
  return getVacations().some(
    (period) => period.startsOn <= dateKey && period.endsOn >= dateKey,
  );
}

export function getMonthlyPayments(): MonthlyPayment[] {
  return read<MonthlyPayment>(STORAGE_KEYS.monthlyPayments);
}

export function saveMonthlyPayments(items: MonthlyPayment[]) {
  write(STORAGE_KEYS.monthlyPayments, items);
  void import("./cloud").then((m) => m.scheduleSync("monthlyPayments"));
}

export function getMonthlyPaymentSummary(patientId: string, month: string, amountDue = 0) {
  const records = getMonthlyPayments().filter(
    (item) => item.patientId === patientId && item.month === month,
  );
  const hasLegacyPaid = records.some(
    (item) => item.status === undefined && item.amountReceived === undefined,
  );
  const received = hasLegacyPaid
    ? amountDue
    : records.reduce((sum, item) => sum + (Number(item.amountReceived) || 0), 0);
  const due = Math.max(Number(amountDue) || 0, ...records.map((item) => Number(item.amountDue) || 0));
  const balance = Math.max(due - received, 0);
  const status = due > 0 && received >= due ? "pago" : received > 0 ? "parcial" : "pendente";

  return {
    amountDue: due,
    amountReceived: Math.min(received, due || received),
    balance,
    status,
    isPaid: status === "pago",
  };
}

export function isMonthlyPaid(patientId: string, month: string): boolean {
  const records = getMonthlyPayments().filter(
    (item) => item.patientId === patientId && item.month === month,
  );
  if (records.some((item) => item.status === undefined && item.amountReceived === undefined)) {
    return true;
  }
  return records.some((item) => item.status === "pago");
}

export function recordMonthlyPayment(
  patientId: string,
  month: string,
  amountDue: number,
  amountReceived: number,
  meta: {
    appointmentId?: string;
    receivedMonth?: string;
    delayed?: boolean;
    source?: MonthlyPayment["source"];
    notes?: string;
  } = {},
) {
  const summary = getMonthlyPaymentSummary(patientId, month, amountDue);
  const nextReceived = Math.min(summary.amountReceived + amountReceived, amountDue);
  const status =
    amountDue > 0 && nextReceived >= amountDue
      ? "pago"
      : nextReceived > 0
        ? "parcial"
        : "pendente";
  saveMonthlyPayments([
    ...getMonthlyPayments(),
    {
      id: uid(),
      patientId,
      month,
      amountDue,
      amountReceived: Math.max(amountReceived, 0),
      status,
      appointmentId: meta.appointmentId,
      receivedMonth: meta.receivedMonth ?? month,
      delayed: meta.delayed,
      source: meta.source,
      notes: meta.notes,
      paidAt: new Date().toISOString(),
    },
  ]);
  if (amountReceived > 0) {
    addCashEntry({
      source: "particular-mensal",
      patientId,
      appointmentId: meta.appointmentId,
      month,
      receivedMonth: meta.receivedMonth ?? month,
      delayed: meta.delayed,
      amount: amountReceived,
      notes: status === "pago" ? "Pagamento mensal integral" : "Pagamento mensal parcial",
    });
  }
}

export function markMonthlyPaid(patientId: string, month: string, amountDue = 0) {
  if (isMonthlyPaid(patientId, month)) return;
  recordMonthlyPayment(patientId, month, amountDue, amountDue);
}

export function getCashEntries(): CashEntry[] {
  return read<CashEntry>(STORAGE_KEYS.cashEntries);
}

export function saveCashEntries(items: CashEntry[]) {
  write(STORAGE_KEYS.cashEntries, items);
}

export function addCashEntry(entry: Omit<CashEntry, "id" | "createdAt">) {
  saveCashEntries([
    ...getCashEntries(),
    {
      ...entry,
      id: uid(),
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function getClinicPaymentRecords(): ClinicPaymentRecord[] {
  return read<ClinicPaymentRecord>(STORAGE_KEYS.clinicPayments);
}

export function saveClinicPaymentRecords(items: ClinicPaymentRecord[]) {
  write(STORAGE_KEYS.clinicPayments, items);
}

export function upsertClinicPaymentRecord(record: Omit<ClinicPaymentRecord, "id" | "confirmedAt">) {
  const current = getClinicPaymentRecords();
  const existing = current.find(
    (item) => item.clinicId === record.clinicId && item.month === record.month,
  );
  const nextRecord: ClinicPaymentRecord = {
    ...record,
    id: existing?.id ?? uid(),
    confirmedAt: new Date().toISOString(),
  };
  saveClinicPaymentRecords(
    existing
      ? current.map((item) => (item.id === existing.id ? nextRecord : item))
      : [...current, nextRecord],
  );
}

// ---------- Appointments ----------
export function getAppointments(): Appointment[] {
  return read<Appointment>(STORAGE_KEYS.appointments);
}

export function saveAppointments(items: Appointment[]) {
  write(STORAGE_KEYS.appointments, items);
  void import("./cloud").then((m) => m.scheduleSync("appointments"));
}

export function upsertAppointment(item: Appointment) {
  const current = getAppointments();
  const next = current.some((appointment) => appointment.id === item.id)
    ? current.map((appointment) => (appointment.id === item.id ? item : appointment))
    : [...current, item];
  saveAppointments(next);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBlockedDay(dateKey: string) {
  return getDayStatus(dateKey) === "folga" || isVacationDate(dateKey);
}

function recurringId(dateKey: string, patientId: string, scheduleId: string) {
  return `recurring:${dateKey}:${patientId}:${scheduleId}`;
}

function appointmentDateKey(appointment: Appointment) {
  return toDateKey(new Date(appointment.startsAt));
}

export function getAgendaAppointmentsForDate(dateKey: string): Appointment[] {
  if (isBlockedDay(dateKey)) return [];

  const weekday = String(parseDateKey(dateKey).getDay());
  const saved = getAppointments();
  const byId = new Map(saved.map((appointment) => [appointment.id, appointment]));
  const items: Appointment[] = [];

  for (const patient of getActivePatients()) {
    for (const schedule of normalizePatientSchedules(patient)) {
      if (schedule.weekday !== weekday) continue;

      const id = recurringId(dateKey, patient.id, schedule.id);
      const savedItem =
        byId.get(id) ??
        saved.find(
          (appointment) =>
            appointment.originalDate === dateKey &&
            appointment.patientId === patient.id &&
            appointment.scheduleId === schedule.id,
        );

      if (savedItem?.status === "cancelado") continue;

      items.push(
        savedItem ?? {
          id,
          patientId: patient.id,
          scheduleId: schedule.id,
          clinicId: patient.clinicId ?? null,
          startsAt: combineDateTime(dateKey, schedule.time),
          originalDate: dateKey,
          durationMin: schedule.durationMinutes,
          status: "agendado",
          paid: false,
          repasseConfirmed: false,
          createdAt: new Date().toISOString(),
        },
      );
    }
  }

  for (const appointment of saved) {
    if (appointment.status === "cancelado") continue;
    if (appointmentDateKey(appointment) !== dateKey) continue;
    if (items.some((item) => item.id === appointment.id)) continue;
    if (
      items.some(
        (item) =>
          item.patientId === appointment.patientId &&
          timeFromIso(item.startsAt) === timeFromIso(appointment.startsAt),
      )
    ) {
      continue;
    }
    const patient = getPatients().find((item) => item.id === appointment.patientId);
    if (patient?.status !== "ativo") continue;
    items.push(appointment);
  }

  return items.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}

export function getAppointmentsToday(now = new Date()): Appointment[] {
  return getAgendaAppointmentsForDate(toDateKey(now));
}

export function getNextAppointment(now = new Date()): Appointment | null {
  const today = toDateKey(now);

  for (let offset = 0; offset < 120; offset += 1) {
    const date = parseDateKey(today);
    date.setDate(date.getDate() + offset);
    const items = getAgendaAppointmentsForDate(toDateKey(date))
      .filter(
        (appointment) =>
          appointment.status === "agendado" &&
          new Date(appointment.startsAt).getTime() >= now.getTime(),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    if (items[0]) return items[0];
  }

  return null;
}

export function countAbsences(): number {
  return getAppointments().filter((a) =>
    ["falta", "falta-justificada"].includes(a.status),
  ).length;
}

export function legacyIsSameDay(a: Date, b: Date) {
  return isSameDay(a, b);
}
