import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Launch the browser (host Chromium). Pass a URL to navigate immediately, or omit to start blank. headed=true (default) shows a real window on the user's desktop; the chat UI also displays screenshots. Reuse the running browser across turns — do not relaunch unless asked.",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to open after launch."),
    headed: z
      .boolean()
      .optional()
      .describe("Show a visible window (default true; false for headless)."),
  }),
  approval: never(),
  async execute({ url, headed = true }) {
    const args = ["open", "--headed", String(headed)];
    if (url) args.push(url);
    return runBrowser(args, 90_000);
  },
});
