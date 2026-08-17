import { PLATFORM_FACTS } from '@/content/site';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import { CountUp } from './CountUp';

/**
 * Four facts about how the platform behaves. Every figure describes something
 * the code enforces, so it can be animated without animating a fiction.
 */
export function PlatformFacts() {
  return (
    <Stagger className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
      {PLATFORM_FACTS.map((fact) => (
        <StaggerItem key={fact.label} className="bg-surface/80 px-6 py-9 sm:px-7 sm:py-11">
          <p className="font-display text-5xl font-extrabold leading-none text-gradient sm:text-6xl">
            <CountUp value={fact.value} />
          </p>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-chalk">
            {fact.label}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-dim">{fact.detail}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
