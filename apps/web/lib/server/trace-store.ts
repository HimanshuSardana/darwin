import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly traceId: string;
  readonly name: string;
  readonly startNs: number;
  readonly endNs: number;
  readonly attrs: Record<string, string | number>;
}

export interface TraceSummary {
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

function tracesDir(): string {
  return (
    process.env.EVE_TRACES_DIR ?? join(process.cwd(), ".eve", "traces", "v1")
  );
}

function attrValue(value: unknown): string | number | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["stringValue", "intValue", "doubleValue", "boolValue"]) {
    const entry = record[key];
    if (typeof entry === "string" || typeof entry === "number") return entry;
    if (typeof entry === "boolean") return entry ? 1 : 0;
  }
  if (Array.isArray(record.arrayValue)) return JSON.stringify(record.arrayValue);
  if (typeof record.kvlistValue === "object") return JSON.stringify(record.kvlistValue);
  return null;
}

function parseSpans(traceId: string, doc: unknown): TraceSpan[] {
  const out: TraceSpan[] = [];
  const root = (doc as { resourceSpans?: unknown[] })?.resourceSpans;
  if (!Array.isArray(root)) return out;
  for (const resource of root) {
    const scopes = (resource as { scopeSpans?: unknown[] })?.scopeSpans;
    if (!Array.isArray(scopes)) continue;
    for (const scope of scopes) {
      const spans = (scope as { spans?: unknown[] })?.spans;
      if (!Array.isArray(spans)) continue;
      for (const raw of spans) {
        const span = raw as {
          spanId?: string;
          parentSpanId?: string;
          name?: string;
          startTimeUnixNano?: string;
          endTimeUnixNano?: string;
          attributes?: { key?: string; value?: unknown }[];
        };
        if (!span.spanId || !span.name) continue;
        const attrs: Record<string, string | number> = {};
        for (const attr of span.attributes ?? []) {
          if (!attr.key) continue;
          const value = attrValue(attr.value);
          if (value !== null) attrs[attr.key] = value;
        }
        out.push({
          spanId: span.spanId,
          parentSpanId: span.parentSpanId ?? null,
          traceId,
          name: span.name,
          startNs: Number(span.startTimeUnixNano ?? 0),
          endNs: Number(span.endTimeUnixNano ?? 0),
          attrs,
        });
      }
    }
  }
  return out;
}

async function readTraceSpans(id: string): Promise<TraceSpan[]> {
  const segments = join(tracesDir(), id, "segments");
  let files: string[];
  try {
    files = (await readdir(segments)).filter((file) => file.endsWith(".otlp.json"));
  } catch {
    return [];
  }
  const spans: TraceSpan[] = [];
  for (const file of files) {
    try {
      const doc = JSON.parse(await readFile(join(segments, file), "utf8")) as unknown;
      spans.push(...parseSpans(id, doc));
    } catch {
      // Skip unreadable segments; traces are best-effort diagnostics.
    }
  }
  return spans.sort((a, b) => a.startNs - b.startNs);
}

function summarize(id: string, spans: TraceSpan[]): TraceSummary | null {
  if (spans.length === 0) return null;
  let title: string | null = null;
  let sessionId: string | null = null;
  let modelCalls = 0;
  let toolCalls = 0;
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const span of spans) {
    sessionId ??= span.attrs["agent.run.id"]?.toString() ?? span.attrs["gen_ai.conversation.id"]?.toString() ?? null;
    if (typeof span.attrs["agent.session.title"] === "string") {
      title ??= span.attrs["agent.session.title"];
    }
    if (span.name.startsWith("chat ")) modelCalls += 1;
    else if (span.name.startsWith("execute_tool ")) toolCalls += 1;
    else if (span.name === "agent.step") steps += 1;
    // Sum usage once per model call (agent.* and gen_ai.* mirror each other).
    if (span.name.startsWith("chat ")) {
      const input = span.attrs["gen_ai.usage.input_tokens"];
      const output = span.attrs["gen_ai.usage.output_tokens"];
      if (typeof input === "number") inputTokens += input;
      if (typeof output === "number") outputTokens += output;
    }
  }
  return {
    id,
    title,
    sessionId,
    startNs: spans[0].startNs,
    endNs: spans.reduce((max, span) => Math.max(max, span.endNs), 0),
    modelCalls,
    toolCalls,
    steps,
    inputTokens,
    outputTokens,
    spans: spans.length,
  };
}

// Tiny in-memory cache: traces only grow, so a short TTL keeps the list fast.
let cache: { at: number; summaries: TraceSummary[] } | null = null;
const CACHE_TTL_MS = 5000;

export async function listTraces(): Promise<TraceSummary[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.summaries;
  let ids: string[];
  try {
    const entries = await readdir(tracesDir(), { withFileTypes: true });
    ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
  // Newest activity first: rank by directory mtime before parsing bodies.
  const ranked = await Promise.all(
    ids.map(async (id) => {
      try {
        const info = await stat(join(tracesDir(), id));
        return { id, mtime: info.mtimeMs };
      } catch {
        return { id, mtime: 0 };
      }
    }),
  );
  ranked.sort((a, b) => b.mtime - a.mtime);
  const summaries: TraceSummary[] = [];
  for (const { id } of ranked.slice(0, 100)) {
    const summary = summarize(id, await readTraceSpans(id));
    if (summary) summaries.push(summary);
  }
  cache = { at: Date.now(), summaries };
  return summaries;
}

export async function getTrace(id: string): Promise<TraceSpan[] | null> {
  if (!/^[0-9a-f]{16,64}$/.test(id)) return null;
  const spans = await readTraceSpans(id);
  return spans.length > 0 ? spans : null;
}
