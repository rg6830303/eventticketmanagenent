import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Globe } from '@/components/brand/Globe';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-20 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 gridfield fade-edges" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-vybe-600/20 blur-[120px]" />
      </div>

      {/* The mark drifted off its axis — the page is the one thing here that
          isn't where it should be. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(112vw,660px)] -translate-x-[38%] -translate-y-[56%] animate-drift"
      >
        <Globe spin strokeWidth={1.5} className="h-full w-full text-vybe-500/25" />
      </div>

      <div className="relative w-full max-w-xl">
        <Link
          href="/"
          className="mb-12 inline-block rounded-full"
          aria-label="Houz of Vybe — home"
        >
          <Logo variant="inline" />
        </Link>

        <p
          aria-hidden
          className="font-display text-[30vw] font-extrabold leading-none tracking-tighter text-ink sm:text-[190px]"
          style={{ textShadow: '0 0 60px rgba(3,6,15,0.9)' }}
        >
          404
        </p>

        <h1 className="mt-6 font-display text-2xl font-bold text-ink sm:text-3xl">
          <span className="sr-only">404 — </span>
          This one&apos;s not on the list.
        </h1>
        <p className="lede mx-auto mt-3 max-w-md">
          The page you were after doesn&apos;t exist, or it moved. Here&apos;s where everyone else
          is going.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary px-7 py-3.5">
            Back home
          </Link>
          <Link href="/events/offcampus" className="btn-outline px-7 py-3.5">
            OffCampus
          </Link>
          <Link href="/book" className="btn-outline btn-sm px-7 py-3.5">
            Book tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
