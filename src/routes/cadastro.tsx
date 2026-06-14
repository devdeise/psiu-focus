import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAppointments,
  getClinics,
  getPatients,
  patientHasHistory,
  saveAppointments,
  saveClinics,
  savePatients,
} from "@/lib/store";
import type {
  Clinic,
  ClinicAttendanceType,
  ClinicPaymentTermType,
  Patient,
  PatientSchedule,
  PaymentFrequency,
} from "@/lib/store/types";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Cadastro — PSIU!" }] }),
  component: CadastroPage,
});

type PatientOrigin = "clinica" | "particular";

type ClinicTypeDraft = {
  id: string;
  name: string;
  value: string;
};

type ClinicDraft = {
  id?: string;
  name: string;
  types: ClinicTypeDraft[];
  paymentTermType: ClinicPaymentTermType;
  customPaymentDays: string;
};

type PatientScheduleDraft = {
  id: string;
  weekday: string;
  time: string;
  durationMinutes: string;
};

type PatientDraft = {
  id?: string;
  name: string;
  origin: PatientOrigin | "";
  clinicId: string;
  attendanceTypeId: string;
  value: string;
  schedules: PatientScheduleDraft[];
  billingModel: PaymentFrequency;
  notes: string;
};

type DeletePatientDraft = {
  patient: Patient;
  mode: "simple" | "protected" | "blocked";
  pin: string;
  error: string;
};

const PIN_STORAGE_KEY = "psiu:internal-pin";

const weekDays = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

const billingOptions: Array<{ value: PaymentFrequency; label: string }> = [
  { value: "sessao", label: "Por sessão" },
  { value: "mensal", label: "Mensal" },
];

const durationOptions = [30, 45, 50, 60, 90, 120] as const;
const DEFAULT_DURATION_MINUTES = 50;

function uid() {
  return crypto.randomUUID();
}

function loadInternalPin() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseMoney(value: string) {
  const normalized = value
    .trim()
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  return Number(normalized || 0);
}

function typeValueText(value: number) {
  return value ? String(value) : "";
}

function clinicPaymentTermDaysFromDraft(draft: ClinicDraft) {
  if (draft.paymentTermType === "60_days") return 60;
  if (draft.paymentTermType === "custom") return Number(draft.customPaymentDays);
  return 30;
}

function clinicPaymentTermLabel(clinic: Clinic) {
  const days = Number(clinic.paymentTermDays) || 30;
  return `${days} dias`;
}

function emptyClinicDraft(): ClinicDraft {
  return {
    name: "",
    types: [{ id: uid(), name: "", value: "" }],
    paymentTermType: "30_days",
    customPaymentDays: "",
  };
}

function emptyScheduleDraft(): PatientScheduleDraft {
  return {
    id: uid(),
    weekday: "",
    time: "",
    durationMinutes: String(DEFAULT_DURATION_MINUTES),
  };
}

function emptyPatientDraft(): PatientDraft {
  return {
    name: "",
    origin: "",
    clinicId: "",
    attendanceTypeId: "",
    value: "",
    schedules: [emptyScheduleDraft()],
    billingModel: "sessao",
    notes: "",
  };
}

function normalizeBillingModel(value?: string): PaymentFrequency {
  return value === "mensal" ? "mensal" : "sessao";
}

function normalizeClinicTypes(clinic: Clinic): ClinicAttendanceType[] {
  if (clinic.attendanceTypes?.length) return clinic.attendanceTypes;
  if (clinic.defaultSessionValue) {
    return [
      {
        id: `legacy-${clinic.id}`,
        name: "Atendimento",
        value: clinic.defaultSessionValue,
      },
    ];
  }
  return [];
}

function clinicTypeLabel(clinic: Clinic) {
  const types = normalizeClinicTypes(clinic);
  if (!types.length) return "Sem tipos";
  return types.map((type) => `${type.name} · ${money(type.value)}`).join(" • ");
}

function dayLabel(value?: string) {
  return weekDays.find((day) => day.value === value)?.label ?? "—";
}

function normalizeDuration(value?: number | string) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_DURATION_MINUTES;
}

function normalizePatientSchedules(patient: Patient): PatientSchedule[] {
  const schedules =
    patient.schedules
      ?.filter((schedule) => schedule.weekday && schedule.time)
      .map((schedule) => ({
        ...schedule,
        durationMinutes: normalizeDuration(schedule.durationMinutes),
      })) ?? [];
  if (schedules.length) return schedules;
  if (patient.weekDay && patient.time) {
    return [
      {
        id: uid(),
        weekday: patient.weekDay,
        time: patient.time,
        durationMinutes: DEFAULT_DURATION_MINUTES,
      },
    ];
  }
  return [];
}

function scheduleText(patient: Patient) {
  const schedules = normalizePatientSchedules(patient);
  if (!schedules.length) return "—";
  return schedules
    .map(
      (schedule) =>
        `${dayLabel(schedule.weekday)} ${schedule.time} (${schedule.durationMinutes} min)`,
    )
    .join(", ");
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && endA > startB;
}

function billingLabel(value?: string) {
  return billingOptions.find((item) => item.value === normalizeBillingModel(value))?.label ?? "—";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/60 pt-2 first:border-0 first:pt-0">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function CadastroPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft>(() => emptyClinicDraft());
  const [patientDraft, setPatientDraft] = useState<PatientDraft>(() => emptyPatientDraft());
  const [message, setMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [activeTab, setActiveTab] = useState("clinicas");
  const [reactivateTarget, setReactivateTarget] = useState<Patient | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<DeletePatientDraft | null>(null);

  const activePatients = useMemo(
    () => patients.filter((patient) => patient.status === "ativo"),
    [patients],
  );
  const closedPatients = useMemo(
    () => patients.filter((patient) => patient.status === "encerrado"),
    [patients],
  );

  useEffect(() => {
    setClinics(getClinics());
    setPatients(getPatients());
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  const showSuccessToast = (text: string) => {
    setSuccessToast(text);
  };

  const persistClinics = (next: Clinic[], note: string, toast?: string) => {
    setClinics(next);
    saveClinics(next);
    setMessage(note);
    if (toast) showSuccessToast(toast);
  };

  const persistPatients = (next: Patient[], note: string, toast?: string) => {
    setPatients(next);
    savePatients(next);
    setMessage(note);
    if (toast) showSuccessToast(toast);
  };

  const updateClinicType = (id: string, patch: Partial<ClinicTypeDraft>) => {
    setClinicDraft((draft) => ({
      ...draft,
      types: draft.types.map((type) => (type.id === id ? { ...type, ...patch } : type)),
    }));
  };

  const resetClinicForm = () => setClinicDraft(emptyClinicDraft());

  const editClinic = (clinic: Clinic) => {
    setClinicDraft({
      id: clinic.id,
      name: clinic.name,
      types: normalizeClinicTypes(clinic).map((type) => ({
        id: type.id,
        name: type.name,
        value: typeValueText(type.value),
      })),
      paymentTermType: clinic.paymentTermType ?? "30_days",
      customPaymentDays:
        clinic.paymentTermType === "custom" ? String(clinic.customPaymentDays ?? clinic.paymentTermDays ?? "") : "",
    });
    setMessage("");
  };

  const submitClinic = () => {
    const name = clinicDraft.name.trim();
    if (!name) {
      setMessage("Informe o nome da clínica.");
      return;
    }

    const cleaned = clinicDraft.types.map((type) => ({
      id: type.id,
      name: type.name.trim(),
      value: parseMoney(type.value),
    }));

    if (!cleaned.length) {
      setMessage("Adicione pelo menos um tipo de atendimento.");
      return;
    }
    if (cleaned.some((type) => !type.name || type.value <= 0)) {
      setMessage("Cada tipo precisa ter nome e valor.");
      return;
    }
    const paymentTermDays = clinicPaymentTermDaysFromDraft(clinicDraft);
    if (
      clinicDraft.paymentTermType === "custom" &&
      (!Number.isFinite(paymentTermDays) || paymentTermDays <= 0)
    ) {
      setMessage("Informe uma quantidade de dias maior que zero.");
      return;
    }

    const existing = clinics.find((clinic) => clinic.id === clinicDraft.id);
    const clinic: Clinic = {
      id: existing?.id ?? uid(),
      name,
      attendanceTypes: cleaned,
      repassePercent: existing?.repassePercent ?? 0,
      defaultSessionValue: cleaned[0].value,
      paymentTypes: existing?.paymentTypes?.length ? existing.paymentTypes : ["clinica"],
      paymentTermType: clinicDraft.paymentTermType,
      customPaymentDays: clinicDraft.paymentTermType === "custom" ? paymentTermDays : undefined,
      paymentTermDays,
      notes: existing?.notes,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const next = existing
      ? clinics.map((item) => (item.id === clinic.id ? clinic : item))
      : [...clinics, clinic];

    persistClinics(
      next,
      existing ? "Clínica atualizada." : "Clínica cadastrada.",
      existing ? "Alteração salva com sucesso." : "Cadastro salvo com sucesso.",
    );
    resetClinicForm();
  };

  const removeClinic = (clinicId: string) => {
    persistClinics(
      clinics.filter((clinic) => clinic.id !== clinicId),
      "Clínica excluída.",
    );
  };

  const onClinicSelect = (clinicId: string) => {
    const clinic = clinics.find((item) => item.id === clinicId);
    const firstType = clinic ? normalizeClinicTypes(clinic)[0] : undefined;
    setPatientDraft((draft) => ({
      ...draft,
      clinicId,
      attendanceTypeId: firstType?.id ?? "",
      value: firstType ? typeValueText(firstType.value) : "",
    }));
  };

  const onClinicTypeSelect = (attendanceTypeId: string) => {
    const clinic = clinics.find((item) => item.id === patientDraft.clinicId);
    const type = clinic
      ? normalizeClinicTypes(clinic).find((item) => item.id === attendanceTypeId)
      : undefined;
    setPatientDraft((draft) => ({
      ...draft,
      attendanceTypeId,
      value: type ? typeValueText(type.value) : draft.value,
    }));
  };

  const resetPatientForm = () => {
    setPatientDraft(emptyPatientDraft());
    setReactivateTarget(null);
  };

  const updatePatientSchedule = (
    id: string,
    patch: Partial<PatientScheduleDraft>,
  ) => {
    setPatientDraft((draft) => ({
      ...draft,
      schedules: draft.schedules.map((schedule) =>
        schedule.id === id ? { ...schedule, ...patch } : schedule,
      ),
    }));
  };

  const addPatientSchedule = () => {
    setPatientDraft((draft) => ({
      ...draft,
      schedules: [...draft.schedules, emptyScheduleDraft()],
    }));
  };

  const removePatientSchedule = (id: string) => {
    setPatientDraft((draft) => {
      if (draft.schedules.length === 1) return draft;
      return {
        ...draft,
        schedules: draft.schedules.filter((schedule) => schedule.id !== id),
      };
    });
  };

  const findScheduleConflict = (
    schedules: PatientSchedule[],
    currentPatientId?: string,
  ) => {
    for (const schedule of schedules) {
      const newStart = timeToMinutes(schedule.time);
      const newEnd = newStart + schedule.durationMinutes;

      for (const patient of patients) {
        if (patient.status !== "ativo" || patient.id === currentPatientId) continue;

        for (const existingSchedule of normalizePatientSchedules(patient)) {
          if (existingSchedule.weekday !== schedule.weekday) continue;

          const existingStart = timeToMinutes(existingSchedule.time);
          const existingEnd = existingStart + existingSchedule.durationMinutes;

          if (rangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
            return {
              patientName: patient.name,
              startsAt: existingSchedule.time,
              endsAt: minutesToTime(existingEnd),
            };
          }
        }
      }
    }

    return null;
  };

  const fillPatientDraft = (patient: Patient) => {
    const origin: PatientOrigin = patient.paymentType === "clinica" ? "clinica" : "particular";
    const schedules = normalizePatientSchedules(patient);
    setPatientDraft({
      id: patient.id,
      name: patient.name,
      origin,
      clinicId: patient.clinicId ?? "",
      attendanceTypeId: patient.attendanceTypeId ?? "",
      value: typeValueText(patient.sessionValue),
      schedules: schedules.length
        ? schedules.map((schedule) => ({
            ...schedule,
            durationMinutes: String(schedule.durationMinutes),
          }))
        : [emptyScheduleDraft()],
      billingModel: normalizeBillingModel(patient.paymentFrequency),
      notes: patient.notes ?? "",
    });
  };

  const editPatient = (patient: Patient) => {
    fillPatientDraft(patient);
    setReactivateTarget(null);
    setMessage("");
  };

  const submitPatient = ({ reactivate = false } = {}) => {
    const name = patientDraft.name.trim();
    const value = parseMoney(patientDraft.value);

    if (!name) {
      setMessage("Informe o nome do paciente.");
      return;
    }
    if (!patientDraft.origin) {
      setMessage("Informe a origem do paciente.");
      return;
    }
    const schedules = patientDraft.schedules.map((schedule) => ({
      id: schedule.id,
      weekday: schedule.weekday,
      time: schedule.time,
      durationMinutes: Number(schedule.durationMinutes),
    }));
    if (
      !schedules.length ||
      schedules.some(
        (schedule) =>
          !schedule.weekday ||
          !schedule.time ||
          !Number.isFinite(schedule.durationMinutes) ||
          schedule.durationMinutes <= 0,
      )
    ) {
      setMessage("Informe pelo menos um dia, horário e duração válidos.");
      return;
    }
    if (patientDraft.origin === "clinica" && (!patientDraft.clinicId || !patientDraft.attendanceTypeId)) {
      setMessage("Selecione a clínica e o tipo de atendimento.");
      return;
    }
    if (patientDraft.origin === "particular" && value <= 0) {
      setMessage("Paciente particular precisa de modelo de cobrança e valor.");
      return;
    }
    if (value <= 0) {
      setMessage("Informe um valor válido.");
      return;
    }

    const existing = patients.find((patient) => patient.id === patientDraft.id);
    const selectedClinic = clinics.find((clinic) => clinic.id === patientDraft.clinicId);
    const selectedType = selectedClinic
      ? normalizeClinicTypes(selectedClinic).find((type) => type.id === patientDraft.attendanceTypeId)
      : undefined;
    const conflict = findScheduleConflict(schedules, existing?.id);

    if (conflict) {
      const detail = `Esse horário está ocupado por ${conflict.patientName} das ${conflict.startsAt} às ${conflict.endsAt}. Escolha outro horário.`;
      setMessage("Já existe um paciente cadastrado neste dia e horário. " + detail);
      window.alert(`Já existe um paciente cadastrado neste dia e horário.\n\n${detail}`);
      return;
    }

    const patient: Patient = {
      id: existing?.id ?? uid(),
      name,
      phone: existing?.phone,
      email: existing?.email,
      status: reactivate ? "ativo" : (existing?.status ?? "ativo"),
      schedules,
      weekDay: schedules[0]?.weekday,
      time: schedules[0]?.time,
      clinicId: patientDraft.origin === "clinica" ? patientDraft.clinicId : null,
      attendanceTypeId: patientDraft.origin === "clinica" ? patientDraft.attendanceTypeId : null,
      attendanceTypeName: patientDraft.origin === "clinica" ? selectedType?.name : undefined,
      paymentType: patientDraft.origin,
      paymentFrequency: patientDraft.origin === "particular" ? patientDraft.billingModel : "sessao",
      sessionValue: value,
      notes: patientDraft.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      closedAt: reactivate ? undefined : existing?.closedAt,
    };

    const next = existing
      ? patients.map((item) => (item.id === patient.id ? patient : item))
      : [...patients, patient];

    persistPatients(
      next,
      reactivate
        ? "Paciente reativado."
        : existing
          ? "Paciente atualizado."
          : "Paciente cadastrado.",
      reactivate
        ? "Paciente reativado com sucesso."
        : existing
          ? "Alteração salva com sucesso."
          : "Cadastro salvo com sucesso.",
    );
    resetPatientForm();
    if (reactivate) setActiveTab("pacientes");
  };

  const closePatient = (patientId: string) => {
    const next = patients.map((patient) =>
      patient.id === patientId
        ? { ...patient, status: "encerrado" as const, closedAt: new Date().toISOString() }
        : patient,
    );
    persistPatients(next, "Paciente encerrado. Histórico preservado.");
  };

  const performDeletePatient = (patientId: string) => {
    saveAppointments(getAppointments().filter((appointment) => appointment.patientId !== patientId));
    persistPatients(
      patients.filter((patient) => patient.id !== patientId),
      "Paciente excluído.",
    );
  };

  const requestDeletePatient = (patientId: string) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    if (!patientHasHistory(patientId)) {
      setDeleteDraft({ patient, mode: "simple", pin: "", error: "" });
      return;
    }

    if (!loadInternalPin()) {
      setDeleteDraft({ patient, mode: "blocked", pin: "", error: "" });
      return;
    }

    setDeleteDraft({ patient, mode: "protected", pin: "", error: "" });
  };

  const confirmDeletePatient = () => {
    if (!deleteDraft) return;
    if (deleteDraft.mode === "blocked") return;

    if (deleteDraft.mode === "protected" && deleteDraft.pin !== loadInternalPin()) {
      setDeleteDraft({
        ...deleteDraft,
        error: "PIN incorreto. Tente novamente.",
      });
      return;
    }

    performDeletePatient(deleteDraft.patient.id);
    setDeleteDraft(null);
  };

  const startReactivate = (patient: Patient) => {
    setReactivateTarget(patient);
    fillPatientDraft(patient);
    setMessage("");
  };

  const confirmReactivate = () => {
    if (!reactivateTarget) return;
    submitPatient({ reactivate: true });
  };

  const selectedPatientClinic = clinics.find((clinic) => clinic.id === patientDraft.clinicId);
  const selectedPatientTypes = selectedPatientClinic
    ? normalizeClinicTypes(selectedPatientClinic)
    : [];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {successToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-primary/40 bg-background/95 px-4 py-3 text-sm font-medium text-foreground shadow-[0_0_24px_rgba(34,211,238,0.22)] backdrop-blur sm:right-6 sm:top-6"
          >
            {successToast}
          </div>
        )}

        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Cadastro</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Gerencie clínicas, pacientes ativos e pacientes encerrados.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{activePatients.length}</span> pacientes ativos
          </div>
        </header>

        {message && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {message}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
            <TabsTrigger value="clinicas">Clínicas</TabsTrigger>
            <TabsTrigger value="pacientes">Pacientes</TabsTrigger>
            <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
          </TabsList>

          <TabsContent value="clinicas" className="mt-5">
            <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">
                    {clinicDraft.id ? "Editar clínica" : "Nova clínica"}
                  </h2>
                  {clinicDraft.id && (
                    <Button variant="ghost" size="sm" onClick={resetClinicForm}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  )}
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Nome">
                    <Input
                      value={clinicDraft.name}
                      onChange={(event) =>
                        setClinicDraft((draft) => ({ ...draft, name: event.target.value }))
                      }
                      placeholder="Ex.: Clínica Evoluir"
                    />
                  </Field>

                  <Field label="Prazo de pagamento da clínica">
                    <Select
                      value={clinicDraft.paymentTermType}
                      onValueChange={(value) =>
                        setClinicDraft((draft) => ({
                          ...draft,
                          paymentTermType: value as ClinicPaymentTermType,
                          customPaymentDays: value === "custom" ? draft.customPaymentDays : "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o prazo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30_days">30 dias</SelectItem>
                        <SelectItem value="60_days">60 dias</SelectItem>
                        <SelectItem value="custom">Prazo personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {clinicDraft.paymentTermType === "custom" && (
                    <Field label="Quantidade de dias">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={clinicDraft.customPaymentDays}
                        onChange={(event) =>
                          setClinicDraft((draft) => ({
                            ...draft,
                            customPaymentDays: event.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="Ex.: 45"
                      />
                    </Field>
                  )}

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Tipos de atendimento
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setClinicDraft((draft) => ({
                            ...draft,
                            types: [...draft.types, { id: uid(), name: "", value: "" }],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" /> Tipo
                      </Button>
                    </div>

                    {clinicDraft.types.map((type) => (
                      <div key={type.id} className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-[1fr,130px,40px]">
                        <Input
                          value={type.name}
                          onChange={(event) => updateClinicType(type.id, { name: event.target.value })}
                          placeholder="Nome do tipo"
                        />
                        <Input
                          value={type.value}
                          onChange={(event) => updateClinicType(type.id, { value: event.target.value })}
                          placeholder="Valor"
                          inputMode="decimal"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={clinicDraft.types.length === 1}
                          onClick={() =>
                            setClinicDraft((draft) => ({
                              ...draft,
                              types: draft.types.filter((item) => item.id !== type.id),
                            }))
                          }
                          aria-label="Remover tipo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button onClick={submitClinic} className="w-full">
                    <Save className="h-4 w-4" /> Salvar clínica
                  </Button>
                </div>
              </div>

              <div>
                <div className="grid gap-3 md:hidden">
                  {clinics.map((clinic) => {
                    const count = activePatients.filter((patient) => patient.clinicId === clinic.id).length;
                    return (
                      <article key={clinic.id} className="glass-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 break-words font-semibold">{clinic.name}</h3>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" onClick={() => editClinic(clinic)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeClinic(clinic.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <MobileField label="Tipos" value={clinicTypeLabel(clinic)} />
                          <MobileField label="Prazo" value={clinicPaymentTermLabel(clinic)} />
                          <MobileField label="Pacientes" value={String(count)} />
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden rounded-xl border border-border bg-card/40 md:block">
                  <table className="w-full table-fixed text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Tipos</th>
                        <th className="w-32 px-4 py-3">Prazo</th>
                        <th className="w-28 px-4 py-3">Pacientes</th>
                        <th className="w-28 px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinics.map((clinic) => {
                        const count = activePatients.filter((patient) => patient.clinicId === clinic.id).length;
                        return (
                          <tr key={clinic.id} className="border-b border-border/70 last:border-0">
                            <td className="px-4 py-3 font-medium">{clinic.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{clinicTypeLabel(clinic)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{clinicPaymentTermLabel(clinic)}</td>
                            <td className="px-4 py-3">{count}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => editClinic(clinic)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeClinic(clinic.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="pacientes" className="mt-5">
            <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">
                    {patientDraft.id ? "Editar paciente" : "Novo paciente"}
                  </h2>
                  {patientDraft.id && (
                    <Button variant="ghost" size="sm" onClick={resetPatientForm}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  )}
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Nome">
                    <Input
                      value={patientDraft.name}
                      onChange={(event) =>
                        setPatientDraft((draft) => ({ ...draft, name: event.target.value }))
                      }
                      placeholder="Nome do paciente"
                    />
                  </Field>

                  <Field label="Origem">
                    <Select
                      value={patientDraft.origin}
                      onValueChange={(value) =>
                        setPatientDraft((draft) => ({
                          ...draft,
                          origin: value as PatientOrigin,
                          clinicId: value === "particular" ? "" : draft.clinicId,
                          attendanceTypeId: value === "particular" ? "" : draft.attendanceTypeId,
                          billingModel: "sessao",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinica">Clínica</SelectItem>
                        <SelectItem value="particular">Particular</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {patientDraft.origin === "clinica" && (
                    <div className="grid gap-4 rounded-lg border border-border bg-card/40 p-3">
                      <Field label="Clínica">
                        <Select value={patientDraft.clinicId} onValueChange={onClinicSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {clinics.map((clinic) => (
                              <SelectItem key={clinic.id} value={clinic.id}>
                                {clinic.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Tipo de atendimento">
                        <Select
                          value={patientDraft.attendanceTypeId}
                          onValueChange={onClinicTypeSelect}
                          disabled={!patientDraft.clinicId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedPatientTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name} · {money(type.value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  )}

                  {patientDraft.origin === "particular" && (
                    <Field label="Modelo de cobrança">
                      <Select
                        value={patientDraft.billingModel}
                        onValueChange={(value) =>
                          setPatientDraft((draft) => ({
                            ...draft,
                            billingModel: normalizeBillingModel(value),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  <div className="grid gap-4">
                    <Field label="Valor">
                      <Input
                        value={patientDraft.value}
                        onChange={(event) =>
                          setPatientDraft((draft) => ({ ...draft, value: event.target.value }))
                        }
                        placeholder="Valor"
                        inputMode="decimal"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Dias e horários de atendimento
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addPatientSchedule}
                      >
                        <Plus className="h-4 w-4" /> Adicionar dia
                      </Button>
                    </div>

                    {patientDraft.schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-[1fr,130px,150px,40px]"
                      >
                        <Field label="Dia da semana">
                          <Select
                            value={schedule.weekday}
                            onValueChange={(value) =>
                              updatePatientSchedule(schedule.id, { weekday: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Dia" />
                            </SelectTrigger>
                            <SelectContent>
                              {weekDays.map((day) => (
                                <SelectItem key={day.value} value={day.value}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Horário">
                          <Input
                            type="time"
                            value={schedule.time}
                            onChange={(event) =>
                              updatePatientSchedule(schedule.id, { time: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Duração do atendimento">
                          <Select
                            value={schedule.durationMinutes}
                            onValueChange={(value) =>
                              updatePatientSchedule(schedule.id, {
                                durationMinutes: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Duração" />
                            </SelectTrigger>
                            <SelectContent>
                              {durationOptions.map((duration) => (
                                <SelectItem key={duration} value={String(duration)}>
                                  {duration} minutos
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={patientDraft.schedules.length === 1}
                          onClick={() => removePatientSchedule(schedule.id)}
                          aria-label="Remover dia"
                          className="self-end"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Field label="Observações">
                    <textarea
                      value={patientDraft.notes}
                      onChange={(event) =>
                        setPatientDraft((draft) => ({ ...draft, notes: event.target.value }))
                      }
                      className="min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Observações clínicas ou administrativas"
                    />
                  </Field>

                  <Button onClick={() => submitPatient()} className="w-full">
                    <Save className="h-4 w-4" /> Salvar paciente
                  </Button>
                </div>
              </div>

              <PatientList
                patients={activePatients}
                clinics={clinics}
                emptyLabel="Nenhum paciente ativo."
                onEdit={editPatient}
                onClose={closePatient}
                onDelete={requestDeletePatient}
              />
            </section>
          </TabsContent>

          <TabsContent value="encerrados" className="mt-5">
            <section className="grid gap-5">
              {reactivateTarget && (
                <div className="glass-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Reativar {reactivateTarget.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Revise o cadastro completo antes de voltar o paciente para ativos.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetPatientForm}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <Field label="Nome">
                      <Input
                        value={patientDraft.name}
                        onChange={(event) =>
                          setPatientDraft((draft) => ({ ...draft, name: event.target.value }))
                        }
                        placeholder="Nome do paciente"
                      />
                    </Field>

                    <Field label="Origem">
                      <Select
                        value={patientDraft.origin}
                        onValueChange={(value) =>
                          setPatientDraft((draft) => ({
                            ...draft,
                            origin: value as PatientOrigin,
                            clinicId: value === "particular" ? "" : draft.clinicId,
                            attendanceTypeId: value === "particular" ? "" : draft.attendanceTypeId,
                            billingModel: "sessao",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinica">Clínica</SelectItem>
                          <SelectItem value="particular">Particular</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    {patientDraft.origin === "clinica" && (
                      <div className="grid gap-4 rounded-lg border border-border bg-card/40 p-3">
                        <Field label="Clínica">
                          <Select value={patientDraft.clinicId} onValueChange={onClinicSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {clinics.map((clinic) => (
                                <SelectItem key={clinic.id} value={clinic.id}>
                                  {clinic.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Tipo de atendimento">
                          <Select
                            value={patientDraft.attendanceTypeId}
                            onValueChange={onClinicTypeSelect}
                            disabled={!patientDraft.clinicId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedPatientTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name} · {money(type.value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}

                    {patientDraft.origin === "particular" && (
                      <Field label="Modelo de cobrança">
                        <Select
                          value={patientDraft.billingModel}
                          onValueChange={(value) =>
                            setPatientDraft((draft) => ({
                              ...draft,
                              billingModel: normalizeBillingModel(value),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {billingOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}

                    <Field label="Valor">
                      <Input
                        value={patientDraft.value}
                        onChange={(event) =>
                          setPatientDraft((draft) => ({ ...draft, value: event.target.value }))
                        }
                        placeholder="Valor"
                        inputMode="decimal"
                      />
                    </Field>

                    <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Dias e horários de atendimento
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addPatientSchedule}
                        >
                          <Plus className="h-4 w-4" /> Adicionar dia
                        </Button>
                      </div>

                      {patientDraft.schedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 sm:grid-cols-[1fr,130px,150px,40px]"
                        >
                          <Field label="Dia da semana">
                            <Select
                              value={schedule.weekday}
                              onValueChange={(value) =>
                                updatePatientSchedule(schedule.id, { weekday: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Dia" />
                              </SelectTrigger>
                              <SelectContent>
                                {weekDays.map((day) => (
                                  <SelectItem key={day.value} value={day.value}>
                                    {day.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Horário">
                            <Input
                              type="time"
                              value={schedule.time}
                              onChange={(event) =>
                                updatePatientSchedule(schedule.id, { time: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Duração do atendimento">
                            <Select
                              value={schedule.durationMinutes}
                              onValueChange={(value) =>
                                updatePatientSchedule(schedule.id, {
                                  durationMinutes: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Duração" />
                              </SelectTrigger>
                              <SelectContent>
                                {durationOptions.map((duration) => (
                                  <SelectItem key={duration} value={String(duration)}>
                                    {duration} minutos
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={patientDraft.schedules.length === 1}
                            onClick={() => removePatientSchedule(schedule.id)}
                            aria-label="Remover dia"
                            className="self-end"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Field label="Observações">
                      <textarea
                        value={patientDraft.notes}
                        onChange={(event) =>
                          setPatientDraft((draft) => ({ ...draft, notes: event.target.value }))
                        }
                        className="min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Observações clínicas ou administrativas"
                      />
                    </Field>

                    <Button onClick={confirmReactivate}>
                      <RotateCcw className="h-4 w-4" /> Reativar
                    </Button>
                  </div>
                </div>
              )}

              <PatientList
                patients={closedPatients}
                clinics={clinics}
                emptyLabel="Nenhum paciente encerrado."
                closed
                onEdit={editPatient}
                onReactivate={startReactivate}
                onDelete={requestDeletePatient}
              />
            </section>
          </TabsContent>
        </Tabs>

        {deleteDraft && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              {deleteDraft.mode === "simple" && (
                <>
                  <h2 className="text-xl font-black">Excluir paciente</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Deseja excluir este paciente? Essa ação removerá o cadastro local.
                  </p>
                  <div className="mt-4 rounded-lg border border-border bg-card/40 p-3 text-sm">
                    <span className="text-muted-foreground">Paciente: </span>
                    <span className="font-semibold">{deleteDraft.patient.name}</span>
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setDeleteDraft(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirmDeletePatient}>
                      Excluir
                    </Button>
                  </div>
                </>
              )}

              {deleteDraft.mode === "blocked" && (
                <>
                  <h2 className="text-xl font-black">Exclusão protegida por PIN</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Cadastre um PIN de segurança no Perfil antes de excluir pacientes com histórico.
                  </p>
                  <div className="mt-4 rounded-lg border border-border bg-card/40 p-3 text-sm">
                    <span className="text-muted-foreground">Paciente: </span>
                    <span className="font-semibold">{deleteDraft.patient.name}</span>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <Button variant="outline" onClick={() => setDeleteDraft(null)}>
                      Entendi
                    </Button>
                  </div>
                </>
              )}

              {deleteDraft.mode === "protected" && (
                <>
                  <h2 className="text-xl font-black">Exclusão protegida por PIN</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Este paciente possui histórico de atendimento. Para evitar exclusões acidentais,
                    informe o PIN de segurança interno.
                  </p>
                  <div className="mt-4 grid gap-4">
                    <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                      <span className="text-muted-foreground">Paciente: </span>
                      <span className="font-semibold">{deleteDraft.patient.name}</span>
                    </div>
                    <Field label="PIN de segurança">
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={deleteDraft.pin}
                        onChange={(event) =>
                          setDeleteDraft({
                            ...deleteDraft,
                            pin: event.target.value.replace(/\D/g, "").slice(0, 4),
                            error: "",
                          })
                        }
                        placeholder="0000"
                      />
                    </Field>
                    {deleteDraft.error && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {deleteDraft.error}
                      </div>
                    )}
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setDeleteDraft(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={confirmDeletePatient}>
                      Confirmar exclusão
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PatientList({
  patients,
  clinics,
  emptyLabel,
  closed = false,
  onEdit,
  onClose,
  onReactivate,
  onDelete,
}: {
  patients: Patient[];
  clinics: Clinic[];
  emptyLabel: string;
  closed?: boolean;
  onEdit: (patient: Patient) => void;
  onClose?: (patientId: string) => void;
  onReactivate?: (patient: Patient) => void;
  onDelete: (patientId: string) => void;
}) {
  const clinicName = (patient: Patient) => {
    if (patient.paymentType !== "clinica") return "Particular";
    return clinics.find((clinic) => clinic.id === patient.clinicId)?.name ?? "Clínica removida";
  };

  const patientType = (patient: Patient) => {
    if (patient.paymentType === "clinica") return patient.attendanceTypeName ?? "Clínica";
    return billingLabel(patient.paymentFrequency);
  };

  if (!patients.length) {
    return (
      <div className="glass-card flex min-h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {patients.map((patient) => (
          <article key={patient.id} className="glass-card p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 break-words font-semibold">{patient.name}</h3>
              <div className="flex shrink-0 gap-1">
                {!closed && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(patient)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {closed ? (
                  <Button variant="ghost" size="icon" onClick={() => onReactivate?.(patient)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => onClose?.(patient.id)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onDelete(patient.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <MobileField label="Dias/horários" value={scheduleText(patient)} />
              <MobileField label="Tipo" value={patientType(patient)} />
              <MobileField label="Origem" value={clinicName(patient)} />
              <MobileField label="Valor" value={money(patient.sessionValue)} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden rounded-xl border border-border bg-card/40 md:block">
        <table className="w-full table-fixed text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Dias e horários</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Clínica/Particular</th>
              <th className="w-28 px-4 py-3">Valor</th>
              <th className="w-36 px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3 font-medium">{patient.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{scheduleText(patient)}</td>
                <td className="px-4 py-3 text-muted-foreground">{patientType(patient)}</td>
                <td className="px-4 py-3 text-muted-foreground">{clinicName(patient)}</td>
                <td className="px-4 py-3 tabular-nums">{money(patient.sessionValue)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {!closed && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(patient)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {closed ? (
                      <Button variant="ghost" size="icon" onClick={() => onReactivate?.(patient)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => onClose?.(patient.id)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onDelete(patient.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
