import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";
import { latestShot, nextShotPath, runBrowser } from "../lib/browser";

export default defineTool({
  description:
    "Capture a screenshot of the browser into the shared shots folder. The image appears automatically in the user's browser panel — mention what you see only if asked. Returns the shot filename.",
  inputSchema: z.object({}),
  approval: never(),
  async execute() {
    const path = nextShotPath();
    const result = await runBrowser(["screenshot", path]);
    return { ...result, shot: result.exitCode === 0 ? path.split("/").pop() : null, latest: latestShot() };
  },
});
