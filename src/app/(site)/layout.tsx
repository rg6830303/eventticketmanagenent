import { after } from 'next/server';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { PageTransition } from '@/components/site/PageTransition';
import { maybeReconcile } from '@/lib/payments';
import { getCustomerSession } from '@/lib/customer-auth';
import { getFeaturedEvent } from '@/lib/event-facts';
import { formatEventDate } from '@/lib/utils';

/**
 * Chrome for every public page. The admin console and the standalone ticket
 * view sit outside this group on purpose — neither wants a marketing nav bar
 * over it.
 *
 * It also carries the heartbeat that confirms payments nobody told us about.
 *
 * That needs explaining, because a layout is an odd place for it. Delivery
 * normally happens when Razorpay's checkout reports success, and on a phone
 * that report is not guaranteed to arrive — paying by UPI backgrounds the
 * browser, and an in-app webview is often killed while it waits. The customer
 * who comes back is covered: the pay page asks the gateway before it renders.
 * The one who never comes back needs somebody else to go looking.
 *
 * A cron would be the obvious somebody, and Vercel's Hobby plan allows exactly
 * one run a day, which is far too slow to leave a person holding a receipt and
 * no ticket. So ordinary traffic drives it instead. Every visit to any public
 * page offers to run a sweep; the sweep itself takes a lock and actually runs
 * at most once every ninety seconds across all instances, so a hundred
 * simultaneous visitors cost one sweep between them, and a quiet site costs
 * nothing at all.
 *
 * `after()` rather than a bare floating promise: this must not delay the page,
 * and on serverless the function can be torn down the moment the response is
 * sent, which would kill the work halfway through.
 */
/**
 * Headroom for the sweep above, not for the page.
 *
 * after() work runs once the response is already sent, but it still lives
 * inside this function's budget — so the default would cut the sweep off
 * partway through. Raising it does not make a single page slower; it only stops
 * the background half being killed. The sweep also stops itself on its own
 * clock, so this is a ceiling rather than a target.
 */
export const maxDuration = 60;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // The cookie alone, not a database read: the header only needs a first name,
  // and every public page renders this layout.
  const [session, featured] = await Promise.all([getCustomerSession(), getFeaturedEvent()]);

  after(async () => {
    try {
      await maybeReconcile();
    } catch {
      // A visitor's page must never fail because a background sweep did.
    }
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        customerName={session ? session.name.split(' ')[0] || 'there' : null}
        buyHref={featured ? `/events/${featured.slug}#tickets` : '/events'}
        featuredLine={
          featured
            ? `${featured.name} ${featured.tagline ?? ''} · ${formatEventDate(featured.starts_at)}`.replace(/\s+·/, ' ·')
            : null
        }
      />
      <main id="main" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  );
}
