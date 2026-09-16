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
let models = $state({}); // sessionId -> [{id, name, provider, ...}]
let currentModel = $state({}); // sessionId -> {id, name, provider} | null
let pickerOpen = $state(false);
let modelSearch = $state("");
let modelsLoading = $state({}); // sessionId -> bool

function ensureSession(id) {
  if (!rawEvents[id]) rawEvents[id] = [];
  if (!messages[id]) messages[id] = [];
  if (!draft[id]) draft[id] = "";
  if (!models[id]) models[id] = [];
  if (!(id in currentModel)) currentModel[id] = null;
}

function modelLabel(id) {
  const m = currentModel[id];
  if (!m) return "select model";
  return `${m.provider}/${m.name ?? m.id}`;
}

function filteredModels(id) {
  const q = modelSearch.trim().toLowerCase();
  const list = models[id] ?? [];
  if (!q) return list;
  return list.filter((m) =>
    `${m.provider} ${m.name ?? ""} ${m.id}`.toLowerCase().includes(q),
  );
}

function groupedModels(id) {
  const groups = {};
  for (const m of filteredModels(id)) {
    const p = m.provider ?? "other";
    if (!groups[p]) groups[p] = [];
    groups[p].push(m);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

async function refreshModels(id) {
  modelsLoading[id] = true;
  try {
    await invoke("request_state", { sessionId: id });
    await invoke("request_models", { sessionId: id });
  } catch (e) {
    error = String(e);
  }
}

async function pickModel(provider, modelId) {
  if (!activeId) return;
  error = "";
  try {
    await invoke("set_model", { sessionId: activeId, provider, modelId });
    pickerOpen = false;
    modelSearch = "";
  } catch (e) {
    error = String(e);
  }
}

async function cycleModelClick() {
  if (!activeId) return;
  try {
    await invoke("cycle_model", { sessionId: activeId });
  } catch (e) {
    error = String(e);
  }
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
  if (t === "response" && ev.command === "get_available_models" && ev.success) {
    models[sessionId] = ev.data?.models ?? [];
    modelsLoading[sessionId] = false;
  }
  if (t === "response" && ev.command === "get_state" && ev.success) {
    currentModel[sessionId] = ev.data?.model ?? null;
  }
  if (t === "response" && ev.command === "set_model" && ev.success) {
    currentModel[sessionId] = ev.data ?? null;
  }
  if (t === "response" && ev.command === "cycle_model" && ev.success) {
    if (ev.data?.model) currentModel[sessionId] = ev.data.model;
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
    refreshModels(id);
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
    // re-query model state in case the child restarted or state changed
    if (currentModel[id] === null && (models[id] ?? []).length === 0) refreshModels(id);
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
    delete models[id];
    delete currentModel[id];
    pickerOpen = false;
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
      <div class="relative flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <button
          onclick={() => { pickerOpen = !pickerOpen; if (pickerOpen) refreshModels(activeId); }}
          class="flex max-w-md items-center gap-2 truncate rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs hover:bg-zinc-800"
          title="Pick model"
        >
          <span class="truncate font-mono">{modelLabel(activeId)}</span>
          <span class="opacity-60">▾</span>
        </button>
        <button
          onclick={cycleModelClick}
          title="Cycle to next model"
          class="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs hover:bg-zinc-800"
        >⇄</button>
        {#if modelsLoading[activeId]}<span class="text-xs opacity-50">loading…</span>{/if}
        {#if pickerOpen}
          <div class="absolute top-full left-2 z-20 mt-1 flex max-h-96 w-96 flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
            <input
              placeholder="Search models…"
              bind:value={modelSearch}
              class="border-b border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div class="overflow-y-auto p-1">
              {#each groupedModels(activeId) as [provider, list]}
                <p class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{provider}</p>
                {#each list as m}
                  <button
                    onclick={() => pickModel(m.provider, m.id)}
                    class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-800 {currentModel[activeId]?.id === m.id && currentModel[activeId]?.provider === m.provider ? 'bg-zinc-800 ring-1 ring-blue-500' : ''}"
                  >
                    <span class="truncate">{m.name ?? m.id}</span>
                    {#if m.reasoning}<span class="shrink-0 rounded bg-purple-900 px-1.5 py-0.5 text-[10px] text-purple-200">reasoning</span>{/if}
                  </button>
                {/each}
              {/each}
              {#if filteredModels(activeId).length === 0}
                <p class="p-3 text-sm opacity-60">{(models[activeId] ?? []).length === 0 ? "No models loaded yet — waiting on pi…" : "No matches."}</p>
              {/if}
            </div>
          </div>
        {/if}
      </div>
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
