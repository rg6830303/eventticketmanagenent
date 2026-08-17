'use client';

/**
 * Replaces the root layout when the root itself throws, so it must render its
 * own <html>/<body> and cannot rely on Tailwind — globals.css is loaded by the
 * layout that just failed. Everything here is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05070f',
          color: '#e9eefc',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '420px' }}>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            HOUZ <span style={{ color: '#1f6bff' }}>OF</span> VYBE
          </p>
          <h1 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 700 }}>
            The site failed to load
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: '15px', lineHeight: 1.6, color: '#9aa8cc' }}>
            Something broke badly enough that we couldn&apos;t render the page. Reloading usually
            fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#1f6bff',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              padding: '14px 32px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: '28px', fontSize: '11px', color: '#63719b' }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
