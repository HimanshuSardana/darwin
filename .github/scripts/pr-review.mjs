#!/usr/bin/env node
/**
 * PR review via OpenCode Go (muse-spark-1.3-contributor, Responses API).
 * Diffs base...head, asks for a code review + security scan, writes
 * review.md for the workflow to post. Never fails the job: on any error
 * it logs and exits 0 without a review file.
 *
 * Env: OPENCODE_API_KEY (required), PR_NUMBER, PR_TITLE, BASE_SHA, HEAD_SHA.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const MODEL = "muse-spark-1.3-contributor";
const ENDPOINT = "https://opencode.ai/zen/go/v1/responses";
const MAX_DIFF_BYTES = 50 * 1024;

function diff(base, head) {
  const raw = execFileSync(
    "git",
    ["diff", `${base}...${head}`, "--", ".", ":(exclude)package-lock.json"],
    { maxBuffer: 20 * 1024 * 1024, encoding: "utf8" },
  );
  if (raw.length > MAX_DIFF_BYTES) {
    return (
      raw.slice(0, MAX_DIFF_BYTES) +
      `\n\n[... diff truncated: ${raw.length - MAX_DIFF_BYTES} more bytes omitted ...]`
    );
  }
  return raw;
}

function extractText(response) {
  const chunks = [];
  for (const item of response?.output ?? []) {
    if (typeof item?.content === "string") chunks.push(item.content);
    if (Array.isArray(item?.content)) {
      for (const part of item.content) {
        if (typeof part?.text === "string") chunks.push(part.text);
      }
    }
    if (typeof item?.text === "string") chunks.push(item.text);
  }
  return chunks.join("\n").trim();
}

async function main() {
  const { OPENCODE_API_KEY, PR_NUMBER, PR_TITLE, BASE_SHA, HEAD_SHA } = process.env;
  if (!OPENCODE_API_KEY) {
    console.log("OPENCODE_API_KEY not set; skipping review.");
    return;
  }
  const patch = diff(BASE_SHA, HEAD_SHA);
  if (!patch.trim()) {
    console.log("Empty diff; nothing to review.");
    return;
  }
  const input = [
    `You are a senior engineer reviewing pull request #${PR_NUMBER}: "${PR_TITLE}".`,
    "Do two things:",
    "1. Code review: bugs, logic errors, broken edge cases, API misuse, type errors the compiler may miss.",
    "2. Security scan: injection, auth/authz bypass, secret leakage, path traversal, SSRF, XSS, insecure randomness, over-broad permissions, missing ownership checks.",
    "Format: one section per finding with aSeverity label [Critical/High/Medium/Low/Nit], file:line, what's wrong, and a concrete fix. End with a one-line verdict.",
    "Be concise and specific. If an area is clean, say so in one line instead of inventing issues.",
    "",
    "--- DIFF ---",
    patch,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENCODE_API_KEY}`,
        "x-opencode-session": `darwin-pr-review-${PR_NUMBER ?? "adhoc"}`,
        "user-agent": "darwin-pr-review/1.0",
      },
      body: JSON.stringify({ model: MODEL, input, max_output_tokens: 4000 }),
    });
    if (!response.ok) {
      console.log(`Review API returned ${response.status}; skipping.`);
      return;
    }
    const text = extractText(await response.json());
    if (!text) {
      console.log("Empty review response; skipping.");
      return;
    }
    writeFileSync(
      "review.md",
      `## AI review (Muse Spark via OpenCode Go)\n\n${text}\n\n---\n_Automated review — treat findings as suggestions, not verdicts._\n`,
    );
    console.log("Wrote review.md");
  } catch (error) {
    console.log(`Review failed (${error}); skipping without failing the job.`);
  } finally {
    clearTimeout(timeout);
  }
}

await main();
