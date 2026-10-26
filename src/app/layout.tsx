import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Three Body",
  description:
    "Place stars and planets, then watch gravity decide what happens. A real N-body simulator you can share.",
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
