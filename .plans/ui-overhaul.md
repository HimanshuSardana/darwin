# darwin UI overhaul — plan

Goal: make the UI modern, animated, with markdown rendering and real icons
(no emojis). Break the work into small, independently committable steps.

Working rules:
- Do one step at a time.
- Mark `[x]` when done, commit, then move on.
- Each step must leave `bun run build` and `cargo check` green.

---

## Step 1 — Dependencies: icons + markdown
- [x] Add `lucide-svelte` (real icon set, SVG, tree-shakeable)
- [x] Add `marked` (markdown -> HTML) and `dompurify` (sanitize)
- [x] Add `@tailwindcss/typography` if needed for prose styles (or hand-roll)
- [x] Commit: `chore(deps): add icons and markdown renderer`

## Step 2 — Markdown rendering module
- [x] `src/lib/markdown.js`: configure `marked` with GFM + breaks, sanitize
      with DOMPurify, and add a `highlight`/code-block pass
- [x] Handle fenced code blocks (language label + copy button class hooks)
- [x] Handle inline code, links (open external in browser), lists, tables,
      blockquotes, task lists
- [x] Commit: `feat(markdown): render assistant output as sanitized html`

## Step 3 — Markdown component + code block
- [x] `src/lib/Markdown.svelte`: renders html, styles via `.md` classes
- [x] `src/lib/CodeBlock.svelte` or delegation: monospace, header with
      language + copy icon button, horizontal scroll
- [x] Style `.md` typography with Tailwind (headings, lists, tables, code,
      blockquote, hr, links)
- [x] Commit: `feat(ui): markdown message component with code blocks`

## Step 4 — Icon pass (replace every emoji)
- [x] Audit `src/App.svelte` for emoji/glyph icons (🗀 ⌕ ✎ ⚙ □ – × ⋯ → ← ↑ ▶ ✔ ▍)
- [x] Replace with `lucide-svelte` icons (Folder, Search, Settings, PanelLeft,
      ArrowLeft/Right, Minus, Square, X, MoreHorizontal, Plus, Send, Square/Stop,
      Loader2, Check, Terminal, ChevronRight, etc.)
- [x] Use an `Icon` wrapper for consistent sizing/stroke
- [x] Commit: `refactor(ui): replace emoji glyphs with lucide icons`

## Step 5 — Visual redesign (modern, clean)
- [x] Establish design tokens: surface layers, border, text hierarchy,
      accent, radius scale, shadow scale (CSS vars in `src/app.css`)
- [x] Refine sidebar: spacing, hover/active states, section headers,
      thread rows with status dot + meta, sticky header controls
- [x] Refine thread header + metadata row
- [x] Refine composer: focus ring, gradient border, model/thinking chips,
      send/stop button states, keyboard hint
- [x] Refine empty state with a proper hero
- [x] Commit: `style(ui): modern visual system with tokens and layered surfaces`

## Step 6 — Animation / motion
- [x] Add `svelte/transition` (fade, fly, scale) + `svelte/animate` flip for lists
- [x] Animate: sidebar collapse, thread list entry, picker popovers, message
      appearance, streaming caret, tool row expand, settings modal
- [x] Respect `prefers-reduced-motion`
- [x] Commit: `feat(ui): add transitions and list animations`

## Step 7 — Streaming / live output polish
- [x] Markdown-render the streaming draft live (throttled)
- [x] Blinking caret while streaming, subtle "thinking" indicator
- [x] Auto-scroll to bottom, but pause if user scrolled up (with jump-to-bottom)
- [x] Commit: `feat(ui): live markdown streaming and smart autoscroll`

## Step 8 — Tool call rendering
- [x] Group consecutive tool events into a collapsible "activity" block
- [x] Show tool name with icon, status (running/done/error), elapsed
- [x] Render bash output in a code block; truncate with "show more"
- [x] Commit: `feat(ui): structured tool activity timeline`

## Step 9 — Sidebar/command niceties
- [x] Keyboard shortcuts help + `Cmd/Ctrl+K` command palette stub (search threads)
- [x] Settings modal polish (icons, sections, about)
- [x] Commit: `feat(ui): command palette and settings polish`

## Step 10 — Final verification
- [x] `bun run build` green
- [x] `cargo check` green
- [x] Manual smoke test notes in README
- [x] Commit: `docs: note UI structure and shortcuts`
