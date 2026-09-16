<script>
import { fly } from "svelte/transition";
import Check from "lucide-svelte/icons/check";
import ChevronRight from "lucide-svelte/icons/chevron-right";
import Loader2 from "lucide-svelte/icons/loader-2";
import X from "lucide-svelte/icons/x";
import Terminal from "lucide-svelte/icons/terminal";
import { toolIcon } from "./toolIcons.js";

let { items = [], running = false, summary = "" } = $props();

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (reducedMotion ? 0 : ms);

const LINE_LIMIT = 12;

let open = $state(false);
let expandedOutputs = $state({});
let wasRunning = $state(false);

// Follow the run: expand when tools start executing, collapse to the summary
// once the block settles. User toggles are preserved while idle.
$effect(() => {
  if (running && !wasRunning) open = true;
  if (!running && wasRunning) open = false;
  wasRunning = running;
});

const done = $derived(items.length > 0 && items.every((i) => i.status !== "running"));
const failed = $derived(items.some((i) => i.status === "error"));
const runningCount = $derived(items.filter((i) => i.status === "running").length);

function linesOf(text) {
  return String(text ?? "").split("\n");
}

function toggleOutput(index) {
  expandedOutputs[index] = !expandedOutputs[index];
}

const heading = $derived.by(() => {
  if (summary) return summary;
  if (running && runningCount > 0)
    return `Running ${runningCount} tool${runningCount === 1 ? "" : "s"}…`;
  return `${items.length} tool call${items.length === 1 ? "" : "s"}`;
});
</script>

<div class="overflow-hidden rounded-xl border border-line bg-surface-2/60">
  <button
    onclick={() => (open = !open)}
    class="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-dim transition-colors hover:bg-surface-3/60"
  >
    <ChevronRight
      size={13}
      class="shrink-0 text-ink-faint transition-transform duration-200 {open ? 'rotate-90' : ''}"
    />
    {#if running && !done}
      <Loader2 size={12} class="shrink-0 animate-spin text-ink-faint" />
    {:else if failed}
      <X size={12} class="shrink-0 text-red-400" />
    {:else}
      <Check size={12} class="shrink-0 text-emerald-400" />
    {/if}
    <span class="truncate">{heading}</span>
  </button>

  {#if open}
    <ul
      in:fly={{ y: -4, duration: dur(150) }}
      class="flex flex-col gap-1 border-t border-line px-3 py-2"
    >
      {#each items as item, i (i)}
        {@const ToolGlyph = toolIcon(item.name)}
        <li class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2 font-mono text-[11.5px] text-ink-faint">
            <ToolGlyph size={12} class="shrink-0" />
            <span class="truncate text-ink-dim">{item.name}</span>
            {#if item.status === "running"}
              <Loader2 size={11} class="shrink-0 animate-spin" />
            {:else if item.status === "error"}
              <X size={11} class="shrink-0 text-red-400" />
            {:else}
              <Check size={11} class="shrink-0 text-emerald-400/80" />
            {/if}
          </div>

          {#if item.output}
            {@const lines = linesOf(item.output)}
            {@const clipped = lines.length > LINE_LIMIT && !expandedOutputs[i]}
            <div class="ml-5 overflow-hidden rounded-lg border border-line bg-[#0d0d0f]">
              <pre class="overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-faint">{clipped
                  ? lines.slice(0, LINE_LIMIT).join("\n")
                  : item.output}</pre>
              {#if lines.length > LINE_LIMIT}
                <button
                  onclick={() => toggleOutput(i)}
                  class="flex w-full items-center gap-1 border-t border-line px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink-dim"
                >
                  <Terminal size={10} />
                  {expandedOutputs[i]
                    ? "Show less"
                    : `Show ${lines.length - LINE_LIMIT} more lines`}
                </button>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
