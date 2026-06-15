import type { Metadata } from "next";
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
