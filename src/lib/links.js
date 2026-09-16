import { openUrl } from "@tauri-apps/plugin-opener";

/** Open a URL in the user's default browser instead of navigating the webview. */
export async function openExternal(href) {
  if (!href) return;
  try {
    await openUrl(href);
  } catch {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
