"use client";

import { MessageSquareTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChatSessionEntry } from "@/lib/sessions";

function relativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ChatSidebar({
  activeId,
  onDelete,
  onNew,
  onSelect,
  sessions,
}: {
  readonly activeId: string | null;
  readonly onDelete: (sessionId: string) => void;
  readonly onNew: () => void;
  readonly onSelect: (sessionId: string) => void;
  readonly sessions: readonly ChatSessionEntry[];
}) {
  return (
    <div className="flex h-full w-full flex-col bg-muted/40">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <span className="px-1 font-medium text-sm tracking-tight">Chats</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Start a new chat" onClick={onNew} size="icon-sm" variant="ghost">
              <PlusIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New chat</TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-muted-foreground text-xs leading-relaxed">
            No conversations yet.
            <br />
            Start one with the composer.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const isActive = session.sessionId === activeId;
              return (
                <li key={session.sessionId} className="group relative">
                  <Button
                    className={cn(
                      "h-auto w-full justify-start gap-2 py-2 pr-8 pl-2.5 text-left",
                      !isActive && "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onSelect(session.sessionId)}
                    variant={isActive ? "secondary" : "ghost"}
                  >
                    <MessageSquareTextIcon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-normal text-sm">
                        {session.title}
                      </span>
                      <span className="block text-muted-foreground text-[11px]">
                        {relativeTime(session.updatedAt)}
                      </span>
                    </span>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={`Delete "${session.title}"`}
                        className="absolute top-1/2 right-1 size-7 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(session.sessionId);
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Remove from list</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Separator />
      <p className="px-4 py-2.5 text-muted-foreground text-[11px]">
        Conversations persist on the agent; the list lives in this browser.
      </p>
    </div>
  );
}
