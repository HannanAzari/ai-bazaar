/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // M15: creator identity lives at /@<username>. A literal `@` folder is reserved by
  // Next for parallel-route slots, so the page is served from /profile/<handle> and the
  // pretty URL is rewritten onto it (the address bar keeps /@handle).
  async rewrites() {
    return [{ source: "/@:handle", destination: "/profile/:handle" }];
  },
};

export default nextConfig;
