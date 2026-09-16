<script>
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { onMount } from "svelte";

let sessions = $state([]);
let activeId = $state(null);
let rawEvents = $state({}); // sessionId -> array of raw pi events
let messages = $state({}); // sessionId -> derived chat bubbles
let draft = $state({}); // sessionId -> in-progress assistant text
let input = $state("");
let cwdInput = $state("");
let error = $state("");
let streaming = $state({}); // sessionId -> bool

function ensureSession(id) {
  if (!rawEvents[id]) rawEvents[id] = [];
  if (!messages[id]) messages[id] = [];
  if (!draft[id]) draft[id] = "";
}

function applyEvent(sessionId, ev) {
  ensureSession(sessionId);
  rawEvents[sessionId].push(ev);
  const t = ev?.type;

  if (t === "agent_start" || t === "turn_start" || t === "message_start") {
    streaming[sessionId] = true;
  }
  if (t === "agent_end" || t === "agent_settled" || t === "turn_end") {
    streaming[sessionId] = false;
  }
  if (t === "message_end") {
    if (draft[sessionId]) {
      messages[sessionId].push({ role: "assistant", text: draft[sessionId] });
      draft[sessionId] = "";
    }
    streaming[sessionId] = false;
  }
  if (t === "message_update") {
    const inner = ev.assistantMessageEvent ?? ev.messageEvent ?? {};
    const kind = inner.type ?? "";
    if (kind === "text_delta" && typeof inner.delta === "string") {
      draft[sessionId] += inner.delta;
    } else if (kind === "text" && typeof inner.text === "string") {
      draft[sessionId] += inner.text;
    } else if (inner.text && typeof inner.text === "string") {
      draft[sessionId] += inner.text;
    }
  }
  if (t === "tool_execution_start") {
    const name = ev.toolName ?? ev.tool ?? "tool";
    messages[sessionId].push({ role: "tool", text: `▶ ${name}` });
  }
  if (t === "tool_execution_end") {
    const name = ev.toolName ?? ev.tool ?? "tool";
    messages[sessionId].push({ role: "tool", text: `✔ ${name} done` });
  }
  if (t === "bash_execution_update" && ev.output) {
    messages[sessionId].push({ role: "tool", text: "$ " + String(ev.output).slice(0, 500) });
  }
  if (t === "response" && ev.success === false) {
    messages[sessionId].push({ role: "system", text: "RPC error: " + JSON.stringify(ev) });
  }
  if (t === "error" || t === "agent_error") {
    messages[sessionId].push({ role: "system", text: "Error: " + (ev.message ?? JSON.stringify(ev)) });
  }
}

async function refreshSessions() {
  try {
    sessions = await invoke("list_sessions");
    for (const s of sessions) ensureSession(s.id);
    if (!activeId && sessions.length > 0) activeId = sessions[0].id;
  } catch (e) {
    error = String(e);
  }
}

async function createSession() {
  error = "";
  try {
    const id = await invoke("create_session", { cwd: cwdInput.trim() || null });
    await refreshSessions();
    activeId = id;
    ensureSession(id);
  } catch (e) {
    error = String(e);
  }
}

async function selectSession(id) {
  activeId = id;
  ensureSession(id);
  // backfill anything missed while away
  try {
    const after = rawEvents[id].length;
    const evs = await invoke("get_events", { sessionId: id, after });
    for (const ev of evs) applyEvent(id, ev);
  } catch (e) {
    error = String(e);
  }
}

async function send() {
  const text = input.trim();
  if (!text || !activeId) return;
  error = "";
  messages[activeId].push({ role: "user", text });
  input = "";
  try {
    if (streaming[activeId]) {
      await invoke("send_steer", { sessionId: activeId, message: text });
    } else {
      await invoke("send_prompt", { sessionId: activeId, message: text });
    }
  } catch (e) {
    error = String(e);
  }
}

async function abort() {
  if (!activeId) return;
  try {
    await invoke("abort_session", { sessionId: activeId });
  } catch (e) {
    error = String(e);
  }
}

async function destroy() {
  if (!activeId) return;
  const id = activeId;
  try {
    await invoke("destroy_session", { sessionId: id });
    delete rawEvents[id];
    delete messages[id];
    activeId = null;
    await refreshSessions();
  } catch (e) {
    error = String(e);
  }
}

onMount(async () => {
  await refreshSessions();
  await listen("pi-event", (e) => {
    const { session_id, event } = e.payload;
    applyEvent(session_id, event);
  });
});
</script>

<div class="flex h-full bg-zinc-950 text-zinc-100 dark">
  <aside class="flex w-72 flex-col gap-3 border-r border-zinc-800 bg-zinc-900 p-3">
    <h1 class="text-xl font-bold tracking-widest">darwin</h1>
    <div class="flex gap-2">
      <input
        placeholder="cwd (optional)"
        bind:value={cwdInput}
        class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <button
        onclick={createSession}
        class="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm hover:bg-zinc-700"
      >+ session</button>
    </div>
    <div class="flex flex-col gap-1.5 overflow-y-auto">
      {#each sessions as s}
        <button
          onclick={() => selectSession(s.id)}
          class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-zinc-800 {s.id === activeId ? 'border-blue-500' : 'border-zinc-700 bg-zinc-900'}"
        >
          <span class="h-2 w-2 shrink-0 rounded-full {s.alive ? 'bg-green-400' : 'bg-zinc-600'}"></span>
          <span class="font-mono text-xs">{s.id}</span>
          <span class="truncate text-[11px] opacity-60">{s.cwd}</span>
        </button>
      {/each}
      {#if sessions.length === 0}
        <p class="text-[13px] opacity-60">No sessions yet. Create one to spawn <code class="font-mono">pi --mode rpc</code>.</p>
      {/if}
    </div>
    {#if error}<pre class="whitespace-pre-wrap text-xs text-red-400">{error}</pre>{/if}
  </aside>

  <main class="flex flex-1 flex-col">
    {#if !activeId}
      <p class="p-4 text-sm opacity-60">Create or pick a session to chat with pi.</p>
    {:else}
      <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {#each messages[activeId] ?? [] as m}
          {#if m.role === 'user'}
            <div class="max-w-[75ch] self-end rounded-xl bg-blue-900 px-3 py-2 text-sm whitespace-pre-wrap">{m.text}</div>
          {:else if m.role === 'tool'}
            <div class="self-start font-mono text-xs opacity-75">{m.text}</div>
          {:else if m.role === 'system'}
            <div class="self-center text-xs text-red-300">{m.text}</div>
          {:else}
            <div class="max-w-[75ch] self-start rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm whitespace-pre-wrap">{m.text}</div>
          {/if}
        {/each}
        {#if draft[activeId]}
          <div class="max-w-[75ch] self-start rounded-xl border border-blue-500 bg-zinc-900 px-3 py-2 text-sm whitespace-pre-wrap">{draft[activeId]}▍</div>
        {/if}
      </div>
      <div class="flex gap-2 border-t border-zinc-800 p-3">
        <input
          placeholder={streaming[activeId] ? "Agent running — Enter steers it…" : "Message pi…"}
          bind:value={input}
          onkeydown={(e) => e.key === "Enter" && send()}
          class="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />
        <button onclick={send} class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Send</button>
        {#if streaming[activeId]}
          <button onclick={abort} class="rounded-md border border-red-900 bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Abort</button>
        {/if}
        <button onclick={destroy} title="Kill pi child" class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm opacity-60 hover:bg-zinc-700">✕</button>
      </div>
    {/if}
  </main>
</div>
