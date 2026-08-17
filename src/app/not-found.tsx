import Link from 'next/link';
import { Logo } from '@/components/site/Logo';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-overlay" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-vybe-600/20 blur-[120px]" />
      </div>

      <div className="relative">
        <Link href="/" className="mb-10 inline-block" aria-label="Houz of Vybe — home">
          <Logo />
        </Link>

        <p className="relative font-display text-[26vw] font-extrabold leading-none tracking-tighter text-chalk/10 sm:text-[180px]">
          404
          {/* Offset duplicates give the number a chromatic-split, misregistered look. */}
          <span aria-hidden className="absolute inset-0 translate-x-[3px] text-vybe-500/25">
            404
          </span>
          <span aria-hidden className="absolute inset-0 -translate-x-[3px] text-pulse-400/20">
            404
          </span>
        </p>

        <h1 className="mt-4 font-display text-2xl font-bold text-chalk sm:text-3xl">
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
          <Link href="/events/offcampus" className="btn-secondary px-7 py-3.5">
            OffCampus
          </Link>
          <Link href="/book" className="btn-ghost px-7 py-3.5">
            Book tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
