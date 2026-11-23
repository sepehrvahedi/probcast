import { XIcon } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

/** Right drawer, 440 px, e3 (§2.6, §3.4). Esc closes; focus is trapped and returned. */
export function SheetContent({
  className,
  children,
  title,
  kicker,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: React.ReactNode; kicker?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fade-in fixed inset-0 z-40 bg-o-scrim/40" />
      <D.Content
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-[440px] max-w-[100vw] flex-col border-o-border border-l bg-o-overlay text-o-text shadow-e3 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-(--o-motion-slow)",
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3 border-o-border-subtle border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            {kicker ? <div className="overline mb-1">{kicker}</div> : null}
            <D.Title className="font-semibold text-md text-o-text">{title}</D.Title>
            <D.Description className="sr-only">Details panel</D.Description>
          </div>
          <D.Close
            className="rounded-md p-1 text-o-text-3 hover:bg-accent hover:text-o-text"
            aria-label="Close panel"
          >
            <XIcon className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
