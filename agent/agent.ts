import { defineAgent } from "eve";
import { createOpenAI } from "@ai-sdk/openai";

// OpenCode Go — OpenAI-compatible gateway ($OPENCODE_API_KEY).
// Base URL: https://opencode.ai/zen/go/v1
// Go requires callers to (1) send a stable x-opencode-session per
// conversation for routing/prompt-cache affinity and (2) identify with a
// custom User-Agent rather than a generic SDK name.
// See https://opencode.ai/docs/go/#where-can-i-use-it
const OPENCODE_SESSION_ID =
  process.env.OPENCODE_SESSION_ID ?? "darwin-eve-agent-001";

const goFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("x-opencode-session", OPENCODE_SESSION_ID);
  headers.set("user-agent", "darwin/0.1.0");
  return fetch(input, { ...init, headers });
};

const opencodeGo = createOpenAI({
  name: "opencode-go",
  baseURL: process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1",
  apiKey: process.env.OPENCODE_API_KEY,
  fetch: goFetch,
});

export default defineAgent({
  // muse-spark only serves the Responses API (chat-completions returns
  // ModelProtocolUnsupported), so use .responses(), not chat().
  model: opencodeGo.responses("muse-spark-1.3-contributor"),
  modelContextWindowTokens: 200_000,
});
