import type { Mode } from "@/lib/mode";

export interface SlashCommand {
  readonly name: string;
  readonly description: string;
  readonly hint: string;
  /**
   * Passthrough commands reach the agent verbatim (agent-side skill routing
   * handles them). Override commands rewrite the turn client-side.
   */
  readonly modeOverride?: Mode;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: "grill",
    description: "Interrogate the task before acting",
    hint: "/grill <task>",
  },
  {
    name: "plan",
    description: "Explore read-only and produce a plan",
    hint: "/plan <task>",
    modeOverride: "plan",
  },
  {
    name: "build",
    description: "Execute with full tool access",
    hint: "/build <task>",
    modeOverride: "build",
  },
];

export interface ParsedSlash {
  readonly command: SlashCommand;
  /** Text after the command; may be empty. */
  readonly rest: string;
}

/** Parse a leading /command. Unknown commands return null (sent verbatim). */
export function parseSlashCommand(text: string): ParsedSlash | null {
  const match = /^\/([A-Za-z]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  const command = SLASH_COMMANDS.find((entry) => entry.name === match[1].toLowerCase());
  if (!command) return null;
  return { command, rest: (match[2] ?? "").trim() };
}

/** Live matches for the autocomplete popup while typing "/…". */
export function matchSlashCommands(text: string): readonly SlashCommand[] {
  const match = /^\/([A-Za-z]*)$/.exec(text);
  if (!match) return [];
  const query = match[1].toLowerCase();
  return SLASH_COMMANDS.filter((entry) => entry.name.startsWith(query));
}
