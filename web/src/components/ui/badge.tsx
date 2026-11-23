import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 py-px font-medium text-xs leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-o-border bg-o-raised text-o-text-2",
        outline: "border-o-border text-o-text-2",
        accent: "border-transparent bg-o-accent-subtle text-o-accent",
        warning: "border-o-warning/50 text-o-warning",
        danger: "border-o-danger/60 text-o-danger",
        success: "border-o-success/50 text-o-success",
        tm: "border-o-tm/60 bg-o-tm-bg text-o-tm",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
