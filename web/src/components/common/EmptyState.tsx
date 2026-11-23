import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

/** EmptyState (UX-C28): glyph, title, one or two sentences, one action or CLI hint (§7.10). */
export function EmptyState({
  title,
  body,
  action,
  cliHint,
  glyph = "◇",
  className,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  cliHint?: string;
  glyph?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}
    >
      <div aria-hidden="true" className="mb-3 text-2xl text-o-text-3">
        {glyph}
      </div>
      <div className="font-semibold text-md text-o-text">{title}</div>
      <div className="mt-1 max-w-md text-o-text-2 text-sm">{body}</div>
      {cliHint ? (
        <div className="mt-3 flex items-center gap-1 rounded-md border border-o-border-subtle bg-o-sunken py-1 pr-1 pl-3">
          <code className="font-mono text-o-text text-xs">{cliHint}</code>
          <CopyButton value={cliHint} label="command" iconOnly />
        </div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
