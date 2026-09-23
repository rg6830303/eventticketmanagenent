/**
 * The page ground.
 *
 * Daylight falling from the top, two slow azure blooms far apart, a fine
 * lattice that fades before it reaches the fold, and a horizon low in the
 * viewport so the page has a floor to stand on.
 *
 * Its entire job is to make the white surfaces above it read as floating. It
 * cannot do that while it is busy being interesting, which is why everything
 * here is low contrast and nothing moves faster than a 22-second cycle.
 *
 * Server component, CSS only: costs nothing at runtime and cannot fail the
 * way a canvas can.
 */
export function Environment() {
  return (
    <div className="env" aria-hidden>
      <span className="env__wash" />
      <span className="env__bloom env__bloom--a" />
      <span className="env__bloom env__bloom--b" />
      <span className="env__lattice" />
      <span className="env__horizon" />
      <span className="env__grain" />
    </div>
  );
}
