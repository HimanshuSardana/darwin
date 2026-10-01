"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { loadSessions } from "@/lib/sessions";
import { cn } from "@/lib/utils";

interface TraceSummary {
  readonly id: string;
  readonly title: string | null;
  readonly sessionId: string | null;
  readonly startNs: number;
  readonly endNs: number;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly steps: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly spans: number;
}

interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly traceId: string;
  readonly name: string;
  readonly startNs: number;
  readonly endNs: number;
  readonly attrs: Record<string, string | number>;
}

function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

function formatDurationNs(startNs: number, endNs: number): string {
  const ms = Math.max(0, Math.round((endNs - startNs) / 1_000_000));
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTime(ns: number): string {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString();
}

function parseJson(value: string | number | undefined): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function TextBlock({ text }: { readonly text: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 1200;
  if (text.length <= limit) {
    return <pre className="whitespace-pre-wrap font-mono text-xs break-words">{text}</pre>;
  }
  return (
    <div>
      <pre className="whitespace-pre-wrap font-mono text-xs break-words">
        {expanded ? text : `${text.slice(0, limit)}…`}
      </pre>
      <button
        className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
        onClick={() => setExpanded((open) => !open)}
        type="button"
      >
        {expanded ? "Show less" : `Show all (${text.length.toLocaleString()} chars)`}
      </button>
    </div>
  );
}

function MessageCard({ index, message }: { readonly index: number; readonly message: unknown }) {
  const [open, setOpen] = useState(index < 3);
  if (typeof message !== "object" || message === null) {
    return <TextBlock text={String(message)} />;
  }
  const record = message as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : null;
  const kind = typeof record.kind === "string" ? record.kind : null;
  const parts = Array.isArray(record.parts) ? record.parts : [];
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <button
        className="bg-muted/40 flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChevronDownIcon className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
        <span className="text-muted-foreground font-mono text-[11px]">#{index}</span>
        {role ? <Badge variant="outline">{role}</Badge> : null}
        {kind ? <span className="text-muted-foreground font-mono text-[11px]">{kind}</span> : null}
        <span className="text-muted-foreground ml-auto font-mono text-[11px]">
          {parts.length} part{parts.length === 1 ? "" : "s"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          {parts.map((part, partIndex) => {
            if (typeof part !== "object" || part === null) {
              return <TextBlock key={partIndex} text={String(part)} />;
            }
            const entry = part as Record<string, unknown>;
            const content = entry.content;
            return (
              <div key={partIndex}>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {typeof entry.type === "string" ? entry.type : "part"}:
                </span>
                <TextBlock
                  text={typeof content === "string" ? content : JSON.stringify(content, null, 2)}
                />
              </div>
            );
          })}
          {parts.length === 0 ? (
            <TextBlock text={JSON.stringify(record, null, 2)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChatSpanDetail({ span }: { readonly span: TraceSpan }) {
  const [tab, setTab] = useState<"messages" | "system" | "output" | "raw">("messages");
  const input = useMemo(
    () => parseJson(span.attrs["gen_ai.input.messages"]),
    [span.attrs],
  );
  const output = useMemo(
    () => parseJson(span.attrs["gen_ai.output.messages"]),
    [span.attrs],
  );
  const system =
    span.attrs["gen_ai.system_instructions"] ?? span.attrs["ai.prompt.system"];
  const messages = Array.isArray(input) ? input : [];
  const inputTokens = span.attrs["gen_ai.usage.input_tokens"] ?? span.attrs["agent.usage.input_tokens"];
  const outputTokens = span.attrs["gen_ai.usage.output_tokens"] ?? span.attrs["agent.usage.output_tokens"];
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{span.attrs["gen_ai.request.model"]?.toString() ?? "model"}</Badge>
        {typeof inputTokens === "number" ? (
          <span className="text-muted-foreground font-mono">↑ {formatTokens(inputTokens)}</span>
        ) : null}
        {typeof outputTokens === "number" ? (
          <span className="text-muted-foreground font-mono">↓ {formatTokens(outputTokens)}</span>
        ) : null}
        <span className="text-muted-foreground font-mono">
          {formatDurationNs(span.startNs, span.endNs)}
        </span>
        <span className="text-muted-foreground font-mono">
          finish: {span.attrs["ai.response.finish_reason"]?.toString() ?? "?"}
        </span>
      </div>
      <div className="border-border flex gap-1 border-b pb-2">
        {(["messages", "system", "output", "raw"] as const).map((entry) => (
          <button
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              tab === entry ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            key={entry}
            onClick={() => setTab(entry)}
            type="button"
          >
            {entry === "messages"
              ? `Messages (${messages.length})`
              : entry[0].toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </div>
      {tab === "messages" ? (
        <div className="flex flex-col gap-2">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-xs">No messages recorded.</p>
          ) : (
            messages.map((message, index) => (
              <MessageCard index={index} key={index} message={message} />
            ))
          )}
        </div>
      ) : null}
      {tab === "system" ? (
        typeof system === "string" ? (
          <TextBlock text={JSON.stringify(parseJson(system), null, 2)} />
        ) : (
          <p className="text-muted-foreground text-xs">No system instructions recorded.</p>
        )
      ) : null}
      {tab === "output" ? (
        <TextBlock
          text={
            typeof span.attrs["ai.response.text"] === "string" &&
            !span.attrs["gen_ai.output.messages"]
              ? span.attrs["ai.response.text"]
              : JSON.stringify(output, null, 2)
          }
        />
      ) : null}
      {tab === "raw" ? (
        <TextBlock text={JSON.stringify(span.attrs, null, 2)} />
      ) : null}
    </div>
  );
}

function ToolSpanDetail({ span }: { readonly span: TraceSpan }) {
  const args = parseJson(span.attrs["gen_ai.tool.call.arguments"]);
  const result = parseJson(span.attrs["gen_ai.tool.call.result"]);
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{span.attrs["gen_ai.tool.name"]?.toString() ?? span.name}</Badge>
        <span className="text-muted-foreground font-mono">
          {formatDurationNs(span.startNs, span.endNs)}
        </span>
      </div>
      <span className="text-muted-foreground text-xs font-medium">Arguments</span>
      <TextBlock text={JSON.stringify(args, null, 2)} />
      <span className="text-muted-foreground text-xs font-medium">Result</span>
      <TextBlock text={typeof result === "string" ? result : JSON.stringify(result, null, 2)} />
    </div>
  );
}

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
    void fetch("/api/observability/traces")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return (await response.json()) as { traces: TraceSummary[] };
      })
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
    void fetch(`/api/observability/traces/${encodeURIComponent(selectedId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return (await response.json()) as { spans: TraceSpan[] };
      })
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
