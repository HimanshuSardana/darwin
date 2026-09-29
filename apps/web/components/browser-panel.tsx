"use client";

import { Maximize2Icon, Minimize2Icon, MonitorIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Chromeless floating browser window: just the screen. All controls live
 * in an overlay bar that appears on hover/focus. Drag from anywhere except
 * the controls themselves.
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

  const onPointerDown = (event: React.PointerEvent) => {
    if (fullscreen) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = Math.min(Math.max(event.clientX - drag.dx, 8), window.innerWidth - 120);
    const y = Math.min(Math.max(event.clientY - drag.dy, 8), window.innerHeight - 80);
    setPos({ x, y });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const src = streamFrame ?? shotUrl;
  // Fullscreen portals to document.body: fixed positioning is relative to
  // the nearest transformed/filtered ancestor, and app chrome (sidebars,
  // animated containers) can trap it. The portal guarantees viewport fill.
  const window_ = (
    <div
      ref={frameRef}
      style={pos ? { left: pos.x, top: pos.y } : { top: 72, right: 16 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "group/window overflow-hidden rounded-xl border bg-background shadow-xl select-none",
        fullscreen ? "fixed inset-0 z-50" : "fixed z-40 w-[440px] max-w-[90vw]",
      )}
    >
      <div className="relative aspect-video w-full touch-none bg-muted/30">
        {src ? (
          live ? (
            <img
              alt="Live browser view"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
              src={src}
            />
          ) : (
            <div className="absolute inset-0 overflow-auto">
              <img
                alt="Last browser screenshot"
                className="h-auto w-full"
                draggable={false}
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
        {/* Controls overlay: only on hover/focus. */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-2.5 pt-2 pb-5 opacity-0 transition-opacity group-hover/window:opacity-100 focus-within:opacity-100">
          <span className="min-w-0 flex-1 truncate px-1 text-xs text-white/90">
            {url ?? "Browser"}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              live ? "bg-emerald-500/25 text-emerald-300" : "bg-white/15 text-white/80",
            )}
            title={live ? "Live browser stream" : "Stream offline — showing last screenshot"}
          >
            <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-400" : "bg-white/60")} />
            {live ? "LIVE" : "OFFLINE"}
          </span>
          <Button
            aria-label="Refresh view"
            className="size-7 text-white/90 hover:bg-white/15 hover:text-white"
            onClick={onRefresh}
            size="icon-sm"
            variant="ghost"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
          <Button
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="size-7 text-white/90 hover:bg-white/15 hover:text-white"
            onClick={onFullscreen}
            size="icon-sm"
            variant="ghost"
          >
            {fullscreen ? <Minimize2Icon className="size-3.5" /> : <Maximize2Icon className="size-3.5" />}
          </Button>
          <Button
            aria-label="Close browser panel"
            className="size-7 text-white/90 hover:bg-white/15 hover:text-white"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
  if (fullscreen && typeof document !== "undefined") {
    return createPortal(window_, document.body);
  }
  return window_;
}
