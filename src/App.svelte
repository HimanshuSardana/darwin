<script>
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMount } from "svelte";
import Markdown from "./lib/Markdown.svelte";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Loader2,
  Minus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Square,
  X,
} from "lucide-svelte";

const appWindow = getCurrentWindow();

let sessions = $state([]);
let activeId = $state(null);
let rawEvents = $state({}); // sessionId -> raw pi events
let messages = $state({}); // sessionId -> thread items
let draft = $state({}); // sessionId -> in-progress assistant text
let titles = $state({}); // sessionId -> title
let turnStartAt = $state({}); // sessionId -> ms timestamp
let input = $state("");
let error = $state("");
let streaming = $state({}); // sessionId -> bool

// model + thinking state
let models = $state({}); // sessionId -> [{id, name, provider, reasoning}]
let currentModel = $state({}); // sessionId -> {id, name, provider} | null
let thinkingLevels = $state({}); // sessionId -> string[]
let thinkingLevel = $state({}); // sessionId -> string | null
let pendingThinking = $state({}); // sessionId -> level sent, awaiting confirm
let modelPickerOpen = $state(false);
let thinkingPickerOpen = $state(false);
let modelSearch = $state("");
let modelsLoading = $state({});

// sidebar state
let sidebarHidden = $state(false);
let searchOpen = $state(false);
let searchQuery = $state("");
let newOpen = $state(false);
let newCwd = $state("");
let backStack = $state([]);
let fwdStack = $state([]);

// header / settings state
let menuOpen = $state(false);
let renaming = $state(false);
let renameValue = $state("");
let settingsOpen = $state(false);
let appInfo = $state(null);

let composerEl = $state(null);

function ensureSession(id) {
  if (!rawEvents[id]) rawEvents[id] = [];
  if (!messages[id]) messages[id] = [];
  if (!draft[id]) draft[id] = "";
  if (!models[id]) models[id] = [];
  if (!(id in currentModel)) currentModel[id] = null;
  if (!thinkingLevels[id]) thinkingLevels[id] = [];
  if (!(id in thinkingLevel)) thinkingLevel[id] = null;
}

function fmtElapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `Worked for ${s}s`;
  const m = Math.floor(s / 60);
  return `Worked for ${m}m ${s % 60}s`;
}

function relTime(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function projectOf(s) {
  const parts = (s.cwd ?? "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "local";
}

function sessionTitle(id) {
  if (titles[id]) return titles[id];
  const first = (messages[id] ?? []).find((m) => m.role === "user");
  if (first) return first.text.slice(0, 42);
  return "New thread";
}

function groupedSessions() {
  const q = searchQuery.trim().toLowerCase();
  const groups = new Map();
  for (const s of sessions) {
    const title = sessionTitle(s.id);
    if (
      q &&
      !`${title} ${s.cwd ?? ""}`.toLowerCase().includes(q)
    )
      continue;
    const p = projectOf(s);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(s);
  }
  return [...groups.entries()];
}

function modelLabel(id) {
  const m = currentModel[id];
  if (!m) return "Model";
  return m.name ?? m.id;
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

function applyEvent(sessionId, ev) {
  ensureSession(sessionId);
  rawEvents[sessionId].push(ev);
  const t = ev?.type;

  if (t === "agent_start" || t === "turn_start") {
    streaming[sessionId] = true;
    if (turnStartAt[sessionId] == null) turnStartAt[sessionId] = Date.now();
  }
  if (t === "message_start") streaming[sessionId] = true;
  if (t === "turn_end" || t === "agent_end" || t === "agent_settled") {
    streaming[sessionId] = false;
    if (draft[sessionId]) {
      messages[sessionId].push({ role: "assistant", text: draft[sessionId] });
      draft[sessionId] = "";
    }
    if (turnStartAt[sessionId] != null) {
      messages[sessionId].push({
        role: "work",
        text: fmtElapsed(Date.now() - turnStartAt[sessionId]),
      });
      turnStartAt[sessionId] = null;
    }
  }
  if (t === "message_end") {
    if (draft[sessionId]) {
      messages[sessionId].push({ role: "assistant", text: draft[sessionId] });
      draft[sessionId] = "";
    }
  }
  if (t === "message_update") {
    const inner = ev.assistantMessageEvent ?? ev.messageEvent ?? {};
    const kind = inner.type ?? "";
    if (kind === "text_delta" && typeof inner.delta === "string") {
      draft[sessionId] += inner.delta;
    } else if (typeof inner.text === "string") {
      draft[sessionId] += inner.text;
    }
  }
  if (t === "tool_execution_start") {
    messages[sessionId].push({
      role: "tool",
      tool: ev.toolName ?? ev.tool ?? "tool",
      phase: "start",
    });
  }
  if (t === "tool_execution_end") {
    messages[sessionId].push({
      role: "tool",
      tool: ev.toolName ?? ev.tool ?? "tool",
      phase: "end",
      isError: ev.isError ?? false,
    });
  }
  if (t === "bash_execution_update" && ev.output) {
    messages[sessionId].push({
      role: "bash",
      text: String(ev.output),
    });
  }
  if (t === "response" && ev.command === "get_available_models" && ev.success) {
    models[sessionId] = ev.data?.models ?? [];
    modelsLoading[sessionId] = false;
  }
  if (t === "response" && ev.command === "get_state" && ev.success) {
    currentModel[sessionId] = ev.data?.model ?? null;
    if (ev.data?.thinkingLevel != null)
      thinkingLevel[sessionId] = ev.data.thinkingLevel;
  }
  if (t === "response" && ev.command === "set_model" && ev.success) {
    currentModel[sessionId] = ev.data ?? null;
  }
  if (t === "response" && ev.command === "cycle_model" && ev.success) {
    if (ev.data?.model) currentModel[sessionId] = ev.data.model;
  }
  if (
    t === "response" &&
    ev.command === "get_available_thinking_levels" &&
    ev.success
  ) {
    thinkingLevels[sessionId] = ev.data?.levels ?? [];
  }
  if (t === "response" && ev.command === "set_thinking_level") {
    if (ev.success && pendingThinking[sessionId] != null) {
      thinkingLevel[sessionId] = pendingThinking[sessionId];
      pendingThinking[sessionId] = null;
    }
  }
  if (t === "response" && ev.success === false) {
    messages[sessionId].push({
      role: "system",
      text: "RPC error: " + JSON.stringify(ev),
    });
  }
  if (t === "error" || t === "agent_error") {
    messages[sessionId].push({
      role: "system",
      text: "Error: " + (ev.message ?? JSON.stringify(ev)),
    });
    streaming[sessionId] = false;
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

async function refreshMeta(id) {
  modelsLoading[id] = true;
  try {
    await invoke("request_state", { sessionId: id });
    await invoke("request_models", { sessionId: id });
    await invoke("request_thinking_levels", { sessionId: id });
  } catch (e) {
    error = String(e);
  }
}

async function createSession(cwd) {
  error = "";
  try {
    const id = await invoke("create_session", { cwd: cwd?.trim() || null });
    await refreshSessions();
    backStack.push(activeId);
    fwdStack = [];
    activeId = id;
    ensureSession(id);
    newOpen = false;
    newCwd = "";
    refreshMeta(id);
  } catch (e) {
    error = String(e);
  }
}

async function selectSession(id, push = true) {
  if (push && activeId && activeId !== id) {
    backStack.push(activeId);
    fwdStack = [];
  }
  activeId = id;
  ensureSession(id);
  modelPickerOpen = false;
  thinkingPickerOpen = false;
  menuOpen = false;
  renaming = false;
  try {
    const after = rawEvents[id].length;
    const evs = await invoke("get_events", { sessionId: id, after });
    for (const ev of evs) applyEvent(id, ev);
    if (currentModel[id] === null && (models[id] ?? []).length === 0)
      refreshMeta(id);
  } catch (e) {
    error = String(e);
  }
}

function goBack() {
  while (backStack.length) {
    const id = backStack.pop();
    if (id && sessions.some((s) => s.id === id)) {
      fwdStack.push(activeId);
      selectSession(id, false);
      return;
    }
  }
}

function goFwd() {
  while (fwdStack.length) {
    const id = fwdStack.pop();
    if (id && sessions.some((s) => s.id === id)) {
      backStack.push(activeId);
      selectSession(id, false);
      return;
    }
  }
}

function autoresize() {
  if (!composerEl) return;
  composerEl.style.height = "auto";
  composerEl.style.height = Math.min(composerEl.scrollHeight, 200) + "px";
}

async function send() {
  const text = input.trim();
  if (!text || !activeId) return;
  error = "";
  const isFirst = !(messages[activeId] ?? []).some((m) => m.role === "user");
  messages[activeId].push({ role: "user", text });
  if (isFirst && !titles[activeId]) titles[activeId] = text.slice(0, 42);
  input = "";
  if (composerEl) composerEl.style.height = "auto";
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
    delete titles[id];
    menuOpen = false;
    backStack = backStack.filter((x) => x !== id);
    fwdStack = fwdStack.filter((x) => x !== id);
    activeId = null;
    await refreshSessions();
  } catch (e) {
    error = String(e);
  }
}

async function pickModel(provider, modelId) {
  if (!activeId) return;
  try {
    await invoke("set_model", { sessionId: activeId, provider, modelId });
    modelPickerOpen = false;
    modelSearch = "";
  } catch (e) {
    error = String(e);
  }
}

async function pickThinking(level) {
  if (!activeId) return;
  pendingThinking[activeId] = level;
  thinkingPickerOpen = false;
  try {
    await invoke("set_thinking_level", { sessionId: activeId, level });
  } catch (e) {
    error = String(e);
  }
}

async function openSettings() {
  try {
    appInfo = await invoke("app_info");
  } catch (e) {
    error = String(e);
  }
  settingsOpen = true;
}

async function winMin() {
  await appWindow.minimize();
}
async function winMax() {
  await appWindow.toggleMaximize();
}
async function winClose() {
  await appWindow.close();
}

onMount(async () => {
  await refreshSessions();
  if (activeId) refreshMeta(activeId);
  await listen("pi-event", (e) => {
    const { session_id, event } = e.payload;
    applyEvent(session_id, event);
  });
});
</script>

<div class="flex h-full bg-black text-zinc-100">
  <!-- sidebar -->
  {#if !sidebarHidden}
    <aside class="flex w-[300px] shrink-0 flex-col border-r border-zinc-800/70 bg-[#0c0c0e]">
      <div data-tauri-drag-region class="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <button onclick={winClose} title="Close" class="rounded p-1.5 hover:bg-zinc-800">
          <span class="block h-2.5 w-2.5 rounded-full bg-zinc-700"></span>
        </button>
        <button onclick={winMin} title="Minimize" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><Minus size={14} /></button>
        <button onclick={winMax} title="Maximize" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><Square size={12} /></button>
        <span class="w-1"></span>
        <button onclick={() => (sidebarHidden = true)} title="Hide sidebar" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><PanelLeftClose size={16} /></button>
        <button onclick={goBack} title="Back" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><ArrowLeft size={16} /></button>
        <button onclick={goFwd} title="Forward" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><ArrowRight size={16} /></button>
      </div>

      <div class="flex flex-col gap-0.5 px-3 pt-2">
        <button
          onclick={() => { newOpen = !newOpen; }}
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[15px] hover:bg-zinc-800/70"
        >
          <span class="flex items-center gap-2.5"><Folder size={16} class="text-zinc-400" /> New thread</span>
        </button>
        {#if newOpen}
          <div class="flex flex-col gap-2 rounded-lg bg-zinc-900 p-2.5">
            <input
              placeholder="Working dir (optional)"
              bind:value={newCwd}
              onkeydown={(e) => e.key === "Enter" && createSession(newCwd)}
              class="rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            />
            <div class="flex gap-2">
              <button onclick={() => createSession(newCwd)} class="flex-1 rounded-md bg-zinc-100 px-2 py-1.5 text-sm font-medium text-black hover:bg-white">Create</button>
              <button onclick={() => (newOpen = false)} class="rounded-md border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800">Cancel</button>
            </div>
          </div>
        {/if}
        <button
          onclick={() => { searchOpen = !searchOpen; searchQuery = ""; }}
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[15px] hover:bg-zinc-800/70"
        >
          <span class="flex items-center gap-2.5"><Search size={16} class="text-zinc-400" /> Search</span>
        </button>
        {#if searchOpen}
          <input
            placeholder="Filter threads…"
            bind:value={searchQuery}
            class="mx-0.5 rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        {/if}
      </div>

      <div class="mt-3 flex-1 overflow-y-auto px-3 pb-2">
        {#if groupedSessions().length}
          <p class="px-2.5 pt-3 pb-1 text-[15px] text-zinc-400">Projects</p>
        {/if}
        {#each groupedSessions() as [project, list]}
          <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[15px]">
            <span class="flex items-center gap-2.5"><Folder size={16} class="text-zinc-400" /> {project}</span>
            <span class="text-zinc-600"><Pencil size={13} /></span>
          </div>
          {#each list as s}
            <button
              onclick={() => selectSession(s.id)}
              class="mt-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[15px] hover:bg-zinc-800/70 {s.id === activeId ? 'bg-zinc-800/80' : ''}"
            >
              <span class="flex items-center gap-2 truncate"><span class={s.alive ? "h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" : "h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600"}></span><span class="truncate">{sessionTitle(s.id)}</span></span>
              <span class="shrink-0 text-[13px] text-zinc-500">{relTime(s.created_at)}</span>
            </button>
          {/each}
        {/each}
        {#if sessions.length === 0}
          <p class="px-2.5 pt-4 text-sm text-zinc-500">No threads yet. Start one above.</p>
        {/if}
      </div>

      {#if error}<pre class="max-h-24 overflow-y-auto px-5 pb-1 text-xs whitespace-pre-wrap text-red-400">{error}</pre>{/if}

      <div class="p-3">
        <button onclick={openSettings} class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[15px] hover:bg-zinc-800/70">
          <span class="flex items-center gap-2.5"><Settings size={16} class="text-zinc-400" /> Settings</span>
        </button>
      </div>
    </aside>
  {/if}

  <!-- main -->
  <main class="flex min-w-0 flex-1 flex-col">
    {#if sidebarHidden}
      <div data-tauri-drag-region class="flex items-center gap-1 px-3 pt-3">
        <button onclick={() => (sidebarHidden = false)} title="Show sidebar" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><PanelLeftOpen size={16} /></button>
        <button onclick={winMin} title="Minimize" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><Minus size={14} /></button>
        <button onclick={winMax} title="Maximize" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><Square size={12} /></button>
        <button onclick={winClose} title="Close" class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><X size={16} /></button>
      </div>
    {/if}

    {#if !activeId}
      <div class="flex flex-1 items-center justify-center">
        <p class="text-[15px] text-zinc-500">Create a thread to chat with pi.</p>
      </div>
    {:else}
      <div data-tauri-drag-region class="flex items-center justify-between border-b border-zinc-800/70 px-5 py-3">
        {#if renaming}
          <input
            bind:value={renameValue}
            onkeydown={(e) => {
              if (e.key === "Enter") { titles[activeId] = renameValue.trim() || sessionTitle(activeId); renaming = false; }
              if (e.key === "Escape") renaming = false;
            }}
            class="w-72 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[15px] outline-none focus:border-blue-500"
          />
        {:else}
          <h2 class="truncate text-[17px] font-medium">{sessionTitle(activeId)}</h2>
        {/if}
        <div class="relative">
          <button onclick={() => (menuOpen = !menuOpen)} class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><MoreHorizontal size={18} /></button>
          {#if menuOpen}
            <div class="absolute top-full right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-[#141416] shadow-xl">
              <button onclick={() => { renameValue = sessionTitle(activeId); renaming = true; menuOpen = false; }} class="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800">Rename</button>
              <button onclick={() => { menuOpen = false; abort(); }} class="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800">Abort run</button>
              <button onclick={destroy} class="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-zinc-800">Kill thread</button>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex flex-1 justify-center overflow-y-auto">
        <div class="flex w-full max-w-3xl flex-col gap-5 px-6 py-6">
          {#each messages[activeId] ?? [] as m}
            {#if m.role === "user"}
              <div class="max-w-[80%] self-end rounded-2xl bg-[#1e1e21] px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap">{m.text}</div>
            {:else if m.role === "assistant"}
              <Markdown source={m.text} />
            {:else if m.role === "tool"}
              <div class="flex items-center gap-2 font-mono text-xs text-zinc-500">
                {#if m.phase === "start"}
                  <Loader2 size={12} class="animate-spin text-zinc-500" />
                {:else if m.isError}
                  <X size={12} class="text-red-400" />
                {:else}
                  <Check size={12} class="text-emerald-400" />
                {/if}
                <span>{m.tool}</span>
              </div>
            {:else if m.role === "bash"}
              <pre class="overflow-x-auto rounded-lg border border-zinc-800 bg-[#0d0d0f] p-2.5 font-mono text-[11.5px] whitespace-pre-wrap text-zinc-400">{m.text}</pre>
            {:else if m.role === "work"}
              <details class="text-sm text-zinc-400">
                <summary class="flex cursor-pointer list-none items-center gap-1 hover:text-zinc-200">{m.text} <ChevronRight size={14} class="text-zinc-600" /></summary>
              </details>
            {:else}
              <div class="self-center text-xs text-red-300">{m.text}</div>
            {/if}
          {/each}
          {#if draft[activeId]}
            <Markdown source={draft[activeId]} streaming />
          {/if}
          {#if (messages[activeId] ?? []).length === 0 && !draft[activeId]}
            <p class="pt-10 text-center text-[15px] text-zinc-600">Ask pi to read, write, or run anything in this folder.</p>
          {/if}
        </div>
      </div>

      <div class="flex justify-center px-6 pb-5">
        <div class="w-full max-w-3xl rounded-2xl border border-zinc-700/60 bg-[#151517] px-4 pt-3 pb-2.5">
          <textarea
            bind:this={composerEl}
            rows={1}
            placeholder="Ask for follow-up changes"
            bind:value={input}
            oninput={autoresize}
            onkeydown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            class="max-h-[200px] w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-zinc-600"
          ></textarea>
          <div class="flex items-center justify-between pt-1.5">
            <button
              onclick={() => { const s = sessions.find((x) => x.id === activeId); createSession(s?.cwd); }}
              title="New thread in same folder"
              class="rounded-full p-1.5 text-xl leading-none text-zinc-300 hover:bg-zinc-700/60"
            ><Plus size={18} /></button>
            <div class="flex items-center gap-1.5">
              {#if streaming[activeId]}<Loader2 size={15} class="mr-1 animate-spin text-zinc-400" />{/if}
              <div class="relative">
                <button onclick={() => { modelPickerOpen = !modelPickerOpen; thinkingPickerOpen = false; if (modelPickerOpen) refreshMeta(activeId); }} class="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700/60">
                  {modelLabel(activeId)} <ChevronDown size={13} class="text-zinc-500" />
                </button>
                {#if modelPickerOpen}
                  <div class="absolute right-0 bottom-full z-30 mb-2 flex max-h-80 w-80 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-[#141416] shadow-xl">
                    <input placeholder="Search models…" bind:value={modelSearch} class="border-b border-zinc-700 bg-black px-3 py-2 text-sm outline-none" />
                    <div class="overflow-y-auto p-1">
                      {#each groupedModels(activeId) as [provider, list]}
                        <p class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{provider}</p>
                        {#each list as m}
                          <button onclick={() => pickModel(m.provider, m.id)} class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-800 {currentModel[activeId]?.id === m.id && currentModel[activeId]?.provider === m.provider ? 'bg-zinc-800 ring-1 ring-blue-500' : ''}">
                            <span class="truncate">{m.name ?? m.id}</span>
                            {#if m.reasoning}<span class="shrink-0 rounded bg-purple-900 px-1.5 py-0.5 text-[10px] text-purple-200">reasoning</span>{/if}
                          </button>
                        {/each}
                      {/each}
                      {#if filteredModels(activeId).length === 0}
                        <p class="p-3 text-sm text-zinc-500">{(models[activeId] ?? []).length === 0 ? "Waiting on pi…" : "No matches."}</p>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
              <div class="relative">
                <button onclick={() => { thinkingPickerOpen = !thinkingPickerOpen; modelPickerOpen = false; }} class="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700/60">
                  {(thinkingLevel[activeId] ?? "").charAt(0).toUpperCase() + (thinkingLevel[activeId] ?? "").slice(1) || "Level"} <ChevronDown size={13} class="text-zinc-500" />
                </button>
                {#if thinkingPickerOpen}
                  <div class="absolute right-0 bottom-full z-30 mb-2 w-36 overflow-hidden rounded-xl border border-zinc-700 bg-[#141416] p-1 shadow-xl">
                    {#each thinkingLevels[activeId].length ? thinkingLevels[activeId] : ["off", "minimal", "low", "medium", "high"] as lv}
                      <button onclick={() => pickThinking(lv)} class="block w-full rounded-md px-2 py-1.5 text-left text-sm capitalize hover:bg-zinc-800 {thinkingLevel[activeId] === lv ? 'bg-zinc-800 ring-1 ring-blue-500' : ''}">{lv}</button>
                    {/each}
                  </div>
                {/if}
              </div>
              {#if streaming[activeId]}
                <button onclick={abort} title="Stop" class="rounded-full bg-zinc-100 p-2.5 text-black hover:bg-white"><Square size={13} fill="currentColor" /></button>
              {:else}
                <button onclick={send} disabled={!input.trim()} title="Send" class="rounded-full bg-zinc-700/60 p-2.5 text-zinc-200 hover:bg-zinc-600 disabled:opacity-40"><Send size={15} /></button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

{#if settingsOpen}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
    <div class="w-96 rounded-2xl border border-zinc-700 bg-[#141416] p-5">
      <h3 class="mb-3 text-lg font-medium">Settings</h3>
      {#if appInfo}
        <dl class="flex flex-col gap-2 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-zinc-500">pi binary</dt><dd class="truncate font-mono text-xs">{appInfo.pi_bin}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-zinc-500">pi version</dt><dd class="font-mono text-xs">{appInfo.pi_version}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-zinc-500">sessions dir</dt><dd class="truncate font-mono text-xs">{appInfo.session_root}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-zinc-500">live sessions</dt><dd class="font-mono text-xs">{appInfo.sessions}</dd></div>
        </dl>
      {:else}
        <p class="text-sm text-zinc-500">Loading…</p>
      {/if}
      <button onclick={() => (settingsOpen = false)} class="mt-4 w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-black hover:bg-white">Close</button>
    </div>
  </div>
{/if}
