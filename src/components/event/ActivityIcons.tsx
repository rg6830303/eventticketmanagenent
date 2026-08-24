import type { ComponentType, SVGProps } from 'react';

/**
 * Line icons for the activity list.
 *
 * Drawn here rather than pulled from an icon set: the activities on this poster
 * (a kissing booth, a tattoo gun) do not exist in any general-purpose set, and
 * a grid where two icons are hand-made and four are borrowed always looks it.
 * All six share a 24px box, a 1.5 stroke and round caps.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Deck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="9" cy="12" r="4" />
      <circle cx="9" cy="12" r="1" />
      <path d="M15.5 9.5h3.5M15.5 12.5h3.5M15.5 15.5h2" />
    </svg>
  );
}

function Camera(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.9A1 1 0 0 1 9.2 3.6h5.6a1 1 0 0 1 .9.5L16.8 6h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12" r="3.6" />
    </svg>
  );
}

function Tattoo(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 3.8 20.2 9.5l-2.1 2.1-5.7-5.7z" />
      <path d="M12.4 5.9 5.6 12.7l-1.9 6.6 6.6-1.9 6.8-6.8" />
      <path d="M5.6 12.7 11.3 18.4" />
    </svg>
  );
}

function Lips(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5c2.6-3.6 4.6-4.6 6-3.4.9.8 1.9 1.4 3 1.4s2.1-.6 3-1.4c1.4-1.2 3.4-.2 6 3.4" />
      <path d="M3 11.5c1.9 3.7 5 5.6 9 5.6s7.1-1.9 9-5.6" />
      <path d="M3 11.5h18" />
    </svg>
  );
}

function Glass(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h16l-7 8v7" />
      <path d="M9 19h6" />
      <path d="M6.4 7.2h11.2" />
    </svg>
  );
}

function Stopwatch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      {/* A stopwatch rather than a heart: every listing site draws speed dating
          with a heart, and the thing that actually distinguishes it is the clock. */}
      <path d="M9.5 2.5h5" />
      <path d="M12 2.5v2.2" />
      <circle cx="12" cy="13.5" r="7.8" />
      <path d="M12 9.8v3.7l2.4 1.7" />
      <path d="m18.4 7.2 1.6-1.6" />
    </svg>
  );
}

function Gift(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="9" width="18" height="11.5" rx="2" />
      <path d="M3 13h18M12 9v11.5" />
      <path d="M12 9S10.5 4 8 4a2.2 2.2 0 0 0 0 5zM12 9s1.5-5 4-5a2.2 2.2 0 0 1 0 5z" />
    </svg>
  );
}

export const ACTIVITY_ICONS: Record<string, ComponentType<IconProps>> = {
  deck: Deck,
  camera: Camera,
  tattoo: Tattoo,
  lips: Lips,
  glass: Glass,
  stopwatch: Stopwatch,
  gift: Gift,
};
