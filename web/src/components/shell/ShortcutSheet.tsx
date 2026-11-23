import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";

const SHORTCUTS: [string[], string][] = [
  [["G", "H"], "Home"],
  [["G", "L"], "Leaderboard"],
  [["G", "M"], "Committee"],
  [["G", "A"], "About"],
  [["1", "–", "5"], "Horizon 1W … 12M"],
  [["["], "Toggle the rail"],
  [["⌘", "K"], "Command palette (go to)"],
  [["I"], "Provenance of the focused value"],
  [["V"], "View the focused chart as a table"],
  [["←", "→"], "Move the cursor on the focused fan chart"],
  [["J", "K"], "Next / previous leaderboard row"],
  [["Esc"], "Close a drawer or dialog"],
  [["?"], "This sheet"],
];

/** Shortcut sheet (§3.9): single keys only fire when focus is not in a text field. */
export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard shortcuts and help">
        <div className="px-6 pt-5 pb-6">
          <div className="overline">Help</div>
          <h2 className="mt-1 font-semibold text-md">Keyboard shortcuts</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
            {SHORTCUTS.map(([keys, label]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-o-border-subtle border-b pb-2 text-sm"
              >
                <dt className="text-o-text-2">{label}</dt>
                <dd className="flex shrink-0 items-center gap-1">
                  {keys.map((k) =>
                    k === "–" ? (
                      <span key={k} className="text-o-text-3">
                        –
                      </span>
                    ) : (
                      <Kbd key={k}>{k}</Kbd>
                    ),
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-o-text-3 text-xs">
            Single-key shortcuts do not fire while you type in a field.{" "}
            <Link
              to="/about/$page"
              params={{ page: "glossary" }}
              className="text-o-accent underline-offset-2 hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Glossary
            </Link>{" "}
            ·{" "}
            <Link
              to="/about/$page"
              params={{ page: "look-ahead" }}
              className="text-o-accent underline-offset-2 hover:underline"
              onClick={() => onOpenChange(false)}
            >
              How ProbCast prevents look-ahead
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
