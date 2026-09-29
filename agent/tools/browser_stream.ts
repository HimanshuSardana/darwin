import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Manage the browser's live WebSocket stream (auto-started with the session). 'status' returns the port the chat UI watches; the UI streams frames itself. Use 'disable' when done streaming.",
  inputSchema: z.object({
    action: z.enum(["status", "enable", "disable"]).describe("Stream action."),
  }),
  approval: never(),
  async execute({ action }) {
    if (action === "status") return runBrowser(["stream", "status"]);
    if (action === "enable") {
      return runBrowser(["stream", "enable", "--port", "9223"]);
    }
    return runBrowser(["stream", "disable"]);
  },
});
