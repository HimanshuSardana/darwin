"use client";

import { BotIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import type { ChatSessionEntry } from "@/lib/sessions";
import type { WorkspaceProvider } from "@/components/workspace-dialog";
import type { WorkspaceRecord } from "@/lib/workspaces";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { NavUser } from "@/components/nav-user";
import { SettingsDialog } from "@/components/settings-dialog";
import { WorkspaceDialog } from "@/components/workspace-dialog";

function relativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ChatSidebar({
  activeId,
  activeWorkspaceId,
  onDelete,
  onDeleteWorkspace,
  onNew,
  onSelect,
  onSelectWorkspace,
  sessions,
  workspaces,
  workspaceDialogOpen,
  onWorkspaceDialogChange,
  onWorkspaceDialogSubmit,
}: {
  readonly activeId: string | null;
  readonly activeWorkspaceId: string | null;
  readonly onDelete: (sessionId: string) => void;
  readonly onDeleteWorkspace: (id: string) => void;
  readonly onNew: () => void;
  readonly onSelect: (sessionId: string) => void;
  readonly onSelectWorkspace: (workspace: WorkspaceRecord | null) => void;
  readonly sessions: readonly ChatSessionEntry[];
  readonly workspaces: readonly WorkspaceRecord[];
  readonly workspaceDialogOpen: boolean;
  readonly onWorkspaceDialogChange: (open: boolean) => void;
  readonly onWorkspaceDialogSubmit: (input: {
    name: string;
    provider: WorkspaceProvider;
  }) => Promise<void>;
}) {
  // On mobile the sidebar is a Sheet overlay (separate openMobile state
  // inside the provider). Dismiss it when the user picks a destination;
  // on desktop this is a no-op.
  const { isMobile, setOpenMobile } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: authSession } = useSession();
  const userName =
    authSession?.user?.name?.trim() ||
    authSession?.user?.email?.split("@")[0] ||
    "User";
  const userEmail = authSession?.user?.email ?? "";
  const [workspaceDialogPending, setWorkspaceDialogPending] = useState(false);
  const [workspaceDialogError, setWorkspaceDialogError] = useState<string | null>(null);
  const router = useRouter();
  const signOut = () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/signin");
          router.refresh();
        },
      },
    });
  };
  const dismissMobileSheet = () => {
    if (isMobile) setOpenMobile(false);
  };
  const handleSelect = (sessionId: string) => {
    dismissMobileSheet();
    onSelect(sessionId);
  };
  const handleNew = () => {
    dismissMobileSheet();
    onNew();
  };
  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <SidebarMenuButton size="lg" tooltip="darwin">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <BotIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">darwin</span>
                  <span className="truncate text-xs">Agent harness</span>
                </div>
              </SidebarMenuButton>
              <SidebarTrigger className="shrink-0" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupAction
            onClick={() => onWorkspaceDialogChange(true)}
            title="Spin up workspace"
          >
            <PlusIcon />
            <span className="sr-only">Spin up workspace</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {workspaces.length === 0 ? null : (
              <SidebarMenu>
                {workspaces.map((workspaceRecord) => {
                  return (
                    <SidebarMenuItem key={workspaceRecord.id}>
                      <SidebarMenuButton
                        isActive={workspaceRecord.id === activeWorkspaceId}
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                        onClick={() => {
                          dismissMobileSheet();
                          onSelectWorkspace(
                            workspaceRecord.id === activeWorkspaceId ? null : workspaceRecord,
                          );
                        }}
                        tooltip={workspaceRecord.name}
                      >
                        <span>
                          <span className="block truncate font-normal">
                            {workspaceRecord.name}
                          </span>
                          <span className="text-muted-foreground block text-[11px]">
                            {workspaceRecord.provider === "host" ? "Host directory" : "MicroVM"}
                          </span>
                        </span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        aria-label={`Delete workspace "${workspaceRecord.name}"`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteWorkspace(workspaceRecord.id);
                        }}
                        showOnHover
                        title="Delete workspace"
                      >
                        <Trash2Icon />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupAction onClick={handleNew} title="New chat">
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
                      onClick={() => handleSelect(session.sessionId)}
                      tooltip={session.title}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-has-data-[sidebar=menu-action]/menu-item:pr-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-normal text-sm">
                        {session.title}
                      </span>
                      <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums group-hover/menu-item:invisible">
                        {relativeTime(session.updatedAt)}
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
        <NavUser
          email={userEmail}
          name={userName}
          onSettings={() => {
            dismissMobileSheet();
            setSettingsOpen(true);
          }}
          onSignOut={signOut}
        />
      </SidebarFooter>
      <SidebarRail />
      <SettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
      <WorkspaceDialog
        error={workspaceDialogError}
        onOpenChange={(open) => {
          onWorkspaceDialogChange(open);
          if (open) setWorkspaceDialogError(null);
        }}
        onSubmit={async (input) => {
          setWorkspaceDialogPending(true);
          setWorkspaceDialogError(null);
          try {
            await onWorkspaceDialogSubmit(input);
            onWorkspaceDialogChange(false);
          } catch (error) {
            setWorkspaceDialogError(
              error instanceof Error ? error.message : "Could not spin up workspace.",
            );
          } finally {
            setWorkspaceDialogPending(false);
          }
        }}
        open={workspaceDialogOpen}
        pending={workspaceDialogPending}
      />
    </Sidebar>
  );
}
