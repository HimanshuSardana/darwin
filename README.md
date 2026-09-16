# darwin

A Tauri GUI wrapper around `pi` — the minimal terminal coding harness.

`darwin` spawns one `pi --mode rpc` child per session and speaks strict JSONL
(`\n`-delimited) to it. The Rust backend owns process lifecycle + event
buffering; the Svelte frontend is a thin chat client.

## Prereqs

- `pi` on PATH (`pi --version`)
- Node 22+, Rust stable, `@tauri-apps/cli` (via devDependency)

## Dev

```bash
cd darwin
npm install
npm run tauri dev
```

## How it works

- `src-tauri/src/pi.rs` — session registry: spawn/kill `pi --mode rpc`,
  writer (`prompt`/`steer`/`follow_up`/`abort`), reader thread (lines ->
  JSON -> ring buffer + `app.emit("pi-event")`).
- `src-tauri/src/main.rs` — Tauri commands:
  `create_session`, `list_sessions`, `send_prompt`, `send_steer`,
  `send_follow_up`, `abort_session`, `get_events`, `destroy_session`.
- `src/App.svelte` — session list + live chat. Subscribes to `pi-event`,
  backfills via `get_events`, derives messages from
  `message_update`/`tool_execution_*`/`agent_start|end` events.

Sessions persist under `~/.darwin/sessions/<id>/` (passed as
`--session-dir` to pi). Event buffers are in-memory for now.
