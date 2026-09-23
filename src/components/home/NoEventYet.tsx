import Link from 'next/link';
import { BRAND } from '@/content/site';
import { Globe } from '@/components/brand/Globe';

/**
 * The home page when there is no published event at all.
 *
 * Reachable two ways: a deployment whose database has been set up but not yet
 * seeded, and a promoter between dates with everything archived. Both used to
 * render the hard-coded OFF Campus page against empty tier data — a hero
 * selling a party that had already happened, above a pricing rail with nothing
 * in it.
 *
 * Saying "nothing yet" is the honest answer and it is a better first
 * impression than a broken storefront. It also gives the operator somewhere
 * obvious to land after a fresh install, which is why it names the console.
 */
export function NoEventYet() {
  return (
    <section className="shell flex min-h-[70dvh] items-center py-32">
      <div className="card relative mx-auto max-w-2xl overflow-hidden px-6 py-16 text-center sm:px-12">
        <span aria-hidden className="pointer-events-none absolute inset-0 gridfield fade-edges" />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 text-vybe-500/[0.07]"
        >
          <Globe className="h-full w-full" strokeWidth={1.2} spin />
        </span>

        <div className="relative">
          <div className="mx-auto mb-7 h-14 w-14 text-vybe-400">
            <Globe className="h-full w-full animate-drift" strokeWidth={3} />
          </div>
          <p className="eyebrow mx-auto">{BRAND.city}</p>
          <h1 className="h-section mt-4">Nothing on sale right now.</h1>
          <p className="lede mx-auto mt-4 max-w-md">
            The next date is being put together. Tickets go on sale here first — message us and you
            will hear about it before it is public.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="btn-primary">
              Get on the list
            </Link>
            <Link href="/events" className="btn-outline">
              Past dates
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
