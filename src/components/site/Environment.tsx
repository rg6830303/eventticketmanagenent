/**
 * The page backdrop.
 *
 * Rendered once, fixed, behind everything. It is deliberately a server
 * component with no props: the whole thing is CSS, so it costs nothing at
 * runtime and cannot fail the way a canvas can.
 *
 * The blobs are absurdly large and blurred well past recognition on purpose —
 * at this radius they read as light in the room rather than as three coloured
 * circles, which is the difference between an atmosphere and a gradient demo.
 */
export function Environment() {
  return (
    <div className="env" aria-hidden>
      <span
        className="env__blob left-[-18%] top-[-22%] h-[70vw] w-[70vw] animate-aurora1"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, rgba(120,180,255,0.95), rgba(120,180,255,0) 68%)',
        }}
      />
      <span
        className="env__blob right-[-22%] top-[6%] h-[62vw] w-[62vw] animate-aurora2"
        style={{
          background:
            'radial-gradient(circle at 55% 45%, rgba(160,135,250,0.55), rgba(160,135,250,0) 66%)',
        }}
      />
      <span
        className="env__blob bottom-[-26%] left-[18%] h-[66vw] w-[66vw] animate-aurora3"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(110,220,235,0.6), rgba(110,220,235,0) 66%)',
        }}
      />

      <span className="env__lattice" />
      <span className="env__grain" />

      {/* A hard horizon just under the fold. Without it the aurora keeps
          drifting down the page and the hero never resolves into a section. */}
      <span className="absolute inset-x-0 top-[88vh] h-[40vh] bg-gradient-to-b from-transparent to-canvasDeep/70" />
    </div>
  );
}
