import { EVENT } from '@/content/site';

/**
 * The page ground.
 *
 * Flat layers with hard edges, assembled the way a poster is: a deep-blue
 * diagonal band across the lower half, the halftone screen off the artwork in
 * one corner, a fine grid, film grain, and the event wordmark set enormous in
 * outline and cropped by the viewport. No blur, no drift — a mesh-gradient
 * aurora is the single most recognisable tell of a generated page, and this
 * replaces it with composition.
 *
 * Server component, CSS only: costs nothing at runtime and cannot fail the
 * way a canvas can.
 */
export function Environment() {
  return (
    <div className="env" aria-hidden>
      <span className="env__band" />
      <span className="env__band2" />
      <span className="env__grid" />
      <span className="env__halftone" />
      <span className="env__mark">
        {EVENT.name} {EVENT.editionShort}
      </span>
      <span className="env__grain" />
    </div>
  );
}
