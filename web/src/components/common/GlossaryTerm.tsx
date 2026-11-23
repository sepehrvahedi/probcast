import { Link } from "@tanstack/react-router";
import { HoverCard } from "radix-ui";
import type { ReactNode } from "react";
import { type GlossaryKey, glossary } from "@/content/glossary";

/** GlossaryTerm (UX-C21): dotted underline; popover on hover and focus; "Read more" → About. */
export function GlossaryTerm({ term, children }: { term: GlossaryKey; children?: ReactNode }) {
  const g = glossary(term);
  return (
    <HoverCard.Root openDelay={250} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <Link
          to="/about/$page"
          params={{ page: "glossary" }}
          hash={term}
          className="cursor-help underline decoration-o-text-3 decoration-dotted underline-offset-[3px] hover:text-o-text"
        >
          {children ?? g.term}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="fade-in z-80 w-80 rounded-md border border-o-border bg-o-overlay p-3 text-o-text-2 text-xs leading-[1.125rem] shadow-e3"
        >
          <div className="mb-1 font-semibold text-o-text text-sm">{g.term}</div>
          {g.definition}
          <div className="mt-2 text-o-accent">Read more in the glossary →</div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
