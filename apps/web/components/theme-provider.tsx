"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applyTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  readonly preference: ThemePreference;
  readonly resolved: "light" | "dark";
  readonly setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "light",
  setPreference: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadTheme);

  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (loadTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveTheme(next);
    setPreferenceState(next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ preference, resolved: resolveTheme(preference), setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
