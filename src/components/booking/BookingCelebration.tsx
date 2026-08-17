'use client';

import { useEffect, useState } from 'react';
import { Celebration } from '@/components/game/Celebration';

/**
 * Client seam for the confirmation page: a server component cannot hold the
 * "has this already played" state, and replaying the burst on every
 * `router.refresh()` from the resend button would cheapen the moment.
 *
 * The guard is session-scoped and keyed by reference, so a fresh booking in the
 * same tab still gets its own celebration.
 */
export function BookingCelebration({ reference }: { reference: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const key = `hov:celebrated:${reference}`;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(key) === '1';
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Private mode or a blocked storage partition — celebrate anyway.
    }
    if (!seen) setPlay(true);
  }, [reference]);

  if (!play) return null;
  return <Celebration fire />;
}
