import { useSyncExternalStore } from "react";

/**
 * "Acting as" handle (ADR-002, §3.5): attribution, not security. Persisted in localStorage
 * under `probcast.actingAs`. Write actions read `disabledReason` and stay disabled without one.
 */
const KEY = "probcast.actingAs";
const listeners = new Set<() => void>();
export const NO_HANDLE_REASON = "Choose who you are acting as (top right) first.";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActingAs(handle: string | null): void {
  try {
    if (handle) localStorage.setItem(KEY, handle);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useActingAs(): {
  handle: string | null;
  setHandle: (h: string | null) => void;
  disabledReason: string | null;
} {
  const handle = useSyncExternalStore(subscribe, read, () => null);
  return { handle, setHandle: setActingAs, disabledReason: handle ? null : NO_HANDLE_REASON };
}
