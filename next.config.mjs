/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide Next's dev route indicator so the full-screen editor looks like a product
  // in dev too (no effect on production, which never shows it).
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
