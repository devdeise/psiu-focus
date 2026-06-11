import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/confirmar-pagamento", label: "Confirmar Pagamento", icon: CheckCircle2 },
  { to: "/analise-faltas", label: "Análise de Faltas", icon: AlertTriangle },
  { to: "/cadastro", label: "Cadastro", icon: UserPlus },
  { to: "/perfil", label: "Perfil", icon: UserCircle },
] as const;

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
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <div className="mt-4 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
          Versão local de protótipo. Dados salvos no seu navegador.
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
