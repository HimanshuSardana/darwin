<script>
import { onMount } from "svelte";
import { renderMarkdown } from "./markdown.js";
import { copyText } from "./clipboard.js";
import { openExternal } from "./links.js";

let { source = "", streaming = false, class: klass = "" } = $props();

let hostEl = $state(null);
let rendered = $state("");
let latest = "";
let scheduled = false;
let html = $derived(renderMarkdown(rendered));

// While streaming, coalesce rapid deltas so we re-parse markdown at most ~every
// 60ms instead of once per token. When streaming ends, render the final text.
$effect(() => {
  latest = source;
  if (!streaming) {
    rendered = latest;
    return;
  }
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    rendered = latest;
  }, 60);
});

function wire() {
  if (!hostEl) return;
  for (const btn of hostEl.querySelectorAll("[data-copy]")) {
    if (btn.dataset.wired === "1") continue;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = btn.closest(".md-code")?.querySelector("code");
      if (!code) return;
      await copyText(code.textContent ?? "");
      const prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("md-code-copied");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("md-code-copied");
      }, 1200);
    });
  }
  for (const a of hostEl.querySelectorAll("a[href]")) {
    if (a.dataset.wired === "1") continue;
    a.dataset.wired = "1";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href") ?? "";
      if (href) openExternal(href);
    });
  }
}

$effect(() => {
  html;
  queueMicrotask(wire);
});

onMount(wire);
</script>

<div bind:this={hostEl} class="md {klass} {streaming ? 'md-streaming' : ''}">
  {@html html}
</div>
