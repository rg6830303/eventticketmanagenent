'use client';

import { useEffect } from 'react';

/** Fire-and-forget ping that lets ordinary traffic drive the payment sweep. */
export function Heartbeat() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
