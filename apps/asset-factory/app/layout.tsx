import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nestudio Asset Factory",
  description: "Internal review & export tool for Nestudio assets.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
