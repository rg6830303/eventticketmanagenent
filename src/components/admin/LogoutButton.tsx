'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      // Refresh before pushing so the server layout re-reads the now-absent
      // session instead of serving the cached authenticated shell.
      router.refresh();
      router.push('/admin/login');
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-full border border-edge px-3.5 py-1.5 text-[12px] font-medium text-slate transition-colors hover:border-vybe-600 hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
