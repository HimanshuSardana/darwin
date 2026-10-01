"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { ChatSpanDetail } from "@/components/observability/payload-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchModelCalls,
  fetchTraceSpans,
  formatDurationNs,
  formatTime,
  formatTokens,
  type ModelCallSummary,
  type TraceSpan,
} from "@/lib/observability";
import { cn } from "@/lib/utils";

/**
 * Right-side observability drawer for the main chat page: a table of
 * recent model calls; picking one renders its full payload in place,
 * with a back button to the table.
 */
export function ObservabilityDrawer({
  onOpenChange,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const [calls, setCalls] = useState<ModelCallSummary[] | null>(null);
  const [selected, setSelected] = useState<ModelCallSummary | null>(null);
  const [span, setSpan] = useState<TraceSpan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void fetchModelCalls(50)
      .then((body) => {
        if (!cancelled) setCalls(body.calls);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Failed to load calls.");
      });
    return () => {
      cancelled = true;
    };
  }, [open ]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSpan(null);
      return;
    }
  }, [open ]);

  const openCall = (call: ModelCallSummary) => {
    setSelected(call);
    setSpan(null);
    void fetchTraceSpans(call.traceId)
      .then((body) => {
        setSpan(body.spans.find((entry) => entry.spanId === call.spanId) ?? null);
      })
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load payload.");
      });
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-border border-b px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            {selected ? (
              <Button
                aria-label="Back to messages"
                onClick={() => {
                  setSelected(null);
                  setSpan(null);
                }}
                size="icon-sm"
                title="Back to messages"
                type="button"
                variant="ghost"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
            ) : null}
            <div>
              <SheetTitle>{selected ? "Message payload" : "Messages"}</SheetTitle>
              <SheetDescription>
                {selected
                  ? (selected.title ?? selected.sessionId ?? selected.spanId.slice(0, 8))
                  : "Recent model calls, newest first."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        {error ? <p className="text-destructive px-4 py-2 text-xs">{error}</p> : null}
        {!selected ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {calls === null ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-xs">
                Loading calls…
              </p>
            ) : calls.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-xs">
                No model calls recorded yet.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground sticky top-0 bg-background">
                  <tr className="border-border border-b">
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-2 py-2 font-medium">Conversation</th>
                    <th className="px-2 py-2 font-medium">Tokens</th>
                    <th className="px-4 py-2 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr
                      className="border-border hover:bg-accent/40 cursor-pointer border-b"
                      key={`${call.traceId}:${call.spanId}`}
                      onClick={() => openCall(call)}
                    >
                      <td className="text-muted-foreground px-4 py-2 font-mono text-[11px] whitespace-nowrap">
                        {formatTime(call.startNs)}
                      </td>
                      <td className="min-w-0 max-w-55 px-2 py-2">
                        <span className="block truncate font-medium">
                          {call.title ?? call.sessionId ?? call.spanId.slice(0, 8)}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-[11px]">
                          {(call.model ?? "model").split("-").slice(0, 2).join("-")}
                          {call.finishReason ? ` · ${call.finishReason}` : ""}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "text-muted-foreground px-2 py-2 font-mono text-[11px] whitespace-nowrap",
                          call.inputTokens === null && "opacity-50",
                        )}
                      >
                        {call.inputTokens === null
                          ? "—"
                          : `↑${formatTokens(call.inputTokens)} ↓${formatTokens(call.outputTokens ?? 0)}`}
                      </td>
                      <td className="text-muted-foreground px-4 py-2 text-right font-mono text-[11px] whitespace-nowrap">
                        {formatDurationNs(call.startNs, call.endNs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!span ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-xs">
                Loading payload…
              </p>
            ) : (
              <>
                <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-2">
                  <Badge>{selected.model ?? "model"}</Badge>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {formatTime(selected.startNs)}
                  </span>
                </div>
                <ChatSpanDetail span={span} />
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
