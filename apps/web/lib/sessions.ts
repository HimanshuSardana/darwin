"use client";

export interface ChatSessionEntry {
  readonly sessionId: string;
  title: string;
  updatedAt: number;
}

const STORAGE_KEY = "darwin.sessions.v1";
const TITLE_MAX = 48;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSessions(): ChatSessionEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ChatSessionEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as ChatSessionEntry).sessionId === "string",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(sessions: ChatSessionEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable — sidebar simply won't persist.
  }
}

export function titleFromMessage(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= TITLE_MAX) return singleLine || "New chat";
  return `${singleLine.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Insert or refresh an entry; returns the new list (newest first). */
export function upsertSession(
  sessions: ChatSessionEntry[],
  sessionId: string,
  patch?: { readonly title?: string },
): ChatSessionEntry[] {
  const now = Date.now();
  const existing = sessions.find((entry) => entry.sessionId === sessionId);
  const next: ChatSessionEntry[] = existing
    ? sessions.map((entry) =>
        entry.sessionId === sessionId
          ? { ...entry, updatedAt: now, title: patch?.title ?? entry.title }
          : entry,
      )
    : [{ sessionId, title: patch?.title ?? "New chat", updatedAt: now }, ...sessions];
  const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
  persist(sorted);
  return sorted;
}

export function removeSession(
  sessions: ChatSessionEntry[],
  sessionId: string,
): ChatSessionEntry[] {
  const next = sessions.filter((entry) => entry.sessionId !== sessionId);
  persist(next);
  return next;
}
