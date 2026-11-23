/**
 * UXR1-07 feature flags per drop. The rail and ⌘K show only enabled routes; a link to a
 * disabled route renders as plain text with the tooltip below. There is no "coming soon" page.
 */
export type Drop = "R1.0" | "R1.1" | "R1.2";

export interface RouteFeature {
  id: string;
  label: string;
  path: string;
  drop: Drop;
  enabled: boolean;
  /** Rail group: the simple main flow, the expert screens, or the bottom block. */
  group?: "main" | "advanced" | "bottom";
}

export const DISABLED_TOOLTIP = "Arrives in a later update";

export const ROUTES: RouteFeature[] = [
  { id: "home", label: "Forecast", path: "/", drop: "R1.0", enabled: true, group: "main" },
  { id: "ideas", label: "Ideas", path: "/ideas", drop: "R1.0", enabled: true, group: "main" },
  {
    id: "rankings",
    label: "Rankings",
    path: "/rankings",
    drop: "R1.0",
    enabled: true,
    group: "main",
  },
  {
    id: "how",
    label: "How it works",
    path: "/how-it-works",
    drop: "R1.0",
    enabled: true,
    group: "main",
  },
  {
    id: "data",
    label: "Data explorer",
    path: "/data/price",
    drop: "R1.1",
    enabled: true,
    group: "advanced",
  },
  {
    id: "classic",
    label: "Committee home",
    path: "/classic",
    drop: "R1.0",
    enabled: true,
    group: "advanced",
  },
  {
    id: "committee",
    label: "Committee",
    path: "/committee/forecast",
    drop: "R1.0",
    enabled: true,
    group: "advanced",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    path: "/leaderboard",
    drop: "R1.0",
    enabled: true,
    group: "advanced",
  },
  {
    id: "analyzers",
    label: "Analyzers",
    path: "/analyzers",
    drop: "R1.1",
    enabled: true,
    group: "advanced",
  },
  {
    id: "events",
    label: "Events",
    path: "/events",
    drop: "R1.1",
    enabled: true,
    group: "advanced",
  },
  {
    id: "report",
    label: "Report pack",
    path: "/report/figures",
    drop: "R1.1",
    enabled: true,
    group: "advanced",
  },
  {
    id: "lab",
    label: "Pre-registration lab",
    path: "/lab",
    drop: "R1.1",
    enabled: true,
    group: "advanced",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    drop: "R1.1",
    enabled: true,
    group: "bottom",
  },
  {
    id: "about",
    label: "About",
    path: "/about/look-ahead",
    drop: "R1.0",
    enabled: true,
    group: "bottom",
  },
];

/** Committee tabs: Forecast and Attribution are R1.0; the rest shipped early in this build. */
export const COMMITTEE_TABS = [
  { id: "forecast", label: "Forecast", drop: "R1.0", enabled: true },
  { id: "attribution", label: "Attribution", drop: "R1.0", enabled: true },
  { id: "scenarios", label: "Scenarios", drop: "R1.1", enabled: true },
  { id: "members", label: "Members & gate log", drop: "R1.1", enabled: true },
  { id: "anchor", label: "Anchor sensitivity", drop: "R1.1", enabled: true },
  { id: "freeze", label: "Freeze history", drop: "R1.1", enabled: true },
] as const;

export type CommitteeTab = (typeof COMMITTEE_TABS)[number]["id"];

/** ⌘K command palette (UX-C04): navigation only. Stretch (R1.2), built early. */
export const COMMAND_PALETTE = true;
