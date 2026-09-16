<script>
import { fade, fly, scale } from "svelte/transition";
import { onMount, tick } from "svelte";
import Search from "lucide-svelte/icons/search";
import Plus from "lucide-svelte/icons/plus";
import Settings from "lucide-svelte/icons/settings";
import CornerDownLeft from "lucide-svelte/icons/corner-down-left";
import Folder from "lucide-svelte/icons/folder";

let {
  open = false,
  threads = [],
  onSelect = () => {},
  onNew = () => {},
  onSettings = () => {},
  onClose = () => {},
} = $props();

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (reducedMotion ? 0 : ms);

let query = $state("");
let index = $state(0);
let inputEl = $state(null);

const results = $derived.by(() => {
  const q = query.trim().toLowerCase();
  const items = [
    { kind: "action", id: "new", label: "New thread", icon: Plus, hint: "Create" },
    { kind: "action", id: "settings", label: "Settings", icon: Settings, hint: "Open" },
  ];
  const matchedThreads = threads
    .filter(
      (t) =>
        !q ||
        `${t.title} ${t.project}`.toLowerCase().includes(q),
    )
    .map((t) => ({
      kind: "thread",
      id: t.id,
      label: t.title,
      sub: t.project,
      alive: t.alive,
      icon: Folder,
    }));
  const matchedActions = q
    ? items.filter((i) => i.label.toLowerCase().includes(q))
    : items;
  return [...matchedActions, ...matchedThreads].slice(0, 40);
});

$effect(() => {
  if (open) {
    query = "";
    index = 0;
    tick().then(() => inputEl?.focus());
  }
});

$effect(() => {
  if (index >= results.length) index = Math.max(0, results.length - 1);
});

function choose(item) {
  if (!item) return;
  if (item.kind === "action") {
    if (item.id === "new") onNew();
    if (item.id === "settings") onSettings();
  } else {
    onSelect(item.id);
  }
  onClose();
}

function onKeydown(e) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    index = Math.min(index + 1, results.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    index = Math.max(index - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    choose(results[index]);
  } else if (e.key === "Escape") {
    e.preventDefault();
    onClose();
  }
}

let scrollerEl = $state(null);
$effect(() => {
  const el = scrollerEl?.querySelector(`[data-idx="${index}"]`);
  el?.scrollIntoView({ block: "nearest" });
});
</script>

{#if open}
  <div class="fixed inset-0 z-50 pt-[14vh]">
    <button
      type="button"
      aria-label="Close command palette"
      transition:fade={{ duration: dur(120) }}
      class="absolute inset-0 cursor-default bg-black/50"
      onclick={onClose}
    ></button>
    <div class="pointer-events-none absolute inset-0 flex justify-center">
      <div
        transition:scale={{ start: 0.98, duration: dur(140) }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabindex="-1"
        class="pointer-events-auto flex max-h-[60vh] w-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[var(--shadow-pop)]"
      >
      <div class="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Search size={15} class="shrink-0 text-ink-faint" />
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeydown}
          placeholder="Search threads and actions…"
          class="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint"
        />
        <kbd class="rounded-md border border-line bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">esc</kbd>
      </div>

      <div bind:this={scrollerEl} class="overflow-y-auto p-1.5">
        {#each results as item, i (item.kind + item.id)}
          {@const Glyph = item.icon}
          <button
            data-idx={i}
            onclick={() => choose(item)}
            onmouseenter={() => (index = i)}
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors {i === index
              ? 'bg-accent-soft text-ink'
              : 'text-ink-dim hover:bg-surface-3'}"
          >
            <Glyph size={15} class="shrink-0 text-ink-faint" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[13.5px]">{item.label}</span>
              {#if item.sub}
                <span class="truncate text-[11.5px] text-ink-faint">{item.sub}</span>
              {/if}
            </span>
            {#if item.kind === "thread"}
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {item.alive ? 'bg-emerald-400' : 'bg-ink-faint/50'}"></span>
            {/if}
            {#if i === index}
              <CornerDownLeft size={12} class="shrink-0 text-ink-faint" />
            {/if}
          </button>
        {/each}
        {#if results.length === 0}
          <p class="px-3 py-6 text-center text-[13px] text-ink-faint">No matches.</p>
        {/if}
      </div>
      </div>
    </div>
  </div>
{/if}
