import { LockIcon } from "lucide-react";
import type { FreezeRecord } from "@/api/types";
import { Hash } from "@/components/common/chips";
import { CAVEATS } from "@/lib/copy";
import * as fmt from "@/lib/fmt";

/** RegisteredForecastCard (UXR1-33): display only; there is no freeze action in the app. */
export function RegisteredForecastCard({
  status,
  freeze,
  prospective,
}: {
  status: "working" | "frozen" | "baseline_only";
  freeze: FreezeRecord | null;
  prospective: {
    registered: boolean;
    registered_at?: string;
    hash?: string;
    score_on: string;
  } | null;
}) {
  if (status !== "frozen" || !freeze) {
    return <p className="text-o-text-2 text-sm leading-5">{CAVEATS.notFrozen}</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-o-text">
        <LockIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
        Committee forecast v{freeze.version} · frozen {fmt.dateTimeUK(freeze.frozen_at)}
      </div>
      <div className="flex items-center gap-2 text-o-text-2 text-xs">
        Forecast hash <Hash value={freeze.forecast_hash} n={10} />
      </div>
      {prospective?.registered && prospective.registered_at && prospective.hash ? (
        <p className="text-o-text-2 text-xs leading-4">
          {CAVEATS.registered(
            fmt.dateTimeUK(prospective.registered_at),
            fmt.hash(prospective.hash),
            fmt.date(prospective.score_on),
          )}
        </p>
      ) : null}
      <p className="text-o-text-3 text-xs">
        Frozen from the CLI. The reveal unseals scores only; the hash never changes.
      </p>
    </div>
  );
}
