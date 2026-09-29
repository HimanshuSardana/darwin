import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
  description: "Scroll the page or an element (up/down/left/right, optional pixel count). Approved once per session.",
  inputSchema: z.object({
    direction: z.enum(["up", "down", "left", "right"]),
    pixels: z.number().int().positive().optional(),
    selector: z.string().optional().describe("Scroll this element instead of the page."),
  }),
  approval: once(),
  async execute({ direction, pixels, selector }) {
    const args = ["scroll", direction];
    if (pixels) args.push(String(pixels));
    if (selector) args.push("--selector", selector);
    return runBrowser(args);
  },
});
