import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { BookOpenIcon, FileTextIcon, HashIcon, PlayIcon } from "lucide-react";
import { useRuns } from "@/api/queries";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GLOSSARY } from "@/content/glossary";
import { COMMITTEE_TABS, ROUTES } from "@/features";

const ABOUT = [
  ["look-ahead", "How ProbCast prevents look-ahead"],
  ["scoring", "How forecasts are scored"],
  ["committee", "How the committee combines"],
  ["glossary", "Glossary"],
  ["data", "Data and licences"],
  ["disclaimer", "Disclaimer"],
] as const;

const itemCls =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-o-text-2 text-sm data-[selected=true]:bg-o-selected data-[selected=true]:text-o-text [&_svg]:size-4 [&_svg]:text-o-text-3";
const groupCls =
  "[&_[cmdk-group-heading]]:overline [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1";

/** ⌘K command palette (UX-C04, R1.2 stretch built early): navigate and open objects only. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const runs = useRuns();
  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Command palette" hideClose className="overflow-hidden p-0">
        <Command label="Command palette" className="flex max-h-[60vh] flex-col">
          <Command.Input
            autoFocus
            placeholder="Go to a page, run, committee tab or glossary term…"
            className="h-12 w-full border-o-border-subtle border-b bg-transparent px-4 text-o-text text-sm outline-none placeholder:text-o-text-3"
          />
          <Command.List className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-8 text-center text-o-text-3 text-sm">
              Nothing matches. Try an analyzer name, a run ID or a glossary term.
            </Command.Empty>
            <Command.Group heading="Pages" className={groupCls}>
              {ROUTES.filter((r) => r.enabled).map((r) => (
                <Command.Item
                  key={r.id}
                  value={`page ${r.label}`}
                  className={itemCls}
                  onSelect={() => go(() => navigate({ to: r.path }))}
                >
                  <FileTextIcon /> {r.label}
                </Command.Item>
              ))}
              <Command.Item
                value="launch a run backtest"
                className={itemCls}
                onSelect={() => go(() => navigate({ to: "/lab/run" as never }))}
              >
                <FileTextIcon /> Launch a run…
              </Command.Item>
              {COMMITTEE_TABS.filter((t) => t.enabled).map((t) => (
                <Command.Item
                  key={t.id}
                  value={`committee ${t.label}`}
                  className={itemCls}
                  onSelect={() =>
                    go(() => navigate({ to: "/committee/$tab", params: { tab: t.id } }))
                  }
                >
                  <FileTextIcon /> Committee › {t.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Runs" className={groupCls}>
              {(runs.data?.items ?? []).map((r) => (
                <Command.Item
                  key={r.run_id}
                  value={`run ${r.run_id} ${r.name} ${r.analyzer} ${r.author}`}
                  className={itemCls}
                  onSelect={() =>
                    go(() =>
                      navigate({
                        to: "/runs/$runId/$tab",
                        params: { runId: r.run_id, tab: "overview" },
                      }),
                    )
                  }
                >
                  <PlayIcon /> <span className="text-o-text">{r.name}</span>
                  <span className="ml-auto font-mono text-o-text-3 text-xs">{r.run_id}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="About" className={groupCls}>
              {ABOUT.map(([id, label]) => (
                <Command.Item
                  key={id}
                  value={`about ${label}`}
                  className={itemCls}
                  onSelect={() => go(() => navigate({ to: "/about/$page", params: { page: id } }))}
                >
                  <BookOpenIcon /> {label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Glossary" className={groupCls}>
              {GLOSSARY.map((g) => (
                <Command.Item
                  key={g.key}
                  value={`glossary ${g.term}`}
                  className={itemCls}
                  onSelect={() =>
                    go(() =>
                      navigate({ to: "/about/$page", params: { page: "glossary" }, hash: g.key }),
                    )
                  }
                >
                  <HashIcon /> {g.term}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
