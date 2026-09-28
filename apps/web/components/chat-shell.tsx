"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AgentChat } from "@/app/_components/agent-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { loadMode, saveMode, type Mode } from "@/lib/mode";
import {
  loadReasoningEffort,
  saveReasoningEffort,
  type ReasoningEffort,
} from "@/lib/reasoning";
import {
  loadWorkspace,
  saveWorkspace,
  type Workspace,
} from "@/lib/workspace";
import {
  createEveSession,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  namedWorkspaceClientContext,
  type WorkspaceRecord,
} from "@/lib/workspaces";
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
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const [mode, setMode] = useState<Mode>(loadMode);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);

  const handleSessionChange = useCallback((session: { readonly sessionId: string }) => {
    setSessions((previous) => upsertSession(previous, session.sessionId));
    setActiveId(session.sessionId);
  }, []);

  const handleFirstMessage = useCallback(
    (text: string) => {
      const workspaceSessionIds = new Set(
        workspaces.map((entry) => entry.sessionId).filter((id) => id !== null),
      );
      setSessions((previous) => {
        const target = activeId
          ? previous.find((entry) => entry.sessionId === activeId)
          : previous[0];
        if (!target || target.title !== "New chat") return previous;
        // Workspace-bound sessions keep the workspace name.
        if (workspaceSessionIds.has(target.sessionId)) return previous;
        return upsertSession(previous, target.sessionId, {
          title: titleFromMessage(text),
        });
      });
    },
    [activeId, workspaces],
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

  const handleWorkspaceChange = useCallback((next: Workspace) => {
    setWorkspace(next);
    saveWorkspace(next);
  }, []);

  const handleModeChange = useCallback((next: Mode) => {
    setMode(next);
    saveMode(next);
  }, []);

  useEffect(() => {
    listWorkspaces()
      .then(({ workspaces }) => setWorkspaces(workspaces))
      .catch(() => setWorkspaces([]));
  }, []);

  const handleSelectWorkspace = useCallback(
    (selected: WorkspaceRecord | null) => {
      setActiveWorkspace(selected);
      if (!selected) return;
      // Pair the execution target with the workspace kind (overridable after).
      if (selected.provider === "host") {
        setWorkspace("local");
        saveWorkspace("local");
      } else {
        setWorkspace("vm");
        saveWorkspace("vm");
        if (selected.sessionId) {
          const sessionId = selected.sessionId;
          setSessions((previous) =>
            upsertSession(previous, sessionId, { title: selected.name }),
          );
          setActiveId(sessionId);
        }
      }
    },
    [],
  );

  const handleNewWorkspace = useCallback(
    async (input: { name: string; provider: "microvm" | "host" }) => {
      const sessionId =
        input.provider === "microvm" ? await createEveSession() : undefined;
      const { workspace: record } = await createWorkspace({
        name: input.name,
        provider: input.provider,
        sessionId,
      });
      const { workspaces: fresh } = await listWorkspaces();
      setWorkspaces(fresh);
      handleSelectWorkspace(record);
    },
    [handleSelectWorkspace],
  );

  const handleDeleteWorkspace = useCallback(
    async (id: string) => {
      await deleteWorkspace(id);
      setActiveWorkspace((current) => (current?.id === id ? null : current));
      const { workspaces: fresh } = await listWorkspaces().catch(() => ({
        workspaces: [],
      }));
      setWorkspaces(fresh);
    },
    [],
  );

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
        activeWorkspaceId={activeWorkspace?.id ?? null}
        onDelete={handleDelete}
        onDeleteWorkspace={(id) => {
          handleDeleteWorkspace(id).catch(() => {});
        }}
        onNew={handleNew}
        onNewWorkspace={handleNewWorkspace}
        onSelect={handleSelect}
        onSelectWorkspace={handleSelectWorkspace}
        sessions={sessions}
        workspaces={workspaces}
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
          workspace={workspace}
          workspaceOnChange={handleWorkspaceChange}
          mode={mode}
          modeOnChange={handleModeChange}
          namedWorkspaceContext={namedWorkspaceClientContext(activeWorkspace)}
          sessionId={activeId ?? undefined}
          sessionless={activeId === null}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
