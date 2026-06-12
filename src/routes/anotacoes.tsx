import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useMemo, useState } from "react";
import {
  NotebookPen,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import {
  NOTE_CATEGORIES,
  type Note,
  type NoteCategory,
  loadNotes,
  saveNote,
  deleteNote,
} from "@/lib/notes-store";

export const Route = createFileRoute("/anotacoes")({
  head: () => ({
    meta: [
      { title: "Anotações — PSIU!" },
      {
        name: "description",
        content:
          "Consolide lembretes, observações e informações importantes do dia a dia.",
      },
    ],
  }),
  component: AnotacoesPage,
});

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type EditorState = {
  open: boolean;
  id?: string;
  title: string;
  content: string;
  category: NoteCategory;
};

const EMPTY_EDITOR: EditorState = {
  open: false,
  title: "",
  content: "",
  category: "Geral",
};

function AnotacoesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const openNew = () =>
    setEditor({ ...EMPTY_EDITOR, open: true });

  const openEdit = (n: Note) =>
    setEditor({
      open: true,
      id: n.id,
      title: n.title,
      content: n.content,
      category: n.category,
    });

  const handleSave = () => {
    if (!editor.title.trim() || !editor.content.trim()) return;
    const updated = saveNote({
      id: editor.id,
      title: editor.title.trim(),
      content: editor.content.trim(),
      category: editor.category,
    });
    setNotes(updated);
    setEditor(EMPTY_EDITOR);
  };

  const handleDelete = (id: string) => {
    setNotes(deleteNote(id));
    setConfirmId(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground glow">
              <NotebookPen className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">
                Anotações
              </h1>
              <p className="text-sm text-muted-foreground">
                Consolide lembretes, observações e informações importantes do
                dia a dia.
              </p>
            </div>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nova anotação
          </button>
        </header>

        {/* Busca */}
        <div className="glass-card flex items-center gap-3 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, conteúdo ou categoria..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-card/60">
              <NotebookPen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-bold">
              {notes.length === 0
                ? "Nenhuma anotação registrada ainda."
                : "Nenhum resultado encontrado."}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {notes.length === 0
                ? "Crie sua primeira anotação para organizar lembretes e observações importantes."
                : "Tente ajustar os termos da busca."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((n) => (
              <article
                key={n.id}
                className="glass-card flex flex-col gap-3 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">{n.title}</h3>
                    <span className="mt-1 inline-block rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {n.category}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(n)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card/60 text-muted-foreground transition hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(n.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.content}
                </p>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span>Criada em {formatDate(n.createdAt)}</span>
                  {n.updatedAt && (
                    <span>Atualizada em {formatDate(n.updatedAt)}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setEditor(EMPTY_EDITOR)}
          />
          <div className="glass-card relative z-10 flex w-full max-w-lg flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editor.id ? "Editar anotação" : "Nova anotação"}
              </h2>
              <button
                onClick={() => setEditor(EMPTY_EDITOR)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Título
              </label>
              <input
                type="text"
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
                placeholder="Ex: Lembrar de ligar para o paciente"
                className="mt-2 w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Categoria
              </label>
              <select
                value={editor.category}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    category: e.target.value as NoteCategory,
                  })
                }
                className="mt-2 w-full rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Conteúdo
              </label>
              <textarea
                value={editor.content}
                onChange={(e) =>
                  setEditor({ ...editor, content: e.target.value })
                }
                placeholder="Detalhes da anotação..."
                className="mt-2 min-h-[140px] w-full resize-y rounded-lg border border-input bg-card/60 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditor(EMPTY_EDITOR)}
                className="rounded-lg border border-input bg-card/60 px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!editor.title.trim() || !editor.content.trim()}
                className="rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow transition hover:opacity-90 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setConfirmId(null)}
          />
          <div className="glass-card relative z-10 flex w-full max-w-md flex-col gap-4 p-6">
            <h2 className="text-lg font-bold">Excluir anotação</h2>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir esta anotação?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-lg border border-input bg-card/60 px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
