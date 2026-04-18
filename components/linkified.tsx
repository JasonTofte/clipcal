import { Fragment } from 'react';
import { linkifySafe } from '@/lib/linkify';

// Render shim for Haiku-generated free text. Safety lives in linkifySafe;
// this component just maps the resulting segments. Wrapped in a Fragment
// so it inherits the parent element's typography (<p>, <span>, etc.).
export function Linkified({ text }: { text: string }) {
  const segments = linkifySafe(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline"
          >
            {seg.value}
          </a>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </>
  );
}
