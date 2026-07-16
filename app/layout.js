import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

// Nunito for body/UI text, Fraunces (a warm serif) for headings and the
// wordmark — both self-hosted at build time via next/font so they actually
// render for everyone with no external request.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  variable: "--font-heading",
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
    <html lang="en" className={`${nunito.variable} ${fraunces.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
