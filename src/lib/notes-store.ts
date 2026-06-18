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

function notesKey(userId: string) {
  return `${NOTES_LIST_KEY}:${userId}`;
}

function read(userId: string): Note[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(notesKey(userId));
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function write(userId: string, notes: Note[]) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(notesKey(userId), JSON.stringify(notes));
}

export function loadNotes(userId: string): Note[] {
  return read(userId);
}

export function saveNote(
  userId: string,
  input: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Note[] {
  const notes = read(userId);
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
  write(userId, notes);
  return notes;
}

export function deleteNote(userId: string, id: string): Note[] {
  const notes = read(userId).filter((n) => n.id !== id);
  write(userId, notes);
  return notes;
}

export function addQuickNote(userId: string, content: string): Note[] {
  const trimmed = content.trim();
  if (!trimmed) return read(userId);
  return saveNote(userId, {
    title: "Anotação rápida",
    content: trimmed,
    category: "Lembrete",
  });
}

export function clearNotesCache(userId?: string) {
  if (typeof window === "undefined") return;
  if (userId) {
    window.localStorage.removeItem(notesKey(userId));
    return;
  }
  Object.keys(window.localStorage)
    .filter(
      (key) =>
        key === NOTES_LIST_KEY ||
        key === NOTES_SEEDED_KEY ||
        key.startsWith(`${NOTES_LIST_KEY}:`),
    )
    .forEach((key) => window.localStorage.removeItem(key));
}
