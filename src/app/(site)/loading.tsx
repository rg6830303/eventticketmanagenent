import { DandiyaStick } from '@/components/site/Environment';

/** Shown the instant a link is tapped, while the next page renders. */
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 pt-20" role="status">
      <div className="relative h-24 w-20">
        <span className="loader-stick loader-stick--l">
          <DandiyaStick tone="a" />
        </span>
        <span className="loader-stick loader-stick--r">
          <DandiyaStick tone="b" />
        </span>
      </div>
      <p className="text-[0.9375rem] font-medium text-muted">Loading…</p>
    </div>
  );
}
