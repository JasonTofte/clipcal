type Props = {
  size?: number;
  showStatus?: boolean;
  className?: string;
  // Mark decorative when this avatar is already inside a labeled region
  // (e.g. an event-card speech bubble with role="note"). Screen readers
  // skip it rather than reading "Goldy Gopher image" mid-sentence.
  decorative?: boolean;
};

// Stylized UMN-style block "M" mark. Rendered inline as SVG to avoid
// external image hops (CSP stays self-hosted, no Wikipedia dependency).
export function GoldyAvatar({
  size = 44,
  showStatus = false,
  className = '',
  decorative = false,
}: Props) {
  // Wrapper is positioned (for the status dot) but NOT overflow-hidden, so
  // the dot can sit on the edge without being clipped. The inner shell owns
  // overflow-hidden + background so the SVG "M" fills it cleanly.
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Goldy Gopher'}
      aria-hidden={decorative || undefined}
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="relative block overflow-hidden rounded-lg border-2 bg-white shadow-md"
        style={{
          width: size,
          height: size,
          borderColor: 'var(--goldy-gold-400)',
        }}
      >
        <svg
          viewBox="0 0 32 40"
          width={size}
          height={size}
          fill="var(--goldy-maroon-500)"
          aria-hidden="true"
          style={{ padding: size * 0.15 }}
        >
          {/* Geometric block-letter "M" silhouette. Not the official UMN mark
              — a simplified visual stand-in for MVP. */}
          <path d="M2 2 H10 L16 18 L22 2 H30 V38 H23 V14 L18 28 H14 L9 14 V38 H2 Z" />
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
