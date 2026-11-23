import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** KpiTile (UX-C13): overline title, value, sub line (CI or base rate). */
export function KpiTile({
  title,
  value,
  sub,
  children,
  className,
  insufficient = false,
}: {
  title: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
  insufficient?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-o-border-subtle bg-o-surface p-4",
        insufficient && "hatch-insufficient",
        className,
      )}
    >
      <div className="overline">{title}</div>
      <div className="min-w-0 font-semibold text-o-text text-xl">{value}</div>
      {sub ? <div className="min-w-0 text-o-text-2 text-xs leading-4">{sub}</div> : null}
      {children}
    </div>
  );
}
