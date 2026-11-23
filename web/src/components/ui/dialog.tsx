import { XIcon } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: string;
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fade-in fixed inset-0 z-60 bg-o-scrim" />
      <D.Content
        className={cn(
          "fade-in fixed top-[12vh] left-1/2 z-60 w-[min(640px,calc(100vw-48px))] -translate-x-1/2 rounded-xl border border-o-border bg-o-overlay text-o-text shadow-e4 outline-none",
          className,
        )}
        {...props}
      >
        <D.Title className="sr-only">{title}</D.Title>
        {description ? (
          <D.Description className="sr-only">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        {children}
        {hideClose ? null : (
          <D.Close
            className="absolute top-3 right-3 rounded-md p-1 text-o-text-3 hover:bg-accent hover:text-o-text"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
