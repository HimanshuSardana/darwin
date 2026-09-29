"use client";

import { Maximize2Icon, Minimize2Icon, MonitorIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Live browser view: stream frames, screenshot fallback, fullscreen. */
export function BrowserPanel({
  fullscreen,
  live,
  onClose,
  onFullscreen,
  onRefresh,
  shotUrl,
  streamFrame,
  url,
}: {
  readonly fullscreen: boolean;
  readonly live: boolean;
  readonly onClose: () => void;
  readonly onFullscreen: () => void;
  readonly onRefresh: () => void;
  readonly shotUrl: string | null;
  readonly streamFrame: string | null;
  readonly url: string | null;
}) {
  const src = streamFrame ?? shotUrl;
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-background",
        fullscreen
          ? "fixed inset-0 z-50"
          : "h-full min-h-0 w-[420px] shrink-0 border-l xl:w-[520px]",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-1 border-b px-3">
        <MonitorIcon className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">
          {url ?? "Browser"}
        </span>
        <span
          className={cn(
            "mr-1 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            live ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
          )}
          title={live ? "Live browser stream" : "Stream offline — showing last screenshot"}
        >
          <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-500" : "bg-muted-foreground")} />
          {live ? "LIVE" : "OFFLINE"}
        </span>
        <Button aria-label="Refresh view" onClick={onRefresh} size="icon-sm" variant="ghost">
          <RefreshCwIcon className="size-4" />
        </Button>
        <Button
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onFullscreen}
          size="icon-sm"
          variant="ghost"
        >
          {fullscreen ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
        </Button>
        <Button aria-label="Close browser panel" onClick={onClose} size="icon-sm" variant="ghost">
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
        {src ? (
          <img
            alt={live ? "Live browser view" : "Last browser screenshot"}
            className="h-auto w-full rounded-lg border bg-background shadow-sm"
            key={live ? "live" : src}
            src={src}
          />
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center">
            <MonitorIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground max-w-55 text-sm">
              No browser yet. Ask the agent to open a page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
