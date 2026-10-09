import { DandiyaStick } from './Environment';

/**
 * A pair of dandiya sticks crossed over a turning mirror-work disc, in CSS 3D.
 *
 * Each stick is four copies of the flat drawing rotated around its own axis,
 * which reads as a solid rod from any angle without shipping a WebGL scene.
 * Pure CSS, so it renders on the server and costs nothing to hydrate.
 */
export function Dandiya3D({ className }: { className?: string }) {
  const faces = [0, 45, 90, 135];
  return (
    <div className={`d3 ${className ?? ''}`} aria-hidden>
      <div className="d3__stage">
        <div className="d3__disc">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="d3__mirror" style={{ transform: `rotate(${i * 22.5}deg) translateY(-118%)` }} />
          ))}
        </div>
        <div className="d3__stick d3__stick--l">
          {faces.map((f) => (
            <span key={f} className="d3__face" style={{ transform: `rotateY(${f}deg)` }}>
              <DandiyaStick tone="a" />
            </span>
          ))}
        </div>
        <div className="d3__stick d3__stick--r">
          {faces.map((f) => (
            <span key={f} className="d3__face" style={{ transform: `rotateY(${f}deg)` }}>
              <DandiyaStick tone="b" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
