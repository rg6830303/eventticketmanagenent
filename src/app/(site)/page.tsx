import type { Metadata } from 'next';
import Link from 'next/link';
import { getFeaturedEvent, isPastEvent } from '@/lib/event-facts';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { BRAND } from '@/content/site';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Houz of Vybe — The Dandiya Project 2026, Hyderabad' },
  description:
    'The Dandiya Project 2026 by Orbit × Houz of Vybe. Early Bird passes on sale now — book with your account and get a QR pass straight to your inbox.',
  alternates: { canonical: '/' },
};

/**
 * The front page sells the next night and nothing else.
 *
 * One featured event, dressed for the season (maroon, marigold and gold for
 * Navratri), and one call to action: Buy tickets. Past events live in the
 * console as a record, not here.
 */
export default async function HomePage() {
  const featured = await getFeaturedEvent();
  const live = featured && !isPastEvent(featured) ? featured : null;
  const tiers = live ? await listStorefrontTiers(live.id) : [];
  const onSale = tiers.some((t) => t.remaining > 0);
  const fromPaise = onSale ? Math.min(...tiers.filter((t) => t.remaining > 0).map((t) => t.pricePaise)) : null;

  if (!live) {
    return (
      <section className="shell flex min-h-[70vh] flex-col items-center justify-center pt-28 text-center">
        <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold text-ink">The next night is being planned.</h1>
        <p className="mt-4 text-slate">Follow @houzofvybe for the drop.</p>
      </section>
    );
  }

  const buyHref = `/events/${live.slug}#tickets`;

  return (
    <div className="relative">
      <section className="relative overflow-hidden bg-[#3b0a14] text-[#fff4dc]">
        {/* Festive backdrop: marigold glow, a mandala ring, a garland of dots. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.35),transparent_60%)]" />
        <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[40rem] w-[40rem] rounded-full border-[18px] border-dotted border-amber-400/20" />
        <div aria-hidden className="pointer-events-none absolute -left-40 bottom-[-12rem] h-[30rem] w-[30rem] rounded-full border-[14px] border-dashed border-rose-400/20" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(90deg,#f59e0b_0_14px,#be123c_14px_28px,#16a34a_28px_42px)]" />

        <div className="shell relative grid items-center gap-12 pb-20 pt-32 sm:pt-36 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Reveal>
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-amber-300">
                {BRAND.name} presents · Navratri 2026
              </p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/10 px-3 py-1 text-[0.75rem] font-semibold text-amber-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {onSale ? 'Early Bird on sale now' : 'Tickets opening soon'}
              </p>
              <h1 className="mt-5 font-display text-[clamp(2.75rem,7vw,5.75rem)] font-bold leading-[0.92] tracking-[-0.035em]">
                {live.name}
                {live.tagline && <span className="block text-amber-400">{live.tagline}</span>}
              </h1>
              <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-[#f5dfc0]">
                {live.description ??
                  'Dhol, dandiya and a night-long garba circle. Dress in your brightest, bring your crew, and spin till the lights come up.'}
              </p>
              <p className="mt-5 font-semibold">
                {formatEventDate(live.starts_at)} · {formatEventTime(live.doors_at ?? live.starts_at)} · {live.venue_name}
              </p>

              <Link
                href={buyHref}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl border-2 border-[#fff4dc] bg-amber-400 px-8 py-4 font-display text-lg font-bold text-[#3b0a14] shadow-[4px_4px_0_#fff4dc] transition-transform hover:-translate-y-0.5"
              >
                Buy tickets{fromPaise ? ` · ${formatInr(fromPaise)}` : ''}
              </Link>

              <div className="mt-8">
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-amber-200/80">Doors open in</p>
                <Countdown target={live.doors_at ?? live.starts_at} className="mt-2" compact />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Link href={buyHref} className="group relative block">
              <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-400/50 via-rose-500/40 to-transparent blur-2xl" />
              {live.hero_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={live.hero_image}
                  alt={`${live.name} ${live.tagline ?? ''} poster`}
                  className="relative h-auto w-full rounded-[1.75rem] border-2 border-amber-300 object-cover shadow-2xl transition-transform duration-500 group-hover:-translate-y-1"
                />
              ) : (
                <div className="relative aspect-square w-full rounded-[1.75rem] border-2 border-amber-300 bg-rose-900" />
              )}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="shell py-16">
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ['Pick your pass', 'Early Bird is the cheapest it will ever be. Add passes to your cart.'],
            ['Pay in seconds', 'Sign in and pay securely with Razorpay — UPI, cards, netbanking.'],
            ['QR in your inbox', 'Your pass lands in your email and your account the moment payment clears.'],
          ].map(([head, body], i) => (
            <li key={head} className="card-print p-5">
              <span className="font-mono text-[0.75rem] font-semibold text-vybe-600">0{i + 1}</span>
              <p className="mt-2 font-display text-lg font-bold text-ink">{head}</p>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-slate">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
