"use client";

import { MotionConfig } from "motion/react";
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
  // The hook's own live session, for sidebar highlight. Distinct from
  // activeId (which drives remounts): adopting a fresh session into
  // activeId would remount AgentChat mid-send and wipe its pending state.
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>(loadReasoningEffort);
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const [mode, setMode] = useState<Mode>(loadMode);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);

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
        // Adopt without touching: selecting/viewing must not reorder.
        // Timestamps move only via touchSession (user sends) below.
        setSessions((previous) =>
          upsertSession(previous, userId, session.sessionId, { touch: false }),
        );
      }
      // Adopt only into a fresh pane: remounting on first send would
      // destroy the hook store (and the optimistic sending bubble).
      setActiveId((current) => current ?? session.sessionId);
      setLiveSessionId(session.sessionId);
    },
    [userId],
  );

  const touchSession = useCallback(
    (sessionId: string | undefined) => {
      if (!userId || !sessionId) return;
      setSessions((previous) => {
        if (!previous.some((entry) => entry.sessionId === sessionId)) return previous;
        return upsertSession(previous, userId, sessionId, { touch: true });
      });
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

  const handleNew = useCallback(() => {
    setActiveId(null);
    setLiveSessionId(null);
  }, []);

  const handleSelect = useCallback(
    (sessionId: string) => {
      setActiveId(sessionId);
      setLiveSessionId(sessionId);
      if (userId) {
        // Viewing must not reorder: refresh the entry without touching time.
        setSessions((previous) => upsertSession(previous, userId, sessionId, { touch: false }));
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
      setLiveSessionId((current) => (current === sessionId ? null : current));
    },
    [userId],
  );

  const handleReasoningChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    saveReasoningEffort(effort);
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
      if (!selected) {
        setLiveSessionId(null);
        return;
      }
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
          setLiveSessionId(sessionId);
        }
      }
    },
    [userId],
  );

  const handleNewWorkspace = useCallback(
    async (input: { name: string; provider: "microvm" | "host"; packages: string[] }) => {
      const sessionId =
        input.provider === "microvm" ? await createEveSession() : undefined;
      const { workspace: record } = await createWorkspace({
        name: input.name,
        provider: input.provider,
        sessionId,
        packages: input.packages,
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
        activeId={liveSessionId ?? activeId}
        activeWorkspaceId={activeWorkspace?.id ?? null}
        onDelete={handleDelete}
        onDeleteWorkspace={(id) => {
          handleDeleteWorkspace(id).catch(() => {});
        }}
        onNew={handleNew}
        onSelect={handleSelect}
        onSelectWorkspace={handleSelectWorkspace}
        onWorkspaceDialogChange={setWorkspaceDialogOpen}
        onWorkspaceDialogSubmit={handleNewWorkspace}
        sessions={sessions}
        workspaces={workspaces}
        workspaceDialogOpen={workspaceDialogOpen}
      />
      <SidebarInset>
        <MotionConfig reducedMotion="user">
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
          onMessageSent={(sessionId) => {
            if (sessionId) touchSession(sessionId);
          }}
          onRequestNewChat={handleNew}
          onSessionChange={handleSessionChange}
          reasoningEffort={reasoningEffort}
          reasoningOnChange={handleReasoningChange}
          workspace={workspace}
          namedWorkspaces={workspaces}
          activeNamedWorkspace={activeWorkspace}
          onPickNamedWorkspace={handleSelectWorkspace}
          onNewNamedWorkspace={() => setWorkspaceDialogOpen(true)}
          mode={mode}
          modeOnChange={handleModeChange}
          namedWorkspaceContext={namedWorkspaceClientContext(activeWorkspace)}
          sessionId={activeId ?? undefined}
        />
        </MotionConfig>
      </SidebarInset>
    </SidebarProvider>
  );
}
