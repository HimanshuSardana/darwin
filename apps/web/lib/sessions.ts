"use client";

export interface ChatSessionEntry {
  readonly sessionId: string;
  title: string;
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = "darwin.sessions.v1.";
const TITLE_MAX = 48;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSessions(userId: string): ChatSessionEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
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

function persist(userId: string, sessions: ChatSessionEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
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
  userId: string,
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
  persist(userId, sorted);
  return sorted;
}

export function removeSession(
  sessions: ChatSessionEntry[],
  userId: string,
  sessionId: string,
): ChatSessionEntry[] {
  const next = sessions.filter((entry) => entry.sessionId !== sessionId);
  persist(userId, next);
  return next;
}

/** Register ownership server-side (first writer wins). Returns true if mine. */
export async function claimSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { mine?: unknown };
    return data.mine === true;
  } catch {
    return false;
  }
}
