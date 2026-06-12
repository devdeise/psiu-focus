export const NOTES_LIST_KEY = "psiu:notes";
export const NOTES_SEEDED_KEY = "psiu:notes:seeded";

export const NOTE_CATEGORIES = [
  "Geral",
  "Paciente",
  "Pagamento",
  "Agenda",
  "Clínica",
  "Lembrete",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export type Note = {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  createdAt: string;
  updatedAt?: string;
};

function read(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_LIST_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function write(notes: Note[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTES_LIST_KEY, JSON.stringify(notes));
}

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  // Seed once
  try {
    const seeded = window.localStorage.getItem(NOTES_SEEDED_KEY);
    if (!seeded && !window.localStorage.getItem(NOTES_LIST_KEY)) {
      const now = new Date().toISOString();
      const seed: Note[] = [
        {
          id: crypto.randomUUID(),
          title: "Confirmar pagamento",
          content:
            "Verificar se o paciente Bruno realizou o pagamento da sessão.",
          category: "Pagamento",
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          title: "Observação de agenda",
          content:
            "Conferir horários da semana antes de iniciar os atendimentos.",
          category: "Agenda",
          createdAt: now,
        },
      ];
      write(seed);
      window.localStorage.setItem(NOTES_SEEDED_KEY, "1");
    }
  } catch {}
  return read();
}

export function saveNote(
  input: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Note[] {
  const notes = read();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = notes.findIndex((n) => n.id === input.id);
    if (idx >= 0) {
      notes[idx] = {
        ...notes[idx],
        title: input.title,
        content: input.content,
        category: input.category,
        updatedAt: now,
      };
    }
  } else {
    notes.unshift({
      id: crypto.randomUUID(),
      title: input.title,
      content: input.content,
      category: input.category,
      createdAt: now,
    });
  }
  write(notes);
  return notes;
}

export function deleteNote(id: string): Note[] {
  const notes = read().filter((n) => n.id !== id);
  write(notes);
  return notes;
}

export function addQuickNote(content: string): Note[] {
  const trimmed = content.trim();
  if (!trimmed) return read();
  return saveNote({
    title: "Anotação rápida",
    content: trimmed,
    category: "Lembrete",
  });
}
