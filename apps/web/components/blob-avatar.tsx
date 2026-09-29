"use client";

import { Blobatar as BlobatarFigure } from "@blobatar/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Deterministic blobatar avatar (blobatar.dev): the same seed string
 * renders the same geometric face everywhere, with nothing stored.
 * Generated in-process — no network, no third-party calls.
 */
export function BlobAvatar({
  seed,
  className,
  label,
}: {
  readonly seed: string;
  readonly className?: string;
  readonly label?: string;
}) {
  const name = seed.trim() || "user";
  const initial = (label ?? name).trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      <BlobatarFigure
        background="squircle"
        className="size-full"
        name={name}
        title={label ?? name}
      />
      <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
    </Avatar>
  );
}
