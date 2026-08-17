'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error boundary for purely decorative subtrees.
 *
 * WebGL is the reason this exists. `HeroScene` can fail for reasons that have
 * nothing to do with our code — a blocklisted GPU driver, a browser running
 * with hardware acceleration disabled, an extension that stubs canvas APIs,
 * or a context-lost event under memory pressure. Without a boundary, any of
 * those propagate to the root and replace the entire page with the error
 * screen, which is an absurd outcome for an ornament behind the headline.
 *
 * Anything wrapped here must be non-essential: on failure it renders nothing
 * and the page continues with its CSS gradients.
 */
interface Props {
  children: ReactNode;
  /** Shown instead of the failed subtree. Defaults to nothing at all. */
  fallback?: ReactNode;
  /** Label used in the console warning, to identify which ornament failed. */
  label?: string;
}

interface State {
  failed: boolean;
}

export class SafeDecoration extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Warn rather than error: this is a handled, non-fatal degradation, and it
    // should not read as a page failure in logs or session replays.
    console.warn(
      `[decoration${this.props.label ? `:${this.props.label}` : ''}] disabled after an error —`,
      error.message,
      info.componentStack,
    );
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
