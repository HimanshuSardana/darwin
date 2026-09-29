"use client";

import { Maximize2Icon, Minimize2Icon, MonitorIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Floating browser window: spawns top-right, drags by its header,
 * reveals fullscreen/close controls on hover. Fullscreen takes over.
 */
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const onHeaderPointerDown = (event: React.PointerEvent) => {
    if (fullscreen) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onHeaderPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = Math.min(
      Math.max(event.clientX - drag.dx, 8),
      window.innerWidth - 120,
    );
    const y = Math.min(Math.max(event.clientY - drag.dy, 8), window.innerHeight - 80);
    setPos({ x, y });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const src = streamFrame ?? shotUrl;
  return (
    <div
      ref={frameRef}
      style={pos ? { left: pos.x, top: pos.y } : { top: 72, right: 16 }}
      className={cn(
        "group/window flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl",
        fullscreen ? "fixed inset-0 z-50" : "fixed z-40 w-[440px] max-w-[90vw]",
      )}
    >
      <div
        className="flex h-11 shrink-0 cursor-grab touch-none items-center gap-1 border-b px-2.5 select-none active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/window:opacity-100 focus-within:opacity-100">
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
        </span>
      </div>
      <div className="relative aspect-video min-h-0 w-full bg-muted/30">
        {src ? (
          live ? (
            <div className="absolute inset-0 flex items-center justify-center p-2">
              <img
                alt="Live browser view"
                className="max-h-full max-w-full rounded-md border bg-background object-contain shadow-sm"
                src={src}
              />
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto p-2">
              <img
                alt="Last browser screenshot"
                className="h-auto w-full rounded-md border bg-background shadow-sm"
                key={src}
                src={src}
              />
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
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
