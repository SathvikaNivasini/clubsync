import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "ClubSync — find a time that actually works",
    template: "%s · ClubSync",
  },
  description:
    "ClubSync collects club member availability anonymously, shows leaders when the most people are free, and keeps everyone in the loop when a meeting is scheduled.",
  applicationName: "ClubSync",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  openGraph: {
    title: "ClubSync",
    description:
      "Anonymous availability collection and meeting scheduling for school clubs.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#101319",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-[#06201c]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
