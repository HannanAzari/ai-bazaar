import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lantern Hollow palette — keep legacy names, retune values
        ink: "#38291d",
        "ink-soft": "#6b5847",
        parchment: "#faf1dc",
        "parchment-deep": "#e3cfa3",
        saffron: "#e8a23c",
        terracotta: "#a65b3f",
        teal: "#3d7068",
        rosewater: "#ecd9c8",
        // Scene materials
        meadow: "#93ac5f",
        "meadow-shade": "#6e8a47",
        plaster: "#f0dfbc",
        stone: "#c7b393",
        timber: "#8a5c3b",
        "timber-dark": "#5c3e26",
        lantern: "#ffc55c",
        ember: "#e08f3f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // font-black was 900 everywhere — the loud SaaS habit. Cap it at 700.
      fontWeight: {
        black: "700",
      },
      boxShadow: {
        soft: "0 6px 18px rgba(70, 54, 90, 0.14)",
        lift: "0 18px 50px rgba(70, 54, 90, 0.18)",
        glow: "0 0 14px 4px rgba(255, 197, 92, 0.5)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
