import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Get the accessibility tree of the current page with element refs (@e1, @e2, …). Always snapshot before clicking/filling — refs expire after every page change. Output truncated past 12KB.",
  inputSchema: z.object({}),
  approval: never(),
  async execute() {
    return runBrowser(["snapshot"]);
  },
});
