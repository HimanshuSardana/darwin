import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Close the browser session when the task is done.",
  inputSchema: z.object({}),
  approval: never(),
  async execute() {
    return runBrowser(["close"]);
  },
});
