import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { settleCashfreeOrder } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where Cashfree drops the customer's browser after checkout.
 *
 * The only thing this URL is trusted for is the order id in the query string,
 * and even that is treated as a hint: `settleCashfreeOrder` re-reads the order
 * from Cashfree's API and that response is what confirms the booking. Anyone
 * can type this URL with any order id — doing so gets them the true status of
 * an order they do not own, and nothing else.
 *
 * The handler always ends in a redirect. A customer who has just paid must land
 * on a page, never on a JSON body, however badly the settlement went.
 */
export async function GET(request: NextRequest) {
  const site = env.siteUrl;
  const orderId =
    request.nextUrl.searchParams.get('order_id') ??
    request.nextUrl.searchParams.get('orderId') ??
    '';

  if (!orderId) {
    return NextResponse.redirect(`${site}/book?status=missing_order`, { status: 303 });
  }

  try {
    const result = await settleCashfreeOrder(orderId, 'return');
    const reference = result.booking?.reference;

    switch (result.outcome) {
      case 'paid':
        // `paid=1` is what the confirmation page uses to fire its celebration,
        // and `mailed` lets it say whether the email is already gone rather
        // than promising a delivery that failed.
        return NextResponse.redirect(
          `${site}/booking/${reference}?paid=1&mailed=${result.emailSent ? '1' : '0'}`,
          { status: 303 },
        );

      case 'failed':
        return NextResponse.redirect(`${site}/pay/${reference}?status=failed`, { status: 303 });

      case 'expired':
        return NextResponse.redirect(`${site}/book?status=expired`, { status: 303 });

      case 'pending':
        // Money may be in flight — UPI collect requests routinely settle after
        // the browser is already back. The booking page explains the hold.
        return reference
          ? NextResponse.redirect(`${site}/booking/${reference}?status=processing`, { status: 303 })
          : NextResponse.redirect(`${site}/book?status=processing`, { status: 303 });

      case 'unknown_order':
      default:
        return NextResponse.redirect(`${site}/book?status=unknown_order`, { status: 303 });
    }
  } catch (error) {
    // Cashfree was unreachable. The webhook is the backstop and will settle
    // this within seconds, so send the customer somewhere that says so instead
    // of somewhere that says the payment failed.
    console.error('[payments] return settlement failed', {
      orderId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.redirect(`${site}/book?status=processing`, { status: 303 });
  }
}
