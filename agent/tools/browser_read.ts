import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Read agent-friendly text: pass a URL to fetch it as markdown, or omit to read the rendered active tab (includes auth state and client-side updates). Truncated past 12KB.",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to fetch; omit for the active tab."),
  }),
  approval: never(),
  async execute({ url }) {
    return runBrowser(url ? ["read", url] : ["read"]);
  },
});
