"use client";

import { Blobatar as BlobatarFigure } from "@blobatar/react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Deterministic blobatar avatar (blobatar.dev): the same seed string
 * renders the same geometric face everywhere, with nothing stored.
 * Generated in-process — no network, no third-party calls.
 *
 * Rendered as plain inline SVG (not AvatarImage): there is no remote
 * image to load or fail, so the letter fallback must stay out, otherwise
 * Radix displays it next to the figure.
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
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      <BlobatarFigure
        background="squircle"
        className="size-full"
        name={name}
        size={32}
        title={label ?? name}
      />
    </Avatar>
  );
}
