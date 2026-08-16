import 'server-only';
import { query } from './db';
import type { AdminSession } from './types';

/**
 * Admin-side action log. Separate from scan_log (which records door events);
 * this one answers "who changed what" — resends, cancellations, voids, logins.
 */
export async function recordAudit(args: {
  actor?: AdminSession | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        args.actor?.sub ?? null,
        args.actor?.email ?? null,
        args.action,
        args.entity ?? null,
        args.entityId ?? null,
        JSON.stringify(args.metadata ?? {}),
        args.ipAddress ?? null,
      ],
    );
  } catch (error) {
    console.error('[audit] write failed:', error);
  }
}
