import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <EmptyState
      glyph="∅"
      title="Page not found"
      body="This address does not match a ProbCast page in this release."
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to Home</Link>
        </Button>
      }
    />
  );
}
