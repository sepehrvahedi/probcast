import type { Provenance } from "@/api/types";
import { serialiseProv } from "@/lib/prov";
import { type VerdictFields, verdictSentences } from "./verdict";

/** VerdictCard (UXR1-21): renders the §7.3 template only; accepts no children and no free text. */
export function VerdictCard({ fields, prov }: { fields: VerdictFields; prov: Provenance }) {
  const [headline, ...rest] = verdictSentences(fields);
  return (
    <div
      data-metric="verdict"
      data-provenance={serialiseProv(prov, `verdict.${fields.h}`)}
      className="rounded-lg border border-o-border-subtle bg-o-surface px-5 py-4"
    >
      <p className="max-w-[110ch] text-base text-o-text-2 leading-[1.5rem]">
        <span className="mr-1.5 font-semibold text-o-text">{headline}</span>
        {rest.join(" ")}
      </p>
    </div>
  );
}
