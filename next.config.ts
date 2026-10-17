import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The address printed on every event QR code. Not permanent (307), so
      // browsers don't cache it: point it somewhere new and the printed codes
      // follow.
      { source: "/qr", destination: "/interest", permanent: false },
      // Short public links resolve to the Arabic default, like "/".
      { source: "/pricing", destination: "/ar/pricing", permanent: true },
      { source: "/faq", destination: "/ar/faq", permanent: true },
      { source: "/how-it-works", destination: "/ar/how-it-works", permanent: true },
    ];
  },
};

export default nextConfig;
