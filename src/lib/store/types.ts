// Tipos centrais do PSIU! (frontend-only, persistidos em localStorage)

export type PaymentType = "particular" | "convenio" | "clinica";
export type PaymentFrequency = "sessao" | "semanal" | "mensal";
export type PatientStatus = "ativo" | "encerrado";
export type AppointmentStatus =
  | "agendado"
  | "realizado"
  | "falta"
  | "cancelado";

export type Clinic = {
  id: string;
  name: string;
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
  /** Clínica vinculada (ou null para particular puro). */
  clinicId?: string | null;
  /** Tipo de pagamento principal do paciente. */
  paymentType: PaymentType;
  /** Frequência de cobrança. */
  paymentFrequency: PaymentFrequency;
  /** Valor da sessão (ou pacote, conforme frequência). */
  sessionValue: number;
  notes?: string;
  createdAt: string;
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
