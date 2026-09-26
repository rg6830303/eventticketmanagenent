import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEventBySlug } from '@/lib/bookings';
import { getCustomerSession } from '@/lib/customer-auth';
import { isPastEvent } from '@/lib/event-facts';
import { PLATFORM_FEE_LABEL } from '@/lib/fees';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { TicketRail } from '@/components/event/TicketRail';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug).catch(() => null);
  if (!event) return { title: 'Event not found' };
  const title = `${event.name} ${event.tagline ?? ''}`.trim();
  return {
    title,
    description: event.description ?? `${title} — ${formatEventDate(event.starts_at)}, ${event.city}.`,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: event.hero_image ? { images: [{ url: event.hero_image }] } : undefined,
  };
}

/**
 * Any event, from the database.
 *
 * OFF Campus had a page written by hand. The platform needs one page that works
 * for every event an operator creates in the console — name, date, venue,
 * poster, passes — so the next drop is a row, not a pull request. Past events
 * redirect home; their record lives in the console.
 *
 * Three states, and the page is honest about each: on sale, announced but not
 * on sale yet, and over.
 */
export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEventBySlug(slug).catch(() => null);
  if (!event || event.status === 'draft' || event.status === 'archived') notFound();

  const [tiers, session] = await Promise.all([listStorefrontTiers(event.id), getCustomerSession()]);

  // Past nights are a console record now, not a public page.
  if (isPastEvent(event)) redirect('/');
  const past = false;
  const onSale = !past && tiers.some((t) => t.remaining > 0);
  const fromPaise = onSale ? Math.min(...tiers.filter((t) => t.remaining > 0).map((t) => t.pricePaise)) : null;
  const title = `${event.name} ${event.tagline ?? ''}`.trim();
  const venueLine = [event.venue_name, event.venue_address && event.venue_address !== event.city ? event.venue_address : null, event.city]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="relative">
      {/* --- Hero ------------------------------------------------------ */}
      <section className="shell grid items-center gap-10 pb-16 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <Reveal>
          <div className="relative">
            <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-vybe-300/40 via-orchid-300/30 to-transparent blur-2xl" />
            {event.hero_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.hero_image}
                alt={`${title} poster`}
                className="relative h-auto w-full rounded-[1.75rem] border-[1.5px] border-ink object-cover shadow-press"
              />
            ) : (
              <div className="relative flex aspect-square w-full items-center justify-center rounded-[1.75rem] border-[1.5px] border-ink bg-vybe-100 font-display text-4xl font-bold text-ink shadow-press">
                {event.name}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div>
            <span
              className={
                past
                  ? 'inline-flex rounded-full bg-mist px-3 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate'
                  : 'inline-flex rounded-full bg-vybe-500 px-3 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white'
              }
            >
              {onSale ? 'Tickets on sale' : 'Coming soon'}
            </span>

            <h1 className="mt-5 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-ink">
              {event.name}
              {event.tagline && <span className="block text-vybe-600">{event.tagline}</span>}
            </h1>

            {event.description && (
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-slate">{event.description}</p>
            )}

            <dl className="mt-7 grid max-w-xl grid-cols-2 gap-3">
              <Fact label="Date" value={formatEventDate(event.starts_at)} />
              <Fact label="Doors" value={formatEventTime(event.doors_at ?? event.starts_at)} />
              <Fact label="Where" value={venueLine} wide />
            </dl>

            {!past && (
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#tickets" className="btn-primary px-7 py-4">
                  {onSale ? `Get tickets${fromPaise ? ` · from ${formatInr(fromPaise)}` : ''}` : 'See passes'}
                </a>
              </div>
            )}

            {!past && (
              <div className="mt-7">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">Doors open in</p>
                <Countdown target={event.doors_at ?? event.starts_at} className="mt-2" />
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* --- Tickets --------------------------------------------------- */}
      {!past && (
        <section id="tickets" className="scroll-mt-28 border-t border-edge bg-frost/60 py-16">
          <div className="shell">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">Passes</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
                  {onSale ? 'Pick your pass' : 'Tickets opening soon'}
                </h2>
              </div>
              {onSale && (
                <p className="max-w-sm text-[0.875rem] text-slate">
                  Every pass is a single-use QR, emailed the moment payment clears. A {PLATFORM_FEE_LABEL.toLowerCase()} is
                  added at checkout.
                </p>
              )}
            </div>

            {!session && onSale && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-[1.5px] border-ink bg-paper px-5 py-4 shadow-press-sm">
                <p className="text-[0.9375rem] text-ink">
                  <strong>Sign in to buy.</strong>{' '}
                  <span className="text-slate">Browse freely — you will need an account at checkout.</span>
                </p>
                <div className="flex gap-2">
                  <Link href="/login?next=/cart" className="btn-outline py-2.5 text-[0.875rem]">
                    Sign in
                  </Link>
                  <Link href="/signup?next=/cart" className="btn-primary py-2.5 text-[0.875rem]">
                    Sign up
                  </Link>
                </div>
              </div>
            )}

            {onSale ? (
              <div className="mt-10">
                <TicketRail tiers={tiers} showReferralNote={false} signedIn={Boolean(session)} />
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border-[1.5px] border-dashed border-edgeStrong bg-paper p-8 text-center">
                <p className="font-display text-xl font-bold text-ink">
                  Passes are not on sale yet.
                </p>
                <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-slate">
                  {session
                    ? 'You are signed in, so you are ready the moment they drop. Follow @houzofvybe for the announcement.'
                    : 'Create an account now so checkout takes seconds when they drop.'}
                </p>
                {!session && (
                  <Link href={`/signup?next=/events/${event.slug}`} className="btn-primary mt-5 inline-flex">
                    Create an account
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* --- How it works ---------------------------------------------- */}
      {!past && (
        <section className="shell py-16">
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">How entry works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Sign in', 'Create your Houz of Vybe account, or sign in to the one you have.'],
              ['Pick passes', 'Add passes to your cart and pay securely through Razorpay.'],
              ['Get your QR', 'Passes land in your inbox the moment payment clears, and in your account.'],
              ['Scan in', 'Show the QR at the door. Each pass scans once. Screenshot it for patchy signal.'],
            ].map(([head, body], i) => (
              <li key={head} className="card-print p-5">
                <span className="font-mono text-[0.75rem] font-semibold text-vybe-600">0{i + 1}</span>
                <p className="mt-2 font-display text-lg font-bold text-ink">{head}</p>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {past && (
        <section className="shell pb-20">
          <div className="card-print p-8 text-center">
            <p className="font-display text-2xl font-bold text-ink">This night has happened.</p>
            <p className="mt-2 text-slate">Thank you to everyone who came. See what is next.</p>
            <Link href="/" className="btn-primary mt-5 inline-flex">Upcoming events</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 rounded-xl border border-edge bg-paper px-4 py-3' : 'rounded-xl border border-edge bg-paper px-4 py-3'}>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
