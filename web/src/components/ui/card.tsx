import type * as React from "react";
import { cn } from "@/lib/utils";

/** Panel card: surface + 1 px border (e1), radius-lg, 40 px header, 16 px padding (§2.6). */
export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-o-border-subtle bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex min-h-10 items-center gap-2 border-o-border-subtle border-b px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("truncate font-semibold text-o-text text-sm", className)}
      {...props}
    />
  );
}

export function CardKicker({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("overline", className)} {...props} />;
}

export function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ml-auto flex shrink-0 items-center gap-1.5", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("min-w-0 p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "border-o-border-subtle border-t px-4 py-2 text-2xs text-o-text-3 leading-[0.875rem]",
        className,
      )}
      {...props}
    />
  );
}
