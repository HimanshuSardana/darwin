import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Clear an input and fill it with text (snapshot ref or selector). Approved once per session.",
  inputSchema: z.object({
    selector: z.string().min(1),
    text: z.string().describe("Text to fill in."),
  }),
  approval: once(),
  async execute({ selector, text }) {
    return runBrowser(["fill", selector, text]);
  },
});
