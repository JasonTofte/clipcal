type Props = {
  size?: number;
  showStatus?: boolean;
  className?: string;
  // Mark decorative when this avatar is already inside a labeled region
  // (e.g. an event-card speech bubble with role="note"). Screen readers
  // skip it rather than reading "Goldy Gopher image" mid-sentence.
  decorative?: boolean;
};

// Stylized UMN-style filled Block M. Rendered inline as SVG to avoid
// external image hops (CSP stays 'self', no Wikipedia dependency). The
// shape is a solid silhouette:
//   - Full-width top bar
//   - Deep inverted-V notch down the middle (inner peak at 70% depth)
//   - Thick outer legs (20% of width each)
//   - Flat bottom
// Not the official UMN mark — a simplified visual stand-in that reads
// as a Block M at avatar sizes (18px up to 128px).
const BLOCK_M_PATH = 'M 10 10 H 90 V 90 H 72 V 34 L 50 72 L 28 34 V 90 H 10 Z';

export function GoldyAvatar({
  size = 44,
  showStatus = false,
  className = '',
  decorative = false,
}: Props) {
  // Outer wrapper is positioned (for the status dot) but NOT overflow-
  // hidden, so the dot can sit on the edge without being clipped. Inner
  // shell owns overflow-hidden + border + bg so the SVG fills the frame.
  const svgInset = Math.max(2, Math.round(size * 0.08));
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Goldy Gopher'}
      aria-hidden={decorative || undefined}
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="relative block overflow-hidden rounded-xl border-2 bg-white shadow-md"
        style={{
          width: size,
          height: size,
          borderColor: 'var(--goldy-gold-400)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="var(--goldy-maroon-500)"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
          style={{ padding: svgInset }}
        >
          <path d={BLOCK_M_PATH} />
        </svg>
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
