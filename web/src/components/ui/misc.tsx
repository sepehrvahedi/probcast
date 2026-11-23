import { Separator as S } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-o-border-subtle",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

/** Skeleton (UX-C29): static under reduced motion. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-xs bg-o-hover", className)}
      {...props}
    />
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-o-border bg-o-sunken px-1 font-mono text-2xs text-o-text-2",
        className,
      )}
      {...props}
    />
  );
}
