// Camada de sincronização Lovable Cloud ↔ localStorage para o PSIU!
// Mantém as APIs síncronas existentes do store e espelha cada write para o Cloud.

import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS } from "./index";
import type {
  Appointment,
  CashEntry,
  Clinic,
  ClinicAttendanceType,
  ClinicPaymentRecord,
  DayStatusRecord,
  MonthlyPayment,
  Patient,
  PatientSchedule,
  VacationPeriod,
} from "./types";

// --- estado interno ---
let currentUserId: string | null = null;
let pullPromise: Promise<void> | null = null;
let initialPulled = false;

export function setCloudUser(userId: string | null) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  initialPulled = false;
  pullPromise = null;
}

export function getCloudUser() {
  return currentUserId;
}

function ts() {
  return new Date().toISOString();
}

// --- mapeamentos ---
function clinicFromRow(row: any, types: ClinicAttendanceType[]): Clinic {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? undefined,
    attendanceTypes: types,
    repassePercent: Number(row.repasse_percent ?? 0),
    defaultSessionValue:
      row.default_session_value != null ? Number(row.default_session_value) : undefined,
    paymentTypes: (row.payment_types ?? ["clinica"]) as Clinic["paymentTypes"],
    paymentTermType: row.payment_term_type ?? undefined,
    customPaymentDays: row.custom_payment_days ?? undefined,
    paymentTermDays: row.payment_term_days ?? undefined,
    createdAt: row.created_at ?? ts(),
  };
}

function clinicToRow(c: Clinic, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    notes: c.notes ?? null,
    status: "ativa",
    repasse_percent: c.repassePercent ?? 0,
    default_session_value: c.defaultSessionValue ?? null,
    payment_types: c.paymentTypes ?? ["clinica"],
    payment_term_type: c.paymentTermType ?? null,
    payment_term_days: c.paymentTermDays ?? null,
    custom_payment_days: c.customPaymentDays ?? null,
  };
}

function patientFromRow(row: any, schedules: PatientSchedule[]): Patient {
  const data = row.data ?? {};
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    status: row.status as Patient["status"],
    schedules,
    weekDay: data.weekDay,
    time: data.time,
    clinicId: row.clinic_id ?? null,
    attendanceTypeId: row.attendance_type_id ?? null,
    attendanceTypeName: row.attendance_type_name ?? undefined,
    paymentType: row.payment_type as Patient["paymentType"],
    paymentFrequency: row.payment_frequency as Patient["paymentFrequency"],
    sessionValue: Number(row.session_value ?? 0),
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? ts(),
    closedAt: row.closed_at ?? undefined,
  };
}

function patientToRow(p: Patient, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    phone: p.phone ?? null,
    email: p.email ?? null,
    status: p.status,
    clinic_id: p.clinicId || null,
    attendance_type_id: p.attendanceTypeId || null,
    attendance_type_name: p.attendanceTypeName ?? null,
    payment_type: p.paymentType,
    payment_frequency: p.paymentFrequency,
    session_value: p.sessionValue ?? 0,
    notes: p.notes ?? null,
    closed_at: p.closedAt ?? null,
    data: { weekDay: p.weekDay, time: p.time },
  };
}

function appointmentFromRow(row: any): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    scheduleId: row.schedule_id ?? undefined,
    clinicId: row.clinic_id ?? null,
    startsAt: row.starts_at,
    originalDate: row.original_date ?? undefined,
    durationMin: Number(row.duration_min ?? 50),
    status: row.status as Appointment["status"],
    paid: !!row.paid,
    repasseConfirmed: !!row.repasse_confirmed,
    absenceReason: row.absence_reason ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? ts(),
    updatedAt: row.updated_at ?? undefined,
  };
}

function appointmentToRow(a: Appointment, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    patient_id: a.patientId,
    schedule_id: a.scheduleId ?? null,
    clinic_id: a.clinicId || null,
    starts_at: a.startsAt,
    original_date: a.originalDate ?? null,
    duration_min: a.durationMin ?? 50,
    status: a.status,
    paid: !!a.paid,
    repasse_confirmed: !!a.repasseConfirmed,
    absence_reason: a.absenceReason ?? null,
    notes: a.notes ?? null,
  };
}

// --- mappers para pagamentos / caixa ---
function clinicPaymentFromRow(row: any): ClinicPaymentRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    month: row.month,
    amount: Number(row.amount ?? 0),
    expectedAmount: row.expected_amount != null ? Number(row.expected_amount) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    appointmentIds: Array.isArray(row.appointment_ids) ? row.appointment_ids : [],
    status: row.status,
    receivedMonth: row.received_month,
    delayed: !!row.delayed,
    confirmedAt: row.confirmed_at ?? ts(),
    notes: row.notes ?? undefined,
  };
}
function clinicPaymentToRow(p: ClinicPaymentRecord, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    clinic_id: p.clinicId,
    month: p.month,
    amount: p.amount ?? 0,
    expected_amount: p.expectedAmount ?? null,
    discount_amount: p.discountAmount ?? null,
    appointment_ids: p.appointmentIds ?? [],
    status: p.status,
    received_month: p.receivedMonth,
    delayed: !!p.delayed,
    confirmed_at: p.confirmedAt,
    notes: p.notes ?? null,
  };
}

function monthlyPaymentFromRow(row: any): MonthlyPayment {
  return {
    id: row.id,
    patientId: row.patient_id,
    month: row.month,
    amountDue: row.amount_due != null ? Number(row.amount_due) : undefined,
    amountReceived: row.amount_received != null ? Number(row.amount_received) : undefined,
    status: row.status ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    receivedMonth: row.received_month ?? undefined,
    delayed: !!row.delayed,
    source: row.source ?? undefined,
    notes: row.notes ?? undefined,
    paidAt: row.paid_at ?? ts(),
  };
}
function monthlyPaymentToRow(p: MonthlyPayment, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    patient_id: p.patientId,
    month: p.month,
    amount_due: p.amountDue ?? null,
    amount_received: p.amountReceived ?? null,
    status: p.status ?? null,
    appointment_id: p.appointmentId ?? null,
    received_month: p.receivedMonth ?? null,
    delayed: !!p.delayed,
    source: p.source ?? null,
    notes: p.notes ?? null,
    paid_at: p.paidAt,
  };
}

function cashEntryFromRow(row: any): CashEntry {
  return {
    id: row.id,
    source: row.source,
    patientId: row.patient_id ?? undefined,
    clinicId: row.clinic_id ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    month: row.month ?? undefined,
    receivedMonth: row.received_month,
    delayed: !!row.delayed,
    expectedAmount: row.expected_amount != null ? Number(row.expected_amount) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    amount: Number(row.amount ?? 0),
    createdAt: row.created_at ?? ts(),
    notes: row.notes ?? undefined,
  };
}
function cashEntryToRow(c: CashEntry, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    source: c.source,
    patient_id: c.patientId ?? null,
    clinic_id: c.clinicId ?? null,
    appointment_id: c.appointmentId ?? null,
    month: c.month ?? null,
    received_month: c.receivedMonth,
    delayed: !!c.delayed,
    expected_amount: c.expectedAmount ?? null,
    discount_amount: c.discountAmount ?? null,
    amount: c.amount ?? 0,
    notes: c.notes ?? null,
  };
}

// --- pull (cloud → local) ---
export function pullAllFromCloud(): Promise<void> {
  if (!currentUserId) return Promise.resolve();
  if (pullPromise) return pullPromise;
  const userId = currentUserId;
  pullPromise = (async () => {
    try {
      const [
        clinicsRes,
        atRes,
        patientsRes,
        schedulesRes,
        appsRes,
        dayRes,
        vacRes,
        clinicPaysRes,
        monthlyPaysRes,
        cashRes,
      ] = await Promise.all([
        supabase.from("clinics").select("*").eq("user_id", userId),
        supabase.from("attendance_types").select("*").eq("user_id", userId),
        supabase.from("patients").select("*").eq("user_id", userId),
        supabase.from("patient_schedules").select("*").eq("user_id", userId),
        supabase.from("appointments").select("*").eq("user_id", userId),
        supabase.from("day_statuses").select("*").eq("user_id", userId),
        supabase.from("vacations").select("*").eq("user_id", userId),
        supabase.from("clinic_payments").select("*").eq("user_id", userId),
        supabase.from("monthly_payments").select("*").eq("user_id", userId),
        supabase.from("cash_entries").select("*").eq("user_id", userId),
      ]);

      const atByClinic = new Map<string, ClinicAttendanceType[]>();
      for (const t of atRes.data ?? []) {
        const arr = atByClinic.get(t.clinic_id) ?? [];
        arr.push({ id: t.id, name: t.name, value: Number(t.value ?? 0) });
        atByClinic.set(t.clinic_id, arr);
      }
      const clinics: Clinic[] = (clinicsRes.data ?? []).map((row: any) =>
        clinicFromRow(row, atByClinic.get(row.id) ?? []),
      );

      const schedByPatient = new Map<string, PatientSchedule[]>();
      for (const s of schedulesRes.data ?? []) {
        const arr = schedByPatient.get(s.patient_id) ?? [];
        arr.push({
          id: s.id,
          weekday: s.weekday,
          time: s.time,
          durationMinutes: Number(s.duration_minutes ?? 50),
        });
        schedByPatient.set(s.patient_id, arr);
      }
      const patients: Patient[] = (patientsRes.data ?? []).map((row: any) =>
        patientFromRow(row, schedByPatient.get(row.id) ?? []),
      );

      const appointments: Appointment[] = (appsRes.data ?? []).map(appointmentFromRow);

      const dayStatuses: DayStatusRecord[] = (dayRes.data ?? []).map((r: any) => ({
        date: r.date,
        status: r.status,
      }));
      const vacations: VacationPeriod[] = (vacRes.data ?? []).map((r: any) => ({
        id: r.id,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
      }));

      const clinicPayments: ClinicPaymentRecord[] = (clinicPaysRes.data ?? []).map(clinicPaymentFromRow);
      const monthlyPayments: MonthlyPayment[] = (monthlyPaysRes.data ?? []).map(monthlyPaymentFromRow);
      const cashEntries: CashEntry[] = (cashRes.data ?? []).map(cashEntryFromRow);

      const isEmpty =
        !clinics.length &&
        !patients.length &&
        !appointments.length &&
        !dayStatuses.length &&
        !vacations.length &&
        !clinicPayments.length &&
        !monthlyPayments.length &&
        !cashEntries.length;

      if (isEmpty) {
        initialPulled = true;
        await pushAllLocalToCloud();
        return;
      }

      window.localStorage.setItem(STORAGE_KEYS.clinics, JSON.stringify(clinics));
      window.localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patients));
      window.localStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(appointments));
      window.localStorage.setItem(STORAGE_KEYS.dayStatuses, JSON.stringify(dayStatuses));
      window.localStorage.setItem(STORAGE_KEYS.vacations, JSON.stringify(vacations));
      window.localStorage.setItem(STORAGE_KEYS.clinicPayments, JSON.stringify(clinicPayments));
      window.localStorage.setItem(STORAGE_KEYS.monthlyPayments, JSON.stringify(monthlyPayments));
      window.localStorage.setItem(STORAGE_KEYS.cashEntries, JSON.stringify(cashEntries));
      window.localStorage.setItem(STORAGE_KEYS.seeded, "1");
      initialPulled = true;
    } catch (err) {
      console.error("[cloud] pullAllFromCloud", err);
    }
  })();
  return pullPromise;
}

// --- push helpers (local → cloud) ---
async function pushAllLocalToCloud() {
  if (!currentUserId) return;
  try {
    const raw = (k: string) => window.localStorage.getItem(k);
    const clinics: Clinic[] = JSON.parse(raw(STORAGE_KEYS.clinics) || "[]");
    const patients: Patient[] = JSON.parse(raw(STORAGE_KEYS.patients) || "[]");
    const apps: Appointment[] = JSON.parse(raw(STORAGE_KEYS.appointments) || "[]");
    const days: DayStatusRecord[] = JSON.parse(raw(STORAGE_KEYS.dayStatuses) || "[]");
    const vacs: VacationPeriod[] = JSON.parse(raw(STORAGE_KEYS.vacations) || "[]");
    const cps: ClinicPaymentRecord[] = JSON.parse(raw(STORAGE_KEYS.clinicPayments) || "[]");
    const mps: MonthlyPayment[] = JSON.parse(raw(STORAGE_KEYS.monthlyPayments) || "[]");
    const ces: CashEntry[] = JSON.parse(raw(STORAGE_KEYS.cashEntries) || "[]");
    await Promise.all([
      syncClinics(clinics),
      syncPatients(patients),
      syncAppointments(apps),
      syncDayStatuses(days),
      syncVacations(vacs),
      syncClinicPayments(cps),
      syncMonthlyPayments(mps),
      syncCashEntries(ces),
    ]);
  } catch (err) {
    console.error("[cloud] pushAllLocalToCloud", err);
  }
}

// Diff-based upsert/delete por coleção
export async function syncClinics(clinics: Clinic[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("clinics")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(clinics.map((c) => c.id));

    // Upsert clinics
    if (clinics.length) {
      const rows = clinics.map((c) => clinicToRow(c, userId));
      const { error } = await supabase.from("clinics").upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert clinics", error);
    }

    // Delete clinics removidos
    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("clinics").delete().in("id", toDelete).eq("user_id", userId);
    }

    // Sincronizar attendance_types: delete + reinsert por clínica
    await supabase.from("attendance_types").delete().eq("user_id", userId);
    const allTypes = clinics.flatMap((c) =>
      (c.attendanceTypes ?? []).map((t) => ({
        id: t.id,
        user_id: userId,
        clinic_id: c.id,
        name: t.name,
        value: t.value ?? 0,
        active: true,
      })),
    );
    if (allTypes.length) {
      const { error } = await supabase.from("attendance_types").insert(allTypes);
      if (error) console.error("[cloud] insert attendance_types", error);
    }
  } catch (err) {
    console.error("[cloud] syncClinics", err);
  }
}

export async function syncPatients(patients: Patient[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(patients.map((p) => p.id));

    if (patients.length) {
      const rows = patients.map((p) => patientToRow(p, userId));
      const { error } = await supabase.from("patients").upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert patients", error);
    }

    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("patients").delete().in("id", toDelete).eq("user_id", userId);
    }

    // Sincroniza schedules: delete + reinsert por paciente
    await supabase.from("patient_schedules").delete().eq("user_id", userId);
    const allSchedules = patients.flatMap((p) =>
      (p.schedules ?? []).map((s) => ({
        id: s.id,
        user_id: userId,
        patient_id: p.id,
        weekday: s.weekday,
        time: s.time,
        duration_minutes: s.durationMinutes ?? 50,
        active: true,
      })),
    );
    if (allSchedules.length) {
      const { error } = await supabase.from("patient_schedules").insert(allSchedules);
      if (error) console.error("[cloud] insert patient_schedules", error);
    }
  } catch (err) {
    console.error("[cloud] syncPatients", err);
  }
}

export async function syncAppointments(apps: Appointment[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(apps.map((a) => a.id));

    if (apps.length) {
      const rows = apps.map((a) => appointmentToRow(a, userId));
      const { error } = await supabase.from("appointments").upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert appointments", error);
    }

    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("appointments").delete().in("id", toDelete).eq("user_id", userId);
    }
  } catch (err) {
    console.error("[cloud] syncAppointments", err);
  }
}

export async function syncDayStatuses(items: DayStatusRecord[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    await supabase.from("day_statuses").delete().eq("user_id", userId);
    if (items.length) {
      const rows = items.map((i) => ({
        user_id: userId,
        date: i.date,
        status: i.status,
      }));
      const { error } = await supabase.from("day_statuses").insert(rows);
      if (error) console.error("[cloud] insert day_statuses", error);
    }
  } catch (err) {
    console.error("[cloud] syncDayStatuses", err);
  }
}

export async function syncVacations(items: VacationPeriod[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("vacations")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(items.map((v) => v.id));

    if (items.length) {
      const rows = items.map((v) => ({
        id: v.id,
        user_id: userId,
        starts_on: v.startsOn,
        ends_on: v.endsOn,
      }));
      const { error } = await supabase.from("vacations").upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert vacations", error);
    }

    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("vacations").delete().in("id", toDelete).eq("user_id", userId);
    }
  } catch (err) {
    console.error("[cloud] syncVacations", err);
  }
}

export async function syncClinicPayments(items: ClinicPaymentRecord[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("clinic_payments")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(items.map((i) => i.id));
    if (items.length) {
      const rows = items.map((i) => clinicPaymentToRow(i, userId));
      const { error } = await supabase
        .from("clinic_payments")
        .upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert clinic_payments", error);
    }
    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("clinic_payments").delete().in("id", toDelete).eq("user_id", userId);
    }
  } catch (err) {
    console.error("[cloud] syncClinicPayments", err);
  }
}

export async function syncMonthlyPayments(items: MonthlyPayment[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("monthly_payments")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(items.map((i) => i.id));
    if (items.length) {
      const rows = items.map((i) => monthlyPaymentToRow(i, userId));
      const { error } = await supabase
        .from("monthly_payments")
        .upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert monthly_payments", error);
    }
    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("monthly_payments").delete().in("id", toDelete).eq("user_id", userId);
    }
  } catch (err) {
    console.error("[cloud] syncMonthlyPayments", err);
  }
}

export async function syncCashEntries(items: CashEntry[]) {
  if (!currentUserId || !initialPulled) return;
  const userId = currentUserId;
  try {
    const { data: existing } = await supabase
      .from("cash_entries")
      .select("id")
      .eq("user_id", userId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.id));
    const localIds = new Set(items.map((i) => i.id));
    if (items.length) {
      const rows = items.map((i) => cashEntryToRow(i, userId));
      const { error } = await supabase
        .from("cash_entries")
        .upsert(rows, { onConflict: "id" });
      if (error) console.error("[cloud] upsert cash_entries", error);
    }
    const toDelete = [...existingIds].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      await supabase.from("cash_entries").delete().in("id", toDelete).eq("user_id", userId);
    }
  } catch (err) {
    console.error("[cloud] syncCashEntries", err);
  }
}

// Debounce simples por coleção
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
function debounce(key: string, fn: () => void, ms = 250) {
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, ms);
}

export function scheduleSync(
  collection: "clinics" | "patients" | "appointments" | "dayStatuses" | "vacations",
) {
  if (!currentUserId || !initialPulled) return;
  debounce(collection, () => {
    try {
      const raw = (k: string) => window.localStorage.getItem(k);
      if (collection === "clinics") {
        const items: Clinic[] = JSON.parse(raw(STORAGE_KEYS.clinics) || "[]");
        void syncClinics(items);
      } else if (collection === "patients") {
        const items: Patient[] = JSON.parse(raw(STORAGE_KEYS.patients) || "[]");
        void syncPatients(items);
      } else if (collection === "appointments") {
        const items: Appointment[] = JSON.parse(raw(STORAGE_KEYS.appointments) || "[]");
        void syncAppointments(items);
      } else if (collection === "dayStatuses") {
        const items: DayStatusRecord[] = JSON.parse(raw(STORAGE_KEYS.dayStatuses) || "[]");
        void syncDayStatuses(items);
      } else if (collection === "vacations") {
        const items: VacationPeriod[] = JSON.parse(raw(STORAGE_KEYS.vacations) || "[]");
        void syncVacations(items);
      }
    } catch (err) {
      console.error("[cloud] scheduleSync", err);
    }
  });
}
