type Props = {
  size?: number;
  showStatus?: boolean;
  className?: string;
  // Mark decorative when this avatar sits inside an already-labeled
  // region (e.g. an event-card speech bubble with role="note"). Screen
  // readers skip it rather than reading "Goldy Gopher image" mid-sentence.
  decorative?: boolean;
};

// Uses the real UMN Block M asset at /goldy-block-m.svg (self-hosted in
// /public). Two-tone maroon + gold, matches UMN brand identity. Falls
// back gracefully if the asset ever 404s (alt text + empty box).
export function GoldyAvatar({
  size = 44,
  showStatus = false,
  className = '',
  decorative = false,
}: Props) {
  // Outer wrapper is positioned (for the status dot) but NOT overflow-
  // hidden so the dot can sit on the edge without being clipped. Inner
  // shell owns the rounded corners, border, bg, and shadow so the SVG
  // reads as a badge.
  const svgInset = Math.max(4, Math.round(size * 0.12));
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Goldy Gopher'}
      aria-hidden={decorative || undefined}
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-xl border-2 bg-white shadow-md"
        style={{
          width: size,
          height: size,
          borderColor: 'var(--goldy-gold-400)',
          padding: svgInset,
        }}
      >
        {/* Plain <img> — next/image's intrinsic-dimension handling adds
            extra wrapper markup that can crush the asset at small sizes
            inside flex parents. A naked img at width/height 100% + object-
            contain is both simpler and more reliable here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/goldy-block-m.svg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </span>
      {showStatus && (
        <span
          aria-hidden
          className="absolute block rounded-full border-2"
          style={{
            bottom: -2,
            right: -2,
            width: Math.max(10, size * 0.25),
            height: Math.max(10, size * 0.25),
            background: 'rgb(52, 211, 153)',
            borderColor: 'var(--goldy-maroon-500)',
          }}
        />
      )}
    </span>
  );
}
