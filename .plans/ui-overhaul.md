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
- [x] Commit: `chore(deps): add icons and markdown renderer`

## Step 2 — Markdown rendering module
- [x] `src/lib/markdown.js`: configure `marked` with GFM + breaks, sanitize
      with DOMPurify, and add code-block hooks
- [x] Handle fenced code blocks (language label + copy button)
- [x] Handle inline code, links (open external in browser), lists, tables,
      blockquotes, task lists
- [x] Commit: `feat(markdown): render assistant output as sanitized html`

## Step 3 — Markdown component + code block
- [x] `src/lib/Markdown.svelte`: renders html, styles via `.md` classes
- [x] `src/lib/CodeBlock.svelte`: monospace, header with language + copy icon
- [x] Style `.md` typography with Tailwind
- [x] Commit: `feat(ui): markdown message component with code blocks`

## Step 4 — Icon pass (replace every emoji)
- [x] Audit `src/App.svelte` for emoji/glyph icons
- [x] Replace with `lucide-svelte` icons
- [x] Commit: `refactor(ui): replace emoji glyphs with lucide icons`

## Step 5 — Visual redesign (modern, clean)
- [x] Design tokens: surfaces, border, text hierarchy, accent, radius, shadow
- [x] Refine sidebar, thread header, composer, empty state
- [x] Commit: `style(ui): modern visual system with tokens and layered surfaces`

## Step 6 — Animation / motion
- [x] Add `svelte/transition` + `svelte/animate` flip for lists
- [x] Animate sidebar collapse, pickers, messages, modal
- [x] Respect `prefers-reduced-motion`
- [x] Commit: `feat(ui): add transitions and list animations`

## Step 7 — Streaming / live output polish
- [x] Markdown-render streaming draft live (throttled)
- [x] Blinking caret + thinking indicator
- [x] Smart autoscroll with jump-to-bottom
- [x] Commit: `feat(ui): live markdown streaming and smart autoscroll`

## Step 8 — Tool call rendering
- [ ] Group consecutive tool events into collapsible activity blocks
- [ ] Tool name + icon, status, elapsed
- [ ] Bash output in code block, truncate with show more
- [ ] Commit: `feat(ui): structured tool activity timeline`

## Step 9 — Command palette + settings
- [ ] `Cmd/Ctrl+K` palette for thread search/navigation
- [ ] Settings modal polish
- [ ] Commit: `feat(ui): command palette and settings polish`

## Step 10 — Final verification
- [ ] `bun run build` green
- [ ] `cargo check` green
- [ ] README notes for UI structure and shortcuts
- [ ] Commit: `docs: note ui structure and shortcuts`
