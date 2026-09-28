/**
 * Named agent mounted by `withEve({ agents })`, if any.
 *
 * Single-agent projects like this one mount the unnamed agent at `/eve/v1/*`,
 * so this stays `undefined` and `useEveAgent` uses same-origin default routes.
 * Set it to a key of the `agents` map if the app ever mounts multiple agents.
 */
export const WEB_CHAT_AGENT: string | undefined = undefined;
