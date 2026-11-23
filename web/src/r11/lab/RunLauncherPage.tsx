import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RunLauncherDialog } from "./RunLauncher";
import type { RunSearch } from "./search";

/**
 * `/lab/run?analyzer=` opens the run launcher directly: a deep link for ⌘K, the Leaderboard row
 * menu and the analyzer detail page when they cannot host the dialog themselves.
 */
export function RunLauncherPage() {
  const { analyzer } = useSearch({ strict: false }) as RunSearch;
  const [open, setOpen] = useState(true);
  return (
    <div>
      <PageHeader title="Run launcher" breadcrumb={<Link to="/lab">Idea lab</Link>} />
      <Card className="max-w-2xl">
        <CardContent className="space-y-3 text-o-text-2 text-sm">
          <p>
            Runs the standard walk-forward protocol for one analyzer with a declared preset. The
            trial count is shown before launch; an identical configuration opens the existing run
            and adds no trial.
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Open the run launcher
          </Button>
        </CardContent>
      </Card>
      <RunLauncherDialog open={open} onOpenChange={setOpen} analyzerId={analyzer ?? null} />
    </div>
  );
}
