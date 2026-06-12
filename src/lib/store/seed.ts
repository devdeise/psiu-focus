import {
  STORAGE_KEYS,
  saveAppointments,
  saveClinics,
  savePatients,
} from "./index";
import type { Appointment, Clinic, ClinicAttendanceType, Patient } from "./types";

function uid() {
  return crypto.randomUUID();
}

function atTime(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function clinicTypes(items: Array<{ name: string; value: number }>): ClinicAttendanceType[] {
  return items.map((item) => ({ id: uid(), ...item }));
}

/**
 * Popula o store local com dados de exemplo apenas na primeira vez.
 * Idempotente: respeita a flag psiu:store:seeded.
 */
export function ensureSeed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STORAGE_KEYS.seeded)) return;

  const now = new Date().toISOString();

  const clinicATypes = clinicTypes([
    { name: "Terapia ABA", value: 200 },
    { name: "Psicoterapia infantil", value: 180 },
  ]);
  const clinicBTypes = clinicTypes([
    { name: "Psicoterapia", value: 180 },
    { name: "Avaliação", value: 240 },
  ]);

  const clinicA: Clinic = {
    id: uid(),
    name: "Clínica Bem-Estar",
    attendanceTypes: clinicATypes,
    repassePercent: 30,
    defaultSessionValue: clinicATypes[0].value,
    paymentTypes: ["clinica"],
    notes: "Repasse mensal no dia 10.",
    createdAt: now,
  };
  const clinicB: Clinic = {
    id: uid(),
    name: "Espaço Equilíbrio",
    attendanceTypes: clinicBTypes,
    repassePercent: 25,
    defaultSessionValue: clinicBTypes[0].value,
    paymentTypes: ["clinica"],
    createdAt: now,
  };

  const patients: Patient[] = [
    {
      id: uid(),
      name: "Ana Lima",
      phone: "(11) 99999-1111",
      status: "ativo",
      weekDay: "1",
      time: "09:00",
      clinicId: null,
      paymentType: "particular",
      paymentFrequency: "sessao",
      sessionValue: 220,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Bruno Souza",
      phone: "(11) 99999-2222",
      status: "ativo",
      weekDay: "2",
      time: "11:00",
      clinicId: null,
      paymentType: "particular",
      paymentFrequency: "mensal",
      sessionValue: 800,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Carla Mendes",
      phone: "(11) 99999-3333",
      status: "ativo",
      weekDay: "3",
      time: "15:00",
      clinicId: clinicA.id,
      attendanceTypeId: clinicATypes[0].id,
      attendanceTypeName: clinicATypes[0].name,
      paymentType: "clinica",
      paymentFrequency: "sessao",
      sessionValue: clinicATypes[0].value,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Diego Faria",
      phone: "(11) 99999-4444",
      status: "ativo",
      weekDay: "4",
      time: "10:00",
      clinicId: clinicB.id,
      attendanceTypeId: clinicBTypes[0].id,
      attendanceTypeName: clinicBTypes[0].name,
      paymentType: "clinica",
      paymentFrequency: "sessao",
      sessionValue: clinicBTypes[0].value,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Elisa Prado",
      status: "encerrado",
      weekDay: "5",
      time: "14:00",
      clinicId: null,
      paymentType: "particular",
      paymentFrequency: "sessao",
      sessionValue: 220,
      createdAt: now,
      closedAt: now,
    },
  ];

  const [ana, bruno, carla, diego] = patients;

  const appointments: Appointment[] = [
    {
      id: uid(),
      patientId: ana.id,
      clinicId: null,
      startsAt: atTime(0, 9),
      durationMin: 50,
      status: "agendado",
      paid: false,
      repasseConfirmed: false,
      createdAt: now,
    },
    {
      id: uid(),
      patientId: bruno.id,
      clinicId: null,
      startsAt: atTime(0, 11),
      durationMin: 50,
      status: "agendado",
      paid: false,
      repasseConfirmed: false,
      createdAt: now,
    },
    {
      id: uid(),
      patientId: carla.id,
      clinicId: clinicA.id,
      startsAt: atTime(0, 15),
      durationMin: 50,
      status: "agendado",
      paid: false,
      repasseConfirmed: false,
      createdAt: now,
    },
    {
      id: uid(),
      patientId: diego.id,
      clinicId: clinicB.id,
      startsAt: atTime(1, 10),
      durationMin: 50,
      status: "agendado",
      paid: false,
      repasseConfirmed: false,
      createdAt: now,
    },
    {
      id: uid(),
      patientId: ana.id,
      clinicId: null,
      startsAt: atTime(-2, 9),
      durationMin: 50,
      status: "falta",
      paid: false,
      repasseConfirmed: false,
      createdAt: now,
    },
    {
      id: uid(),
      patientId: carla.id,
      clinicId: clinicA.id,
      startsAt: atTime(-3, 15),
      durationMin: 50,
      status: "realizado",
      paid: true,
      repasseConfirmed: false,
      createdAt: now,
    },
  ];

  saveClinics([clinicA, clinicB]);
  savePatients(patients);
  saveAppointments(appointments);
  window.localStorage.setItem(STORAGE_KEYS.seeded, "1");
}
