import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

/** Toasts: bottom-right above the status bar, neutral tone, polite live region (§3.4, §7.12). */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      offset={{ bottom: 44, right: 16 }}
      toastOptions={{
        style: {
          background: "var(--o-overlay)",
          color: "var(--o-text)",
          border: "1px solid var(--o-border)",
          fontSize: "var(--text-sm)",
          borderRadius: "var(--radius-md)",
        },
      }}
    />
  );
}
