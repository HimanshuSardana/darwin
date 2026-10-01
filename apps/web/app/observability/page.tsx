"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react";
import { ChatSpanDetail, TextBlock, ToolSpanDetail } from "@/components/observability/payload-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import {
  fetchTraceSpans,
  fetchTraces,
  formatDurationNs,
  formatTime,
  formatTokens,
  type TraceSpan,
  type TraceSummary,
} from "@/lib/observability";
import { loadSessions } from "@/lib/sessions";
import { cn } from "@/lib/utils";

export default function ObservabilityPage() {
  const { data: authSession } = useSession();
  const userId = authSession?.user?.id ?? null;
  const [traces, setTraces] = useState<TraceSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spans, setSpans] = useState<TraceSpan[] | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTraces()
      .then((body) => {
        if (cancelled) return;
        setTraces(body.traces);
        setSelectedId((current) => current ?? body.traces[0]?.id ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Failed to load traces.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSpans(null);
      return;
    }
    let cancelled = false;
    setSpans(null);
    void fetchTraceSpans(selectedId)
      .then((body) => {
        if (!cancelled) {
          setSpans(body.spans);
          setExpanded(new Set());
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Failed to load trace.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const toggle = useCallback((spanId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }, []);

  const localSessionIds = useMemo(() => {
    if (!userId) return new Set<string>();
    try {
      return new Set(loadSessions(userId).map((entry) => entry.sessionId));
    } catch {
      return new Set<string>();
    }
  }, [userId]);

  const selected = traces?.find((entry) => entry.id === selectedId) ?? null;

  return (
    <main className="mx-auto flex h-dvh max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Button asChild size="icon-sm" title="Back to chat" variant="ghost">
          <Link aria-label="Back to chat" href="/">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-medium">Observability</h1>
          <p className="text-muted-foreground text-xs">
            Every model call, tool call, and token — from local Eve traces.
          </p>
        </div>
      </header>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr]">
        <section className="border-border flex min-h-0 flex-col overflow-hidden rounded-xl border">
          <p className="text-muted-foreground border-border border-b px-3 py-2 text-xs font-medium">
            {traces === null ? "Loading…" : `${traces.length} traces`}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {traces?.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-xs leading-relaxed">
                No traces yet. Traces are recorded locally during development
                under .eve/traces.
              </p>
            ) : (
              traces?.map((trace) => (
                <button
                  className={cn(
                    "border-border flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left",
                    trace.id === selectedId ? "bg-accent" : "hover:bg-accent/40",
                  )}
                  key={trace.id}
                  onClick={() => setSelectedId(trace.id)}
                  type="button"
                >
                  <span className="truncate text-sm font-medium">
                    {trace.title ?? trace.sessionId ?? trace.id.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap gap-x-2 font-mono text-[11px]">
                    <span>{formatTime(trace.startNs)}</span>
                    <span>
                      {trace.modelCalls} calls · {trace.toolCalls} tools
                    </span>
                    <span>
                      ↑{formatTokens(trace.inputTokens)} ↓{formatTokens(trace.outputTokens)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="border-border flex min-h-0 flex-col overflow-hidden rounded-xl border">
          {!selected || !spans ? (
            <p className="text-muted-foreground m-auto px-6 py-12 text-center text-sm">
              {traces === null ? "Loading traces…" : "Select a trace to inspect its payloads."}
            </p>
          ) : (
            <>
              <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <h2 className="text-sm font-medium">
                  {selected.title ?? selected.sessionId ?? selected.id.slice(0, 8)}
                </h2>
                {selected.sessionId && localSessionIds.has(selected.sessionId) ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/?session=${encodeURIComponent(selected.sessionId)}`}>
                      Open in chat
                    </Link>
                  </Button>
                ) : null}
                <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                  {formatDurationNs(selected.startNs, selected.endNs)} ·{" "}
                  {spans.length} spans
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {spans.map((span) => {
                  const isChat = span.name.startsWith("chat ");
                  const isTool = span.name.startsWith("execute_tool ");
                  const isOpen = expanded.has(span.spanId);
                  return (
                    <div className="border-border border-b" key={span.spanId}>
                      <button
                        className="hover:bg-accent/40 flex w-full items-center gap-2 px-4 py-2 text-left"
                        onClick={() => toggle(span.spanId)}
                        type="button"
                      >
                        <ChevronDownIcon
                          className={cn("size-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")}
                        />
                        <Badge variant={isChat ? "default" : "outline"}>
                          {isChat ? span.attrs["gen_ai.request.model"]?.toString().split("-").slice(0, 2).join("-") ?? "model" : isTool ? "tool" : "step"}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">
                          {isTool
                            ? span.attrs["gen_ai.tool.name"]?.toString() ?? span.name
                            : span.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                          {formatDurationNs(span.startNs, span.endNs)}
                        </span>
                      </button>
                      {isOpen && isChat ? <ChatSpanDetail span={span} /> : null}
                      {isOpen && isTool ? <ToolSpanDetail span={span} /> : null}
                      {isOpen && !isChat && !isTool ? (
                        <div className="px-4 py-2">
                          <TextBlock text={JSON.stringify(span.attrs, null, 2)} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
