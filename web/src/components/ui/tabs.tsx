import { Tabs as T } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("flex h-10 items-end gap-5 border-o-border-subtle border-b", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-transparent border-b-2 font-medium text-o-text-3 text-sm transition-colors duration-(--o-motion-fast) hover:text-o-text-2 disabled:text-o-text-disabled data-[state=active]:border-o-accent data-[state=active]:text-o-text",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("fade-in outline-none", className)} {...props} />;
}
