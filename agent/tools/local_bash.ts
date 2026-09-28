import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { hostRoot, runHostCommand } from "../lib/host";

export default defineTool({
  description:
    "Run a shell command directly on the HOST machine (not the VM sandbox). " +
    "Use ONLY when the turn context says Workspace: this machine. " +
    "Every call pauses for user approval before running. " +
    "Working directory is the host workspace root; output is truncated past 30KB.",
  inputSchema: z.object({
    command: z.string().min(1).describe("Shell command to run with bash -c."),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(120_000)
      .optional()
      .describe("Kill the command after this long (default 30000, max 120000)."),
  }),
  approval: always(),
  async execute({ command, timeoutMs }) {
    const result = await runHostCommand(command, { timeoutMs });
    return { cwd: hostRoot(), ...result };
  },
});
