import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Monotype Grotesque isn't freely licensable for web embedding, so most
// visitors would just see the fallback sans-serif anyway. Hanken Grotesk is
// a free, genuinely grotesque-style face with a similar neutral character —
// self-hosted at build time via next/font, so it actually renders for
// everyone with no external request.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "SCB 1st Grade 2026",
  description: "Weekly reminders, calendar, and room chat for our classroom family.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "1st Grade",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4a63f2",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={hankenGrotesk.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
