"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, BrainIcon, PlusIcon, SquareIcon } from "lucide-react";
import { useRef, useState } from "react";
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
import { ModeSelect } from "@/components/mode-select";
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
  sessionId,
  sessionless = false,
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
  readonly sessionId?: string;
  readonly sessionless?: boolean;
}) {
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
  const turnFailure = isBusy || isResuming ? undefined : getLatestTurnFailure(agent.events);
  const errorMessage = cancellationError ?? agent.error?.message ?? turnFailure;
  const hasConversationContent = sessionless || !isEmpty || errorMessage !== undefined;
  const showConversationLayout = isResuming || hasConversationContent;
  const activeSessionId = sessionId ?? agent.session?.sessionId;

  const requestCancellation = () => {
    setCancellationError(undefined);
    void agent.cancel().catch((error: unknown) => {
      setCancellationError(toErrorMessage(error));
    });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isResuming) return;

    setHasInputText(false);
    setCancellationError(undefined);
    const contexts = [
      modeClientContext(mode),
      reasoningClientContext(reasoningEffort),
      workspaceClientContext(workspace),
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

    if (message.files.length === 0) {
      await agent.send(text, options);
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

    await agent.send(parts, options);
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputBody>
        <PromptInputTextarea
          disabled={isResuming}
          onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)}
          placeholder="Send a message…"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
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

      {showConversationLayout ? (
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
              message.id === lastMessage.id ? null : (
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
            {showPendingThinking ? <PendingThinking /> : null}
            {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : null}

      <div
        className={cn(
          "w-full px-4 sm:px-6",
          showConversationLayout
            ? // Static flex child in embedded mode: centers by construction,
              // no viewport math. Standalone keeps the overlay composer.
              "mx-auto max-w-3xl shrink-0 pt-2 pb-6"
            : "mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]",
          !embedded &&
            showConversationLayout &&
            "fixed bottom-0 left-1/2 z-20 -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent pt-4",
        )}
      >
        {showConversationLayout ? null : (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
          </div>
        )}
        <div className="w-full">{composer}</div>
      </div>
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
