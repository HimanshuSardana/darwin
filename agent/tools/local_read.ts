import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { readHostFile } from "../lib/host";

export default defineTool({
  description:
    "Read a text file directly from the HOST machine (not the VM sandbox). " +
    "Use ONLY when the turn context says Workspace: this machine. " +
    "Paths are confined to the host workspace root (DARWIN_WORKSPACE or the server cwd); " +
    "absolute paths outside it are rejected. Approved once per session.",
  inputSchema: z.object({
    path: z.string().min(1).describe("Path relative to the host workspace root."),
  }),
  approval: once(),
  async execute({ path }) {
    return readHostFile(path);
  },
});
