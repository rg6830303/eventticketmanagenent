'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in Vercel's runtime logs alongside the digest the user can quote.
    console.error('[app] unhandled error', error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-overlay" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vybe-700/20 blur-[110px]" />
      </div>

      <div className="relative max-w-md">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-vybe-500/40 bg-vybe-500/10">
          <span aria-hidden className="font-display text-2xl text-vybe-300">
            !
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold text-chalk sm:text-3xl">
          Something went wrong on our side.
        </h1>
        <p className="lede mt-3">
          This isn&apos;t you. Try again — if it keeps happening, send us the reference below and
          we&apos;ll chase it.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary px-7 py-3.5">
            Try again
          </button>
          <Link href="/" className="btn-ghost px-7 py-3.5">
            Back home
          </Link>
        </div>

        {/* A server error carries a digest and its message is deliberately
            withheld. A client-side error has no digest, and its message came
            from the visitor's own browser — showing it leaks nothing and is
            the only thing that makes these reportable. */}
        {error.digest ? (
          <p className="mt-8 font-mono text-[11px] text-dim">Reference: {error.digest}</p>
        ) : error.message ? (
          <p className="mx-auto mt-8 max-w-sm break-words font-mono text-[11px] leading-relaxed text-dim">
            {error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
