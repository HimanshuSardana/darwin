import { defineTool } from "eve/tools";
import { z } from "zod";

const todoSchema = z.object({
  id: z.string().min(1).describe("Stable id for this todo, e.g. \"explore-auth\"."),
  title: z.string().min(1).describe("Short imperative title, e.g. \"Read the auth middleware\"."),
  status: z.enum(["pending", "in_progress", "completed"]),
  notes: z.string().optional().describe("Findings, file paths, or decisions for this todo."),
});

// update_plan is side-effect free (pure echo): safe in every mode, no approval.
export default defineTool({
  description:
    "Publish or update the task plan. REQUIRED in plan mode: explore with read-only " +
    "tools, then record the plan here so the user can review it. In build mode, call " +
    "again to mark todos in_progress/completed as work proceeds. At most one todo " +
    "should be in_progress at a time.",
  inputSchema: z.object({
    todos: z.array(todoSchema).min(1).max(50),
    summary: z.string().optional().describe("One-paragraph plan overview for the user."),
  }),
  async execute({ todos, summary }) {
    const done = todos.filter((todo) => todo.status === "completed").length;
    return {
      todos,
      summary: summary ?? null,
      total: todos.length,
      done,
      updatedAt: new Date().toISOString(),
    };
  },
});
