import { Popover as P } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "fade-in z-50 w-80 rounded-md border border-o-border bg-popover p-3 text-popover-foreground text-sm shadow-e3 outline-none",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
