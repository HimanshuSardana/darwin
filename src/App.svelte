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
  Folder,
  FolderOpen,
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
  Sliders,
  Sparkles,
  Square,
  X,
} from "lucide-svelte";

const appWindow = getCurrentWindow();

let sessions = $state([]);
let activeId = $state(null);
let rawEvents = $state({});
let messages = $state({});
let draft = $state({});
let titles = $state({});
let turnStartAt = $state({});
let input = $state("");
let error = $state("");
let streaming = $state({});

let models = $state({});
let currentModel = $state({});
let thinkingLevels = $state({});
let thinkingLevel = $state({});
let pendingThinking = $state({});
let modelPickerOpen = $state(false);
let thinkingPickerOpen = $state(false);
let modelSearch = $state("");
let modelsLoading = $state({});

let sidebarHidden = $state(false);
let searchOpen = $state(false);
let searchQuery = $state("");
let newOpen = $state(false);
let newCwd = $state("");
let backStack = $state([]);
let fwdStack = $state([]);

let menuOpen = $state(false);
let renaming = $state(false);
let renameValue = $state("");
let settingsOpen = $state(false);
let appInfo = $state(null);

let composerEl = $state(null);
let threadEl = $state(null);
let pinnedToBottom = $state(true);

const MODELS_BY_PROVIDER = (list) => {
  const groups = {};
  for (const m of list) {
    const p = m.provider ?? "other";
    (groups[p] ??= []).push(m);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
};

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
  return `Worked for ${Math.floor(s / 60)}m ${s % 60}s`;
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
    if (q && !`${title} ${s.cwd ?? ""}`.toLowerCase().includes(q)) continue;
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

function applyEvent(sessionId, ev) {
  ensureSession(sessionId);
  rawEvents[sessionId].push(ev);
  const t = ev?.type;

  if (t === "agent_start" || t === "turn_start" || t === "message_start") {
    streaming[sessionId] = true;
    if (t === "turn_start" && turnStartAt[sessionId] == null)
      turnStartAt[sessionId] = Date.now();
  }
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
  if (t === "message_end" && draft[sessionId]) {
    messages[sessionId].push({ role: "assistant", text: draft[sessionId] });
    draft[sessionId] = "";
  }
  if (t === "message_update") {
    const inner = ev.assistantMessageEvent ?? ev.messageEvent ?? {};
    if (inner.type === "text_delta" && typeof inner.delta === "string") {
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
    messages[sessionId].push({ role: "bash", text: String(ev.output) });
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
    if (activeId) backStack.push(activeId);
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
  composerEl.style.height = Math.min(composerEl.scrollHeight, 220) + "px";
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
  pinnedToBottom = true;
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

const winMin = () => appWindow.minimize();
const winMax = () => appWindow.toggleMaximize();
const winClose = () => appWindow.close();

onMount(async () => {
  await refreshSessions();
  if (activeId) refreshMeta(activeId);
  await listen("pi-event", (e) => {
    const { session_id, event } = e.payload;
    applyEvent(session_id, event);
  });
});
</script>

<div class="flex h-full bg-canvas text-ink">
  <!-- ─────────── sidebar ─────────── -->
  {#if !sidebarHidden}
    <aside
      class="flex w-[284px] shrink-0 flex-col border-r border-line/70 bg-surface"
    >
      <div data-tauri-drag-region class="flex items-center gap-0.5 px-3 pt-3 pb-2">
        <button
          onclick={winClose}
          title="Close"
          class="group grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-surface-3"
        >
          <span class="h-2.5 w-2.5 rounded-full bg-line-strong transition-colors group-hover:bg-red-400"></span>
        </button>
        <button
          onclick={winMin}
          title="Minimize"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><Minus size={14} /></button>
        <button
          onclick={winMax}
          title="Maximize"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><Square size={11} /></button>
        <span class="mx-1 h-4 w-px bg-line"></span>
        <button
          onclick={() => (sidebarHidden = true)}
          title="Hide sidebar"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><PanelLeftClose size={15} /></button>
        <button
          onclick={goBack}
          title="Back"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><ArrowLeft size={15} /></button>
        <button
          onclick={goFwd}
          title="Forward"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><ArrowRight size={15} /></button>
      </div>

      <div class="flex flex-col gap-0.5 px-2.5 pt-1">
        <button
          onclick={() => { newOpen = !newOpen; searchOpen = false; }}
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
        ><Plus size={16} class="text-ink-faint" /> New thread</button>

        {#if newOpen}
          <div class="mb-1 flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
            <input
              placeholder="Working dir (optional)"
              bind:value={newCwd}
              onkeydown={(e) => e.key === "Enter" && createSession(newCwd)}
              class="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:border-accent"
            />
            <div class="flex gap-2">
              <button
                onclick={() => createSession(newCwd)}
                class="flex-1 rounded-lg bg-ink px-2 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-white"
              >Create</button>
              <button
                onclick={() => (newOpen = false)}
                class="rounded-lg border border-line px-2.5 py-1.5 text-[13px] text-ink-dim transition-colors hover:bg-surface-3"
              >Cancel</button>
            </div>
          </div>
        {/if}

        <button
          onclick={() => { searchOpen = !searchOpen; searchQuery = ""; newOpen = false; }}
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
        ><Search size={16} class="text-ink-faint" /> Search</button>

        {#if searchOpen}
          <input
            placeholder="Filter threads…"
            bind:value={searchQuery}
            class="mx-0.5 mb-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:border-accent"
          />
        {/if}
      </div>

      <div class="mt-3 flex-1 overflow-y-auto px-2.5 pb-2">
        {#if groupedSessions().length}
          <p class="px-2.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
            Projects
          </p>
        {/if}
        {#each groupedSessions() as [project, list]}
          <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink-dim">
            <span class="flex min-w-0 items-center gap-2.5">
              <FolderOpen size={15} class="shrink-0 text-ink-faint" />
              <span class="truncate">{project}</span>
            </span>
            <span class="shrink-0 text-ink-faint opacity-0 transition-opacity hover:opacity-100"><Pencil size={12} /></span>
          </div>
          {#each list as s}
            <button
              onclick={() => selectSession(s.id)}
              class="mt-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors {s.id === activeId
                ? 'bg-accent-soft text-ink'
                : 'text-ink-dim hover:bg-surface-3 hover:text-ink'}"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full {s.alive ? 'bg-emerald-400' : 'bg-ink-faint/50'}"
                ></span>
                <span class="truncate">{sessionTitle(s.id)}</span>
              </span>
              <span class="shrink-0 text-[11.5px] text-ink-faint">{relTime(s.created_at)}</span>
            </button>
          {/each}
        {/each}
        {#if sessions.length === 0}
          <div class="flex flex-col items-center gap-2 px-4 pt-10 text-center">
            <Folder size={22} class="text-ink-faint" />
            <p class="text-[13px] text-ink-faint">No threads yet.</p>
          </div>
        {/if}
      </div>

      {#if error}
        <pre class="mx-2.5 mb-1 max-h-24 overflow-y-auto rounded-lg border border-red-900/50 bg-red-950/30 px-2.5 py-2 text-[11px] whitespace-pre-wrap text-red-300">{error}</pre>
      {/if}

      <div class="p-2.5">
        <button
          onclick={openSettings}
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
        ><Settings size={16} class="text-ink-faint" /> Settings</button>
      </div>
    </aside>
  {/if}

  <!-- ─────────── main ─────────── -->
  <main class="flex min-w-0 flex-1 flex-col bg-canvas">
    {#if sidebarHidden}
      <div data-tauri-drag-region class="flex items-center gap-0.5 px-3 pt-3">
        <button
          onclick={() => (sidebarHidden = false)}
          title="Show sidebar"
          class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        ><PanelLeftOpen size={15} /></button>
        <span class="mx-1 h-4 w-px bg-line"></span>
        <button onclick={winMin} title="Minimize" class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"><Minus size={14} /></button>
        <button onclick={winMax} title="Maximize" class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"><Square size={11} /></button>
        <button onclick={winClose} title="Close" class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"><X size={15} /></button>
      </div>
    {/if}

    {#if !activeId}
      <div class="flex flex-1 flex-col items-center justify-center gap-3">
        <div class="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-surface-2">
          <Sparkles size={20} class="text-ink-dim" />
        </div>
        <p class="text-[14px] text-ink-dim">Create a thread to chat with pi</p>
        <button
          onclick={() => createSession(null)}
          class="mt-1 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:bg-white"
        >New thread</button>
      </div>
    {:else}
      <div
        data-tauri-drag-region
        class="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-3"
      >
        {#if renaming}
          <input
            bind:value={renameValue}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                titles[activeId] = renameValue.trim() || sessionTitle(activeId);
                renaming = false;
              }
              if (e.key === "Escape") renaming = false;
            }}
            class="w-80 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[14px] outline-none transition-colors focus:border-accent"
          />
        {:else}
          <h2 class="truncate text-[14.5px] font-medium">{sessionTitle(activeId)}</h2>
        {/if}
        <div class="relative">
          <button
            onclick={() => (menuOpen = !menuOpen)}
            class="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          ><MoreHorizontal size={17} /></button>
          {#if menuOpen}
            <div class="absolute top-full right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface-2 p-1 shadow-[var(--shadow-pop)]">
              <button
                onclick={() => { renameValue = sessionTitle(activeId); renaming = true; menuOpen = false; }}
                class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
              ><Pencil size={13} /> Rename</button>
              <button
                onclick={() => { menuOpen = false; abort(); }}
                class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
              ><Square size={13} /> Abort run</button>
              <div class="my-1 h-px bg-line"></div>
              <button
                onclick={destroy}
                class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-red-300 transition-colors hover:bg-red-950/40"
              ><X size={13} /> Kill thread</button>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex flex-1 justify-center overflow-y-auto">
        <div class="flex w-full max-w-3xl flex-col gap-4 px-6 py-7">
          {#each messages[activeId] ?? [] as m}
            {#if m.role === "user"}
              <div class="max-w-[80%] self-end rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-[14.5px] leading-7 whitespace-pre-wrap">
                {m.text}
              </div>
            {:else if m.role === "assistant"}
              <Markdown source={m.text} />
            {:else if m.role === "tool"}
              <div class="flex items-center gap-2 font-mono text-[11.5px] text-ink-faint">
                {#if m.phase === "start"}
                  <Loader2 size={12} class="animate-spin" />
                {:else if m.isError}
                  <X size={12} class="text-red-400" />
                {:else}
                  <Check size={12} class="text-emerald-400" />
                {/if}
                <span>{m.tool}</span>
              </div>
            {:else if m.role === "bash"}
              <pre class="overflow-x-auto rounded-xl border border-line bg-[#0d0d0f] p-3 font-mono text-[11.5px] whitespace-pre-wrap text-ink-faint">{m.text}</pre>
            {:else if m.role === "work"}
              <div class="flex items-center gap-2 text-[12.5px] text-ink-faint">
                <Sparkles size={12} />
                <span>{m.text}</span>
              </div>
            {:else}
              <div class="self-center rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-1.5 text-[12px] text-red-300">{m.text}</div>
            {/if}
          {/each}

          {#if draft[activeId]}
            <Markdown source={draft[activeId]} streaming />
          {/if}

          {#if (messages[activeId] ?? []).length === 0 && !draft[activeId]}
            <div class="flex flex-col items-center gap-2 pt-16 text-center">
              <Sparkles size={18} class="text-ink-faint" />
              <p class="text-[13.5px] text-ink-faint">
                Ask pi to read, write, or run anything in this folder.
              </p>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex justify-center px-6 pb-5">
        <div
          class="w-full max-w-3xl rounded-2xl border border-line bg-surface-2 p-3 shadow-[var(--shadow-card)] transition-colors focus-within:border-line-strong"
        >
          <textarea
            bind:this={composerEl}
            rows={1}
            placeholder="Ask for follow-up changes"
            bind:value={input}
            oninput={autoresize}
            onkeydown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            class="max-h-[220px] w-full resize-none bg-transparent text-[14.5px] leading-6 outline-none placeholder:text-ink-faint"
          ></textarea>
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-0.5">
              <button
                onclick={() => { const s = sessions.find((x) => x.id === activeId); createSession(s?.cwd); }}
                title="New thread in same folder"
                class="grid h-8 w-8 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
              ><Plus size={17} /></button>
              <button
                onclick={() => refreshMeta(activeId)}
                title="Sync model state"
                class="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
              ><Sliders size={15} /></button>
            </div>
            <div class="flex items-center gap-1.5">
              {#if streaming[activeId]}
                <Loader2 size={14} class="mr-1 animate-spin text-ink-faint" />
              {/if}

              <div class="relative">
                <button
                  onclick={() => { modelPickerOpen = !modelPickerOpen; thinkingPickerOpen = false; if (modelPickerOpen) refreshMeta(activeId); }}
                  class="flex max-w-[220px] items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <span class="truncate">{modelLabel(activeId)}</span>
                  <ChevronDown size={12} class="shrink-0 text-ink-faint" />
                </button>
                {#if modelPickerOpen}
                  <div class="absolute right-0 bottom-full z-30 mb-2 flex max-h-80 w-80 flex-col overflow-hidden rounded-xl border border-line bg-surface-2 shadow-[var(--shadow-pop)]">
                    <input
                      placeholder="Search models…"
                      bind:value={modelSearch}
                      class="border-b border-line bg-canvas px-3 py-2 text-[13px] outline-none"
                    />
                    <div class="overflow-y-auto p-1">
                      {#each MODELS_BY_PROVIDER(filteredModels(activeId)) as [provider, list]}
                        <p class="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-wider text-ink-faint uppercase">{provider}</p>
                        {#each list as m}
                          <button
                            onclick={() => pickModel(m.provider, m.id)}
                            class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors {currentModel[activeId]?.id === m.id && currentModel[activeId]?.provider === m.provider
                              ? 'bg-accent-soft text-ink'
                              : 'text-ink-dim hover:bg-surface-3 hover:text-ink'}"
                          >
                            <span class="truncate">{m.name ?? m.id}</span>
                            {#if m.reasoning}
                              <span class="shrink-0 rounded-md border border-line bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-faint">reasoning</span>
                            {/if}
                          </button>
                        {/each}
                      {/each}
                      {#if filteredModels(activeId).length === 0}
                        <p class="px-3 py-3 text-[13px] text-ink-faint">
                          {(models[activeId] ?? []).length === 0 ? "Waiting on pi…" : "No matches."}
                        </p>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>

              <div class="relative">
                <button
                  onclick={() => { thinkingPickerOpen = !thinkingPickerOpen; modelPickerOpen = false; }}
                  class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <span class="capitalize">{thinkingLevel[activeId] ?? "Level"}</span>
                  <ChevronDown size={12} class="text-ink-faint" />
                </button>
                {#if thinkingPickerOpen}
                  <div class="absolute right-0 bottom-full z-30 mb-2 w-36 overflow-hidden rounded-xl border border-line bg-surface-2 p-1 shadow-[var(--shadow-pop)]">
                    {#each thinkingLevels[activeId].length ? thinkingLevels[activeId] : ["off", "minimal", "low", "medium", "high"] as lv}
                      <button
                        onclick={() => pickThinking(lv)}
                        class="block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] capitalize transition-colors {thinkingLevel[activeId] === lv
                          ? 'bg-accent-soft text-ink'
                          : 'text-ink-dim hover:bg-surface-3 hover:text-ink'}"
                      >{lv}</button>
                    {/each}
                  </div>
                {/if}
              </div>

              {#if streaming[activeId]}
                <button
                  onclick={abort}
                  title="Stop"
                  class="grid h-8 w-8 place-items-center rounded-xl bg-ink text-black transition-colors hover:bg-white"
                ><Square size={12} fill="currentColor" /></button>
              {:else}
                <button
                  onclick={send}
                  disabled={!input.trim()}
                  title="Send"
                  class="grid h-8 w-8 place-items-center rounded-xl bg-ink text-black transition-all hover:bg-white disabled:bg-surface-3 disabled:text-ink-faint"
                ><Send size={14} /></button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

{#if settingsOpen}
  <div class="fixed inset-0 z-40 grid place-items-center bg-black/60 p-6">
    <div class="w-[420px] rounded-2xl border border-line bg-surface-2 p-5 shadow-[var(--shadow-pop)]">
      <div class="mb-4 flex items-center gap-2.5">
        <Settings size={17} class="text-ink-dim" />
        <h3 class="text-[15px] font-medium">Settings</h3>
      </div>
      {#if appInfo}
        <dl class="flex flex-col gap-2.5 text-[13px]">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-faint">pi binary</dt>
            <dd class="truncate font-mono text-[11.5px] text-ink-dim">{appInfo.pi_bin}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-faint">pi version</dt>
            <dd class="font-mono text-[11.5px] text-ink-dim">{appInfo.pi_version}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-faint">sessions dir</dt>
            <dd class="truncate font-mono text-[11.5px] text-ink-dim">{appInfo.session_root}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-faint">live sessions</dt>
            <dd class="font-mono text-[11.5px] text-ink-dim">{appInfo.sessions}</dd>
          </div>
        </dl>
      {:else}
        <p class="text-[13px] text-ink-faint">Loading…</p>
      {/if}
      <button
        onclick={() => (settingsOpen = false)}
        class="mt-5 w-full rounded-xl bg-ink py-2 text-[13px] font-medium text-black transition-colors hover:bg-white"
      >Close</button>
    </div>
  </div>
{/if}
