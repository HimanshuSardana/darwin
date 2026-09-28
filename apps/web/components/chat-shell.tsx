"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useCallback, useState, type CSSProperties } from "react";
import { AgentChat } from "@/app/_components/agent-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "18rem";

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

  const handleDelete = useCallback(
    (sessionId: string) => {
      setSessions((previous) => removeSession(previous, sessionId));
      setActiveId((current) => (current === sessionId ? null : current));
    },
    [],
  );

  const handleReasoningChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    saveReasoningEffort(effort);
  }, []);

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background text-foreground"
      style={{ "--chat-offset": sidebarOpen ? SIDEBAR_WIDTH : "0px" } as CSSProperties}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          "h-full shrink-0 overflow-hidden border-r transition-[width] duration-200",
          "fixed z-40 md:static",
          sidebarOpen ? "w-72" : "w-0 border-r-0",
        )}
        style={sidebarOpen ? { width: SIDEBAR_WIDTH } : undefined}
        inert={!sidebarOpen}
      >
        <div className="h-full w-72">
          <ChatSidebar
            activeId={activeId}
            onDelete={handleDelete}
            onNew={handleNew}
            onSelect={handleSelect}
            sessions={sessions}
          />
        </div>
      </aside>
      {sidebarOpen ? (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-background/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      {/* Chat pane */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none fixed top-3 left-4 z-30">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                className="pointer-events-auto"
                onClick={() => setSidebarOpen((open) => !open)}
                size="icon-sm"
                variant="ghost"
              >
                {sidebarOpen ? (
                  <PanelLeftCloseIcon className="size-4" />
                ) : (
                  <PanelLeftOpenIcon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            </TooltipContent>
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
      </div>
    </div>
  );
}
