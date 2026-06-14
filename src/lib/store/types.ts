// Tipos centrais do PSIU! (frontend-only, persistidos em localStorage)

export type PaymentType = "particular" | "convenio" | "clinica";
export type PaymentFrequency = "sessao" | "mensal";
export type PatientStatus = "ativo" | "encerrado";
export type AppointmentStatus =
  | "agendado"
  | "realizado"
  | "falta"
  | "falta-justificada"
  | "cancelado";
export type DayStatus = "normal" | "folga";

export type ClinicAttendanceType = {
  id: string;
  name: string;
  value: number;
};

export type ClinicPaymentTermType = "30_days" | "60_days" | "custom";

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
  paymentTermType?: ClinicPaymentTermType;
  customPaymentDays?: number;
  paymentTermDays?: number;
  /** Endereço/observações livres. */
  notes?: string;
  createdAt: string;
};

export type PatientSchedule = {
  id: string;
  weekday: string;
  time: string;
  durationMinutes: number;
};

export type Patient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: PatientStatus;
  /** Dias e horários recorrentes de atendimento. */
  schedules?: PatientSchedule[];
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
  scheduleId?: string;
  clinicId?: string | null;
  /** ISO datetime de início. */
  startsAt: string;
  /** Data original em yyyy-MM-dd, usada para remarcações. */
  originalDate?: string;
  /** Duração em minutos. */
  durationMin: number;
  status: AppointmentStatus;
  /** Marcado como pago pelo paciente. */
  paid: boolean;
  /** Marcado como repasse confirmado à clínica. */
  repasseConfirmed: boolean;
  absenceReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type DayStatusRecord = {
  date: string;
  status: DayStatus;
};

export type VacationPeriod = {
  id: string;
  startsOn: string;
  endsOn: string;
};

export type MonthlyPayment = {
  id: string;
  patientId: string;
  month: string;
  amountDue?: number;
  amountReceived?: number;
  status?: "pendente" | "parcial" | "pago";
  appointmentId?: string;
  receivedMonth?: string;
  delayed?: boolean;
  source?: "agenda" | "confirmar-pagamento";
  notes?: string;
  paidAt: string;
};

export type CashEntry = {
  id: string;
  source: "particular-sessao" | "particular-mensal" | "clinica";
  patientId?: string;
  clinicId?: string;
  appointmentId?: string;
  month?: string;
  receivedMonth: string;
  delayed?: boolean;
  expectedAmount?: number;
  discountAmount?: number;
  amount: number;
  createdAt: string;
  notes?: string;
};

export type ClinicPaymentRecord = {
  id: string;
  clinicId: string;
  month: string;
  amount: number;
  expectedAmount?: number;
  discountAmount?: number;
  appointmentIds: string[];
  status: "aguardando" | "atrasado" | "confirmado";
  receivedMonth: string;
  delayed?: boolean;
  confirmedAt: string;
  notes?: string;
};
