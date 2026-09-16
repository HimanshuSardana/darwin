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

<div class="layout">
  <aside class="side">
    <h1>darwin</h1>
    <div class="newrow">
      <input placeholder="cwd (optional)" bind:value={cwdInput} />
      <button onclick={createSession}>+ session</button>
    </div>
    <div class="list">
      {#each sessions as s}
        <button
          class="sess"
          class:active={s.id === activeId}
          onclick={() => selectSession(s.id)}
        >
          <span class="dot" class:alive={s.alive}></span>
          <span class="mono">{s.id}</span>
          <span class="cwd">{s.cwd}</span>
        </button>
      {/each}
      {#if sessions.length === 0}
        <p class="hint">No sessions yet. Create one to spawn <code>pi --mode rpc</code>.</p>
      {/if}
    </div>
    {#if error}<pre class="err">{error}</pre>{/if}
  </aside>

  <main class="chat">
    {#if !activeId}
      <p class="hint">Create or pick a session to chat with pi.</p>
    {:else}
      <div class="thread">
        {#each messages[activeId] ?? [] as m}
          <div class="msg {m.role}">{m.text}</div>
        {/each}
        {#if draft[activeId]}
          <div class="msg assistant streaming">{draft[activeId]}▍</div>
        {/if}
      </div>
      <div class="composer">
        <input
          placeholder={streaming[activeId] ? "Agent running — Enter steers it…" : "Message pi…"}
          bind:value={input}
          onkeydown={(e) => e.key === "Enter" && send()}
        />
        <button onclick={send}>Send</button>
        {#if streaming[activeId]}
          <button class="danger" onclick={abort}>Abort</button>
        {/if}
        <button class="ghost" onclick={destroy} title="Kill pi child">✕</button>
      </div>
    {/if}
  </main>
</div>

<style>
.layout { display: flex; height: 100%; }
.side { width: 300px; border-right: 1px solid #222a35; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: #10141b; }
.side h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
.newrow { display: flex; gap: 6px; }
.newrow input { flex: 1; min-width: 0; background: #0c0e12; border: 1px solid #2a3342; color: inherit; border-radius: 6px; padding: 6px 8px; }
button { background: #1d2532; color: inherit; border: 1px solid #2e394b; border-radius: 6px; padding: 6px 10px; }
button:hover { background: #263042; }
.list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.sess { display: flex; gap: 8px; align-items: center; text-align: left; }
.sess.active { border-color: #4f8cff; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #555; flex-shrink: 0; }
.dot.alive { background: #3ddc84; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.cwd { font-size: 11px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { opacity: 0.6; font-size: 13px; }
.err { color: #ff7a7a; font-size: 12px; white-space: pre-wrap; }
.chat { flex: 1; display: flex; flex-direction: column; }
.thread { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 75ch; padding: 8px 12px; border-radius: 10px; white-space: pre-wrap; font-size: 14px; }
.msg.user { align-self: flex-end; background: #1c3a5e; }
.msg.assistant { align-self: flex-start; background: #161c26; border: 1px solid #232c3d; }
.msg.assistant.streaming { border-color: #4f8cff; }
.msg.tool { align-self: flex-start; font-family: ui-monospace, monospace; font-size: 12px; opacity: 0.75; }
.msg.system { align-self: center; font-size: 12px; color: #ff9d9d; }
.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #222a35; }
.composer input { flex: 1; background: #0c0e12; border: 1px solid #2a3342; color: inherit; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
button.danger { border-color: #7a2e2e; }
button.ghost { opacity: 0.6; }
code { font-family: ui-monospace, monospace; }
</style>
