"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, BrainIcon, ChevronDownIcon, ChevronUpIcon, ListChecksIcon, PanelRightIcon, PlusIcon, SquareIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationTopFade,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { BrowserPanel } from "@/components/browser-panel";
import { useBrowserStream } from "@/lib/use-browser-stream";
import { ModeSelect } from "@/components/mode-select";
import { SlashMenu } from "@/components/slash-menu";
import { matchSlashCommands, parseSlashCommand } from "@/lib/slash-commands";
import { PlanTodos, parsePlanTodos } from "@/components/plan-todos";
import { ReasoningSelect } from "@/components/reasoning-select";
import { WorkspaceSelect } from "@/components/workspace-select";
import { modeClientContext, type Mode } from "@/lib/mode";
import {
  reasoningClientContext,
  type ReasoningEffort,
} from "@/lib/reasoning";
import { workspaceClientContext, type Workspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { useSession } from "@/lib/auth-client";
import { WEB_CHAT_AGENT } from "@/app/eve-agent";

const DEFAULT_AGENT_NAME = "eve-agent";
const AGENT_NAME = WEB_CHAT_AGENT ?? DEFAULT_AGENT_NAME;

export function AgentChat({
  embedded = false,
  manageHistory = true,
  onFirstMessage,
  onRequestNewChat,
  onSessionChange,
  reasoningEffort = "provider-default",
  reasoningOnChange,
  workspace = "vm",
  workspaceOnChange,
  mode = "build",
  modeOnChange,
  namedWorkspaceContext,
  sessionId,
}: {
  /** Render inside the sidebar shell as a static flex column. */
  readonly embedded?: boolean;
  /** When false, skips the standalone /s/:id history rewrite. */
  readonly manageHistory?: boolean;
  /** First user message of a fresh session (for sidebar titles). */
  readonly onFirstMessage?: (text: string) => void;
  /** Override the header "New chat" action (shell switches panes instead). */
  readonly onRequestNewChat?: () => void;
  /** Every durable session cursor the hook settles on. */
  readonly onSessionChange?: (session: { readonly sessionId: string }) => void;
  /** Composer reasoning effort; sent as ephemeral turn context. */
  readonly reasoningEffort?: ReasoningEffort;
  readonly reasoningOnChange?: (effort: ReasoningEffort) => void;
  /** Composer workspace; sent as ephemeral turn context. */
  readonly workspace?: Workspace;
  readonly workspaceOnChange?: (workspace: Workspace) => void;
  /** Composer plan/build mode; sent first as ephemeral turn context. */
  readonly mode?: Mode;
  readonly modeOnChange?: (mode: Mode) => void;
  /** Named persistent workspace context; appended to ephemeral turn context. */
  readonly namedWorkspaceContext?: string | null;
  readonly sessionId?: string;
}) {
  const { data: authSession } = useSession();
  const firstName =
    authSession?.user?.name?.trim().split(/\s+/)[0] ||
    authSession?.user?.email?.split("@")[0] ||
    "there";
  const [cancellationError, setCancellationError] = useState<string>();
  const [hasInputText, setHasInputText] = useState(false);
  const titledSessionRef = useRef<string | null>(null);
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const onFirstMessageRef = useRef(onFirstMessage);
  onFirstMessageRef.current = onFirstMessage;
  const agent = useEveAgent({
    agent: WEB_CHAT_AGENT,
    initialSession:
      sessionId === undefined
        ? undefined
        : {
            sessionId,
            streamIndex: 0,
          },
    resume: sessionId !== undefined,
    onSessionChange(session) {
      if (session === undefined) return;
      if (sessionId === undefined && manageHistory) {
        // Next patches window.history to navigate, which would detach the active stream.
        History.prototype.replaceState.call(
          window.history,
          window.history.state,
          "",
          `/s/${encodeURIComponent(session.sessionId)}`,
        );
      }
      onSessionChangeRef.current?.(session);
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isResuming = agent.status === "resuming";
  const isEmpty = agent.data.messages.length === 0;
  const lastMessage = agent.data.messages.at(-1);
  const isPendingAssistantShell =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.every((part) => part.type === "step-start");
  const showPendingThinking =
    isBusy &&
    (agent.status === "submitted" || lastMessage?.role !== "assistant" || isPendingAssistantShell);
  const activePlan = useMemo(() => {
    const messages = agent.data.messages;
    for (let index = messages.length - 1; index >= 0; index--) {
      const parts = messages[index].parts;
      for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
        const part = parts[partIndex] as {
          readonly input?: unknown;
          readonly output?: unknown;
          readonly toolName?: unknown;
          readonly type?: string;
        };
        if (part.type === "dynamic-tool" && part.toolName === "update_plan") {
          const plan = parsePlanTodos(part.input, part.output);
          if (plan) return plan;
        }
      }
    }
    return null;
  }, [agent.data.messages]);
  const activeTodoCount = activePlan
    ? activePlan.todos.filter((todo) => todo.status === "completed").length
    : 0;
  const showPlanBar =
    activePlan !== null && activeTodoCount < activePlan.todos.length;
  const [planExpanded, setPlanExpanded] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [manualShot, setManualShot] = useState<string | null>(null);
  const browserActivity = useMemo(() => {
    const messages = agent.data.messages;
    let shot: string | null = null;
    let url: string | null = null;
    let active = false;
    for (let index = messages.length - 1; index >= 0; index--) {
      const parts = messages[index].parts;
      for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
        const part = parts[partIndex] as {
          readonly input?: unknown;
          readonly output?: unknown;
          readonly toolName?: unknown;
          readonly type?: string;
        };
        if (part.type !== "dynamic-tool" || typeof part.toolName !== "string") continue;
        if (!part.toolName.startsWith("browser_")) continue;
        active = true;
        if (shot === null && part.toolName === "browser_screenshot") {
          const output = part.output as { shot?: unknown } | null;
          if (output && typeof output.shot === "string") shot = output.shot;
        }
        if (url === null && part.toolName === "browser_navigate") {
          const input = part.input as { url?: unknown } | null;
          if (input && typeof input.url === "string") url = input.url;
        }
      }
    }
    return { active, shot, url };
  }, [agent.data.messages]);
  useEffect(() => {
    if (browserActivity.active) setBrowserOpen(true);
  }, [browserActivity.active]);
  const browserShotUrl = manualShot ?? (browserActivity.shot ? `/api/shots/${browserActivity.shot}` : null);
  const browserUrl = browserActivity.url;
  const browserStream = useBrowserStream(browserOpen && embedded, browserUrl);
  const refreshBrowserShot = async () => {
    try {
      const response = await fetch("/api/shots/latest");
      const data = (await response.json()) as { latest?: unknown };
      if (typeof data.latest === "string") {
        setManualShot(`/api/shots/${data.latest}?t=${Date.now()}`);
      }
    } catch {
      // Panel keeps showing the last known shot.
    }
  };
  const [composerText, setComposerText] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const slashMatches = useMemo(
    () => (slashDismissed ? [] : matchSlashCommands(composerText)),
    [composerText, slashDismissed],
  );
  // Optimistic send state: jump to the chat view immediately on submit,
  // showing the message muted + shimmering until the transcript confirms
  // it. Covers both gaps: session-create (status submitted) and model
  // cold-start (streaming, but no messages yet).
  const [pendingSend, setPendingSend] = useState<string | null>(null);
  useEffect(() => {
    setPendingSend(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.session?.sessionId]);
  const lastUserIndex = (() => {
    const messages = agent.data.messages;
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === "user") return index;
    }
    return -1;
  })();
  const turnLive = agent.status === "submitted" || agent.status === "streaming";
  const showSyntheticSend =
    pendingSend !== null && lastUserIndex === -1 && turnLive;
  // Muted styling applies to a real optimistic bubble only pre-stream.
  const isSending = agent.status === "submitted";
  const turnFailure = isBusy || isResuming ? undefined : getLatestTurnFailure(agent.events);
  const errorMessage = cancellationError ?? agent.error?.message ?? turnFailure;
  const hasConversationContent = !isEmpty || errorMessage !== undefined;
  const showConversationLayout =
    isResuming || hasConversationContent || showSyntheticSend || isSending;
  const activeSessionId = sessionId ?? agent.session?.sessionId;

  const requestCancellation = () => {
    setCancellationError(undefined);
    void agent.cancel().catch((error: unknown) => {
      setCancellationError(toErrorMessage(error));
    });
  };

  const handleComposerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.currentTarget.value;
    setComposerText(next);
    setHasInputText(next.trim().length > 0);
    setSlashDismissed(false);
    setSlashIndex(0);
  };

  const completeSlash = (name: string) => {
    setComposerText(`/${name} `);
    setSlashDismissed(true);
    setHasInputText(false);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMatches.length === 0) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setSlashDismissed(true);
    } else if (event.key === "Tab") {
      event.preventDefault();
      const pick = slashMatches[Math.min(slashIndex, slashMatches.length - 1)];
      if (pick) completeSlash(pick.name);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSlashIndex((index) => (index + 1) % slashMatches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSlashIndex((index) => (index + slashMatches.length - 1) % slashMatches.length);
    }
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const rawText = message.text.trim();
    if ((rawText.length === 0 && message.files.length === 0) || isResuming) return;

    setHasInputText(false);
    setComposerText("");
    setSlashDismissed(true);
    setCancellationError(undefined);
    // Slash commands with a mode override rewrite this turn's mode; a bare
    // "/plan" or "/build" just flips the composer toggle instead.
    let text = rawText;
    let effectiveMode = mode;
    const parsed = parseSlashCommand(rawText);
    if (parsed?.command.modeOverride) {
      if (parsed.rest.length === 0) {
        modeOnChange?.(parsed.command.modeOverride);
        return;
      }
      text = parsed.rest;
      effectiveMode = parsed.command.modeOverride;
    }
    const contexts = [
      modeClientContext(effectiveMode),
      reasoningClientContext(reasoningEffort),
      workspaceClientContext(workspace),
      namedWorkspaceContext ?? undefined,
    ].filter((entry): entry is string => entry !== undefined);
    const options =
      isBusy || contexts.length > 0
        ? {
            ...(isBusy ? { turnPolicy: "steer" as const } : {}),
            ...(contexts.length > 0 ? { clientContext: contexts } : {}),
          }
        : undefined;
    if (text.length > 0 && titledSessionRef.current !== (sessionId ?? "new")) {
      titledSessionRef.current = sessionId ?? "new";
      onFirstMessageRef.current?.(text);
    }
    // Arm the optimistic sending state *after* slash handling, right before
    // the turn actually dispatches (bare mode-switches return early above).
    if (text.length > 0) {
      setPendingSend(text);
    }

    if (message.files.length === 0) {
      try {
        await agent.send(text, options);
      } catch {
        setPendingSend(null);
      }
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) {
      parts.push({ text, type: "text" });
    }
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }

    try {
      await agent.send(parts, options);
    } catch {
      setPendingSend(null);
    }
  };

  const conversationView = !showConversationLayout ? null : (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="contents"
    >
      <Conversation
          className="min-h-0 flex-1"
          initial={sessionId === undefined ? undefined : false}
          resize={activeSessionId === undefined ? "smooth" : "instant"}
          scrollRestorationKey={
            isEmpty || activeSessionId === undefined
              ? undefined
              : `eve:web-chat-scroll:${activeSessionId}`
          }
        >
          <ConversationTopFade className={embedded ? "top-0" : "top-14"} />
          <ConversationContent
            className={cn(
              "mx-auto w-full max-w-3xl gap-6 px-4 sm:px-6",
              embedded ? "pt-6 pb-10" : "pt-20 pb-36",
            )}
          >
            {agent.data.messages.map((message, index) =>
              showPendingThinking &&
              isPendingAssistantShell &&
              message.id === lastMessage.id ? null : isSending &&
                index === lastUserIndex ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 0.55, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  key={message.id}
                >
                  <AgentMessage
                    canRespond={false}
                    isStreaming={false}
                    message={message}
                    onInputResponses={(inputResponses) => {
                      setCancellationError(undefined);
                      return agent.respond(inputResponses);
                    }}
                  />
                  <div className="text-muted-foreground mt-1 flex justify-end pr-1 text-xs">
                    <Shimmer duration={1.2}>Sending…</Shimmer>
                  </div>
                </motion.div>
              ) : (
                <AgentMessage
                  canRespond={!isBusy && !isResuming}
                  isStreaming={
                    agent.status === "streaming" && index === agent.data.messages.length - 1
                  }
                  key={message.id}
                  message={message}
                  onInputResponses={(inputResponses) => {
                    setCancellationError(undefined);
                    return agent.respond(inputResponses);
                  }}
                />
              ),
            )}
            {showSyntheticSend && pendingSend ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex justify-end"
              >
                <div className="flex max-w-[85%] flex-col items-end gap-1">
                  <div className="bg-muted text-muted-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {pendingSend}
                  </div>
                  <div className="text-muted-foreground pr-1 text-xs">
                    <Shimmer duration={1.2}>Sending…</Shimmer>
                  </div>
                </div>
              </motion.div>
            ) : null}
            {showPendingThinking ? <PendingThinking /> : null}
            {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
    </motion.div>
  );

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputBody>
        <PromptInputTextarea
          disabled={isResuming}
          onChange={handleComposerChange}
          onKeyDown={handleComposerKeyDown}
          placeholder="Send a message… ( / for commands )"
          value={composerText}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <Button
            aria-label="Toggle browser panel"
            onClick={() => setBrowserOpen((open) => !open)}
            size="icon-sm"
            title="Browser panel"
            type="button"
            variant={browserOpen ? "secondary" : "ghost"}
          >
            <PanelRightIcon className="size-4" />
          </Button>
          {modeOnChange ? (
            <ModeSelect onChange={modeOnChange} value={mode} />
          ) : null}
          {workspaceOnChange ? (
            <WorkspaceSelect onChange={workspaceOnChange} value={workspace} />
          ) : null}
          {reasoningOnChange ? (
            <ReasoningSelect onChange={reasoningOnChange} value={reasoningEffort} />
          ) : null}
        </PromptInputTools>
        <ComposerAction
          hasInputText={hasInputText}
          isBusy={isBusy}
          isResuming={isResuming}
          onCancel={requestCancellation}
        />
      </PromptInputFooter>
    </PromptInput>
  );

  const composerView = (
    <motion.div
      layout
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        "w-full px-4 sm:px-6",
        showConversationLayout
          ? "mx-auto max-w-3xl shrink-0 pt-2 pb-6"
          : "mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]",
        !embedded &&
          showConversationLayout &&
          "fixed bottom-0 left-1/2 z-20 -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent pt-4",
      )}
    >
      {showConversationLayout ? null : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <h1 className="font-medium text-5xl tracking-tighter">Hello, {firstName}</h1>
          </motion.div>
        </AnimatePresence>
      )}
      <div className="relative w-full">
        {slashMatches.length > 0 ? (
          <SlashMenu
            commands={slashMatches}
            onPick={(command) => completeSlash(command.name)}
            selectedIndex={Math.min(slashIndex, slashMatches.length - 1)}
          />
        ) : null}
        {showPlanBar && activePlan ? (
          <div className="mb-2">
            <button
              aria-expanded={planExpanded}
              className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/60"
              onClick={() => setPlanExpanded((open) => !open)}
              type="button"
            >
              <ListChecksIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">Plan</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {activeTodoCount}/{activePlan.todos.length}
              </span>
              {planExpanded ? (
                <ChevronUpIcon className="size-4 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDownIcon className="size-4 text-muted-foreground ml-auto" />
              )}
            </button>
            {planExpanded ? (
              <div className="mt-2">
                <PlanTodos summary={activePlan.summary} todos={activePlan.todos} />
              </div>
            ) : null}
          </div>
        ) : null}
        {composer}
      </div>
    </motion.div>
  );

  return (
    <main
      className={cn(
        "flex flex-col overflow-hidden bg-background text-foreground",
        embedded ? "h-svh min-h-0 min-w-0 flex-1" : "h-dvh",
      )}
    >
      {showConversationLayout ? (
        <ChatHeader
          canStartNewChat={activeSessionId !== undefined}
          embedded={embedded}
          onRequestNewChat={onRequestNewChat}
        />
      ) : null}

      {conversationView}
      {composerView}
      {embedded && browserOpen ? (
        <BrowserPanel
          fullscreen={browserFullscreen}
          live={browserStream.live}
              onClose={() => {
                setBrowserOpen(false);
                setBrowserFullscreen(false);
              }}
              onFullscreen={() => setBrowserFullscreen((full) => !full)}
              onRefresh={() => void refreshBrowserShot()}
              shotUrl={browserShotUrl}
              streamFrame={browserStream.frame}
              url={browserStream.url}
            />
          ) : null}
    </main>
  );
}

function ComposerAction({
  hasInputText,
  isBusy,
  isResuming,
  onCancel,
}: {
  readonly hasInputText: boolean;
  readonly isBusy: boolean;
  readonly isResuming: boolean;
  readonly onCancel: () => void;
}) {
  const attachments = usePromptInputAttachments();
  const canSubmit = hasInputText || attachments.files.length > 0;

  if (!isBusy || canSubmit) {
    return <PromptInputSubmit disabled={isResuming} />;
  }

  return (
    <PromptInputButton
      aria-label="Stop"
      className="absolute right-2.5 bottom-2.5"
      onClick={onCancel}
      variant="outline"
    >
      <SquareIcon className="size-3 fill-current" />
    </PromptInputButton>
  );
}

function ErrorMessage({ message }: { readonly message: string }) {
  return (
    <Message className="max-w-full" from="assistant">
      <MessageContent>
        <div
          className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="mt-0.5 text-muted-foreground">{message}</p>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}

function ChatHeader({
  canStartNewChat,
  embedded,
  onRequestNewChat,
}: {
  readonly canStartNewChat: boolean;
  readonly embedded: boolean;
  readonly onRequestNewChat?: () => void;
}) {
  return (
    <header
      className={cn(
        "pointer-events-none z-20 h-14 shrink-0",
        embedded ? "static" : "fixed top-0 right-0 left-0",
      )}
    >
      <div className="relative mx-auto flex h-full w-full max-w-3xl items-center justify-center bg-background px-24">
        <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
        {canStartNewChat ? (
          <Button
            aria-label="Start a new chat"
            className="pointer-events-auto fixed top-3 right-6 pr-4"
            onClick={() => {
              if (onRequestNewChat) {
                onRequestNewChat();
              } else {
                window.location.assign("/s");
              }
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <PlusIcon className="size-4" />
            <span className="hidden font-normal text-sm sm:inline">New chat</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function PendingThinking() {
  return (
    <Message aria-live="polite" from="assistant">
      <MessageContent>
        <div className="mb-4 flex w-full items-center gap-2 text-muted-foreground text-sm">
          <BrainIcon className="size-4" />
          <Shimmer duration={1}>Thinking</Shimmer>
        </div>
      </MessageContent>
    </Message>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to cancel the response.";
}

function getLatestTurnFailure(
  events: ReturnType<typeof useEveAgent>["events"],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "turn.failed") {
      return event.data.code === "MODEL_CALL_FAILED"
        ? "The model is temporarily unavailable. Please try again."
        : event.data.message;
    }

    if (event.type === "turn.completed" || event.type === "turn.cancelled") {
      return undefined;
    }

    if (event.type === "message.received") {
      return undefined;
    }
  }

  return undefined;
}
