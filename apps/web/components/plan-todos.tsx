"use client";

import { CheckCircle2Icon, CircleDashedIcon, CircleIcon, ListChecksIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanTodo {
  readonly id: string;
  readonly title: string;
  readonly status: "pending" | "in_progress" | "completed";
  readonly notes?: string;
}

const STATUS_ICON: Record<PlanTodo["status"], typeof CircleIcon> = {
  pending: CircleIcon,
  in_progress: CircleDashedIcon,
  completed: CheckCircle2Icon,
};

/** Pull a plan out of an update_plan tool call (result preferred, input fallback). */
export function parsePlanTodos(
  input: unknown,
  output: unknown,
): { readonly summary: string | null; readonly todos: PlanTodo[] } | null {
  const data = (output ?? input) as {
    readonly summary?: unknown;
    readonly todos?: unknown;
  } | null;
  if (!data || !Array.isArray(data.todos)) return null;
  const todos = data.todos.filter(
    (todo): todo is PlanTodo =>
      typeof todo === "object" &&
      todo !== null &&
      typeof (todo as PlanTodo).title === "string" &&
      ((todo as PlanTodo).status === "pending" ||
        (todo as PlanTodo).status === "in_progress" ||
        (todo as PlanTodo).status === "completed"),
  );
  if (todos.length === 0) return null;
  return {
    summary: typeof data.summary === "string" ? data.summary : null,
    todos: todos.map((todo) => ({
      id: String((todo as { id?: unknown }).id ?? todo.title),
      notes:
        typeof (todo as { notes?: unknown }).notes === "string"
          ? (todo as { notes: string }).notes
          : undefined,
      status: todo.status,
      title: todo.title,
    })),
  };
}

/** Rendered for update_plan tool calls: the model's published task plan. */
export function PlanTodos({
  summary,
  todos,
}: {
  readonly summary?: string | null;
  readonly todos: readonly PlanTodo[];
}) {
  const done = todos.filter((todo) => todo.status === "completed").length;
  return (
    <div className="w-full rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecksIcon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">Plan</span>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {done}/{todos.length} done
        </span>
      </div>
      {summary ? (
        <p className="text-muted-foreground mb-3 text-sm leading-relaxed">{summary}</p>
      ) : null}
      <ol className="flex flex-col gap-1.5">
        {todos.map((todo, index) => {
          const Icon = STATUS_ICON[todo.status] ?? CircleIcon;
          return (
            <li className="flex items-start gap-2.5 text-sm" key={todo.id}>
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  todo.status === "completed" && "text-emerald-600 dark:text-emerald-400",
                  todo.status === "in_progress" && "text-sky-600 dark:text-sky-400",
                  todo.status === "pending" && "text-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "leading-snug",
                    todo.status === "completed" && "text-muted-foreground line-through",
                  )}
                >
                  <span className="text-muted-foreground mr-1.5 tabular-nums">{index + 1}.</span>
                  {todo.title}
                </p>
                {todo.notes ? (
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {todo.notes}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
