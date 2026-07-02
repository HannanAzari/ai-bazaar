import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DemoProvider } from "@/components/providers/demo-provider";
import { SiteHeader } from "@/components/site-header";
import { DevModeBadge } from "@/components/dev-mode-badge";
import "./globals.css";

// Display face: storybook serif with high softness; UI face: rounded but adult.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  weight: "variable",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: "variable",
});

export const metadata: Metadata = {
  title: {
    default: "AI Bazaar",
    template: "%s | AI Bazaar",
  },
  description: "Choose a village, claim a little house, and build your own creative place.",
};

// M13 (Task 5): `viewport-fit=cover` makes iOS expose the safe-area insets the Nest editor
// pads against (notch / home indicator). `initialScale: 1` keeps the mobile layout honest;
// keyboard-zoom is prevented via ≥16px inputs (not by disabling user zoom — a11y).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2e4c4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunitoSans.variable}`}>
      <body>
        <AuthProvider>
          <DemoProvider>
            <SiteHeader />
            <main>{children}</main>
            <DevModeBadge />
          </DemoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
