import type { Metadata } from 'next';
import Link from 'next/link';
import { getFeaturedEvent, isPastEvent } from '@/lib/event-facts';
import { listStorefrontTiers } from '@/lib/storefront-tiers';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { BRAND } from '@/content/site';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';
import { Dandiya3D } from '@/components/site/Dandiya3D';
import { Marquee } from '@/components/ui/Marquee';

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
 * One featured event and one call to action: Buy tickets. The festival
 * palette comes from the site-wide tokens, so every page wears it. Past events live in the
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
    <div className="relative overflow-x-clip">
      <section id="upcoming" className="relative overflow-hidden">
        <div className="shell relative grid items-center gap-10 pb-14 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-20">
          <Reveal>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-vybe-400/60 bg-vybe-100/70 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-vybe-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping2 rounded-full bg-vybe-500" />
                  <span className="relative h-2 w-2 rounded-full bg-vybe-500" />
                </span>
                {onSale ? 'Early Bird on sale now' : 'Tickets opening soon'}
              </p>
              <p className="mt-5 text-[0.9375rem] font-medium text-slate">
                {BRAND.name} presents · Navratri 2026
              </p>
              <h1 className="mt-2 font-display text-[clamp(2.75rem,11vw,6rem)] leading-[0.98] text-ink">
                {live.name}
                {live.tagline && (
                  <span className="mt-1 block bg-gradient-to-r from-vybe-500 via-vybe-400 to-orchid-400 bg-clip-text font-script text-[0.62em] leading-[1.15] text-transparent">
                    {live.tagline}
                  </span>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-slate">
                {live.description ??
                  'Dhol, dandiya and a night-long garba circle. Dress in your brightest, bring your crew, and spin till the lights come up.'}
              </p>

              <dl className="mt-6 grid max-w-md grid-cols-3 overflow-hidden rounded-2xl border border-edgeStrong bg-paper/70 backdrop-blur-sm">
                {[
                  ['Date', formatEventDate(live.starts_at)],
                  ['Doors', formatEventTime(live.doors_at ?? live.starts_at)],
                  ['Venue', live.venue_name],
                ].map(([k, v], i) => (
                  <div key={k} className={i ? 'border-l border-edge px-3 py-3' : 'px-3 py-3'}>
                    <dt className="text-[0.75rem] font-medium text-muted">{k}</dt>
                    <dd className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={buyHref} className="btn-primary w-full text-base sm:w-auto">
                  Buy tickets{fromPaise ? ` · from ${formatInr(fromPaise)}` : ''}
                </Link>
                <Link href={`/events/${live.slug}`} className="btn-outline w-full text-base sm:w-auto">
                  Event details
                </Link>
              </div>

              <div className="mt-8">
                <p className="text-[0.8125rem] font-medium text-muted">Doors open in</p>
                <Countdown target={live.doors_at ?? live.starts_at} className="mt-2" compact />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative mx-auto w-full max-w-[520px]">
              <Dandiya3D className="pointer-events-none absolute -bottom-[8%] -left-[4%] z-20 w-[30%] drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)] sm:-left-[12%] lg:-left-[16%] lg:w-[42%]" />
              <Link href={buyHref} className="group relative z-10 block [perspective:1000px]">
                <div className="relative rounded-[1.75rem] bg-gradient-to-br from-vybe-500 via-orchid-500 to-pulse-500 p-[3px] shadow-[0_40px_80px_-30px_rgb(var(--c-orchid-500)/0.6)] transition-transform duration-500 ease-out group-hover:[transform:rotateY(-6deg)_rotateX(4deg)]">
                  {live.hero_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={live.hero_image}
                      alt={`${live.name} ${live.tagline ?? ''} poster`}
                      className="h-auto w-full rounded-[1.6rem] object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-[1.6rem] bg-paper" />
                  )}
                </div>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="relative z-10 my-6 -rotate-[1.5deg] scale-[1.03] border-y-2 border-vybe-300 bg-gradient-to-r from-vybe-500 via-vybe-400 to-orchid-400 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)]">
        <Marquee
          items={['Dhol', 'Dandiya', 'Garba', 'Raas', 'Navratri 2026', 'Kompally', '17 October']}
          separator="✦"
          speedSeconds={26}
        />
      </div>

      <section className="shell pb-20 pt-10">
        <h2 className="h-section">
          Three steps to the <span className="accent">circle</span>
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Pick your pass', 'Early Bird is the cheapest it will ever be. Add passes to your cart.'],
            ['Pay in seconds', 'Sign in and pay securely with Razorpay — UPI, cards, netbanking.'],
            ['QR in your inbox', 'Your pass lands in your email and your account the moment payment clears.'],
          ].map(([head, body], i) => (
            <li key={head} className="card-print relative overflow-hidden p-5 sm:p-6">
              <span aria-hidden className="absolute -right-2 -top-6 font-display text-[6rem] leading-none text-vybe-500/15">
                {i + 1}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-vybe-500 font-display text-lg text-night">
                {i + 1}
              </span>
              <p className="mt-4 font-display text-xl text-ink">{head}</p>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-slate">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
