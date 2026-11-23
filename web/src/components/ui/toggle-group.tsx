import { ToggleGroup as T } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function ToggleGroup({ className, ...props }: React.ComponentProps<typeof T.Root>) {
  return (
    <T.Root
      className={cn(
        "inline-flex h-8 items-center rounded-md border border-o-border bg-o-sunken p-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof T.Item>) {
  return (
    <T.Item
      className={cn(
        "num inline-flex h-full min-w-8 items-center justify-center rounded-[4px] px-2 font-medium text-o-text-3 text-xs transition-colors duration-(--o-motion-fast) hover:text-o-text data-[state=on]:bg-o-raised data-[state=on]:text-o-text data-[state=on]:shadow-e2",
        className,
      )}
      {...props}
    />
  );
}
