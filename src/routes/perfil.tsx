import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useState } from "react";
import { Bell, LockKeyhole, Trash2, UserCircle, X } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil — PSIU!" }] }),
  component: PerfilPage,
});

const STORAGE_KEY = "psiu:profile";
const PIN_STORAGE_KEY = "psiu:internal-pin";

type Profile = { name: string; email: string };
type PinMessage = { type: "success" | "error"; text: string } | null;

function loadProfile(): Profile {
  if (typeof window === "undefined") return { name: "", email: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {}
  return { name: "", email: "" };
}

function loadPin(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

function PerfilPage() {
  const [profile, setProfile] = useState<Profile>({ name: "", email: "" });
  const [saved, setSaved] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMessage, setPinMessage] = useState<PinMessage>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    setProfile(loadProfile());
    setHasPin(Boolean(loadPin()));
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const deleteLocalAccount = () => {
    if (deleteConfirmation !== "DELETAR") return;

    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("psiu:"))
      .forEach((key) => window.localStorage.removeItem(key));

    setProfile({ name: "", email: "" });
    setSaved(false);
    setHasPin(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMessage(null);
    setDeleteConfirmation("");
    setDeleteModalOpen(false);
    setDeleteMessage("Conta local deletada com sucesso.");
  };

  const savePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    const storedPin = loadPin();
    if (storedPin && currentPin !== storedPin) {
      setPinMessage({ type: "error", text: "PIN atual incorreto." });
      return;
    }
    if (!isValidPin(newPin)) {
      setPinMessage({ type: "error", text: "O PIN deve ter 4 dígitos numéricos." });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMessage({ type: "error", text: "A confirmação deve ser igual ao novo PIN." });
      return;
    }

    window.localStorage.setItem(PIN_STORAGE_KEY, newPin);
    setHasPin(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMessage({
      type: "success",
      text: storedPin ? "PIN redefinido com sucesso." : "PIN criado com sucesso.",
    });
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

        {/* PIN interno */}
        <form onSubmit={savePin} className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card/60">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">PIN de segurança interno</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                PIN local salvo apenas neste navegador.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {hasPin && (
                  <PinField
                    label="PIN atual"
                    value={currentPin}
                    onChange={setCurrentPin}
                  />
                )}
                <PinField
                  label={hasPin ? "Novo PIN" : "Novo PIN"}
                  value={newPin}
                  onChange={setNewPin}
                />
                <PinField
                  label={hasPin ? "Confirmar novo PIN" : "Confirmar PIN"}
                  value={confirmPin}
                  onChange={setConfirmPin}
                />
              </div>

              {pinMessage && (
                <div
                  className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                    pinMessage.type === "success"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {pinMessage.text}
                </div>
              )}

              <button
                type="submit"
                className="mt-5 rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow transition hover:opacity-90"
              >
                {hasPin ? "Redefinir PIN" : "Criar PIN"}
              </button>
            </div>
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

        {deleteMessage && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            {deleteMessage}
          </div>
        )}

        {/* Zona de risco */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold">Zona de risco</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta ação apaga todos os dados locais deste dispositivo, incluindo pacientes,
            clínicas, agenda, pagamentos, anotações e preferências.
          </p>
          <button
            onClick={() => {
              setDeleteMessage("");
              setDeleteConfirmation("");
              setDeleteModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" />
            Deletar conta
          </button>
        </div>

        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Deletar conta local?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Esta ação apagará todos os dados locais do PSIU neste dispositivo. Não
                    será possível recuperar essas informações.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card/60 text-muted-foreground transition hover:text-foreground"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Como esta versão não possui backend, apenas os dados salvos neste navegador
                serão apagados.
              </div>

              <label className="mt-5 grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Digite DELETAR para confirmar
                </span>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder="DELETAR"
                  className="w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-card"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmation !== "DELETAR"}
                  onClick={deleteLocalAccount}
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Deletar conta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="0000"
        className="w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
