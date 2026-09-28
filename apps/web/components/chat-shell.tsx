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
import { useSession } from "@/lib/auth-client";
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
  claimSession,
  loadSessions,
  removeSession,
  titleFromMessage,
  upsertSession,
  type ChatSessionEntry,
} from "@/lib/sessions";

const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_ICON_WIDTH = "3rem";

export function ChatShell() {
  const { data: authSession } = useSession();
  const userId = authSession?.user?.id ?? null;
  const [sessions, setSessions] = useState<ChatSessionEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>(loadReasoningEffort);
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const [mode, setMode] = useState<Mode>(loadMode);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);

  // Per-user session registry: load this user's list, claim each server-side
  // (first writer wins), and drop anything owned by someone else — e.g.
  // leftovers from another account in the same browser.
  useEffect(() => {
    if (!userId) {
      setSessions([]);
      return;
    }
    const local = loadSessions(userId);
    if (local.length === 0) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    void Promise.all(local.map((entry) => claimSession(entry.sessionId))).then(
      (results) => {
        if (cancelled) return;
        setSessions(local.filter((_, index) => results[index] === true));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSessionChange = useCallback(
    (session: { readonly sessionId: string }) => {
      if (userId) {
        void claimSession(session.sessionId);
        setSessions((previous) => upsertSession(previous, userId, session.sessionId));
      }
      setActiveId(session.sessionId);
    },
    [userId],
  );

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
        return userId
          ? upsertSession(previous, userId, target.sessionId, {
              title: titleFromMessage(text),
            })
          : previous;
      });
    },
    [activeId, userId, workspaces],
  );

  const handleNew = useCallback(() => setActiveId(null), []);

  const handleSelect = useCallback(
    (sessionId: string) => {
      setActiveId(sessionId);
      if (userId) {
        setSessions((previous) => upsertSession(previous, userId, sessionId));
      }
    },
    [userId],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      if (userId) {
        setSessions((previous) => removeSession(previous, userId, sessionId));
      }
      setActiveId((current) => (current === sessionId ? null : current));
    },
    [userId],
  );

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
          if (userId) {
            void claimSession(sessionId);
            setSessions((previous) =>
              upsertSession(previous, userId, sessionId, { title: selected.name }),
            );
          }
          setActiveId(sessionId);
        }
      }
    },
    [userId],
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
