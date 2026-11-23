import type * as React from "react";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";

const SLOT_BG = ["bg-o-s1", "bg-o-s2", "bg-o-s3", "bg-o-s4", "bg-o-s5", "bg-o-s6"];
const SLOT_RING = ["ring-o-s1", "ring-o-s2", "ring-o-s3", "ring-o-s4", "ring-o-s5", "ring-o-s6"];

export function slotBg(slot: number): string {
  return SLOT_BG[(Math.max(1, slot) - 1) % 6] as string;
}
export function slotRing(slot: number): string {
  return SLOT_RING[(Math.max(1, slot) - 1) % 6] as string;
}

/** AnalyzerChip (UX-C09): 8 px colour square (aria-hidden) + name. */
export function AnalyzerChip({
  name,
  slot,
  version,
  className,
}: {
  id?: string;
  name: string;
  slot: number;
  version?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-[2px]", slotBg(slot))} />
      <span className="truncate text-o-text">{name}</span>
      {version ? <span className="font-mono text-2xs text-o-text-3">{version}</span> : null}
    </span>
  );
}

/** AuthorChip (UX-C06): ring colour + handle; never a real name. */
export function AuthorChip({
  handle,
  slot,
  className,
}: {
  handle: string;
  slot?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-o-text-2", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full ring-2", slot ? slotRing(slot) : "ring-o-border-input")}
      />
      <span className="font-mono text-xs">{handle}</span>
    </span>
  );
}

/** Signed change with glyph and colour together (never colour alone). Input: fraction. */
export function Delta({
  value,
  dp = 1,
  className,
  ...rest
}: { value: number; dp?: number; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const r = fmt.ret(value, dp);
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 whitespace-nowrap",
        r.dir === "up" ? "text-o-up" : r.dir === "down" ? "text-o-down" : "text-o-text-3",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="text-[0.75em]">
        {r.glyph}
      </span>
      <span>{r.text}</span>
      <span className="sr-only">
        {r.dir === "up" ? "up" : r.dir === "down" ? "down" : "unchanged"}
      </span>
    </span>
  );
}

/** Horizon chip: `12M · 252 sessions`, or `12M · fixed`. */
export function HorizonChip({ h, fixed = false }: { h: number; fixed?: boolean }) {
  return (
    <span className="num inline-flex h-5 items-center rounded-xs border border-o-border px-1.5 text-2xs text-o-text-2">
      {fixed ? `${fmt.hLabel(h)} · fixed` : `${fmt.hLabel(h)} · ${h} s`}
    </span>
  );
}

/** Hash: first 6 characters in mono; full on hover. */
export function Hash({ value, n = 6 }: { value: string; n?: number }) {
  return (
    <Tip content={<span className="break-all font-mono">{value}</span>}>
      <span className="cursor-default font-mono text-o-text-2 text-xs">{fmt.hash(value, n)}</span>
    </Tip>
  );
}
