import Link from 'next/link';
import type { Metadata } from 'next';
import { getEventBySlug, listTiers } from '@/lib/bookings';
import { OFFCAMPUS, VENUE } from '@/content/site';
import { formatEventDate, formatEventTime, formatInr } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Countdown } from '@/components/ui/Countdown';
import { Magnetic } from '@/components/ui/Magnetic';
import { Globe } from '@/components/brand/Globe';
import { Accordion } from '@/components/events/Accordion';
import { HeroOrbit, HeroParallax } from '@/components/events/HeroMotion';
import { RoomCards } from '@/components/events/RoomCards';
import { LineupTable } from '@/components/events/LineupTable';
import { ScarcityMeter } from '@/components/game/ScarcityMeter';
import { VibeQuiz } from '@/components/game/VibeQuiz';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OffCampus — the after-hours chapter',
  description: OFFCAMPUS.blurb,
  alternates: { canonical: '/events/offcampus' },
  openGraph: { title: 'OFFCAMPUS · Houz of Vybe', description: OFFCAMPUS.blurb },
};

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUE.mapsQuery)}`;

export default async function OffCampusPage() {
  const event = await getEventBySlug(OFFCAMPUS.slug).catch(() => null);
  const tiers = event ? await listTiers(event.id).catch(() => []) : [];
  const remaining = tiers.reduce((sum, tier) => sum + Math.max(0, tier.quantity - tier.sold), 0);
  const released = tiers.reduce((sum, tier) => sum + tier.quantity, 0);
  const onSale = Boolean(event) && remaining > 0 && event?.status !== 'cancelled';
  const lowStock = released > 0 && remaining > 0 && remaining / released <= 0.15;

  const jsonLd = event
    ? {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: event.name,
        description: OFFCAMPUS.blurb,
        startDate: event.starts_at,
        endDate: event.ends_at ?? undefined,
        eventStatus:
          event.status === 'cancelled'
            ? 'https://schema.org/EventCancelled'
            : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: event.venue_name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.venue_address ?? VENUE.addressLines[0],
            addressLocality: event.city,
            addressRegion: 'Telangana',
            addressCountry: 'IN',
          },
        },
        organizer: { '@type': 'Organization', name: 'Houz of Vybe' },
        offers: tiers.map((tier) => ({
          '@type': 'Offer',
          name: tier.name,
          price: (tier.price_paise / 100).toFixed(2),
          priceCurrency: 'INR',
          availability:
            tier.quantity - tier.sold > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
        })),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Hero ------------------------------------------------------------- */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pt-40">
        <HeroOrbit />

        <div className="container-hov">
          <HeroParallax>
            <Reveal>
              <p className="eyebrow mb-5">{OFFCAMPUS.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="display-1">{OFFCAMPUS.title}</h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-3 font-display text-2xl text-vybe-300 sm:text-3xl">
                {OFFCAMPUS.subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="lede mt-7 max-w-2xl">{OFFCAMPUS.blurb}</p>
            </Reveal>
          </HeroParallax>

          {event ? (
            <>
              <Reveal delay={0.24}>
                <div className="mt-10 max-w-lg">
                  <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flare-400 opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flare-500" />
                    </span>
                    Doors in
                  </p>
                  <Countdown target={event.starts_at} />
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                  <Fact label="Date" value={formatEventDate(event.starts_at)} />
                  <Fact label="Doors" value={formatEventTime(event.doors_at ?? event.starts_at)} />
                  <Fact label="Venue" value={event.venue_name} />
                  <Fact
                    label="Tickets left"
                    value={remaining > 0 ? String(remaining) : 'Sold out'}
                    accent={lowStock}
                  />
                </dl>
              </Reveal>
            </>
          ) : (
            <Reveal delay={0.24}>
              <p className="mt-10 max-w-lg rounded-xl border border-hairline bg-surface/60 px-4 py-3.5 text-[13px] text-haze">
                Dates and tickets for this edition are still being confirmed — booking opens
                shortly.
              </p>
            </Reveal>
          )}

          <Reveal delay={0.36}>
            <div className="mt-10 flex flex-wrap gap-3">
              {onSale ? (
                <Magnetic>
                  <Link href="/book?event=offcampus" className="btn-primary px-8 py-4 text-[15px]">
                    Book tickets
                  </Link>
                </Magnetic>
              ) : (
                <span
                  aria-disabled="true"
                  className="btn-primary pointer-events-none px-8 py-4 text-[15px] opacity-45"
                >
                  {event ? 'Sold out' : 'Booking opens soon'}
                </span>
              )}
              <a href="#lineup" className="btn-secondary px-8 py-4 text-[15px]">
                See the line-up
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Longform --------------------------------------------------------- */}
      <section className="section container-hov border-t border-hairline">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <Reveal>
            <h2 className="display-2 lg:sticky lg:top-28">
              The part that <span className="text-gradient">never made it to screen.</span>
            </h2>
          </Reveal>
          <div className="space-y-6">
            {OFFCAMPUS.longform.map((paragraph, index) => (
              <Reveal key={paragraph} delay={0.06 * index}>
                <p className="text-[17px] leading-relaxed text-haze">{paragraph}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Rooms ------------------------------------------------------------ */}
      <section className="section border-y border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading
            eyebrow="Three rooms"
            title="One night, three completely different rooms."
            lede="Move between them as the night turns. Each has its own rig, its own tempo and its own crowd."
          />
          <RoomCards rooms={OFFCAMPUS.rooms} />
        </div>
      </section>

      {/* Line-up ---------------------------------------------------------- */}
      <section id="lineup" className="section container-hov scroll-mt-24">
        <SectionHeading
          eyebrow="Line-up"
          title="Who's playing, and when."
          lede="The timetable is fixed. Names go up here the day each booking is signed — not before."
        />
        <LineupTable acts={OFFCAMPUS.lineup} />
      </section>

      {/* Vibe quiz -------------------------------------------------------- */}
      <section className="section border-y border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading
            eyebrow="Find your room"
            title="Three questions. One room."
            lede="Answer honestly and we'll point you at the room — and the ticket — that fits the night you actually want."
          />
          <Reveal className="mt-12">
            <VibeQuiz rooms={OFFCAMPUS.rooms} eventSlug={OFFCAMPUS.slug} />
          </Reveal>
        </div>
      </section>

      {/* Tiers ------------------------------------------------------------ */}
      <section className="section container-hov">
        <SectionHeading
          eyebrow="Tickets"
          title="Pick your entry."
          lede="Live stock — what you see is what is actually left."
        />

        {tiers.length === 0 ? (
          <div className="card mt-12 p-10 text-center">
            <p className="text-[14px] text-haze">
              Ticket tiers haven&apos;t been published yet. Check back shortly.
            </p>
          </div>
        ) : (
          <>
            <Reveal className="mt-12">
              <ScarcityMeter
                tiers={tiers.map((tier) => ({
                  code: tier.code,
                  name: tier.name,
                  remaining: Math.max(0, tier.quantity - tier.sold),
                  total: tier.quantity,
                }))}
              />
            </Reveal>

            <Stagger className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier) => {
                const left = Math.max(0, tier.quantity - tier.sold);
                const soldOut = left === 0;
                const perks = Array.isArray(tier.perks) ? tier.perks : [];
                return (
                  <StaggerItem key={tier.id}>
                    <div
                      aria-disabled={soldOut || undefined}
                      className={`card card-lit flex h-full flex-col p-6 transition-transform duration-300 ${
                        soldOut ? 'opacity-55 saturate-50' : 'hover:-translate-y-1'
                      }`}
                    >
                      {soldOut && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-[0.16]"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(135deg, rgba(154,168,204,0.5) 0 1px, transparent 1px 11px)',
                          }}
                        />
                      )}

                      <div className="relative flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold text-chalk">
                          {tier.name}
                        </h3>
                        {soldOut && (
                          <span className="badge border-hairline bg-elevated text-dim">
                            Sold out
                          </span>
                        )}
                      </div>

                      <p
                        className={`relative mt-2 font-display text-3xl font-extrabold ${
                          soldOut ? 'text-dim line-through decoration-1' : 'text-gradient'
                        }`}
                      >
                        {tier.price_paise === 0 ? 'Free' : formatInr(tier.price_paise)}
                      </p>

                      {tier.description && (
                        <p className="relative mt-3 text-[13px] leading-relaxed text-haze">
                          {tier.description}
                        </p>
                      )}

                      {perks.length > 0 && (
                        <ul className="relative mt-4 space-y-1.5">
                          {perks.map((perk) => (
                            <li key={perk} className="flex gap-2 text-[12px] text-haze">
                              <span aria-hidden className="text-vybe-400">
                                ✦
                              </span>
                              {perk}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p
                        className={`relative mt-4 text-[11px] ${
                          left > 0 && left <= 20 ? 'text-flare-300' : 'text-dim'
                        }`}
                      >
                        {soldOut
                          ? 'No tickets left in this tier'
                          : left <= 20
                            ? `Only ${left} left`
                            : `${left} available`}
                      </p>

                      <div className="relative mt-6 pt-2">
                        {soldOut ? (
                          <span
                            aria-disabled="true"
                            className="btn-ghost pointer-events-none w-full cursor-not-allowed py-3 text-[13px]"
                          >
                            Sold out
                          </span>
                        ) : (
                          <Link
                            href={`/book?event=offcampus&tier=${tier.code}`}
                            className="btn-secondary w-full py-3 text-[13px]"
                          >
                            Book {tier.name}
                          </Link>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </>
        )}
      </section>

      {/* Highlights ------------------------------------------------------- */}
      <section className="section container-hov border-t border-hairline">
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OFFCAMPUS.highlights.map((item) => (
            <StaggerItem key={item.title}>
              <div className="card h-full p-6">
                <h3 className="font-display text-lg font-semibold text-chalk">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-haze">{item.copy}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Venue ------------------------------------------------------------ */}
      <section className="section border-t border-hairline">
        <div className="container-hov grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="eyebrow mb-4">The venue</p>
            <h2 className="display-2">{event?.venue_name ?? VENUE.name}</h2>
            <address className="mt-5 not-italic text-[15px] leading-relaxed text-haze">
              {(event?.venue_address ? [event.venue_address] : VENUE.addressLines).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-3 text-[13px] text-dim">{VENUE.landmark}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary mt-7 px-7 py-3.5 text-[13px]"
            >
              Get directions
            </a>
          </Reveal>

          <Reveal delay={0.1} direction="left">
            <div className="card card-lit relative aspect-[4/3] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-vybe-900 via-surface to-void" />
              <div aria-hidden className="absolute inset-0 grid-overlay" />
              {/* Abstract floorplan — three rooms as nested blocks, each in its
                  own hue so the colour language matches the room cards above. */}
              <div aria-hidden className="absolute inset-0 flex items-center justify-center p-10">
                <div className="grid h-full w-full grid-rows-3 gap-2">
                  {OFFCAMPUS.rooms.map((room) => (
                    <div
                      key={room.name}
                      className="flex items-center justify-between rounded-lg border px-4"
                      style={{
                        borderColor: `hsl(${room.hue} 84% 62% / 0.3)`,
                        background: `hsl(${room.hue} 84% 50% / 0.08)`,
                      }}
                    >
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.2em]"
                        style={{ color: `hsl(${room.hue} 84% 78% / 0.95)` }}
                      >
                        {room.name}
                      </span>
                      <span className="font-mono text-[10px] text-dim">
                        {room.time.split(' — ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ -------------------------------------------------------------- */}
      <section className="section border-t border-hairline bg-ink/40">
        <div className="container-hov">
          <SectionHeading eyebrow="Questions" title="Everything you're about to ask." />
          <div className="mt-12">
            <Accordion items={OFFCAMPUS.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
          </div>
        </div>
      </section>

      {/* CTA + disclaimer ------------------------------------------------- */}
      <section className="container-hov py-20">
        <Reveal>
          <div className="card card-lit relative overflow-hidden px-6 py-14 text-center sm:px-12">
            <div aria-hidden className="absolute inset-0 grid-overlay opacity-70" />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 text-vybe-500/[0.06]"
            >
              <Globe className="h-full w-full" strokeWidth={1.2} spin />
            </div>
            <div className="relative">
              <h2 className="display-2">Doors open once.</h2>
              <p className="lede mx-auto mt-4 max-w-md">
                Capacity is capped. When the room is full we stop selling.
              </p>
              {onSale && (
                <Magnetic className="mt-8">
                  <Link href="/book?event=offcampus" className="btn-primary px-10 py-4">
                    Book tickets
                  </Link>
                </Magnetic>
              )}
            </div>
          </div>
        </Reveal>

        {/* Stated plainly rather than buried — the theme is ours, the series is not. */}
        <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-dim">
          {OFFCAMPUS.themeNote}
        </p>
      </section>
    </>
  );
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className={accent ? 'mt-1 font-semibold text-flare-300' : 'mt-1 font-semibold text-chalk'}>
        {value}
      </dd>
    </div>
  );
}
