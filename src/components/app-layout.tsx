import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserCircle,
  NotebookPen,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAppointments,
  clinicPaymentDueDate,
  clinicPaymentDueMonth,
  getClinicPaymentRecords,
  getClinics,
  getMonthlyPaymentSummary,
  getPatients,
  monthKey,
  toDateKey,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/anotacoes", label: "Anotações", icon: NotebookPen },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/confirmar-pagamento", label: "Confirmar Pagamento", icon: CheckCircle2 },
  { to: "/analise-faltas", label: "Análise de Faltas", icon: AlertTriangle },
  { to: "/cadastro", label: "Cadastro", icon: UserPlus },
  { to: "/perfil", label: "Perfil", icon: UserCircle },
] as const;

function appointmentDate(iso: string) {
  return toDateKey(new Date(iso));
}

function hasRealPaymentPending() {
  const appointments = getAppointments().filter((appointment) => appointment.status === "realizado");
  const patients = getPatients();
  const clinics = getClinics();
  const clinicRecords = getClinicPaymentRecords();
  const now = new Date();
  const monthlyGroups = new Map<string, { patientId: string; month: string; amount: number }>();

  for (const appointment of appointments) {
    const patient = patients.find((item) => item.id === appointment.patientId);
    if (!patient) continue;
    const month = monthKey(appointmentDate(appointment.startsAt));

    if (patient.paymentType === "clinica") {
      const clinicId = patient.clinicId ?? appointment.clinicId ?? "";
      const clinic = clinics.find((item) => item.id === clinicId);
      const dueMonth = clinicPaymentDueMonth(appointmentDate(appointment.startsAt), clinic);
      const record = clinicRecords.find(
        (item) => item.clinicId === clinicId && item.month === dueMonth,
      );
      const confirmed = appointment.repasseConfirmed || record?.status === "confirmado";
      if (!confirmed && now > clinicPaymentDueDate(appointmentDate(appointment.startsAt), clinic)) return true;
      continue;
    }

    if (patient.paymentType !== "particular") continue;
    if (patient.paymentFrequency === "sessao" && !appointment.paid) return true;
    if (patient.paymentFrequency === "mensal") {
      monthlyGroups.set(`${patient.id}:${month}`, {
        patientId: patient.id,
        month,
        amount: patient.sessionValue,
      });
    }
  }

  for (const group of monthlyGroups.values()) {
    const summary = getMonthlyPaymentSummary(group.patientId, group.month, group.amount);
    if (summary.status === "pendente" || summary.status === "parcial") return true;
  }

  return false;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary glow">
        <span className="text-lg font-black text-primary-foreground">P!</span>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-black tracking-tight text-gradient leading-none">PSIU!</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          Gestão para psicólogos
        </div>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const paymentAlert = hasRealPaymentPending();
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active =
          item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              item.to === "/confirmar-pagamento" &&
                paymentAlert &&
                !active &&
                "border border-destructive/40 bg-destructive/10 text-foreground",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.to === "/confirmar-pagamento" && paymentAlert && (
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, loading, profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (loading || !session?.user) {
      setCloudReady(false);
      return;
    }
    (async () => {
      const cloud = await import("@/lib/store/cloud");
      cloud.setCloudUser(session.user.id);
      await cloud.pullAllFromCloud();
      if (!cancelled) setCloudReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id]);

  if (loading || !session || !cloudReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const displayName = profile?.nome || user?.email?.split("@")[0] || "Usuário";
  const displayEmail = profile?.email || user?.email || "";

  const handleLogout = async () => {
    const cloud = await import("@/lib/store/cloud");
    cloud.setCloudUser(null);
    // Limpa cache local para o próximo usuário não ver dados anteriores
    // Mantém apenas o PIN interno do dispositivo.
    try {
      const preserve = new Set(["psiu:internal-pin"]);
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("psiu:") && !preserve.has(k))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {}
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const UserCard = () => (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-primary-foreground">
          <UserCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{displayName}</div>
          {displayEmail && (
            <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 backdrop-blur-xl lg:flex">
        <div className="px-2 py-2">
          <Brand />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="mt-4">
          <UserCard />
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card/60"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-sidebar-border bg-sidebar p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-4">
              <UserCard />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
