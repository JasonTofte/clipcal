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
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Goldy Gopher'}
      aria-hidden={decorative || undefined}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-white shadow-md border-2 ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: 'var(--goldy-gold-400)',
      }}
    >
      <svg
        viewBox="0 0 32 40"
        width={size * 0.7}
        height={size * 0.7}
        fill="var(--goldy-maroon-500)"
        aria-hidden="true"
      >
        {/* Geometric block-letter "M" silhouette. Not the official UMN mark
            — a simplified visual stand-in for MVP. */}
        <path d="M2 2 H10 L16 18 L22 2 H30 V38 H23 V14 L18 28 H14 L9 14 V38 H2 Z" />
      </svg>
      {showStatus && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 block size-3 rounded-full border-2"
          style={{
            background: 'rgb(52, 211, 153)',
            borderColor: 'var(--goldy-maroon-500)',
          }}
        />
      )}
    </span>
  );
}
