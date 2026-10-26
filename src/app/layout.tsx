import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

/**
 * Absolute URLs are needed for link previews, so the site's own address has
 * to be known at build time. Vercel supplies it in production; locally it
 * falls back to the dev server.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const description =
  "Place stars and planets, then watch gravity decide what happens. A real N-body simulator you can share.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Three Body",
  description,
  openGraph: {
    title: "Three Body",
    description,
    url: siteUrl,
    siteName: "Three Body",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Three Body",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05060a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body style={{ fontFamily: "var(--font-figtree), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
