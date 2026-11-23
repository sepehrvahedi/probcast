import { useEffect, useRef } from "react";

/** True when focus is in a text field, where single-key shortcuts must not fire (WCAG 2.1.4). */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "range"].includes(type);
  }
  return target.getAttribute("role") === "combobox";
}

type Handler = (e: KeyboardEvent) => void;

/**
 * Single-key and `G x` chord shortcuts (§3.9). Keys are matched on `e.key` (case-insensitive
 * for letters). Chords are written "g h". Modifier combos are ignored except where listed.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (pending) {
        const chord = `${pending} ${key}`;
        pending = null;
        window.clearTimeout(timer);
        const h = ref.current[chord];
        if (h) {
          e.preventDefault();
          h(e);
        }
        return;
      }
      if (Object.keys(ref.current).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        timer = window.setTimeout(() => {
          pending = null;
        }, 1200);
        return;
      }
      const h = ref.current[key] ?? ref.current[e.key];
      if (h) {
        e.preventDefault();
        h(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [enabled]);
}
