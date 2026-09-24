import type { Metadata } from 'next';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/customer-auth';
import { getFeaturedEvent, isPastEvent, listPastEvents, listUpcomingEvents } from '@/lib/event-facts';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { BRAND } from '@/content/site';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Houz of Vybe — Hyderabad’s nights, in one place' },
  description:
    'Houz of Vybe puts on the city’s best day parties and festival nights. Browse what is coming up, book with your account, and get a QR pass straight to your inbox.',
  alternates: { canonical: '/' },
};

/**
 * The platform's front page.
 *
 * It used to be one long page about one night, which made the site a dead end
 * the day after that night happened. Now it leads with whatever is next,
 * lists everything upcoming, and keeps what has already happened as a record —
 * all of it read from the events table, so announcing the next drop is done in
 * the console and not in this file.
 */
export default async function HomePage() {
  const [featured, upcoming, past, session] = await Promise.all([
    getFeaturedEvent(),
    listUpcomingEvents(),
    listPastEvents(),
    getCustomerSession(),
  ]);

  const featuredIsUpcoming = featured ? !isPastEvent(featured) : false;
  const featuredTiers = featured && featuredIsUpcoming ? await listStorefrontTiers(featured.id) : [];
  const onSale = featuredTiers.some((t) => t.remaining > 0);
  const fromPaise = onSale
    ? Math.min(...featuredTiers.filter((t) => t.remaining > 0).map((t) => t.pricePaise))
    : null;
  const others = upcoming.filter((e) => e.id !== featured?.id);

  return (
    <div className="relative">
      {/* --- Hero: the featured event ---------------------------------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-vybe-100 via-canvas to-canvas" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-orchid-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-vybe-300/30 blur-3xl" />

        <div className="shell relative grid items-center gap-12 pb-20 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Reveal>
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-vybe-700">
                {BRAND.name} · Hyderabad
              </p>
              {featured && featuredIsUpcoming ? (
                <>
                  <p className="mt-6 inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-paper px-3 py-1 text-[0.75rem] font-semibold text-ink shadow-press-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-vybe-500" />
                    Up next · {onSale ? 'tickets on sale' : 'coming soon'}
                  </p>
                  <h1 className="mt-5 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.035em] text-ink">
                    {featured.name}
                    {featured.tagline && <span className="block text-vybe-600">{featured.tagline}</span>}
                  </h1>
                  {featured.description && (
                    <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-slate">{featured.description}</p>
                  )}
                  <p className="mt-5 font-semibold text-ink">
                    {formatEventDate(featured.starts_at)} · {formatEventTime(featured.doors_at ?? featured.starts_at)} ·{' '}
                    {featured.venue_name}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href={`/events/${featured.slug}#tickets`} className="btn-primary px-7 py-4">
                      {onSale ? `Get tickets${fromPaise ? ` · ${formatInr(fromPaise)}` : ''}` : 'See the event'}
                    </Link>
                    {!session && (
                      <Link href="/signup" className="btn-outline px-6 py-4">
                        Create an account
                      </Link>
                    )}
                  </div>
                  <div className="mt-8">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted">Doors open in</p>
                    <Countdown target={featured.doors_at ?? featured.starts_at} className="mt-2" compact />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.035em] text-ink">
                    The next night is being planned.
                  </h1>
                  <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-slate">
                    Create an account and you will be ready the moment tickets drop.
                  </p>
                  {!session && (
                    <Link href="/signup" className="btn-primary mt-8 inline-flex px-7 py-4">
                      Create an account
                    </Link>
                  )}
                </>
              )}
            </div>
          </Reveal>

          {featured && featuredIsUpcoming && (
            <Reveal delay={0.1}>
              <Link href={`/events/${featured.slug}`} className="group relative block">
                <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-vybe-400/40 to-orchid-400/40 opacity-70 blur-xl transition-opacity group-hover:opacity-100" />
                {featured.hero_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featured.hero_image}
                    alt={`${featured.name} ${featured.tagline ?? ''} poster`}
                    className="relative aspect-square w-full rounded-[1.75rem] border-[1.5px] border-ink object-cover shadow-press transition-transform duration-500 group-hover:-translate-y-1"
                  />
                ) : (
                  <div className="relative aspect-square w-full rounded-[1.75rem] border-[1.5px] border-ink bg-vybe-100 shadow-press" />
                )}
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      {/* --- Everything upcoming ---------------------------------------- */}
      <section id="upcoming" className="scroll-mt-24 border-t border-edge bg-paper py-16">
        <div className="shell">
          <SectionHead eyebrow="What’s on" title="Upcoming events" />
          {upcoming.length === 0 ? (
            <p className="mt-6 text-slate">Nothing announced yet. Follow @houzofvybe for the next drop.</p>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(featured && featuredIsUpcoming ? [featured, ...others] : upcoming).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --- How it works ----------------------------------------------- */}
      <section className="shell py-16">
        <SectionHead eyebrow="Booking" title="One account, every night" />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Create an account', 'Sign up once with your email. It works for every Houz of Vybe event.'],
            ['Pick your passes', 'Add passes to your cart and pay securely through Razorpay.'],
            ['QR in your inbox', 'Your passes arrive the moment payment clears, and live in your account.'],
            ['Scan and walk in', 'Each QR scans once at the door. Screenshot it — venue signal is patchy.'],
          ].map(([head, body], i) => (
            <li key={head} className="card-print p-5">
              <span className="font-mono text-[0.75rem] font-semibold text-vybe-600">0{i + 1}</span>
              <p className="mt-2 font-display text-lg font-bold text-ink">{head}</p>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Past events -------------------------------------------------- */}
      {past.length > 0 && (
        <section className="border-t border-edge bg-frost/60 py-16">
          <div className="shell">
            <SectionHead eyebrow="The record" title="Past events" />
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((e) => (
                <li key={e.id} className="card-print overflow-hidden">
                  <Link href={`/events/${e.slug}`} className="block p-6">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted">
                      {formatEventDate(e.starts_at)}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-ink">
                      {e.name} {e.tagline ?? ''}
                    </p>
                    <p className="mt-1 text-[0.875rem] text-slate">{e.venue_name}</p>
                    <p className="mt-4 text-[0.875rem] font-semibold text-vybe-700">
                      {e.tickets_sold.toLocaleString('en-IN')} passes · sold out
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* --- Account CTA ------------------------------------------------- */}
      {!session && (
        <section className="shell py-16">
          <div className="relative overflow-hidden rounded-[1.75rem] border-[1.5px] border-ink bg-vybe-500 px-8 py-12 text-white shadow-press">
            <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orchid-400/40 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Be first in line.</h2>
            <p className="relative mt-3 max-w-xl text-white/85">
              Tickets can only be bought with an account. Make yours now and checkout takes seconds when the next
              drop opens.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-xl border-[1.5px] border-ink bg-paper px-6 py-3.5 font-semibold text-ink shadow-press-sm">
                Create an account
              </Link>
              <Link href="/login" className="rounded-xl border-[1.5px] border-white/70 px-6 py-3.5 font-semibold text-white">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-muted">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">{title}</h2>
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  return (
    <li className="card-print group overflow-hidden">
      <Link href={`/events/${event.slug}`} className="block">
        {event.hero_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.hero_image}
            alt=""
            className="aspect-square w-full border-b-[1.5px] border-ink object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-square w-full border-b-[1.5px] border-ink bg-vybe-100" />
        )}
        <div className="p-5">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-vybe-700">
            {formatEventDate(event.starts_at)}
          </p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink">
            {event.name} {event.tagline ?? ''}
          </p>
          <p className="mt-1 text-[0.8125rem] text-slate">{event.venue_name}</p>
        </div>
      </Link>
    </li>
  );
}
