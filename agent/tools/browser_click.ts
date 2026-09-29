import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Click an element by snapshot ref (e.g. @e2) or CSS selector. Take a fresh snapshot first — refs expire on page change. Approved once per session.",
  inputSchema: z.object({
    selector: z.string().min(1).describe("Snapshot ref like @e2, or a CSS selector."),
  }),
  approval: once(),
  async execute({ selector }) {
    return runBrowser(["click", selector]);
  },
});
