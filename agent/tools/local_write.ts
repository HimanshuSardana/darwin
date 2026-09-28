import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { writeHostFile } from "../lib/host";

export default defineTool({
  description:
    "Write a text file directly on the HOST machine (not the VM sandbox). " +
    "Use ONLY when the turn context says Workspace: this machine. " +
    "Paths are confined to the host workspace root (DARWIN_WORKSPACE or the server cwd); " +
    "parent directories are created. Every call pauses for user approval before writing.",
  inputSchema: z.object({
    path: z.string().min(1).describe("Path relative to the host workspace root."),
    content: z.string().describe("Full file content (max 1MB)."),
  }),
  approval: always(),
  async execute({ path, content }) {
    return writeHostFile(path, content);
  },
});
