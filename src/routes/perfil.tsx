import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useState } from "react";
import { Bell, RotateCcw, UserCircle } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil — PSIU!" }] }),
  component: PerfilPage,
});

const STORAGE_KEY = "psiu:profile";

type Profile = { name: string; email: string };

function loadProfile(): Profile {
  if (typeof window === "undefined") return { name: "", email: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {}
  return { name: "", email: "" };
}

function PerfilPage() {
  const [profile, setProfile] = useState<Profile>({ name: "", email: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetTestData = () => {
    if (confirm("Tem certeza que deseja resetar todos os dados locais de teste?")) {
      // Clear all psiu:* keys
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("psiu:"))
        .forEach((k) => window.localStorage.removeItem(k));
      setProfile({ name: "", email: "" });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground glow">
            <UserCircle className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">Perfil</h1>
            <p className="text-sm text-muted-foreground">
              Suas informações locais e preferências.
            </p>
          </div>
        </header>

        {/* Dados básicos */}
        <form onSubmit={save} className="glass-card p-6">
          <h2 className="text-lg font-bold">Dados básicos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas para uso local. Nenhum login é necessário.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nome
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Seu nome"
                className="mt-2 w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-mail (opcional)
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="seu@email.com"
                className="mt-2 w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow transition hover:opacity-90"
            >
              Salvar
            </button>
            {saved && <span className="text-sm text-success">Salvo!</span>}
          </div>
        </form>

        {/* Notificações placeholder */}
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card/60">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Notificações de atendimento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Em uma fase futura, o PSIU! poderá avisar 5 minutos antes do próximo
                atendimento.
              </p>
              <div className="mt-2 inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                Planejado para versão PWA/app mobile.
              </div>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold">Dados locais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apague tudo que está salvo neste navegador para começar do zero.
          </p>
          <button
            onClick={resetTestData}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar dados de teste
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
