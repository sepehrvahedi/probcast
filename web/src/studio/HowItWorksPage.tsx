import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GLOSSARY } from "./words";

const STEPS = [
  {
    title: "You write an idea",
    body: "Any belief about what moves the price, in plain words. For example: “when the dollar gets stronger, Apple's price falls”.",
  },
  {
    title: "It becomes an exact rule",
    body: "It decides exactly what to measure and when, using standard settings from published research (never tuned to make the result look good), and checks automatically that the rule can't peek at the future.",
  },
  {
    title: "We test it on history",
    body: "We go back to the end of every month since 1990 and do this for each of the 32 largest US companies. Each time, the idea sees only what was known on that day and forecasts the price 1 week, 1 month, 3 months, 6 months and 1 year ahead. Then we compare with what really happened.",
  },
  {
    title: "We grade it",
    body: "Each idea is compared with a simple guess that knows nothing clever. We check it over the last year, 3, 5 and 10 years and all history, with recent years counting more, so you can see whether it still works.",
  },
  {
    title: "The ideas are combined",
    body: "Ideas that beat the simple guess get a say in the final forecast in proportion to how well they did. Ideas that don't, get no say. The result is one forecast: a best guess, a likely range, and the chance the price ends higher.",
  },
];

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader simple title="How it works" />
      <Card>
        <CardHeader>
          <CardTitle>In five steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-o-accent-subtle font-semibold text-o-accent text-sm">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium text-o-text">{s.title}</div>
                  <p className="text-o-text-2 text-sm leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What every word on the screen means</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-o-border-subtle">
            {GLOSSARY.map((g) => (
              <div
                key={g.term}
                className="grid grid-cols-1 gap-1 py-3 md:grid-cols-[220px_1fr] md:gap-4"
              >
                <dt className="font-medium text-o-text text-sm">{g.term}</dt>
                <dd className="text-o-text-2 text-sm leading-relaxed">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-5 text-o-text-2 text-sm leading-relaxed">
          <div className="font-medium text-o-text">An honest warning</div>
          <p>
            Share prices are very hard to predict. Even good ideas are only slightly better than the
            simple guess, and every forecast comes with a wide range. ProbCast is an educational
            research tool, not investment advice. The 32 companies were picked because they are the
            biggest today, so their past looks better than it felt at the time (survivor bias).
          </p>
          <p>
            Ready to try?{" "}
            <Link to="/ideas" className="text-o-accent hover:underline">
              Write an idea
            </Link>{" "}
            or{" "}
            <Link to="/" className="text-o-accent hover:underline">
              see the forecast
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
