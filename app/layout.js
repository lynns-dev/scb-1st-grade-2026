import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Monotype Grotesque isn't freely licensable for web embedding, so most
// visitors would just see the fallback sans-serif anyway. Hanken Grotesk is
// a free, genuinely grotesque-style face with a similar neutral character —
// self-hosted at build time via next/font, and used for every bit of text
// in the app (headings included) — one sans-serif, no mixed typefaces.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "The Village",
  description: "Weekly reminders, calendar, and room chat for our classroom family.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Village",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f7eae",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={hankenGrotesk.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
