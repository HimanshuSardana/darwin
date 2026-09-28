"use client";

import { MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
] as const;

type SettingsSection = (typeof NAV_ITEMS)[number]["id"];

function AppearanceSection() {
  const { preference, resolved, setPreference } = useTheme();
  const dark = resolved === "dark";

  const setDark = (next: boolean) => {
    // An explicit toggle choice replaces "system" with a concrete mode.
    setPreference(next ? "dark" : "light");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-medium text-sm">Appearance</h3>
        <p className="text-muted-foreground text-sm">
          Choose how the app looks. Defaults to your system setting.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          {dark ? (
            <MoonIcon className="size-4 text-muted-foreground" />
          ) : (
            <SunIcon className="size-4 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-sm">Dark mode</p>
            <p className="text-muted-foreground text-xs">
              {preference === "system"
                ? `Following system (currently ${resolved})`
                : `Always ${resolved}`}
            </p>
          </div>
        </div>
        <Switch aria-label="Dark mode" checked={dark} onCheckedChange={setDark} />
      </div>
      {preference !== "system" ? (
        <button
          className="text-muted-foreground self-start text-xs underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setPreference("system")}
          type="button"
        >
          Follow system setting instead
        </button>
      ) : null}
    </div>
  );
}

export function SettingsDialog({
  onOpenChange,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const [section, setSection] = useState<SettingsSection>("appearance");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>App settings.</DialogDescription>
        </DialogHeader>
        <div className="flex h-[28rem]">
          <nav className="bg-muted/40 flex w-48 shrink-0 flex-col gap-1 border-r p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors outline-none",
                    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  type="button"
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "appearance" ? <AppearanceSection /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
