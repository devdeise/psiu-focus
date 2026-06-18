import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addCashEntry,
  clinicPaymentDueDate,
  clinicPaymentDueMonth,
  getAppointments,
  getCashEntries,
  getClinicPaymentRecords,
  getClinics,
  getMonthlyPayments,
  getMonthlyPaymentSummary,
  getPatients,
  monthKey,
  recordMonthlyPayment,
  saveAppointments,
  saveCashEntries,
  saveClinicPaymentRecords,
  saveMonthlyPayments,
  toDateKey,
  upsertClinicPaymentRecord,
} from "@/lib/store";
import type { Appointment, CashEntry, Clinic, MonthlyPayment, Patient } from "@/lib/store/types";

export const Route = createFileRoute("/confirmar-pagamento")({
  head: () => ({ meta: [{ title: "Confirmar Pagamento — PSIU!" }] }),
  component: ConfirmarPagamentoPage,
});

type ClinicPaymentStatus = "Aguardando" | "Atrasado" | "Confirmado";
type ParticularPaymentStatus = "Pendente" | "Parcial" | "Pago";

type ClinicItem = {
  id: string;
  clinic: Clinic;
  month: string;
  amount: number;
  appointmentIds: string[];
  quantity: number;
  status: ClinicPaymentStatus;
};

type SessionItem = {
  kind: "session";
  id: string;
  patient: Patient;
  appointment: Appointment;
  amount: number;
  status: ParticularPaymentStatus;
};

type MonthlyItem = {
  kind: "monthly";
  id: string;
  patient: Patient;
  month: string;
  amountDue: number;
  amountReceived: number;
  balance: number;
  status: ParticularPaymentStatus;
};

type ParticularItem = SessionItem | MonthlyItem;

type ClinicModal = {
  kind: "clinic";
  item: ClinicItem;
  delayed: "" | "sim" | "nao";
  receivedMonth: string;
  hasDiscount: "sim" | "nao";
  discountAmount: string;
  notes: string;
};

type SessionModal = {
  kind: "session";
  item: SessionItem;
  choice: "integral" | "nao-recebido";
  delayed: "" | "sim" | "nao";
  receivedMonth: string;
  notes: string;
};

type MonthlyModal = {
  kind: "monthly";
  item: MonthlyItem;
  choice: "integral" | "parcial" | "nao-recebido";
  amountReceived: string;
  delayed: "" | "sim" | "nao";
  receivedMonth: string;
  notes: string;
};

type PaymentModal =
  | ClinicModal
  | SessionModal
  | MonthlyModal;

type ClinicHistoryItem = {
  kind: "clinic";
  id: string;
  recordId: string;
  clinicId: string;
  clinicName: string;
  competence: string;
  expectedAmount: number;
  discountAmount: number;
  receivedAmount: number;
  quantity: number;
  delayed: boolean;
  receivedMonth: string;
  status: "Confirmado";
  notes?: string;
};

type ParticularHistoryItem = {
  kind: "particular";
  id: string;
  source: "session" | "monthly";
  cashEntryId?: string;
  appointmentId?: string;
  monthlyPaymentId?: string;
  patientId?: string;
  patientName: string;
  model: "Por sessão" | "Mensal";
  competence: string;
  receivedAmount: number;
  totalAmount?: number;
  remainingBalance?: number;
  delayed?: boolean;
  receivedMonth: string;
  status: "Pago" | "Parcial" | "Confirmado";
  notes?: string;
};

type HistoryItem = ClinicHistoryItem | ParticularHistoryItem;
type EditPaymentStatus = "Pago" | "Parcial" | "Pendente";
type EditDraft = {
  item: HistoryItem;
  status: EditPaymentStatus;
  amountReceived: string;
  totalAmount: string;
  remainingBalance: string;
  hasDiscount: "sim" | "nao";
  discountAmount: string;
  delayed: "sim" | "nao";
  receivedMonth: string;
  notes: string;
};

const PIN_STORAGE_KEY = "psiu:internal-pin";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function receiptMonthOptions(competence: string) {
  const [year, monthIndex] = competence.split("-").map(Number);
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(year, monthIndex - 1 + index, 1);
    return toDateKey(date).slice(0, 7);
  });
}

function appointmentDate(appointment: Appointment) {
  return toDateKey(new Date(appointment.startsAt));
}

function statusVariant(
  status: ClinicPaymentStatus | ParticularPaymentStatus,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "Confirmado" || status === "Pago") return "default";
  if (status === "Atrasado") return "destructive";
  if (status === "Parcial") return "outline";
  return "secondary";
}

function displayDelay(delayed?: boolean) {
  return delayed ? "Sim" : "Não";
}

function receivedMonthOf(item: { month?: string; receivedMonth?: string }) {
  return item.receivedMonth || item.month || monthKey(toDateKey(new Date()));
}

function loadInternalPin() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function sameAmount(a: number | undefined, b: number | undefined) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.01;
}

function clinicPaymentAmounts(expectedAmount: number, discountValue: string | number) {
  const expected = Math.max(Number(expectedAmount) || 0, 0);
  const discount = Math.max(Number(discountValue) || 0, 0);
  return {
    expected,
    discount,
    received: Math.max(expected - discount, 0),
  };
}

function findRelatedCashEntry(
  cashEntries: CashEntry[],
  usedCashIds: Set<string>,
  predicate: (entry: CashEntry) => boolean,
) {
  const entry = cashEntries.find((item) => !usedCashIds.has(item.id) && predicate(item));
  if (entry) usedCashIds.add(entry.id);
  return entry;
}

function getHistoryMonths(
  clinicRecords: ReturnType<typeof getClinicPaymentRecords>,
  monthlyPayments: MonthlyPayment[],
  cashEntries: CashEntry[],
) {
  const months = new Set<string>();

  for (const record of clinicRecords) {
    if (record.status === "confirmado") months.add(receivedMonthOf(record));
  }

  for (const payment of monthlyPayments) {
    if ((Number(payment.amountReceived) || 0) > 0) months.add(receivedMonthOf(payment));
  }

  for (const entry of cashEntries) {
    if (entry.source === "particular-sessao" && (Number(entry.amount) || 0) > 0) {
      months.add(receivedMonthOf(entry));
    }
  }

  if (months.size === 0) months.add(monthKey(toDateKey(new Date())));
  return [...months].sort((a, b) => b.localeCompare(a));
}

function monthlyBalanceAfterPayment(payment: MonthlyPayment, monthlyPayments: MonthlyPayment[]) {
  const paidAt = payment.paidAt || "";
  const receivedUntilPayment = monthlyPayments
    .filter(
      (item) =>
        item.patientId === payment.patientId &&
        item.month === payment.month &&
        (item.paidAt || "") <= paidAt,
    )
    .reduce((sum, item) => sum + (Number(item.amountReceived) || 0), 0);

  return Math.max((Number(payment.amountDue) || 0) - receivedUntilPayment, 0);
}

function getHistoryItems({
  selectedMonth,
  clinicRecords,
  monthlyPayments,
  cashEntries,
  appointments,
  patientById,
  clinicById,
}: {
  selectedMonth: string;
  clinicRecords: ReturnType<typeof getClinicPaymentRecords>;
  monthlyPayments: MonthlyPayment[];
  cashEntries: CashEntry[];
  appointments: Appointment[];
  patientById: Map<string, Patient>;
  clinicById: Map<string, Clinic>;
}) {
  const items: HistoryItem[] = [];
  const appointmentById = new Map(appointments.map((appointment) => [appointment.id, appointment]));
  const usedCashIds = new Set<string>();

  for (const record of clinicRecords) {
    if (record.status !== "confirmado") continue;
    const receivedMonth = receivedMonthOf(record);
    if (receivedMonth !== selectedMonth) continue;
    const clinic = clinicById.get(record.clinicId);
    const expectedAmount = Number(record.expectedAmount ?? record.amount) || 0;
    const discountAmount = Number(record.discountAmount) || 0;

    items.push({
      kind: "clinic",
      id: `clinic:${record.id}`,
      recordId: record.id,
      clinicId: record.clinicId,
      clinicName: clinic?.name ?? "Clínica removida",
      competence: record.month,
      expectedAmount,
      discountAmount,
      receivedAmount: Number(record.amount) || Math.max(expectedAmount - discountAmount, 0),
      quantity: record.appointmentIds.length,
      delayed: record.delayed ?? receivedMonth !== record.month,
      receivedMonth,
      status: "Confirmado",
      notes: record.notes,
    });
  }

  for (const entry of cashEntries) {
    if (entry.source !== "particular-sessao") continue;
    if (receivedMonthOf(entry) !== selectedMonth) continue;
    const patient = entry.patientId ? patientById.get(entry.patientId) : undefined;
    const appointment = entry.appointmentId ? appointmentById.get(entry.appointmentId) : undefined;
    const competence = entry.month ?? (appointment ? monthKey(appointmentDate(appointment)) : selectedMonth);

    items.push({
      kind: "particular",
      id: `session:${entry.id}`,
      source: "session",
      cashEntryId: entry.id,
      appointmentId: entry.appointmentId,
      patientId: entry.patientId,
      patientName: patient?.name ?? "Paciente removido",
      model: "Por sessão",
      competence,
      receivedAmount: Number(entry.amount) || 0,
      delayed: entry.delayed ?? receivedMonthOf(entry) !== competence,
      receivedMonth: receivedMonthOf(entry),
      status: "Pago",
      notes: entry.notes,
    });
  }

  for (const payment of monthlyPayments) {
    const receivedAmount = Number(payment.amountReceived) || 0;
    if (receivedAmount <= 0) continue;
    const receivedMonth = receivedMonthOf(payment);
    if (receivedMonth !== selectedMonth) continue;
    const patient = patientById.get(payment.patientId);
    const remainingBalance = monthlyBalanceAfterPayment(payment, monthlyPayments);
    const relatedCashEntry = findRelatedCashEntry(
      cashEntries,
      usedCashIds,
      (entry) =>
        entry.source === "particular-mensal" &&
        entry.patientId === payment.patientId &&
        entry.month === payment.month &&
        receivedMonthOf(entry) === receivedMonth &&
        sameAmount(entry.amount, receivedAmount),
    );

    items.push({
      kind: "particular",
      id: `monthly:${payment.id}`,
      source: "monthly",
      cashEntryId: relatedCashEntry?.id,
      monthlyPaymentId: payment.id,
      patientId: payment.patientId,
      patientName: patient?.name ?? "Paciente removido",
      model: "Mensal",
      competence: payment.month,
      receivedAmount,
      totalAmount: Number(payment.amountDue) || 0,
      remainingBalance,
      delayed: payment.delayed ?? receivedMonth !== payment.month,
      receivedMonth,
      status: remainingBalance > 0 ? "Parcial" : "Pago",
      notes: payment.notes,
    });
  }

  return items.sort((a, b) => {
    const monthSort = b.receivedMonth.localeCompare(a.receivedMonth);
    if (monthSort !== 0) return monthSort;
    return a.kind.localeCompare(b.kind);
  });
}

function ConfirmarPagamentoPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment[]>([]);
  const [clinicRecords, setClinicRecords] = useState(getClinicPaymentRecords());
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [historyMonth, setHistoryMonth] = useState(monthKey(toDateKey(new Date())));
  const [modal, setModal] = useState<PaymentModal | null>(null);
  const [pinItem, setPinItem] = useState<HistoryItem | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [message, setMessage] = useState("");

  const reload = () => {
    setPatients(getPatients());
    setClinics(getClinics());
    setAppointments(getAppointments());
    setMonthlyPayments(getMonthlyPayments());
    setClinicRecords(getClinicPaymentRecords());
    setCashEntries(getCashEntries());
  };

  useEffect(() => {
    reload();
  }, []);

  const patientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );
  const clinicById = useMemo(
    () => new Map(clinics.map((clinic) => [clinic.id, clinic])),
    [clinics],
  );

  const realized = useMemo(
    () => appointments.filter((appointment) => appointment.status === "realizado"),
    [appointments],
  );

  const clinicItems = useMemo<ClinicItem[]>(() => {
    const groups = new Map<string, ClinicItem>();
    const now = new Date();

    for (const appointment of realized) {
      const patient = patientById.get(appointment.patientId);
      if (!patient || patient.paymentType !== "clinica") continue;
      const clinic = clinicById.get(patient.clinicId ?? appointment.clinicId ?? "");
      if (!clinic) continue;

      const dueDate = clinicPaymentDueDate(appointmentDate(appointment), clinic);
      const month = clinicPaymentDueMonth(appointmentDate(appointment), clinic);
      const key = `${clinic.id}:${month}`;
      const existing = groups.get(key);
      const amount = Number(patient.sessionValue) || 0;
      const confirmedRecord = clinicRecords.find(
        (record) => record.clinicId === clinic.id && record.month === month,
      );
      let status: ClinicPaymentStatus = now > dueDate ? "Atrasado" : "Aguardando";
      if (confirmedRecord?.status === "confirmado" || appointment.repasseConfirmed) {
        status = "Confirmado";
      } else if (confirmedRecord?.status === "aguardando") {
        status = "Aguardando";
      } else if (confirmedRecord?.status === "atrasado") {
        status = "Atrasado";
      }

      if (existing) {
        existing.amount += amount;
        existing.quantity += 1;
        existing.appointmentIds.push(appointment.id);
        if (existing.status !== "Confirmado" && status === "Atrasado") existing.status = status;
        continue;
      }

      groups.set(key, {
        id: key,
        clinic,
        month,
        amount,
        appointmentIds: [appointment.id],
        quantity: 1,
        status,
      });
    }

    return [...groups.values()]
      .filter((item) => item.status !== "Confirmado")
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [clinicById, clinicRecords, patientById, realized]);

  const particularItems = useMemo<ParticularItem[]>(() => {
    const items: ParticularItem[] = [];
    const monthlyGroups = new Map<string, { patient: Patient; month: string }>();

    for (const appointment of realized) {
      const patient = patientById.get(appointment.patientId);
      if (!patient || patient.paymentType !== "particular") continue;

      const month = monthKey(appointmentDate(appointment));
      if (patient.paymentFrequency === "sessao") {
        if (!appointment.paid) {
          items.push({
            kind: "session",
            id: appointment.id,
            patient,
            appointment,
            amount: Number(patient.sessionValue) || 0,
            status: "Pendente",
          });
        }
        continue;
      }

      if (patient.paymentFrequency === "mensal") {
        monthlyGroups.set(`${patient.id}:${month}`, { patient, month });
      }
    }

    for (const { patient, month } of monthlyGroups.values()) {
      const summary = getMonthlyPaymentSummary(patient.id, month, patient.sessionValue);
      if (summary.status === "pago") continue;

      items.push({
        kind: "monthly",
        id: `${patient.id}:${month}`,
        patient,
        month,
        amountDue: summary.amountDue,
        amountReceived: summary.amountReceived,
        balance: summary.balance,
        status: summary.status === "parcial" ? "Parcial" : "Pendente",
      });
    }

    return items.sort((a, b) => {
      const monthA = a.kind === "monthly" ? a.month : appointmentDate(a.appointment);
      const monthB = b.kind === "monthly" ? b.month : appointmentDate(b.appointment);
      return monthB.localeCompare(monthA);
    });
  }, [monthlyPayments, patientById, realized]);

  const historyMonths = useMemo(
    () => getHistoryMonths(clinicRecords, monthlyPayments, cashEntries),
    [cashEntries, clinicRecords, monthlyPayments],
  );

  useEffect(() => {
    if (historyMonths.length > 0 && !historyMonths.includes(historyMonth)) {
      setHistoryMonth(historyMonths[0]);
    }
  }, [historyMonth, historyMonths]);

  const historyItems = useMemo(
    () =>
      getHistoryItems({
        selectedMonth: historyMonth,
        clinicRecords,
        monthlyPayments,
        cashEntries,
        appointments,
        patientById,
        clinicById,
      }),
    [
      appointments,
      cashEntries,
      clinicById,
      clinicRecords,
      historyMonth,
      monthlyPayments,
      patientById,
    ],
  );

  const openClinicModal = (item: ClinicItem) => {
    setModal({
      kind: "clinic",
      item,
      delayed: "",
      receivedMonth: item.month,
      hasDiscount: "nao",
      discountAmount: "0",
      notes: "",
    });
  };

  const openParticularModal = (item: ParticularItem) => {
    if (item.kind === "session") {
      const competence = monthKey(appointmentDate(item.appointment));
      setModal({
        kind: "session",
        item,
        choice: "integral",
        delayed: "",
        receivedMonth: competence,
        notes: "",
      });
      return;
    }
    setModal({
      kind: "monthly",
      item,
      choice: "integral",
      amountReceived: "",
      delayed: "",
      receivedMonth: item.month,
      notes: "",
    });
  };

  const confirmClinicPayment = (current: ClinicModal) => {
    const expectedAmount = current.item.amount;
    const discountInput = current.hasDiscount === "sim" ? current.discountAmount : "0";
    const { discount, received } = clinicPaymentAmounts(expectedAmount, discountInput);
    if (!current.delayed) {
      setMessage("Informe se houve atraso no pagamento.");
      return;
    }
    if (current.delayed === "sim" && !current.receivedMonth) {
      setMessage("Selecione o mês do recebimento.");
      return;
    }
    if (discount > expectedAmount) {
      setMessage("O desconto não pode ser maior que o valor previsto.");
      return;
    }

    const receivedMonth =
      current.delayed === "sim" ? current.receivedMonth : current.item.month;

    const nextAppointments = appointments.map((appointment) =>
      current.item.appointmentIds.includes(appointment.id)
        ? { ...appointment, repasseConfirmed: true, updatedAt: new Date().toISOString() }
        : appointment,
    );
    saveAppointments(nextAppointments);
    upsertClinicPaymentRecord({
      clinicId: current.item.clinic.id,
      month: current.item.month,
      amount: received,
      expectedAmount,
      discountAmount: discount,
      appointmentIds: current.item.appointmentIds,
      status: "confirmado",
      receivedMonth,
      delayed: current.delayed === "sim",
      notes: current.notes.trim() || "Pagamento confirmado",
    });
    if (received > 0 || discount > 0) {
      addCashEntry({
        source: "clinica",
        clinicId: current.item.clinic.id,
        month: current.item.month,
        receivedMonth,
        delayed: current.delayed === "sim",
        expectedAmount,
        discountAmount: discount,
        amount: received,
        notes: current.notes.trim() || "Repasse de clínica confirmado",
      });
    }
    setMessage("Pagamento de clínica confirmado.");
    setModal(null);
    reload();
  };

  const confirmSessionPayment = (current: SessionModal) => {
    const competence = monthKey(appointmentDate(current.item.appointment));

    if (current.choice === "integral") {
      if (!current.delayed) {
        setMessage("Informe se houve atraso no pagamento.");
        return;
      }
      if (current.delayed === "sim" && !current.receivedMonth) {
        setMessage("Selecione o mês do recebimento.");
        return;
      }

      const receivedMonth =
        current.delayed === "sim" ? current.receivedMonth : competence;
      const nextAppointments = appointments.map((appointment) =>
        appointment.id === current.item.appointment.id
          ? {
              ...appointment,
              paid: true,
              notes: current.notes.trim() || appointment.notes,
              updatedAt: new Date().toISOString(),
            }
          : appointment,
      );
      saveAppointments(nextAppointments);
      addCashEntry({
        source: "particular-sessao",
        patientId: current.item.patient.id,
        appointmentId: current.item.appointment.id,
        month: competence,
        receivedMonth,
        delayed: current.delayed === "sim",
        amount: current.item.amount,
        notes: current.notes.trim() || "Pagamento por sessão confirmado",
      });
      setMessage("Pagamento por sessão confirmado.");
    } else {
      setMessage("Pagamento mantido como pendente.");
    }
    setModal(null);
    reload();
  };

  const confirmMonthlyPayment = (current: MonthlyModal) => {
    let received = 0;
    if (current.choice === "integral") {
      received = current.item.balance;
    } else if (current.choice === "parcial") {
      received = Number(current.amountReceived);
      if (!Number.isFinite(received) || received <= 0) {
        setMessage("Informe um valor recebido maior que zero.");
        return;
      }
      if (received > current.item.balance) {
        setMessage("O valor recebido não pode ultrapassar o saldo pendente.");
        return;
      }
    }

    if (received > 0) {
      if (!current.delayed) {
        setMessage("Informe se houve atraso no pagamento.");
        return;
      }
      if (current.delayed === "sim" && !current.receivedMonth) {
        setMessage("Selecione o mês do recebimento.");
        return;
      }

      const receivedMonth =
        current.delayed === "sim" ? current.receivedMonth : current.item.month;
      recordMonthlyPayment(current.item.patient.id, current.item.month, current.item.amountDue, received, {
        receivedMonth,
        delayed: current.delayed === "sim",
        source: "confirmar-pagamento",
        notes: current.notes.trim() || undefined,
      });
    }
    setMessage(
      current.choice === "nao-recebido"
        ? "Mensalidade mantida como pendente."
        : "Pagamento mensal registrado.",
    );
    setModal(null);
    reload();
  };

  const makeEditDraft = (item: HistoryItem): EditDraft => ({
    item,
    status: item.kind === "clinic" ? "Pago" : item.status === "Parcial" ? "Parcial" : "Pago",
    amountReceived: String(item.receivedAmount || ""),
    totalAmount:
      item.kind === "clinic"
        ? String(item.expectedAmount || item.receivedAmount)
        : item.totalAmount !== undefined
          ? String(item.totalAmount)
          : "",
    remainingBalance:
      item.kind === "particular" && item.remainingBalance !== undefined
        ? String(item.remainingBalance)
        : "",
    hasDiscount:
      item.kind === "clinic" && (Number(item.discountAmount) || 0) > 0 ? "sim" : "nao",
    discountAmount: item.kind === "clinic" ? String(item.discountAmount || 0) : "0",
    delayed: item.delayed ? "sim" : "nao",
    receivedMonth: item.receivedMonth,
    notes: item.notes ?? "",
  });

  const requestHistoryEdit = (item: HistoryItem) => {
    const pin = loadInternalPin();
    if (!pin) {
      setMessage("Cadastre um PIN no Perfil antes de editar pagamentos confirmados.");
      return;
    }
    setPinItem(item);
    setPinInput("");
    setPinError("");
  };

  const confirmPinAccess = () => {
    if (!pinItem) return;
    const pin = loadInternalPin();
    if (!pin) {
      setPinError("Cadastre um PIN no Perfil antes de editar pagamentos confirmados.");
      return;
    }
    if (pinInput !== pin) {
      setPinError("PIN incorreto. Tente novamente.");
      return;
    }
    setEditDraft(makeEditDraft(pinItem));
    setPinItem(null);
    setPinInput("");
    setPinError("");
  };

  const updateOrCreateCashEntry = (entry: Omit<CashEntry, "id" | "createdAt">, id?: string) => {
    if (id && cashEntries.some((item) => item.id === id)) {
      saveCashEntries(
        cashEntries.map((item) =>
          item.id === id
            ? { ...item, ...entry, updatedAt: new Date().toISOString() } as CashEntry
            : item,
        ),
      );
      return;
    }
    addCashEntry(entry);
  };

  const saveClinicEdit = (draft: EditDraft, item: ClinicHistoryItem) => {
    const expectedAmount = Number(draft.totalAmount);
    const discountInput = draft.hasDiscount === "sim" ? draft.discountAmount : "0";
    const { discount, received } = clinicPaymentAmounts(expectedAmount, discountInput);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      setMessage("Informe um valor previsto maior que zero.");
      return;
    }
    if (discount > expectedAmount) {
      setMessage("O desconto não pode ser maior que o valor previsto.");
      return;
    }
    const delayed = draft.delayed === "sim";
    const receivedMonth = delayed ? draft.receivedMonth : item.competence;
    if (delayed && !receivedMonth) {
      setMessage("Selecione o mês computado no caixa.");
      return;
    }

    const nextClinicRecords = clinicRecords.map((record) =>
      record.id === item.recordId
        ? {
            ...record,
            amount: received,
            expectedAmount,
            discountAmount: discount,
            delayed,
            receivedMonth,
            notes: draft.notes.trim() || undefined,
          }
        : record,
    );
    saveClinicPaymentRecords(nextClinicRecords);

    const relatedCash = cashEntries.find(
      (entry) =>
        entry.source === "clinica" &&
        entry.clinicId === item.clinicId &&
        entry.month === item.competence,
    );
    updateOrCreateCashEntry(
      {
        source: "clinica",
        clinicId: item.clinicId,
        month: item.competence,
        receivedMonth,
        delayed,
        expectedAmount,
        discountAmount: discount,
        amount: received,
        notes: draft.notes.trim() || "Repasse de clínica confirmado",
      },
      relatedCash?.id,
    );

    setMessage("Pagamento de clínica atualizado.");
    setEditDraft(null);
    reload();
  };

  const saveSessionEdit = (draft: EditDraft, item: ParticularHistoryItem) => {
    const status = draft.status;
    const amount = Number(draft.amountReceived);
    const delayed = draft.delayed === "sim";
    const receivedMonth = delayed ? draft.receivedMonth : item.competence;

    if (status === "Pendente") {
      saveCashEntries(cashEntries.filter((entry) => entry.id !== item.cashEntryId));
      saveAppointments(
        appointments.map((appointment) =>
          appointment.id === item.appointmentId
            ? { ...appointment, paid: false, notes: draft.notes.trim() || appointment.notes }
            : appointment,
        ),
      );
      setMessage("Pagamento por sessão voltou para pendente.");
      setEditDraft(null);
      reload();
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Informe um valor recebido maior que zero.");
      return;
    }
    if (delayed && !receivedMonth) {
      setMessage("Selecione o mês computado no caixa.");
      return;
    }

    updateOrCreateCashEntry(
      {
        source: "particular-sessao",
        patientId: item.patientId,
        appointmentId: item.appointmentId,
        month: item.competence,
        receivedMonth,
        delayed,
        amount,
        notes: draft.notes.trim() || "Pagamento por sessão confirmado",
      },
      item.cashEntryId,
    );
    saveAppointments(
      appointments.map((appointment) =>
        appointment.id === item.appointmentId
          ? { ...appointment, paid: true, notes: draft.notes.trim() || appointment.notes }
          : appointment,
      ),
    );
    setMessage("Pagamento por sessão atualizado.");
    setEditDraft(null);
    reload();
  };

  const saveMonthlyEdit = (draft: EditDraft, item: ParticularHistoryItem) => {
    const currentPayment = monthlyPayments.find((payment) => payment.id === item.monthlyPaymentId);
    if (!currentPayment) {
      setMessage("Pagamento mensal não encontrado.");
      return;
    }

    const status = draft.status;
    const amount = status === "Pendente" ? 0 : Number(draft.amountReceived);
    const remaining = status === "Pago" ? 0 : Number(draft.remainingBalance);
    const delayed = amount > 0 && draft.delayed === "sim";
    const receivedMonth = delayed ? draft.receivedMonth : item.competence;

    if (status !== "Pendente" && (!Number.isFinite(amount) || amount <= 0)) {
      setMessage("Informe um valor recebido maior que zero.");
      return;
    }
    if (status === "Parcial" && (!Number.isFinite(remaining) || remaining <= 0)) {
      setMessage("Pagamento parcial deve manter saldo restante maior que zero.");
      return;
    }
    if (status === "Pago" && remaining !== 0) {
      setMessage("Pagamento pago deve ter saldo restante igual a zero.");
      return;
    }
    if (delayed && !receivedMonth) {
      setMessage("Selecione o mês computado no caixa.");
      return;
    }

    const amountDue = status === "Pendente"
      ? Number(draft.totalAmount) || Number(currentPayment.amountDue) || 0
      : amount + Math.max(remaining || 0, 0);

    saveMonthlyPayments(
      monthlyPayments.map((payment) =>
        payment.id === currentPayment.id
          ? {
              ...payment,
              amountDue,
              amountReceived: amount,
              status: status === "Pago" ? "pago" : status === "Parcial" ? "parcial" : "pendente",
              receivedMonth,
              delayed,
              notes: draft.notes.trim() || undefined,
            }
          : payment,
      ),
    );

    if (status === "Pendente" || amount <= 0) {
      saveCashEntries(cashEntries.filter((entry) => entry.id !== item.cashEntryId));
    } else {
      updateOrCreateCashEntry(
        {
          source: "particular-mensal",
          patientId: item.patientId,
          month: item.competence,
          receivedMonth,
          delayed,
          amount,
          notes: draft.notes.trim() || (status === "Pago" ? "Pagamento mensal integral" : "Pagamento mensal parcial"),
        },
        item.cashEntryId,
      );
    }

    setMessage("Pagamento mensal atualizado.");
    setEditDraft(null);
    reload();
  };

  const saveHistoryEdit = () => {
    if (!editDraft) return;
    if (editDraft.item.kind === "clinic") {
      saveClinicEdit(editDraft, editDraft.item);
      return;
    }
    if (editDraft.item.source === "session") {
      saveSessionEdit(editDraft, editDraft.item);
      return;
    }
    saveMonthlyEdit(editDraft, editDraft.item);
  };

  const confirmModal = () => {
    if (!modal) return;
    if (modal.kind === "clinic") confirmClinicPayment(modal);
    if (modal.kind === "session") confirmSessionPayment(modal);
    if (modal.kind === "monthly") confirmMonthlyPayment(modal);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Confirmar Pagamento
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Acompanhe repasses de clínicas e pendências reais de pacientes particulares.
          </p>
        </header>

        {message && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <Tabs defaultValue="pendencias" className="w-full">
          <TabsList className="h-auto gap-2 rounded-xl border border-primary/25 bg-card/70 p-1.5 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            <TabsTrigger
              value="pendencias"
              className="min-w-32 rounded-lg px-5 py-2.5 font-bold text-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(34,211,238,0.32)]"
            >
              Pendências
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="min-w-32 rounded-lg px-5 py-2.5 font-bold text-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(34,211,238,0.32)]"
            >
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendencias" className="mt-5">
            <Tabs defaultValue="clinicas" className="w-full">
              <TabsList>
                <TabsTrigger value="clinicas" className="min-w-32 rounded-lg px-5 py-2.5 font-bold text-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(34,211,238,0.32)]">Clínicas</TabsTrigger>
                <TabsTrigger value="particulares" className="min-w-32 rounded-lg px-5 py-2.5 font-bold text-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(34,211,238,0.32)]">Particulares</TabsTrigger>
              </TabsList>

              <TabsContent value="clinicas" className="mt-5">
                <div className="grid gap-3">
                  {clinicItems.length === 0 ? (
                    <EmptyState text="Nenhum pagamento de clínica pendente no momento." />
                  ) : (
                    clinicItems.map((item) => (
                      <article key={item.id} className="glass-card p-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] lg:items-center">
                          <div className="grid gap-1.5 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-xl font-black text-foreground">
                                {item.clinic.name}
                              </h2>
                              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                              {item.status === "Atrasado" && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="mr-1 h-3 w-3" /> alerta
                                </Badge>
                              )}
                            </div>
                            <div>
                              <span className="text-foreground/80">Previsão de pagamento:</span>{" "}
                              <span className="capitalize">{formatMonth(item.month)}</span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Valor:</span>{" "}
                              <span className="font-semibold text-foreground">{money(item.amount)}</span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Quantidade de atendimentos:</span>{" "}
                              <span>{item.quantity}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={item.status === "Confirmado"}
                              onClick={() => openClinicModal(item)}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Confirmar pagamento
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="particulares" className="mt-5">
                <div className="grid gap-3">
                  {particularItems.length === 0 ? (
                    <EmptyState text="Nenhum pagamento particular pendente no momento." />
                  ) : (
                    particularItems.map((item) => (
                      <article key={item.id} className="glass-card p-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] lg:items-center">
                          <div className="grid gap-1.5 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-xl font-black text-foreground">
                                {item.patient.name}
                              </h2>
                              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                            </div>
                            <div>
                              <span className="text-foreground/80">Modelo de cobrança:</span>{" "}
                              <span>{item.kind === "monthly" ? "Mensal" : "Por sessão"}</span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Competência:</span>{" "}
                              <span className="capitalize">
                                {item.kind === "monthly"
                                  ? formatMonth(item.month)
                                  : new Date(item.appointment.startsAt).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Valor total:</span>{" "}
                              <span className="font-semibold text-foreground">
                                {money(item.kind === "monthly" ? item.amountDue : item.amount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Valor recebido:</span>{" "}
                              <span>
                                {money(item.kind === "monthly" ? item.amountReceived : 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/80">Saldo pendente:</span>{" "}
                              <span className="font-semibold text-foreground">
                                {money(item.kind === "monthly" ? item.balance : item.amount)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => openParticularModal(item)}>
                              <CheckCircle2 className="h-4 w-4" /> Confirmar pagamento
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="historico" className="mt-5">
            <HistoryPanel
              month={historyMonth}
              months={historyMonths}
              items={historyItems}
              onMonthChange={setHistoryMonth}
              onEdit={requestHistoryEdit}
            />
          </TabsContent>
        </Tabs>

        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">
                    {modal.kind === "monthly"
                      ? "Confirmar pagamento mensal"
                      : modal.kind === "session"
                        ? "Confirmar pagamento particular"
                        : "Confirmar pagamento da clínica"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {modal.kind === "clinic"
                      ? "Confirme o repasse da clínica para a competência selecionada."
                      : "Confirme o recebimento do pagamento particular."}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setModal(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4">
                {modal.kind === "clinic" && (
                  <ClinicModalContent modal={modal} setModal={setModal} />
                )}
                {modal.kind === "session" && (
                  <SessionModalContent modal={modal} setModal={setModal} />
                )}
                {modal.kind === "monthly" && (
                  <MonthlyModalContent modal={modal} setModal={setModal} />
                )}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>
                  Cancelar
                </Button>
                <Button onClick={confirmModal}>Confirmar</Button>
              </div>
            </div>
          </div>
        )}

        {pinItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Liberação por PIN</h2>
                  <p className="text-sm text-muted-foreground">
                    Informe o PIN de segurança interno para editar este pagamento confirmado.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPinItem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(event) => {
                    setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setPinError("");
                  }}
                  placeholder="PIN de segurança"
                />
                {pinError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {pinError}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPinItem(null)}>
                  Cancelar
                </Button>
                <Button onClick={confirmPinAccess}>Liberar edição</Button>
              </div>
            </div>
          </div>
        )}

        {editDraft && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card max-h-[90vh] w-full max-w-xl overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Editar pagamento confirmado</h2>
                  <p className="text-sm text-muted-foreground">
                    Ajuste o registro local. As alterações recalculam caixa, pendências e histórico.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditDraft(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4">
                <EditPaymentContent draft={editDraft} setDraft={setEditDraft} />
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDraft(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveHistoryEdit}>Salvar edição</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="glass-card flex min-h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function HistoryPanel({
  month,
  months,
  items,
  onMonthChange,
  onEdit,
}: {
  month: string;
  months: string[];
  items: HistoryItem[];
  onMonthChange: (month: string) => void;
  onEdit: (item: HistoryItem) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="glass-card p-4">
        <label className="grid max-w-sm gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Selecione o mês
          </span>
          <select
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
          >
            {months.map((option) => (
              <option key={option} value={option}>
                {formatMonth(option)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {items.length === 0 ? (
        <EmptyState text="Nenhum pagamento confirmado no mês selecionado." />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, onEdit }: { item: HistoryItem; onEdit: (item: HistoryItem) => void }) {
  if (item.kind === "clinic") {
    return (
      <article className="glass-card p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] lg:items-start">
          <div className="grid gap-1.5 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-foreground">{item.clinicName}</h2>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                Editar
              </Button>
            </div>
            <InfoRow label="Competência" value={formatMonth(item.competence)} capitalize />
            <InfoRow label="Valor previsto" value={money(item.expectedAmount)} />
            <InfoRow label="Desconto informado" value={money(item.discountAmount)} />
            <InfoRow label="Valor recebido" value={money(item.receivedAmount)} />
            <InfoRow label="Quantidade de atendimentos" value={`${item.quantity}`} />
            <InfoRow label="Houve atraso" value={displayDelay(item.delayed)} />
            <InfoRow label="Mês computado no caixa" value={formatMonth(item.receivedMonth)} capitalize />
            {item.notes && <InfoRow label="Observação" value={item.notes} />}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] lg:items-start">
        <div className="grid gap-1.5 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-foreground">{item.patientName}</h2>
            <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
              Editar
            </Button>
          </div>
          <InfoRow label="Modelo" value={item.model} />
          <InfoRow label="Competência" value={formatMonth(item.competence)} capitalize />
          <InfoRow label="Valor recebido" value={money(item.receivedAmount)} />
          {item.totalAmount !== undefined && (
            <InfoRow label="Valor total" value={money(item.totalAmount)} />
          )}
          {item.remainingBalance !== undefined && (
            <InfoRow label="Saldo restante" value={money(item.remainingBalance)} />
          )}
          <InfoRow label="Houve atraso" value={displayDelay(item.delayed)} />
          <InfoRow label="Mês computado no caixa" value={formatMonth(item.receivedMonth)} capitalize />
          {item.notes && <InfoRow label="Observação" value={item.notes} />}
        </div>
      </div>
    </article>
  );
}

function EditPaymentContent({
  draft,
  setDraft,
}: {
  draft: EditDraft;
  setDraft: (draft: EditDraft) => void;
}) {
  const item = draft.item;
  const monthOptions = receiptMonthOptions(item.competence);
  const isClinic = item.kind === "clinic";
  const isMonthly = item.kind === "particular" && item.source === "monthly";
  const canReceiveMoney = isClinic || draft.status !== "Pendente";
  const clinicAmounts = isClinic
    ? clinicPaymentAmounts(
        Number(draft.totalAmount) || (item.kind === "clinic" ? item.expectedAmount : 0),
        draft.hasDiscount === "sim" ? draft.discountAmount : "0",
      )
    : null;

  const setStatus = (status: EditPaymentStatus) => {
    setDraft({
      ...draft,
      status,
      amountReceived: status === "Pendente" ? "0" : draft.amountReceived,
      remainingBalance: status === "Pago" ? "0" : draft.remainingBalance,
      delayed: status === "Pendente" ? "nao" : draft.delayed,
      receivedMonth: status === "Pendente" ? item.competence : draft.receivedMonth,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
        <InfoRow
          label={isClinic ? "Clínica" : "Paciente"}
          value={isClinic ? item.clinicName : item.patientName}
        />
        <InfoRow label="Competência" value={formatMonth(item.competence)} capitalize />
        <InfoRow label="Mês atual no caixa" value={formatMonth(item.receivedMonth)} capitalize />
      </div>

      {!isClinic && (
        <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <div className="flex flex-wrap gap-2">
            {(["Pago", ...(isMonthly ? ["Parcial"] : []), "Pendente"] as EditPaymentStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={draft.status === status ? "default" : "outline"}
                  onClick={() => setStatus(status)}
                >
                  {status}
                </Button>
              ),
            )}
          </div>
        </div>
      )}

      {isClinic && (
        <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Valor previsto
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.totalAmount}
              onChange={(event) => setDraft({ ...draft, totalAmount: event.target.value })}
            />
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Houve desconto no pagamento?
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.hasDiscount === "sim" ? "default" : "outline"}
                onClick={() => setDraft({ ...draft, hasDiscount: "sim" })}
              >
                Sim
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.hasDiscount === "nao" ? "default" : "outline"}
                onClick={() =>
                  setDraft({ ...draft, hasDiscount: "nao", discountAmount: "0" })
                }
              >
                Não
              </Button>
            </div>
          </div>

          {draft.hasDiscount === "sim" && (
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor do desconto
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.discountAmount}
                onChange={(event) => setDraft({ ...draft, discountAmount: event.target.value })}
              />
            </label>
          )}

          {clinicAmounts && (
            <div className="grid gap-1 rounded-lg border border-border bg-card/50 p-3 text-sm">
              <InfoRow label="Valor previsto" value={money(clinicAmounts.expected)} />
              <InfoRow label="Desconto informado" value={money(clinicAmounts.discount)} />
              <InfoRow label="Valor real recebido" value={money(clinicAmounts.received)} />
            </div>
          )}
        </div>
      )}

      {isMonthly && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Valor total
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={draft.totalAmount}
            onChange={(event) => setDraft({ ...draft, totalAmount: event.target.value })}
          />
        </label>
      )}

      {!isClinic && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Valor recebido
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={draft.status === "Pendente"}
            value={draft.amountReceived}
            onChange={(event) => setDraft({ ...draft, amountReceived: event.target.value })}
          />
        </label>
      )}

      {isMonthly && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saldo restante
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={draft.status === "Pago"}
            value={draft.status === "Pago" ? "0" : draft.remainingBalance}
            onChange={(event) => setDraft({ ...draft, remainingBalance: event.target.value })}
          />
        </label>
      )}

      {canReceiveMoney && (
        <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Houve atraso no pagamento?
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={draft.delayed === "sim" ? "default" : "outline"}
              onClick={() => setDraft({ ...draft, delayed: "sim" })}
            >
              Sim
            </Button>
            <Button
              type="button"
              size="sm"
              variant={draft.delayed === "nao" ? "default" : "outline"}
              onClick={() =>
                setDraft({ ...draft, delayed: "nao", receivedMonth: item.competence })
              }
            >
              Não
            </Button>
          </div>

          {draft.delayed === "sim" && (
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mês computado no caixa
              </span>
              <select
                value={draft.receivedMonth}
                onChange={(event) => setDraft({ ...draft, receivedMonth: event.target.value })}
                className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

    </div>
  );
}

function ClinicModalContent({
  modal,
  setModal,
}: {
  modal: ClinicModal;
  setModal: (modal: PaymentModal) => void;
}) {
  const monthOptions = receiptMonthOptions(modal.item.month);
  const amounts = clinicPaymentAmounts(
    modal.item.amount,
    modal.hasDiscount === "sim" ? modal.discountAmount : "0",
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
        <InfoRow label="Clínica" value={modal.item.clinic.name} />
        <InfoRow label="Previsão de pagamento" value={formatMonth(modal.item.month)} capitalize />
        <InfoRow label="Valor previsto" value={money(modal.item.amount)} />
        <InfoRow label="Quantidade" value={`${modal.item.quantity} atendimentos`} />
        <InfoRow label="Status" value={modal.item.status} />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Houve desconto no pagamento?
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={modal.hasDiscount === "sim" ? "default" : "outline"}
            onClick={() => setModal({ ...modal, hasDiscount: "sim" })}
          >
            Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modal.hasDiscount === "nao" ? "default" : "outline"}
            onClick={() => setModal({ ...modal, hasDiscount: "nao", discountAmount: "0" })}
          >
            Não
          </Button>
        </div>

        {modal.hasDiscount === "sim" && (
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Valor do desconto
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={modal.discountAmount}
              onChange={(event) => setModal({ ...modal, discountAmount: event.target.value })}
            />
          </label>
        )}

        <div className="grid gap-1 rounded-lg border border-border bg-card/50 p-3 text-sm">
          <InfoRow label="Valor previsto" value={money(amounts.expected)} />
          <InfoRow label="Desconto informado" value={money(amounts.discount)} />
          <InfoRow label="Valor real recebido" value={money(amounts.received)} />
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Houve atraso no pagamento?
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={modal.delayed === "sim" ? "default" : "outline"}
            onClick={() => setModal({ ...modal, delayed: "sim" })}
          >
            Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modal.delayed === "nao" ? "default" : "outline"}
            onClick={() =>
              setModal({ ...modal, delayed: "nao", receivedMonth: modal.item.month })
            }
          >
            Não
          </Button>
        </div>
      </div>

      {modal.delayed === "sim" && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Selecione o mês do recebimento
          </span>
          <select
            value={modal.receivedMonth}
            onChange={(event) => setModal({ ...modal, receivedMonth: event.target.value })}
            className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
      )}

    </div>
  );
}

function SessionModalContent({
  modal,
  setModal,
}: {
  modal: SessionModal;
  setModal: (modal: PaymentModal) => void;
}) {
  const competence = monthKey(appointmentDate(modal.item.appointment));
  const monthOptions = receiptMonthOptions(competence);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
        <InfoRow label="Paciente" value={modal.item.patient.name} />
        <InfoRow
          label="Data do atendimento"
          value={new Date(modal.item.appointment.startsAt).toLocaleDateString("pt-BR")}
        />
        <InfoRow label="Competência" value={formatMonth(competence)} capitalize />
        <InfoRow label="Valor da sessão" value={money(modal.item.amount)} />
        <InfoRow label="Status atual" value={modal.item.status} />
      </div>
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status do pagamento
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={modal.choice === "integral"}
            onChange={() => setModal({ ...modal, choice: "integral" })}
          />
          Pagamento integral
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={modal.choice === "nao-recebido"}
            onChange={() =>
              setModal({
                ...modal,
                choice: "nao-recebido",
                delayed: "",
                receivedMonth: competence,
              })
            }
          />
          Não recebido
        </label>
      </div>

      {modal.choice === "integral" && (
        <PaymentDelayFields
          delayed={modal.delayed}
          receivedMonth={modal.receivedMonth}
          monthOptions={monthOptions}
          onDelayChange={(delayed) =>
            setModal({
              ...modal,
              delayed,
              receivedMonth: delayed === "nao" ? competence : modal.receivedMonth,
            })
          }
          onReceivedMonthChange={(receivedMonth) =>
            setModal({ ...modal, receivedMonth })
          }
        />
      )}

    </div>
  );
}

function MonthlyModalContent({
  modal,
  setModal,
}: {
  modal: MonthlyModal;
  setModal: (modal: PaymentModal) => void;
}) {
  const monthOptions = receiptMonthOptions(modal.item.month);
  const willReceiveMoney = modal.choice === "integral" || modal.choice === "parcial";

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
        <InfoRow label="Paciente" value={modal.item.patient.name} />
        <InfoRow label="Competência" value={formatMonth(modal.item.month)} capitalize />
        <InfoRow label="Valor mensal" value={money(modal.item.amountDue)} />
        <InfoRow label="Valor já recebido" value={money(modal.item.amountReceived)} />
        <InfoRow label="Saldo pendente" value={money(modal.item.balance)} />
        <InfoRow label="Status atual" value={modal.item.status} />
      </div>
      <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status do pagamento
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={modal.choice === "integral"}
            onChange={() => setModal({ ...modal, choice: "integral", amountReceived: "" })}
          />
          Pagamento integral
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={modal.choice === "parcial"}
            onChange={() => setModal({ ...modal, choice: "parcial" })}
          />
          Pagamento parcial
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={modal.choice === "nao-recebido"}
            onChange={() =>
              setModal({
                ...modal,
                choice: "nao-recebido",
                amountReceived: "",
                delayed: "",
                receivedMonth: modal.item.month,
              })
            }
          />
          Não recebido
        </label>
      </div>
      {modal.choice === "integral" && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
          Este pagamento quitará o saldo pendente.
        </div>
      )}
      {modal.choice === "parcial" && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Valor recebido
          </span>
          <Input
            type="number"
            min="0"
            max={modal.item.balance}
            step="0.01"
            value={modal.amountReceived}
            onChange={(event) => setModal({ ...modal, amountReceived: event.target.value })}
          />
        </label>
      )}
      {willReceiveMoney && (
        <PaymentDelayFields
          delayed={modal.delayed}
          receivedMonth={modal.receivedMonth}
          monthOptions={monthOptions}
          onDelayChange={(delayed) =>
            setModal({
              ...modal,
              delayed,
              receivedMonth: delayed === "nao" ? modal.item.month : modal.receivedMonth,
            })
          }
          onReceivedMonthChange={(receivedMonth) =>
            setModal({ ...modal, receivedMonth })
          }
        />
      )}

    </div>
  );
}

function PaymentDelayFields({
  delayed,
  receivedMonth,
  monthOptions,
  onDelayChange,
  onReceivedMonthChange,
}: {
  delayed: "" | "sim" | "nao";
  receivedMonth: string;
  monthOptions: string[];
  onDelayChange: (value: "sim" | "nao") => void;
  onReceivedMonthChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Houve atraso no pagamento?
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={delayed === "sim" ? "default" : "outline"}
          onClick={() => onDelayChange("sim")}
        >
          Sim
        </Button>
        <Button
          type="button"
          size="sm"
          variant={delayed === "nao" ? "default" : "outline"}
          onClick={() => onDelayChange("nao")}
        >
          Não
        </Button>
      </div>

      {delayed === "sim" && (
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Selecione o mês do recebimento
          </span>
          <select
            value={receivedMonth}
            onChange={(event) => onReceivedMonthChange(event.target.value)}
            className="h-10 rounded-md border border-input bg-card/60 px-3 text-sm"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={capitalize ? "font-medium capitalize" : "font-medium"}>{value}</span>
    </div>
  );
}
