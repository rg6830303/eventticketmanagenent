'use client';

import { useState } from 'react';

export function SignOutButton({ className = 'btn-outline' }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/account/logout', { method: 'POST' }).catch(() => {});
        // Full navigation so every server component forgets the session.
        window.location.assign('/');
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
