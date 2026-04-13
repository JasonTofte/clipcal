import type { NextConfig } from "next";

// Tailwind injects inline styles at runtime; Next.js inlines tiny scripts for
// hydration. 'unsafe-inline' for style-src and script-src is the pragmatic
// starting CSP. Deploy as Report-Only first, tighten after a soak period.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://events.tc.umn.edu https://gopherlink.umn.edu",
  "connect-src 'self' https://events.tc.umn.edu https://gopherlink.umn.edu",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS = [
  // Start in Report-Only so we catch violations without blocking real traffic.
  // Flip to 'Content-Security-Policy' after a soak (search for CSP_ENFORCE).
  { key: 'Content-Security-Policy-Report-Only', value: CSP_DIRECTIVES },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  // node-ical pulls in moment-timezone which Turbopack can't bundle cleanly
  // (BigInt usage in the runtime chunk). Keep it Node-resolved at runtime.
  serverExternalPackages: ['node-ical'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
