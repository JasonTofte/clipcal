import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical pulls in moment-timezone which Turbopack can't bundle cleanly
  // (BigInt usage in the runtime chunk). Keep it Node-resolved at runtime.
  serverExternalPackages: ['node-ical'],
};

export default nextConfig;
