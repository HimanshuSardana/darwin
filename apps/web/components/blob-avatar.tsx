"use client";

import { svgFromName } from "hiblob";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Deterministic blob avatar (hiblob): same seed string renders the same
 * SVG figure on every platform, byte for byte. Served as an encoded data
 * URI so it behaves like a regular image inside shadcn Avatar.
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
  const src = useMemo(() => {
    const svg = svgFromName(seed.trim() || "user", { background: "squircle" });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [seed]);
  const initial = (label ?? seed).trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      <AvatarImage alt={label ?? seed} src={src} />
      <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
    </Avatar>
  );
}
