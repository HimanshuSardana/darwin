/**
 * Theme preference (light / dark / system), persisted in localStorage.
 * Applied as a `.dark` class on <html> — Tailwind resolves dark: variants
 * from the class (see globals.css `@custom-variant`), not the OS setting.
 */
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "darwin.theme.v1";

export function loadTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system" || typeof window === "undefined") {
    return preference === "dark" ? "dark" : "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(preference) === "dark");
}

export function saveTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Non-fatal.
  }
  applyTheme(preference);
}
