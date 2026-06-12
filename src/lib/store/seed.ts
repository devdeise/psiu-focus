import {
  STORAGE_KEYS,
  saveAppointments,
  saveClinics,
  savePatients,
} from "./index";
import type { Appointment, Clinic, Patient } from "./types";

function uid() {
  return crypto.randomUUID();
}

function atTime(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Popula o store local com dados de exemplo apenas na primeira vez.
 * Idempotente: respeita a flag psiu:store:seeded.
 */
export function ensureSeed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STORAGE_KEYS.seeded)) return;

  const now = new Date().toISOString();

  const clinicA: Clinic = {
    id: uid(),
    name: "Clínica Bem-Estar",
    repassePercent: 30,
    defaultSessionValue: 200,
    paymentTypes: ["clinica", "convenio"],
    notes: "Repasse mensal no dia 10.",
    createdAt: now,
  };
  const clinicB: Clinic = {
    id: uid(),
    name: "Espaço Equilíbrio",
    repassePercent: 25,
    defaultSessionValue: 180,
    paymentTypes: ["clinica"],
    createdAt: now,
  };

  const patients: Patient[] = [
    {
      id: uid(),
      name: "Ana Lima",
      phone: "(11) 99999-1111",
      status: "ativo",
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
      clinicId: clinicA.id,
      paymentType: "clinica",
      paymentFrequency: "sessao",
      sessionValue: 200,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Diego Faria",
      phone: "(11) 99999-4444",
      status: "ativo",
      clinicId: clinicB.id,
      paymentType: "clinica",
      paymentFrequency: "sessao",
      sessionValue: 180,
      createdAt: now,
    },
    {
      id: uid(),
      name: "Elisa Prado",
      status: "encerrado",
      clinicId: null,
      paymentType: "particular",
      paymentFrequency: "sessao",
      sessionValue: 220,
      createdAt: now,
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
