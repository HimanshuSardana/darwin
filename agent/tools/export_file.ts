import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { environment } from "../sandbox";

const MAX_BYTES = 50_000_000;

/** Host directory for files exported out of VM sandboxes. */
export function sharedDir(): string {
  return join(process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin"), "shared");
}

export default defineTool({
  description:
    "Copy a file OUT of the VM sandbox onto the host and get back a file:// URL. " +
    "Use this whenever the user wants to SEE a VM-produced file (PDF, image, HTML) " +
    "in the host browser: export it first, then browser_launch the returned URL. " +
    "The host CANNOT reach VM network addresses (172.16.x URLs never load) and the " +
    "VM cannot push files out by itself — this tool is the only bridge. Binary-safe.",
  inputSchema: z.object({
    path: z
      .string()
      .min(1)
      .describe("Absolute path inside the VM (e.g. /workspace/hello.pdf)."),
  }),
  approval: always(),
  async execute({ path }, ctx) {
    if (!path.startsWith("/")) {
      throw new Error(`VM path must be absolute: ${path}`);
    }
    const sandbox = await ctx.getSandbox(environment);
    const data = await sandbox.readBinaryFile({ path });
    if (!data) {
      throw new Error(`No such file in the VM: ${path}`);
    }
    if (data.byteLength > MAX_BYTES) {
      throw new Error(
        `File is ${(data.byteLength / 1_000_000).toFixed(1)}MB; limit is 50MB.`,
      );
    }
    const safe = basename(path).replace(/[^A-Za-z0-9._-]/g, "_") || "file";
    const dir = sharedDir();
    await mkdir(dir, { recursive: true });
    const hostPath = join(dir, `${Date.now()}-${safe}`);
    await writeFile(hostPath, data);
    return {
      hostPath,
      url: `file://${hostPath}`,
      bytes: data.byteLength,
    };
  },
});
