import { Fragment } from 'react';

/**
 * A headline with one phrase set in the script face.
 *
 * The accent is a substring the operator names, not a guess. If it is absent
 * or does not occur in the headline, the whole thing renders plainly — a
 * heading with no flourish, never a heading with the flourish in the wrong
 * place or a heading that failed to render.
 */
export function Headline({
  text,
  accent,
  className,
}: {
  text: string;
  accent?: string;
  className?: string;
}) {
  const index = accent ? text.indexOf(accent) : -1;

  if (!accent || index === -1) {
    return <h1 className={className}>{text}</h1>;
  }

  return (
    <h1 className={className}>
      <Fragment>{text.slice(0, index)}</Fragment>
      <span className="accent gradient-text">{accent}</span>
      <Fragment>{text.slice(index + accent.length)}</Fragment>
    </h1>
  );
}
