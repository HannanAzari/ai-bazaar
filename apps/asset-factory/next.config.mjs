/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained internal tool. Images are arbitrary user-provided URLs in V1,
  // so the <img> tag is used directly (next/image is not required here).
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail an internal build on it.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
