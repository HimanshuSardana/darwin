"use client";

import { useEffect, useState } from "react";

export interface BrowserStreamState {
  /** Live when the socket is open and frames are arriving. */
  readonly live: boolean;
  /** Current page URL (from stream url messages, or navigated turns). */
  readonly url: string | null;
  /** Latest frame as a data URL, for <img src>. */
  readonly frame: string | null;
}

/**
 * Watches the agent-browser WebSocket stream: discovers the port via the
 * status endpoint, renders latest-first JPEG frames, follows URL updates.
 * View-only: no input is ever sent to the browser.
 */
export function useBrowserStream(active: boolean, fallbackUrl: string | null): BrowserStreamState {
  const [port, setPort] = useState<number | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Discover the stream port while the panel is open.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/browser/stream");
        const data = (await response.json()) as {
          connected?: boolean;
          enabled?: boolean;
          port?: number | null;
        };
        if (!cancelled && data.enabled && typeof data.port === "number") {
          setPort(data.port);
        }
      } catch {
        // Retry on the next tick.
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  // Stream frames while we have a port.
  useEffect(() => {
    if (!active || port === null) return;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "config", maxFps: 10 }));
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let message: {
        data?: string;
        type?: string;
        url?: string;
      };
      try {
        message = JSON.parse(event.data) as typeof message;
      } catch {
        return;
      }
      if (message.type === "frame" && typeof message.data === "string") {
        setFrame(`data:image/jpeg;base64,${message.data}`);
      } else if (message.type === "url" && typeof message.url === "string") {
        setUrl(message.url);
      }
    };
    socket.onclose = () => {
      if (closed) return;
      // Drop the port; the discovery poll above rediscovers it.
      retryTimer = setTimeout(() => {
        if (!closed) setPort(null);
      }, 2000);
    };
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.close();
    };
  }, [active, port]);

  return { live: frame !== null, url: url ?? fallbackUrl, frame };
}
