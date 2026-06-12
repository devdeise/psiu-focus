// Tipos centrais do PSIU! (frontend-only, persistidos em localStorage)

export type PaymentType = "particular" | "convenio" | "clinica";
export type PaymentFrequency = "sessao" | "semanal" | "quinzenal" | "mensal";
export type PatientStatus = "ativo" | "encerrado";
export type AppointmentStatus =
  | "agendado"
  | "realizado"
  | "falta"
  | "cancelado";

export type ClinicAttendanceType = {
  id: string;
  name: string;
  value: number;
};

export type Clinic = {
  id: string;
  name: string;
  /** Tipos de atendimento oferecidos pela clínica, com valores próprios. */
  attendanceTypes?: ClinicAttendanceType[];
  /** Percentual de repasse devido à clínica (0-100). */
  repassePercent: number;
  /** Valor padrão da sessão na clínica (opcional). */
  defaultSessionValue?: number;
  /** Tipos de cobrança aceitos pela clínica. */
  paymentTypes: PaymentType[];
  /** Endereço/observações livres. */
  notes?: string;
  createdAt: string;
};

export type Patient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: PatientStatus;
  /** Dia da semana do atendimento recorrente (0 domingo, 6 sábado). */
  weekDay?: string;
  /** Horário principal do atendimento recorrente (HH:mm). */
  time?: string;
  /** Clínica vinculada (ou null para particular puro). */
  clinicId?: string | null;
  /** Tipo de atendimento selecionado na clínica. */
  attendanceTypeId?: string | null;
  attendanceTypeName?: string;
  /** Tipo de pagamento principal do paciente. */
  paymentType: PaymentType;
  /** Frequência/modelo de cobrança. */
  paymentFrequency: PaymentFrequency;
  /** Valor da sessão (ou pacote, conforme frequência). */
  sessionValue: number;
  notes?: string;
  createdAt: string;
  closedAt?: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  clinicId?: string | null;
  /** ISO datetime de início. */
  startsAt: string;
  /** Duração em minutos. */
  durationMin: number;
  status: AppointmentStatus;
  /** Marcado como pago pelo paciente. */
  paid: boolean;
  /** Marcado como repasse confirmado à clínica. */
  repasseConfirmed: boolean;
  notes?: string;
  createdAt: string;
};
