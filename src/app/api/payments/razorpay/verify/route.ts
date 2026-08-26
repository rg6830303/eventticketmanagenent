import type { NextRequest } from 'next/server';
import { fail, handleError, ok, readJson } from '@/lib/api';
import { verifyOrigin } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { env } from '@/lib/env';
import { confirmPendingBooking } from '@/lib/bookings';
import { deliverTickets, recordPayment, verifyCheckoutSignature } from '@/lib/payments';
import type { BookingRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Browser-side confirmation after Razorpay checkout succeeds.
 *
 * The signature is the only thing that authorises the state change — the
 * payment ids in the body come from the client and are attacker-controlled
 * until the HMAC checks out.
 */
export async function POST(request: NextRequest) {
  try {
    if (!env.paymentsEnabled) {
      return fail(
        'Online payment is not enabled yet — booking is currently free',
        'payments_disabled',
        503,
      );
    }
    if (!env.razorpay.keySecret) {
      console.error('[payments] RAZORPAY_KEY_SECRET is not set — cannot verify a payment');
      return fail(
        'We could not confirm this payment. Do not pay again — contact us with your booking reference.',
        'payments_misconfigured',
        503,
      );
    }
    if (!verifyOrigin(request.headers)) return fail('Request blocked', 'bad_origin', 403);

    const body = (await readJson(request)) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail('Incomplete payment confirmation', 'missing_payment_fields', 400);
    }

    const signatureValid = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!signatureValid) {
      console.error('[payments] signature mismatch', { order: razorpay_order_id });
      await recordPayment({
        bookingId: null,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: 'SIGNATURE_MISMATCH',
        source: 'verify',
        message: 'Rejected: signature did not verify',
      });
      return fail('Payment could not be verified', 'invalid_signature', 400);
    }

    const booking = await queryOne<BookingRow>(
      'SELECT * FROM bookings WHERE payment_order_id = $1',
      [razorpay_order_id],
    );
    if (!booking) return fail('We could not find that booking', 'booking_not_found', 404);

    const detail = await confirmPendingBooking(booking.id, {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      signature: razorpay_signature,
      provider: 'razorpay',
    });

    await recordPayment({
      bookingId: detail.booking.id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      status: 'PAID',
      amountPaise: detail.booking.amount_paise,
      currency: detail.booking.currency,
      source: 'verify',
      message: 'Signature verified',
    });

    // Reported separately from confirmation: the money is taken and the passes
    // exist whether or not the email lands.
    const emailSent = await deliverTickets(detail);

    return ok({
      reference: detail.booking.reference,
      status: detail.booking.status,
      emailSent,
    });
  } catch (error) {
    return handleError(error, 'payments.verify');
  }
}
