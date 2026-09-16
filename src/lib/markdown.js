import { Marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Strip a leading "language" hint and normalize an unknown language token so we
 * can display it, without trusting it as a class name.
 */
function normalizeLang(lang) {
  if (!lang) return "";
  return String(lang).trim().split(/\s+/)[0].slice(0, 32).toLowerCase();
}

const marked = new Marked({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = normalizeLang(lang);
      // Escape for the code body; the component adds structure via classes.
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const label = language
        ? `<span class="md-code-lang">${language}</span>`
        : `<span class="md-code-lang"></span>`;
      return (
        `<div class="md-code" data-lang="${language}">` +
        `<div class="md-code-head">${label}` +
        `<button class="md-code-copy" type="button" data-copy>Copy</button></div>` +
        `<pre><code class="language-${language}">${escaped}</code></pre>` +
        `</div>`
      );
    },
  },
});

const PURIFY_CONFIG = {
  ADD_ATTR: ["target", "rel", "data-lang", "data-copy"],
  ADD_TAGS: ["button"],
  FORBID_TAGS: ["style", "iframe", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

/** Render markdown to sanitized HTML. */
export function renderMarkdown(source) {
  if (!source) return "";
  const raw = marked.parse(String(source));
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}

/** True when a code block wrapper is present (used for copy-button wiring). */
export function hasCodeBlocks(html) {
  return html.includes("md-code");
}
