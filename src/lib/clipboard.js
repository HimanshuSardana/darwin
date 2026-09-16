import { writeText } from "@tauri-apps/plugin-clipboard-manager";

/** Copy text, preferring the Tauri clipboard plugin with a DOM fallback. */
export async function copyText(text) {
  try {
    await writeText(text);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
