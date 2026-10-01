"use client";

/** Shared observability client: types, fetchers, and formatters. */

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

export interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly traceId: string;
  readonly name: string;
  readonly startNs: number;
  readonly endNs: number;
  readonly attrs: Record<string, string | number>;
}

export interface ModelCallSummary {
  readonly traceId: string;
  readonly spanId: string;
  readonly title: string | null;
  readonly sessionId: string | null;
  readonly model: string | null;
  readonly startNs: number;
  readonly endNs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly finishReason: string | null;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

export function fetchTraces(): Promise<{ traces: TraceSummary[] }> {
  return request("/api/observability/traces");
}

export function fetchTraceSpans(traceId: string): Promise<{ spans: TraceSpan[] }> {
  return request(`/api/observability/traces/${encodeURIComponent(traceId)}`);
}

export function fetchModelCalls(limit = 50): Promise<{ calls: ModelCallSummary[] }> {
  return request(`/api/observability/calls?limit=${limit}`);
}

export function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

export function formatDurationNs(startNs: number, endNs: number): string {
  const ms = Math.max(0, Math.round((endNs - startNs) / 1_000_000));
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function formatTime(ns: number): string {
  if (!ns) return "—";
  return new Date(ns / 1_000_000).toLocaleString();
}

export function parseJson(value: string | number | undefined): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
