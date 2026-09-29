import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Hover over an element (snapshot ref or selector), revealing hover menus. Approved once per session.",
  inputSchema: z.object({
    selector: z.string().min(1),
  }),
  approval: once(),
  async execute({ selector }) {
    return runBrowser(["hover", selector]);
  },
});
