'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/account/logout', { method: 'POST' });
    } catch {
      // A failed request still means the customer wants out. The cookie is
      // httpOnly so the browser cannot drop it here — sending them home and
      // refreshing is the honest fallback, and the session simply survives.
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className="btn-outline btn-sm">
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
