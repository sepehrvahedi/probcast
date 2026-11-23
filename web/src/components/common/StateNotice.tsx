import {
  BanIcon,
  ChevronDownIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  TriangleAlertIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export type NoticeKind = "info" | "stale" | "sealed" | "error" | "blocked" | "offline";

const META: Record<NoticeKind, { icon: typeof InfoIcon; glyph: string; cls: string }> = {
  info: { icon: InfoIcon, glyph: "ⓘ", cls: "border-o-border text-o-text-2" },
  stale: {
    icon: ClockIcon,
    glyph: "⚠",
    cls: "border-o-warning/50 text-o-text-2 [&_.n-icon]:text-o-warning",
  },
  sealed: { icon: LockIcon, glyph: "", cls: "border-o-border text-o-text-2 hatch-holdout" },
  error: {
    icon: TriangleAlertIcon,
    glyph: "⚠",
    cls: "border-o-danger/50 text-o-text-2 [&_.n-icon]:text-o-danger",
  },
  blocked: {
    icon: BanIcon,
    glyph: "⊘",
    cls: "border-o-danger text-o-text-2 [&_.n-icon]:text-o-danger",
  },
  offline: {
    icon: WifiOffIcon,
    glyph: "✕",
    cls: "border-o-danger/60 text-o-text-2 [&_.n-icon]:text-o-danger",
  },
};

/** StateNotice (UXR1-34): glyph + text, never colour alone. */
export function StateNotice({
  kind,
  title,
  body,
  actions,
  details,
  className,
}: {
  kind: NoticeKind;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  details?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const m = META[kind];
  const Icon = kind === "error" && !body ? XCircleIcon : m.icon;
  return (
    <div
      role={kind === "error" || kind === "blocked" || kind === "offline" ? "alert" : "status"}
      className={cn("rounded-lg border bg-o-surface px-4 py-3 text-sm", m.cls, className)}
    >
      <div className="flex items-start gap-3">
        <Icon className="n-icon mt-0.5 size-4 shrink-0 text-o-text-3" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-o-text">
            {m.glyph && kind === "blocked" ? <span className="mr-1">{m.glyph}</span> : null}
            {title}
          </div>
          {body ? <div className="mt-0.5 text-o-text-2">{body}</div> : null}
          {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
          {details ? (
            <div className="mt-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-o-text-3 text-xs hover:text-o-text-2"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                <ChevronDownIcon
                  className={cn("size-3 transition-transform", open && "rotate-180")}
                />
                Details
              </button>
              {open ? (
                <div className="mt-1.5 flex items-start gap-2 rounded-md bg-o-sunken p-2">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-o-text-2 text-xs">
                    {details}
                  </pre>
                  <CopyButton value={details} label="details" iconOnly />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
