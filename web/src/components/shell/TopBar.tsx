import { Link } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  CircleHelpIcon,
  ClockIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";
import { useAuthors, useStatus } from "@/api/queries";
import { HORIZONS, type Horizon, type Status } from "@/api/types";
import { Delta, slotRing } from "@/components/common/chips";
import { Metric } from "@/components/common/Metric";
import { Button } from "@/components/ui/button";
import { Kbd, Separator, Skeleton } from "@/components/ui/misc";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { COMMAND_PALETTE } from "@/features";
import { useActingAs } from "@/lib/acting-as";
import { DISCLAIMER_FULL, PRODUCT, TAGLINE } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { useHorizon, useSetHorizon } from "@/lib/horizon";
import { useSimpleMode } from "@/lib/simple";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { StockPicker } from "@/studio/StockPicker";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("size-5", className)}>
      <path d="M3 10 L17 2.5 L17 17.5 Z" fill="var(--o-fan-95)" />
      <path d="M3 10 L17 5.5 L17 14.5 Z" fill="var(--o-fan-80)" />
      <path d="M3 10 L17 8 L17 12 Z" fill="var(--o-fan-50)" />
      <path d="M3 10 L17 10" stroke="var(--o-accent)" strokeWidth="1.6" />
      <circle cx="3" cy="10" r="1.9" fill="var(--o-ink)" />
    </svg>
  );
}

function TickerContext({ status }: { status: Status | undefined }) {
  if (!status) return <Skeleton className="h-6 w-64" />;
  const t = status.ticker;
  return (
    <Popover>
      <PopoverTrigger
        className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
        aria-label={`Ticker ${t.ticker}, ${t.name}. Company card`}
      >
        <span className="font-semibold text-o-text tracking-wide">{t.ticker}</span>
        <ChevronDownIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
        <span className="hidden truncate text-o-text-2 2xl:inline">{t.name}</span>
        <span className="hidden text-o-text-3 xl:inline">·</span>
        <span className="hidden whitespace-nowrap text-o-text-3 xl:inline">
          Close {fmt.dateShort(t.last_close.date)}{" "}
          <Metric metric="ticker.last_close" prov={t.last_close.provenance} className="text-o-text">
            {fmt.price(t.last_close.price)}
          </Metric>
        </span>
        <Delta value={t.last_close.change} className="hidden text-xs xl:inline-flex" />
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="overline">Company card</div>
        <div className="mt-1 font-semibold text-md text-o-text">
          {t.ticker} · {t.name}
        </div>
        <dl className="num mt-3 grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
          <dt className="text-o-text-3">Exchange calendar</dt>
          <dd>{t.exchange}</dd>
          <dt className="text-o-text-3">Fiscal year end</dt>
          <dd>{t.fiscal_year_end}</dd>
          <dt className="text-o-text-3">Last close</dt>
          <dd>
            <Metric
              metric="ticker.last_close"
              prov={t.last_close.provenance}
              interactive
              label="Last close"
            >
              {fmt.price(t.last_close.price)}
            </Metric>{" "}
            <Delta value={t.last_close.change} className="text-xs" />{" "}
            <span className="text-o-text-3">
              {fmt.date(t.last_close.date)} (snapshot close, never live)
            </span>
          </dd>
          <dt className="text-o-text-3">Splits</dt>
          <dd className="text-o-text-2">
            {t.splits.map((s) => (
              <span key={s.ex_date} className="mr-2 inline-block">
                {s.ratio} {fmt.date(s.ex_date)}
              </span>
            ))}
          </dd>
        </dl>
        <Separator className="my-3" />
        <div className="overline mb-1.5">Ticker</div>
        <ul className="space-y-1">
          {status.tickers.map((x) => (
            <li
              key={x}
              className="flex items-center justify-between rounded-md bg-o-selected px-2 py-1 text-sm"
            >
              <span className="font-medium">{x}</span>
              <span className="text-o-text-3 text-xs">active</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-o-text-3 text-xs">
          Tickers come from <code className="font-mono">configs/tickers/</code>. Other tickers
          arrive in R2.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function AsOfPill({ status }: { status: Status | undefined }) {
  if (!status) return <Skeleton className="h-6 w-56 rounded-full" />;
  const s = status.snapshot;
  return (
    <Tip
      content={
        <div className="space-y-1">
          <div className="font-medium">Latest data in snapshot {s.id}</div>
          {status.freshness.map((f) => (
            <div key={f.dataset} className="num flex justify-between gap-4 text-o-text-2">
              <span>{f.label}</span>
              <span>
                {f.dataset === "prices"
                  ? fmt.dateTimeET(f.last_available_at)
                  : fmt.date(f.last_available_at.slice(0, 10))}
              </span>
            </div>
          ))}
          <div className="text-o-text-3">
            Runs are historical artefacts; the time machine (R1.2) does not change them.
          </div>
        </div>
      }
    >
      <InfoButton
        data-metric="asof"
        data-provenance={`snapshot:${s.id}`}
        className="num inline-flex h-7 min-w-0 max-w-[300px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-o-border px-2.5 text-o-text-2 text-xs"
      >
        <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Latest · {s.id}</span>{" "}
        <span className="hidden 2xl:inline">({fmt.date(s.asof_close.slice(0, 10))} close)</span>
      </InfoButton>
    </Tip>
  );
}

export function HorizonSelector() {
  const h = useHorizon();
  const setH = useSetHorizon();
  return (
    <ToggleGroup
      type="single"
      value={String(h)}
      onValueChange={(v) => v && setH(Number(v) as Horizon)}
      aria-label="Horizon"
      role="radiogroup"
    >
      {HORIZONS.map((x, i) => (
        <Tip
          key={x}
          content={
            <span>
              {fmt.horizon(x)} <Kbd>{i + 1}</Kbd>
            </span>
          }
        >
          <ToggleGroupItem
            value={String(x)}
            role="radio"
            aria-checked={h === x}
            aria-label={fmt.horizon(x)}
          >
            {fmt.hLabel(x)}
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
}

function ActingAsPicker() {
  const { handle, setHandle } = useActingAs();
  const authors = useAuthors();
  const me = authors.data?.items.find((a) => a.handle === handle);
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs",
          handle
            ? "border-o-border text-o-text-2 hover:text-o-text"
            : "border-o-warning text-o-warning",
        )}
        aria-label={handle ? `Acting as ${handle}. Change` : "Choose who you are acting as"}
      >
        {handle ? (
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full ring-2",
              me ? slotRing(me.slot) : "ring-o-border-input",
            )}
          />
        ) : (
          <UserRoundIcon className="size-3.5" aria-hidden="true" />
        )}
        {handle ? (
          <span>
            Acting as: <span className="font-mono text-o-text">{handle}</span>
          </span>
        ) : (
          "Choose who you are acting as"
        )}
        <ChevronDownIcon className="size-3" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="overline mb-2">Acting as</div>
        <div role="listbox" aria-label="Handles" className="space-y-0.5">
          {(authors.data?.items ?? []).map((a) => (
            <PopoverClose asChild key={a.handle}>
              <button
                type="button"
                role="option"
                aria-selected={a.handle === handle}
                onClick={() => setHandle(a.handle)}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent",
                  a.handle === handle && "bg-o-selected",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full ring-2", slotRing(a.slot))}
                />
                <span className="font-mono">{a.handle}</span>
                {a.role === "integrator" ? (
                  <span className="ml-auto text-o-text-3 text-xs">integrator</span>
                ) : null}
              </button>
            </PopoverClose>
          ))}
        </div>
        {handle ? (
          <Button variant="link" size="sm" className="mt-2" onClick={() => setHandle(null)}>
            Clear
          </Button>
        ) : null}
        <p className="mt-3 border-o-border-subtle border-t pt-2 text-o-text-3 text-xs leading-4">
          Attribution, not security: writes carry this handle. {DISCLAIMER_FULL}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Tip content={theme === "dark" ? "Light theme" : "Dark theme"}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
    </Tip>
  );
}

export function TopBar({ onHelp, onCommand }: { onHelp: () => void; onCommand: () => void }) {
  const status = useStatus();
  const simple = useSimpleMode();
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-o-border-subtle border-b bg-o-surface px-3">
      <Link
        to="/"
        className="mr-1 flex items-center gap-2 rounded-md px-1.5 py-1"
        aria-label={`${PRODUCT} home`}
      >
        <LogoMark />
        <span className="font-semibold text-[15px] text-o-text tracking-[-0.01em]">{PRODUCT}</span>
        <span className="hidden text-o-text-3 text-xs 3xl:inline">{TAGLINE}</span>
      </Link>
      <Separator orientation="vertical" className="h-5" />
      {simple ? <StockPicker /> : <TickerContext status={status.data} />}
      {simple ? null : (
        <>
          <Separator orientation="vertical" className="h-5" />
          <AsOfPill status={status.data} />
          <div className="ml-1">
            <HorizonSelector />
          </div>
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {COMMAND_PALETTE && !simple ? (
          <button
            type="button"
            onClick={onCommand}
            className="hidden h-8 w-[220px] items-center gap-2 rounded-md border border-o-border bg-o-sunken px-2.5 text-o-text-3 text-sm hover:border-o-border-input xl:flex 2xl:w-[260px]"
            aria-label="Open the command palette"
          >
            <SearchIcon className="size-3.5" aria-hidden="true" />
            Go to…
            <Kbd className="ml-auto">⌘K</Kbd>
          </button>
        ) : null}
        <Tip
          content={
            <span>
              Shortcuts and help <Kbd>?</Kbd>
            </span>
          }
        >
          <Button variant="ghost" size="icon-sm" onClick={onHelp} aria-label="Shortcuts and help">
            <CircleHelpIcon />
          </Button>
        </Tip>
        <ThemeToggle />
        {simple ? null : <ActingAsPicker />}
      </div>
    </header>
  );
}
