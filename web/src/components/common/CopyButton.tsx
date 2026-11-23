import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** CopyButton (UXR1-38): polite announcement "Copied {label}". */
export function CopyButton({
  value,
  label,
  variant = "ghost",
  iconOnly = false,
  className,
}: {
  value: string;
  label: string;
  variant?: "ghost" | "outline" | "secondary";
  iconOnly?: boolean;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast(`Copied ${label}`);
      window.setTimeout(() => setDone(false), 1400);
    } catch {
      toast(`Could not copy ${label}`);
    }
  };
  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon-sm" : "sm"}
      onClick={onClick}
      aria-label={`Copy ${label}`}
      className={className}
    >
      {done ? <CheckIcon className="text-o-success" /> : <CopyIcon />}
      {iconOnly ? null : <span>Copy {label}</span>}
    </Button>
  );
}
