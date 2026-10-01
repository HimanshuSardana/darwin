import { Suspense } from "react";
import { ChatShell } from "@/components/chat-shell";

export default function Page() {
  return (
    <Suspense>
      <ChatShell />
    </Suspense>
  );
}
