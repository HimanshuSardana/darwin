"use client";

import { MessageSquareTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <SidebarTrigger />
          <span className="flex-1 truncate px-1 font-medium text-sm tracking-tight group-data-[collapsible=icon]:hidden">
            Chats
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupAction onClick={onNew} title="New chat">
            <PlusIcon />
            <span className="sr-only">New chat</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {sessions.length === 0 ? (
              <p className="px-2 py-6 text-center text-muted-foreground text-xs leading-relaxed group-data-[collapsible=icon]:hidden">
                No conversations yet.
                <br />
                Start one with the composer.
              </p>
            ) : (
              <SidebarMenu>
                {sessions.map((session) => (
                  <SidebarMenuItem key={session.sessionId}>
                    <SidebarMenuButton
                      isActive={session.sessionId === activeId}
                      onClick={() => onSelect(session.sessionId)}
                      tooltip={session.title}
                    >
                      <MessageSquareTextIcon />
                      <span>
                        <span className="block truncate font-normal">
                          {session.title}
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          {relativeTime(session.updatedAt)}
                        </span>
                      </span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label={`Remove "${session.title}" from list`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(session.sessionId);
                      }}
                      showOnHover
                      title="Remove from list"
                    >
                      <Trash2Icon />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-muted-foreground px-2 py-1 text-[11px] group-data-[collapsible=icon]:hidden">
          Conversations persist on the agent; the list lives in this browser.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
