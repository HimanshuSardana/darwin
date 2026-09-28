"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { AgentChat } from "@/app/_components/agent-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  loadReasoningEffort,
  saveReasoningEffort,
  type ReasoningEffort,
} from "@/lib/reasoning";
import {
  loadSessions,
  removeSession,
  titleFromMessage,
  upsertSession,
  type ChatSessionEntry,
} from "@/lib/sessions";

const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_ICON_WIDTH = "3rem";

export function ChatShell() {
  const [sessions, setSessions] = useState<ChatSessionEntry[]>(loadSessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>(loadReasoningEffort);

  const handleSessionChange = useCallback((session: { readonly sessionId: string }) => {
    setSessions((previous) => upsertSession(previous, session.sessionId));
    setActiveId(session.sessionId);
  }, []);

  const handleFirstMessage = useCallback(
    (text: string) => {
      setSessions((previous) => {
        const target = activeId
          ? previous.find((entry) => entry.sessionId === activeId)
          : previous[0];
        if (!target || target.title !== "New chat") return previous;
        return upsertSession(previous, target.sessionId, {
          title: titleFromMessage(text),
        });
      });
    },
    [activeId],
  );

  const handleNew = useCallback(() => setActiveId(null), []);

  const handleSelect = useCallback((sessionId: string) => {
    setActiveId(sessionId);
    setSessions((previous) => upsertSession(previous, sessionId));
  }, []);

  const handleDelete = useCallback((sessionId: string) => {
    setSessions((previous) => removeSession(previous, sessionId));
    setActiveId((current) => (current === sessionId ? null : current));
  }, []);

  const handleReasoningChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    saveReasoningEffort(effort);
  }, []);

  return (
    <SidebarProvider
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={
        {
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_ICON_WIDTH,
        } as CSSProperties
      }
    >
      <ChatSidebar
        activeId={activeId}
        onDelete={handleDelete}
        onNew={handleNew}
        onSelect={handleSelect}
        sessions={sessions}
      />
      <SidebarInset>
        <div className="pointer-events-none fixed top-3 left-4 z-30 md:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="pointer-events-auto inline-flex">
                <SidebarTrigger />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Show sidebar</TooltipContent>
          </Tooltip>
        </div>
        <AgentChat
          embedded
          key={activeId ?? "new"}
          manageHistory={false}
          onFirstMessage={handleFirstMessage}
          onRequestNewChat={handleNew}
          onSessionChange={handleSessionChange}
          reasoningEffort={reasoningEffort}
          reasoningOnChange={handleReasoningChange}
          sessionId={activeId ?? undefined}
          sessionless={activeId === null}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
