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
import { useEffect, useMemo, useState } from "react";

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
  saveAppointments,
  saveClinics,
  savePatients,
} from "@/lib/store";
import type {
  Clinic,
  ClinicAttendanceType,
  Patient,
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
};

type PatientDraft = {
  id?: string;
  name: string;
  origin: PatientOrigin | "";
  clinicId: string;
  attendanceTypeId: string;
  value: string;
  weekDay: string;
  time: string;
  billingModel: PaymentFrequency | "";
  notes: string;
};

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
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

function uid() {
  return crypto.randomUUID();
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

function emptyClinicDraft(): ClinicDraft {
  return {
    name: "",
    types: [{ id: uid(), name: "", value: "" }],
  };
}

function emptyPatientDraft(): PatientDraft {
  return {
    name: "",
    origin: "",
    clinicId: "",
    attendanceTypeId: "",
    value: "",
    weekDay: "",
    time: "",
    billingModel: "sessao",
    notes: "",
  };
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

function billingLabel(value?: PaymentFrequency) {
  return billingOptions.find((item) => item.value === value)?.label ?? "—";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  const [reactivateTarget, setReactivateTarget] = useState<Patient | null>(null);
  const [reactivateWeekDay, setReactivateWeekDay] = useState("");
  const [reactivateTime, setReactivateTime] = useState("");

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

  const persistClinics = (next: Clinic[], note: string) => {
    setClinics(next);
    saveClinics(next);
    setMessage(note);
  };

  const persistPatients = (next: Patient[], note: string) => {
    setPatients(next);
    savePatients(next);
    setMessage(note);
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

    const existing = clinics.find((clinic) => clinic.id === clinicDraft.id);
    const clinic: Clinic = {
      id: existing?.id ?? uid(),
      name,
      attendanceTypes: cleaned,
      repassePercent: existing?.repassePercent ?? 0,
      defaultSessionValue: cleaned[0].value,
      paymentTypes: existing?.paymentTypes?.length ? existing.paymentTypes : ["clinica"],
      notes: existing?.notes,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const next = existing
      ? clinics.map((item) => (item.id === clinic.id ? clinic : item))
      : [...clinics, clinic];

    persistClinics(next, existing ? "Clínica atualizada." : "Clínica cadastrada.");
    resetClinicForm();
  };

  const removeClinic = (clinicId: string) => {
    const next = clinics.filter((clinic) => clinic.id !== clinicId);
    persistClinics(next, "Clínica excluída.");
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

  const resetPatientForm = () => setPatientDraft(emptyPatientDraft());

  const editPatient = (patient: Patient) => {
    const origin: PatientOrigin = patient.paymentType === "clinica" ? "clinica" : "particular";
    setPatientDraft({
      id: patient.id,
      name: patient.name,
      origin,
      clinicId: patient.clinicId ?? "",
      attendanceTypeId: patient.attendanceTypeId ?? "",
      value: typeValueText(patient.sessionValue),
      weekDay: patient.weekDay ?? "",
      time: patient.time ?? "",
      billingModel: patient.paymentFrequency,
      notes: patient.notes ?? "",
    });
    setMessage("");
  };

  const submitPatient = () => {
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
    if (!patientDraft.weekDay || !patientDraft.time) {
      setMessage("Informe dia da semana e horário.");
      return;
    }
    if (patientDraft.origin === "clinica") {
      if (!patientDraft.clinicId || !patientDraft.attendanceTypeId) {
        setMessage("Selecione a clínica e o tipo de atendimento.");
        return;
      }
    }
    if (patientDraft.origin === "particular" && (!patientDraft.billingModel || value <= 0)) {
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

    const patient: Patient = {
      id: existing?.id ?? uid(),
      name,
      phone: existing?.phone,
      email: existing?.email,
      status: existing?.status ?? "ativo",
      weekDay: patientDraft.weekDay,
      time: patientDraft.time,
      clinicId: patientDraft.origin === "clinica" ? patientDraft.clinicId : null,
      attendanceTypeId: patientDraft.origin === "clinica" ? patientDraft.attendanceTypeId : null,
      attendanceTypeName: patientDraft.origin === "clinica" ? selectedType?.name : undefined,
      paymentType: patientDraft.origin,
      paymentFrequency:
        patientDraft.origin === "particular" ? (patientDraft.billingModel as PaymentFrequency) : "sessao",
      sessionValue: value,
      notes: patientDraft.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      closedAt: existing?.closedAt,
    };

    const next = existing
      ? patients.map((item) => (item.id === patient.id ? patient : item))
      : [...patients, patient];

    persistPatients(next, existing ? "Paciente atualizado." : "Paciente cadastrado.");
    resetPatientForm();
  };

  const closePatient = (patientId: string) => {
    const next = patients.map((patient) =>
      patient.id === patientId
        ? { ...patient, status: "encerrado" as const, closedAt: new Date().toISOString() }
        : patient,
    );
    persistPatients(next, "Paciente encerrado. Histórico preservado.");
  };

  const deletePatient = (patientId: string) => {
    const nextPatients = patients.filter((patient) => patient.id !== patientId);
    const nextAppointments = getAppointments().filter(
      (appointment) => appointment.patientId !== patientId,
    );
    saveAppointments(nextAppointments);
    persistPatients(nextPatients, "Paciente excluído.");
  };

  const startReactivate = (patient: Patient) => {
    setReactivateTarget(patient);
    setReactivateWeekDay(patient.weekDay ?? "");
    setReactivateTime(patient.time ?? "");
    setMessage("");
  };

  const confirmReactivate = () => {
    if (!reactivateTarget) return;
    if (!reactivateWeekDay || !reactivateTime) {
      setMessage("Informe novo dia e horário para reativar.");
      return;
    }
    const next = patients.map((patient) =>
      patient.id === reactivateTarget.id
        ? {
            ...patient,
            status: "ativo" as const,
            weekDay: reactivateWeekDay,
            time: reactivateTime,
            closedAt: undefined,
          }
        : patient,
    );
    persistPatients(next, "Paciente reativado.");
    setReactivateTarget(null);
    setReactivateWeekDay("");
    setReactivateTime("");
  };

  const selectedPatientClinic = clinics.find((clinic) => clinic.id === patientDraft.clinicId);
  const selectedPatientTypes = selectedPatientClinic
    ? normalizeClinicTypes(selectedPatientClinic)
    : [];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
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

        <Tabs defaultValue="clinicas" className="w-full">
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
                          value: value === "clinica" ? draft.value : draft.value,
                          billingModel: value === "particular" ? draft.billingModel || "sessao" : "sessao",
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
                            billingModel: value as PaymentFrequency,
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

                  <div className="grid gap-4 sm:grid-cols-3">
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
                    <Field label="Dia">
                      <Select
                        value={patientDraft.weekDay}
                        onValueChange={(value) =>
                          setPatientDraft((draft) => ({ ...draft, weekDay: value }))
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
                        value={patientDraft.time}
                        onChange={(event) =>
                          setPatientDraft((draft) => ({ ...draft, time: event.target.value }))
                        }
                      />
                    </Field>
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

                  <Button onClick={submitPatient} className="w-full">
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
                onDelete={deletePatient}
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
                        Informe o novo dia e horário antes de voltar o paciente para ativos.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setReactivateTarget(null)}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[1fr,160px,auto] sm:items-end">
                    <Field label="Novo dia">
                      <Select value={reactivateWeekDay} onValueChange={setReactivateWeekDay}>
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
                    <Field label="Novo horário">
                      <Input
                        type="time"
                        value={reactivateTime}
                        onChange={(event) => setReactivateTime(event.target.value)}
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
                onDelete={deletePatient}
              />
            </section>
          </TabsContent>
        </Tabs>
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
              <MobileField label="Dia" value={dayLabel(patient.weekDay)} />
              <MobileField label="Horário" value={patient.time ?? "—"} />
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
              <th className="w-28 px-4 py-3">Dia</th>
              <th className="w-24 px-4 py-3">Horário</th>
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
                <td className="px-4 py-3">{dayLabel(patient.weekDay)}</td>
                <td className="px-4 py-3">{patient.time ?? "—"}</td>
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
