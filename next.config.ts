import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The address printed on every event QR code. Not permanent (307), so
      // browsers don't cache it: point it somewhere new and the printed codes
      // follow.
      { source: "/qr", destination: "/interest", permanent: false },
    ];
  },
};

export default nextConfig;
