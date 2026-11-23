import { Tooltip as T } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;

/** Compact tooltip helper: `<Tip content="…"><button/></Tip>`. */
export function Tip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  delay,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  delay?: number;
}) {
  if (content == null || content === "") return <>{children}</>;
  return (
    <T.Root {...(delay !== undefined ? { delayDuration: delay } : {})}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "fade-in z-80 max-w-80 rounded-md border border-o-border bg-o-overlay px-2.5 py-1.5 text-o-text text-xs leading-4 shadow-e3",
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/** A keyboard-focusable tooltip trigger for inline text (a real button, so no tabindex hacks). */
export function InfoButton({ className, type, ...props }: React.ComponentProps<"button">) {
  return (
    <button type={type ?? "button"} className={cn("cursor-help text-left", className)} {...props} />
  );
}
