# darwin

A Tauri GUI wrapper around `pi` — the minimal terminal coding harness.

`darwin` spawns one `pi --mode rpc` child per session and speaks strict JSONL
(`\n`-delimited) to it. The Rust backend owns process lifecycle + event
buffering; the Svelte frontend is a thin chat client that renders pi's event
stream.

## Prereqs

- `pi` on PATH (`pi --version`)
- Node 22+, Rust stable, `@tauri-apps/cli` (via devDependency)

Run the Tauri CLI through node/npx, not bun — the CLI ships a NAPI binary that
bun's runtime cannot load reliably:

```bash
cd darwin
bun install            # or npm install
bun run build          # vite build (fast, fine under bun)
npx tauri dev          # NOT `bun run tauri dev`
```

## Backend

- `src-tauri/src/pi.rs` — session registry: spawn/kill `pi --mode rpc`, write
  commands (`prompt`/`steer`/`follow_up`/`abort`/`get_state`/`set_model`/
  `set_thinking_level`), reader thread (LF-delimited JSON -> ring buffer +
  `app.emit("pi-event")`).
- `src-tauri/src/main.rs` — Tauri commands: `create_session`, `list_sessions`,
  `send_prompt`, `send_steer`, `send_follow_up`, `abort_session`,
  `request_state`, `request_models`, `set_model`, `cycle_model`,
  `request_thinking_levels`, `set_thinking_level`, `app_info`, `get_events`,
  `destroy_session`.

Sessions persist under `~/.darwin/sessions/<id>/` (passed as `--session-dir` to
pi). Event buffers are in-memory for now, so restarting darwin starts a fresh
`pi` child per session.

## Frontend

```
src/
  App.svelte                shell: sidebar, thread, composer, overlays
  app.css                   design tokens (@theme) + markdown typography + scrollbars
  lib/
    markdown.js             marked + DOMPurify pipeline, code-block markup hooks
    Markdown.svelte         renders sanitized HTML, throttles live streaming,
                            wires copy buttons + external links
    ToolActivity.svelte     groups tool calls into one collapsible block
    CommandPalette.svelte   cmd/ctrl+K palette (threads + actions)
    toolIcons.js            tool name -> lucide icon
    clipboard.js            Tauri clipboard plugin with DOM fallback
    links.js                Tauri opener plugin with window.open fallback
```

Design language: layered dark surfaces (`canvas` / `surface` / `surface-2` /
`surface-3`), a single `accent` for selection, `line` borders, three levels of
text (`ink` / `ink-dim` / `ink-faint`). All tokens are declared in `app.css`
under `@theme`, so they are usable as normal Tailwind utilities (`bg-surface-2`,
`text-ink-dim`, `border-line`). Icons are per-path lucide imports to keep the
bundle from pulling in the whole icon set.

Motion uses `svelte/transition` (fade/fly/scale/slide), `svelte/animate` flip
for the thread list, and a caret keyframe for streaming. Everything is
duration-gated through `dur()` so `prefers-reduced-motion: reduce` disables it.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Enter` | Send (or steer while the agent is running) |
| `Shift + Enter` | Newline in composer |
| `Cmd/Ctrl + K` | Command palette (search threads, actions) |
| `Cmd/Ctrl + N` | New thread |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Esc` | Close open overlay |

## Behaviour notes

- Assistant output (including the in-progress draft) is rendered as markdown.
  During streaming the parse is coalesced to ~60ms so token deltas do not
  re-parse per token.
- Consecutive tool calls collapse into one activity block that expands while
  tools run and collapses to a summary when the block settles. Bash output is
  clipped to 12 lines with a "show more" toggle.
- The transcript follows new output only while you are at the bottom; scrolling
  up pins the view and reveals a jump-to-latest button.
- A running agent shows a blinking caret, a spinner in the composer, and the
  send button becomes a stop button.
