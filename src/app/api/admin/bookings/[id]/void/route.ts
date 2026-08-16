import type { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireSession, verifyOrigin } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { transaction } from '@/lib/db';
import { clientIp } from '@/lib/validation.server';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cancel a booking and kill its passes.
 *
 * Only tickets still in 'valid' are voided — a ticket already scanned at the
 * door stays 'used', because rewriting history would destroy the only record
 * that the person actually walked in.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession('manager');
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const { id } = await params;

    const result = await transaction(async (client) => {
      const bookingResult = await client.query<BookingRow>(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [id],
      );
      const booking = bookingResult.rows[0];
      if (!booking) return null;

      await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);

      const voided = await client.query(
        "UPDATE tickets SET status = 'void' WHERE booking_id = $1 AND status = 'valid' RETURNING id",
        [id],
      );

      // Release the seats back to the tier so the room can be resold.
      if (booking.tier_id) {
        await client.query(
          'UPDATE ticket_tiers SET sold = GREATEST(0, sold - $2) WHERE id = $1',
          [booking.tier_id, booking.quantity],
        );
      }

      return { reference: booking.reference, voided: voided.rowCount ?? 0 };
    });

    if (!result) return fail('We could not find that booking', 'booking_not_found', 404);

    await recordAudit({
      actor: session,
      action: 'booking.void',
      entity: 'booking',
      entityId: id,
      metadata: { reference: result.reference, ticketsVoided: result.voided },
      ipAddress: clientIp(request.headers),
    });

    return ok(result);
  } catch (error) {
    return handleError(error, 'admin.bookings.void');
  }
}
