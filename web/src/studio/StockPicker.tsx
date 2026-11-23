import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSetStock, useStock, useStocks } from "./api";

const bn = (x: number | null) =>
  x == null ? "" : x >= 1e12 ? `$${(x / 1e12).toFixed(1)}tn` : `$${Math.round(x / 1e9)}bn`;

/** Choose which stock the Forecast and Ideas pages show (the 32 largest US companies, D-097). */
export function StockPicker() {
  const stocks = useStocks();
  const t = useStock();
  const setT = useSetStock();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const items = stocks.data?.items ?? [];
  const cur = items.find((s) => s.ticker === t);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? items.filter((x) => x.ticker.toLowerCase().includes(s) || x.name.toLowerCase().includes(s))
      : items;
  }, [items, q]);
  const pick = (ticker: string) => {
    setT(ticker);
    setOpen(false);
    setQ("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-8 shrink-0 items-center gap-2 rounded-md border border-o-border px-2.5 text-sm hover:bg-accent"
        aria-label={`Stock: ${t}. Choose another stock`}
      >
        <span className="font-semibold text-o-text tracking-wide">{t}</span>
        <span className="hidden max-w-48 truncate text-o-text-2 lg:inline">{cur?.name ?? ""}</span>
        <ChevronDownIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-0">
        <div className="border-o-border-subtle border-b p-2">
          <div className="flex items-center gap-2 rounded-md border border-o-border-input bg-o-sunken px-2">
            <SearchIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown[0]) pick(shown[0].ticker);
              }}
              placeholder="Search a company or ticker"
              aria-label="Search stocks"
              className="h-8 w-full bg-transparent text-o-text text-sm outline-none placeholder:text-o-text-3"
            />
          </div>
          <p className="mt-1.5 px-1 text-2xs text-o-text-3">
            The {items.length} largest US companies by market value
            {stocks.data?.as_of ? ` (as of ${stocks.data.as_of})` : ""}.
          </p>
        </div>
        <ul className="max-h-[360px] overflow-y-auto py-1" aria-label="Stocks">
          {shown.map((s) => (
            <li key={s.ticker}>
              <button
                type="button"
                onClick={() => pick(s.ticker)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-accent",
                  s.ticker === t && "bg-o-selected",
                )}
              >
                <span className="num w-5 text-right text-2xs text-o-text-3">{s.rank ?? ""}</span>
                <span className="w-14 font-semibold text-o-text">{s.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-o-text-2">{s.name}</span>
                <span className="num text-2xs text-o-text-3">{bn(s.market_cap_usd)}</span>
                {s.ticker === t ? (
                  <CheckIcon className="size-3.5 text-o-accent" aria-hidden="true" />
                ) : (
                  <span className="w-3.5" />
                )}
              </button>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-o-text-3 text-sm">No match.</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
