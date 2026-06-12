import type {
  Appointment,
  Clinic,
  Patient,
} from "./types";

export const STORAGE_KEYS = {
  clinics: "psiu:clinics",
  patients: "psiu:patients",
  appointments: "psiu:appointments",
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

// ---------- Clinics ----------
export function getClinics(): Clinic[] {
  return read<Clinic>(STORAGE_KEYS.clinics);
}
export function saveClinics(clinics: Clinic[]) {
  write(STORAGE_KEYS.clinics, clinics);
}

// ---------- Patients ----------
export function getPatients(): Patient[] {
  return read<Patient>(STORAGE_KEYS.patients);
}
export function savePatients(patients: Patient[]) {
  write(STORAGE_KEYS.patients, patients);
}
export function getActivePatients(): Patient[] {
  return getPatients().filter((p) => p.status === "ativo");
}

// ---------- Appointments ----------
export function getAppointments(): Appointment[] {
  return read<Appointment>(STORAGE_KEYS.appointments);
}
export function saveAppointments(items: Appointment[]) {
  write(STORAGE_KEYS.appointments, items);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getAppointmentsToday(now = new Date()): Appointment[] {
  return getAppointments().filter((a) =>
    isSameDay(new Date(a.startsAt), now),
  );
}

export function getNextAppointment(now = new Date()): Appointment | null {
  const upcoming = getAppointments()
    .filter(
      (a) =>
        a.status === "agendado" && new Date(a.startsAt).getTime() >= now.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  return upcoming[0] ?? null;
}

export function countAbsences(): number {
  return getAppointments().filter((a) => a.status === "falta").length;
}
