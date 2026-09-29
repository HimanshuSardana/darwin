import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Press a key (Enter, Tab, Escape, Control+a, …). Approved once per session.",
  inputSchema: z.object({
    key: z.string().min(1).describe("Key to press, e.g. Enter."),
  }),
  approval: once(),
  async execute({ key }) {
    return runBrowser(["press", key]);
  },
});
