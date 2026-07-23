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
  // AUTH + ROUTING CONSOLIDATION — one coherent Nestudio app.
  //  • Canonical auth aliases so /login and /signup resolve to the single Nestudio auth screens.
  //  • Obsolete V1 public entry points (the old Bazaar landing + shop pages) redirect into
  //    Nestudio. NOTE: /village is intentionally NOT redirected — it is still linked from the
  //    current Home/Profile ("Visit the village") and is preserved for a future tab; its
  //    obsolescence needs consumer migration first (see AUTH_ROUTING_SPRINT.md).
  async redirects() {
    return [
      { source: "/login", destination: "/auth/login", permanent: false },
      { source: "/signup", destination: "/auth/sign-up", permanent: false },
      { source: "/sign-up", destination: "/auth/sign-up", permanent: false },
      { source: "/bazaar", destination: "/home", permanent: false },
      { source: "/bazaar/:path*", destination: "/home", permanent: false },
      { source: "/shop", destination: "/home", permanent: false },
      { source: "/shop/:path*", destination: "/home", permanent: false },
    ];
  },
};

export default nextConfig;
