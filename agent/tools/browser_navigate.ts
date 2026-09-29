import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Navigate the running browser to a URL (launches it first if needed).",
  inputSchema: z.object({
    url: z.string().min(1).describe("URL to navigate to."),
  }),
  approval: never(),
  async execute({ url }) {
    return runBrowser(["open", url]);
  },
});
