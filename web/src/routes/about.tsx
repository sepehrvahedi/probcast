import "katex/dist/katex.min.css";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { Children, isValidElement, type ReactNode, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { EmptyState } from "@/components/common/EmptyState";
import { DisclaimerBar } from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import committee from "@/content/about/committee.md?raw";
import data from "@/content/about/data.md?raw";
import disclaimer from "@/content/about/disclaimer.md?raw";
import lookAhead from "@/content/about/look-ahead.md?raw";
import scoring from "@/content/about/scoring.md?raw";
import { GLOSSARY } from "@/content/glossary";
import { cn } from "@/lib/utils";

export const ABOUT_PAGES = [
  { id: "look-ahead", label: "How ProbCast prevents look-ahead", md: lookAhead },
  { id: "scoring", label: "How forecasts are scored", md: scoring },
  { id: "committee", label: "How the committee combines", md: committee },
  { id: "glossary", label: "Glossary", md: null },
  { id: "data", label: "Data and licences", md: data },
  { id: "disclaimer", label: "Disclaimer", md: disclaimer },
] as const;

/** Heading slug shared by the renderer and the table of contents. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((c) =>
      typeof c === "string" || typeof c === "number"
        ? String(c)
        : isValidElement(c)
          ? textOf((c.props as { children?: ReactNode }).children)
          : "",
    )
    .join("");
}

function tocOf(md: string): { id: string; text: string }[] {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => {
      const text = l.slice(3).replace(/`/g, "").trim();
      return { id: slug(text), text };
    });
}

function Prose({ md }: { md: string }) {
  return (
    <div className="prose-o">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h2: ({ children }) => <h2 id={slug(textOf(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slug(textOf(children))}>{children}</h3>,
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function GlossaryList() {
  return (
    <div className="prose-o">
      <h1>Glossary</h1>
      <p>The same definitions appear in the dotted-underline popovers across the app.</p>
      <dl className="mt-4 divide-y divide-o-border-subtle border-o-border-subtle border-y">
        {GLOSSARY.map((g) => (
          <div key={g.key} id={g.key} className="scroll-mt-4 py-3 target:bg-o-accent-subtle/40">
            <dt className="font-semibold text-o-text">
              <a href={`#${g.key}`} className="!no-underline !text-o-text hover:!underline">
                {g.term}
              </a>
            </dt>
            <dd className="mt-1">{g.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function useScrollSpy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === "undefined") return;
    const root = document.getElementById("main");
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

export function AboutPage() {
  const { page } = useParams({ strict: false }) as { page?: string };
  const hash = useLocation({ select: (l) => l.hash });
  const current = ABOUT_PAGES.find((p) => p.id === page);
  const toc = useMemo(
    () =>
      current?.md
        ? tocOf(current.md)
        : current?.id === "glossary"
          ? GLOSSARY.map((g) => ({ id: g.key, text: g.term }))
          : [],
    [current],
  );
  const ids = useMemo(() => toc.map((t) => t.id), [toc]);
  const active = useScrollSpy(ids);

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) window.setTimeout(() => el.scrollIntoView({ block: "start" }), 30);
  }, [hash]);

  if (!current) {
    return <EmptyState glyph="∅" title="Page not found" body="This About page does not exist." />;
  }

  return (
    <div>
      <PageHeader
        breadcrumb={<>About ▸ {current.label}</>}
        title="About, methodology and glossary"
      />
      <div className="grid grid-cols-[220px_minmax(0,720px)_200px] justify-start gap-8 max-2xl:grid-cols-[200px_minmax(0,720px)]">
        <nav aria-label="About pages" className="sticky top-0 self-start">
          <ul className="space-y-0.5 rounded-lg border border-o-border-subtle bg-o-surface p-2">
            {ABOUT_PAGES.map((p) => (
              <li key={p.id}>
                <Link
                  to="/about/$page"
                  params={{ page: p.id }}
                  className={cn(
                    "block rounded-md px-2.5 py-1.5 text-o-text-2 text-sm hover:bg-accent hover:text-o-text",
                    p.id === current.id && "bg-o-selected text-o-text",
                  )}
                  aria-current={p.id === current.id ? "page" : undefined}
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 rounded-lg border border-o-border-subtle bg-o-surface px-8 py-7">
          {current.md ? <Prose md={current.md} /> : <GlossaryList />}
          {current.id === "disclaimer" ? (
            <div className="mt-6">
              <DisclaimerBar variant="block" />
            </div>
          ) : null}
        </article>
        <aside aria-label="On this page" className="sticky top-0 self-start max-2xl:hidden">
          <div className="overline mb-2">On this page</div>
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto border-o-border-subtle border-l">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(t.id)
                      ?.scrollIntoView({ block: "start", behavior: "smooth" });
                  }}
                  className={cn(
                    "-ml-px block border-l py-0.5 pl-3 text-o-text-3 text-xs hover:text-o-text-2",
                    active === t.id ? "border-o-accent text-o-text" : "border-transparent",
                  )}
                >
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
