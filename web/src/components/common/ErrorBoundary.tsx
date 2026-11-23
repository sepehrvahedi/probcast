import { Component, type ReactNode } from "react";
import { StateNotice } from "./StateNotice";

/** Keeps one broken panel from blanking the page (UX-M01: the rest of the page keeps working). */
export class PanelBoundary extends Component<
  { thing: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(`[ProbCast] ${this.props.thing} failed to render`, error);
  }

  override render() {
    if (this.state.error) {
      return (
        <StateNotice
          kind="error"
          title={`Something went wrong drawing ${this.props.thing}.`}
          body="The rest of the page keeps working."
          details={String(this.state.error.stack ?? this.state.error.message)}
        />
      );
    }
    return this.props.children;
  }
}
