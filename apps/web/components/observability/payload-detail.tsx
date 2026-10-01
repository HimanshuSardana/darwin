"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDurationNs,
  formatTokens,
  parseJson,
  type TraceSpan,
} from "@/lib/observability";
import { cn } from "@/lib/utils";

export function TextBlock({ text }: { readonly text: unknown }) {
  const body = typeof text === "string" ? text : JSON.stringify(text, null, 2) ?? "(empty)";
  const [expanded, setExpanded] = useState(false);
  const limit = 1200;
  if (body.length <= limit) {
    return <pre className="whitespace-pre-wrap font-mono text-xs break-words">{body}</pre>;
  }
  return (
    <div>
      <pre className="whitespace-pre-wrap font-mono text-xs break-words">
        {expanded ? body : `${body.slice(0, limit)}…`}
      </pre>
      <button
        className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
        onClick={() => setExpanded((open) => !open)}
        type="button"
      >
        {expanded ? "Show less" : `Show all (${body.length.toLocaleString()} chars)`}
      </button>
    </div>
  );
}

export function MessageCard({ index, message }: { readonly index: number; readonly message: unknown }) {
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

export function ChatSpanDetail({ span }: { readonly span: TraceSpan }) {
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
      <Tabs defaultValue="messages">
        <TabsList className="gap-1 bg-transparent p-0">
          <TabsTrigger
            className="text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="messages"
          >
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger
            className="text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="system"
          >
            System
          </TabsTrigger>
          <TabsTrigger
            className="text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="output"
          >
            Output
          </TabsTrigger>
          <TabsTrigger
            className="text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="raw"
          >
            Raw
          </TabsTrigger>
        </TabsList>
        <TabsContent value="messages">
          <div className="flex flex-col gap-2">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-xs">No messages recorded.</p>
            ) : (
              messages.map((message, index) => (
                <MessageCard index={index} key={index} message={message} />
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="system">
          {typeof system === "string" ? (
            <TextBlock text={JSON.stringify(parseJson(system), null, 2)} />
          ) : (
            <p className="text-muted-foreground text-xs">No system instructions recorded.</p>
          )}
        </TabsContent>
        <TabsContent value="output">
          <TextBlock
            text={
              typeof span.attrs["ai.response.text"] === "string" &&
              !span.attrs["gen_ai.output.messages"]
                ? span.attrs["ai.response.text"]
                : JSON.stringify(output, null, 2)
            }
          />
        </TabsContent>
        <TabsContent value="raw">
          <TextBlock text={JSON.stringify(span.attrs, null, 2)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ToolSpanDetail({ span }: { readonly span: TraceSpan }) {
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
